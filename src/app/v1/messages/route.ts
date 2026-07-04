import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  authenticateProxyKey,
  recordUsage,
  usageFromBody,
  usageFromSSE,
  readProxyKey,
  buildUpstreamHeaders,
  passthroughResponseHeaders,
  sanitizeModelInBody,
} from "@/lib/proxy";
import type { NormalizedUsage } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_USAGE: NormalizedUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheCreation5mInputTokens: 0,
  cacheCreation1hInputTokens: 0,
  cacheReadInputTokens: 0,
};

export async function POST(req: Request) {
  const startedAt = Date.now();

  // 1. Authenticate the proxy key → decrypt the real upstream key.
  const rawKey = readProxyKey(req);
  const auth = await authenticateProxyKey(rawKey);
  if (!auth) {
    return NextResponse.json(
      { type: "error", error: { type: "authentication_error", message: "Invalid proxy key" } },
      { status: 401 },
    );
  }

  // 2. Read the request body once; extract model + stream flag.
  //    Strip any client context-window suffix ("[1m]") the upstream won't accept.
  const rawBody = await req.text();
  const { bodyText, model: requestedModel } = sanitizeModelInBody(rawBody);
  let isStream = false;
  try {
    isStream = (JSON.parse(rawBody) as { stream?: boolean }).stream === true;
  } catch {
    /* forward as-is; upstream will validate */
  }

  // 3. Forward to the upstream provider with the real key.
  const upstreamHeaders = buildUpstreamHeaders(req, auth.upstreamKey);
  const search = new URL(req.url).search;

  let upstream: Response;
  try {
    upstream = await fetch(`${env.anthropicBaseUrl}/v1/messages${search}`, {
      method: "POST",
      headers: upstreamHeaders,
      body: bodyText,
    });
  } catch (e) {
    void recordUsage({
      orgId: auth.orgId,
      proxyKeyId: auth.proxyKeyId,
      provider: auth.provider,
      model: requestedModel,
      usage: { ...EMPTY_USAGE },
      status: "error",
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { type: "error", error: { type: "api_error", message: "Upstream request failed" } },
      { status: 502 },
    );
  }

  const requestId =
    upstream.headers.get("request-id") ?? upstream.headers.get("anthropic-request-id");

  // 4a. Streaming: tee the body — client gets one branch, we parse the other.
  if (isStream && upstream.body) {
    const [clientStream, parseStream] = upstream.body.tee();

    // Consume the parse branch concurrently (detached — never blocks the client).
    void (async () => {
      const reader = parseStream.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
        }
      } catch {
        /* ignore parse-side stream errors */
      }
      const { usage, model, stopReason } = usageFromSSE(buf);
      await recordUsage({
        orgId: auth.orgId,
        proxyKeyId: auth.proxyKeyId,
        provider: auth.provider,
        model: model ?? requestedModel,
        usage,
        status: stopReason === "refusal" ? "refusal" : upstream.ok ? "ok" : "error",
        stopReason,
        latencyMs: Date.now() - startedAt,
        requestId,
      });
    })();

    const headers = passthroughResponseHeaders(upstream);
    if (!headers.has("content-type")) headers.set("content-type", "text/event-stream");
    headers.set("cache-control", "no-cache");
    return new Response(clientStream, { status: upstream.status, headers });
  }

  // 4b. Non-streaming: read, forward, capture usage from the body.
  const respText = await upstream.text();
  let respJson: any = null;
  try {
    respJson = JSON.parse(respText);
  } catch {
    /* non-JSON error body */
  }

  const usage = respJson ? usageFromBody(respJson) : { ...EMPTY_USAGE };
  const model = respJson?.model ?? requestedModel;
  const stopReason = respJson?.stop_reason ?? null;
  const status: "ok" | "error" | "refusal" = !upstream.ok
    ? "error"
    : stopReason === "refusal"
      ? "refusal"
      : "ok";

  void recordUsage({
    orgId: auth.orgId,
    proxyKeyId: auth.proxyKeyId,
    provider: auth.provider,
    model,
    usage,
    status,
    stopReason,
    latencyMs: Date.now() - startedAt,
    requestId,
  });

  const headers = passthroughResponseHeaders(upstream);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return new Response(respText, { status: upstream.status, headers });
}
