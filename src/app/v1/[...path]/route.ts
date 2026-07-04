import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  authenticateProxyKey,
  readProxyKey,
  buildUpstreamHeaders,
  passthroughResponseHeaders,
  sanitizeModelInBody,
} from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Transparent passthrough for every /v1/* path EXCEPT the exact /v1/messages
async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;

  const auth = await authenticateProxyKey(readProxyKey(req));
  if (!auth) {
    return NextResponse.json(
      { type: "error", error: { type: "authentication_error", message: "Invalid proxy key" } },
      { status: 401 },
    );
  }

  const upstreamPath = "/v1/" + path.map(encodeURIComponent).join("/");
  const search = new URL(req.url).search;
  const method = req.method.toUpperCase();

  const hasBody = method !== "GET" && method !== "HEAD";
  let bodyBuf = hasBody ? Buffer.from(await req.arrayBuffer()) : undefined;

  // For JSON payloads (e.g. /v1/messages/count_tokens), strip any client
  // context-window suffix ("[1m]") from the model the upstream won't accept.
  if (bodyBuf?.length && (req.headers.get("content-type") ?? "").includes("json")) {
    const { bodyText } = sanitizeModelInBody(bodyBuf.toString("utf8"));
    bodyBuf = Buffer.from(bodyText, "utf8");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${env.anthropicBaseUrl}${upstreamPath}${search}`, {
      method,
      headers: buildUpstreamHeaders(req, auth.upstreamKey),
      body: bodyBuf && bodyBuf.length > 0 ? bodyBuf : undefined,
    });
  } catch {
    return NextResponse.json(
      { type: "error", error: { type: "api_error", message: "Upstream request failed" } },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: passthroughResponseHeaders(upstream),
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
