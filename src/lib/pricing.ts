import { db } from "@/db";
import { modelPricing } from "@/db/schema";
import { and, eq, lte, desc } from "drizzle-orm";

export type NormalizedUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  // Cache creation split by TTL. When the upstream doesn't break it down, all of
  // cacheCreationInputTokens is treated as 5m (Claude Code's default).
  cacheCreation5mInputTokens: number;
  cacheCreation1hInputTokens: number;
  cacheReadInputTokens: number;
};

export type PricingRow = {
  version: number;
  inputPerMtok: number;
  outputPerMtok: number;
  cacheWriteMult: number; // 5-minute TTL
  cacheWrite1hMult: number; // 1-hour TTL
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
  return model
    .replace(/^anthropic\./, "")
    .replace(/\[[^\]]*\]$/, "") // strip client context-window suffix, e.g. "[1m]"
    .replace(/-\d{8}$/, "");
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
        cacheWrite1hMult: Number(r.cacheWrite1hMult),
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

  // Split cache-creation tokens by TTL. If the upstream didn't break it down
  // (both splits zero but a total is present), price the whole total at the 5m
  // rate — Claude Code's default and the cheaper, conservative assumption.
  const split1h = usage.cacheCreation1hInputTokens;
  const split5m =
    usage.cacheCreation5mInputTokens > 0 || split1h > 0
      ? usage.cacheCreation5mInputTokens
      : usage.cacheCreationInputTokens;

  const cost =
    (usage.inputTokens * pricing.inputPerMtok) / 1e6 +
    (usage.outputTokens * pricing.outputPerMtok) / 1e6 +
    (split5m * pricing.inputPerMtok * pricing.cacheWriteMult) / 1e6 +
    (split1h * pricing.inputPerMtok * pricing.cacheWrite1hMult) / 1e6 +
    (usage.cacheReadInputTokens * pricing.inputPerMtok * pricing.cacheReadMult) / 1e6;
  return { cost, version: pricing.version };
}
