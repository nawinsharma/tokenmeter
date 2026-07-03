import { db } from "@/db";
import { modelPricing } from "@/db/schema";
import { and, eq, lte, desc } from "drizzle-orm";

export type NormalizedUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
};

export type PricingRow = {
  version: number;
  inputPerMtok: number;
  outputPerMtok: number;
  cacheWriteMult: number;
  cacheReadMult: number;
};

// Small in-memory cache so the hot path doesn't hit the DB every request.
const cache = new Map<string, { row: PricingRow | null; at: number }>();
const TTL_MS = 60_000;

/**
 * Anthropic returns dated snapshot ids in responses (e.g. claude-haiku-4-5-20251001)
 * while pricing is keyed on the alias (claude-haiku-4-5). Strip a trailing -YYYYMMDD
 * and any provider prefix (Bedrock's `anthropic.`) so pricing still resolves.
 */
export function normalizeModel(model: string): string {
  return model.replace(/^anthropic\./, "").replace(/-\d{8}$/, "");
}

export async function getPricing(
  provider: string,
  model: string,
): Promise<PricingRow | null> {
  const key = `${provider}:${model}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.row;

  // Try the exact model first, then the normalized alias.
  const candidates = [model];
  const norm = normalizeModel(model);
  if (norm !== model) candidates.push(norm);

  let r: typeof modelPricing.$inferSelect | undefined;
  for (const candidate of candidates) {
    const rows = await db
      .select()
      .from(modelPricing)
      .where(
        and(
          eq(modelPricing.provider, provider),
          eq(modelPricing.model, candidate),
          lte(modelPricing.effectiveFrom, new Date()),
        ),
      )
      .orderBy(desc(modelPricing.effectiveFrom))
      .limit(1);
    if (rows[0]) {
      r = rows[0];
      break;
    }
  }

  const row: PricingRow | null = r
    ? {
        version: r.version,
        inputPerMtok: Number(r.inputPerMtok),
        outputPerMtok: Number(r.outputPerMtok),
        cacheWriteMult: Number(r.cacheWriteMult),
        cacheReadMult: Number(r.cacheReadMult),
      }
    : null;

  cache.set(key, { row, at: Date.now() });
  return row;
}

/** Compute USD cost for a request. Returns { cost, version } — version null if unpriced. */
export function computeCost(
  usage: NormalizedUsage,
  pricing: PricingRow | null,
): { cost: number; version: number | null } {
  if (!pricing) return { cost: 0, version: null };
  const cost =
    (usage.inputTokens * pricing.inputPerMtok) / 1e6 +
    (usage.outputTokens * pricing.outputPerMtok) / 1e6 +
    (usage.cacheCreationInputTokens * pricing.inputPerMtok * pricing.cacheWriteMult) / 1e6 +
    (usage.cacheReadInputTokens * pricing.inputPerMtok * pricing.cacheReadMult) / 1e6;
  return { cost, version: pricing.version };
}
