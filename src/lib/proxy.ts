import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { proxyKeys, providerKeys, usageEvents } from "@/db/schema";
import { decryptSecret, hashProxyKey } from "@/lib/crypto";
import { getPricing, computeCost, normalizeModel, type NormalizedUsage } from "@/lib/pricing";

export type ProxyAuth = {
  proxyKeyId: string;
  orgId: string;
  provider: string;
  upstreamKey: string;
};

/** Read the proxy key from x-api-key or Authorization: Bearer. */
export function readProxyKey(req: Request): string {
  const xApiKey = req.headers.get("x-api-key");
  if (xApiKey) return xApiKey;
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

/** Clone client headers, strip hop-by-hop/auth, and set the real upstream key. */
export function buildUpstreamHeaders(req: Request, upstreamKey: string): Headers {
  const h = new Headers(req.headers);
  for (const drop of ["host", "connection", "content-length", "authorization", "accept-encoding"]) {
    h.delete(drop);
  }
  h.set("x-api-key", upstreamKey);
  if (!h.has("anthropic-version")) h.set("anthropic-version", "2023-06-01");
  return h;
}

/** Copy upstream response headers, dropping ones that don't survive re-streaming. */
export function passthroughResponseHeaders(upstream: Response): Headers {
  const h = new Headers(upstream.headers);
  for (const drop of ["content-encoding", "content-length", "transfer-encoding", "connection"]) {
    h.delete(drop);
  }
  return h;
}

/** Resolve an issued proxy key to its org + decrypted upstream provider key. */
export async function authenticateProxyKey(rawKey: string): Promise<ProxyAuth | null> {
  if (!rawKey) return null;
  const hash = hashProxyKey(rawKey);

  const [row] = await db
    .select({
      proxyKeyId: proxyKeys.id,
      orgId: proxyKeys.orgId,
      provider: providerKeys.provider,
      iv: providerKeys.iv,
      ciphertext: providerKeys.ciphertext,
      providerRevoked: providerKeys.revokedAt,
    })
    .from(proxyKeys)
    .innerJoin(providerKeys, eq(proxyKeys.providerKeyId, providerKeys.id))
    .where(and(eq(proxyKeys.hash, hash), isNull(proxyKeys.revokedAt)))
    .limit(1);

  if (!row || row.providerRevoked) return null;

  return {
    proxyKeyId: row.proxyKeyId,
    orgId: row.orgId,
    provider: row.provider,
    upstreamKey: decryptSecret(row.iv, row.ciphertext),
  };
}

export type RecordUsageInput = {
  orgId: string;
  proxyKeyId: string;
  provider: string;
  model: string;
  usage: NormalizedUsage;
  status: "ok" | "error" | "refusal";
  stopReason?: string | null;
  latencyMs: number;
  requestId?: string | null;
};

/** Price and persist one proxied request. Never throws to the hot path — logs instead. */
export async function recordUsage(input: RecordUsageInput): Promise<void> {
  try {
    // Group and price by the model alias (dated snapshot ids collapse to it).
    const model = normalizeModel(input.model);
    const pricing = await getPricing(input.provider, model);
    const { cost, version } = computeCost(input.usage, pricing);

    await db.insert(usageEvents).values({
      orgId: input.orgId,
      proxyKeyId: input.proxyKeyId,
      provider: input.provider,
      model,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      cacheCreationInputTokens: input.usage.cacheCreationInputTokens,
      cacheReadInputTokens: input.usage.cacheReadInputTokens,
      costUsd: cost.toFixed(10),
      pricingVersion: version,
      status: input.status,
      stopReason: input.stopReason ?? null,
      latencyMs: input.latencyMs,
      requestId: input.requestId ?? null,
    });
  } catch (e) {
    // A metrics failure must never break the user's LLM call.
    console.error("[usage] failed to record event:", e);
  }
}

const EMPTY_USAGE: NormalizedUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

/** Pull normalized usage out of an Anthropic non-streaming response body. */
export function usageFromBody(body: unknown): NormalizedUsage {
  const u = (body as { usage?: Record<string, number> })?.usage;
  if (!u) return { ...EMPTY_USAGE };
  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheCreationInputTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: u.cache_read_input_tokens ?? 0,
  };
}

/**
 * Parse a full SSE transcript from a streamed Anthropic response and extract
 * final usage + stop_reason + model. message_start carries input/cache tokens;
 * message_delta carries the (cumulative) output_tokens and stop_reason.
 */
export function usageFromSSE(sse: string): {
  usage: NormalizedUsage;
  model: string | null;
  stopReason: string | null;
} {
  const usage: NormalizedUsage = { ...EMPTY_USAGE };
  let model: string | null = null;
  let stopReason: string | null = null;

  for (const block of sse.split("\n\n")) {
    const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) continue;
    const json = dataLine.slice("data:".length).trim();
    if (!json || json === "[DONE]") continue;
    let evt: any;
    try {
      evt = JSON.parse(json);
    } catch {
      continue;
    }
    if (evt.type === "message_start" && evt.message) {
      model = evt.message.model ?? model;
      const u = evt.message.usage ?? {};
      usage.inputTokens = u.input_tokens ?? usage.inputTokens;
      usage.cacheCreationInputTokens = u.cache_creation_input_tokens ?? usage.cacheCreationInputTokens;
      usage.cacheReadInputTokens = u.cache_read_input_tokens ?? usage.cacheReadInputTokens;
      if (typeof u.output_tokens === "number") usage.outputTokens = u.output_tokens;
    } else if (evt.type === "message_delta") {
      if (evt.usage?.output_tokens != null) usage.outputTokens = evt.usage.output_tokens;
      if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
    }
  }
  return { usage, model, stopReason };
}
