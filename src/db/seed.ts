import { loadEnv } from "@/lib/env";
loadEnv();

import { db } from "@/db";
import { modelPricing } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Current Anthropic pricing (USD per 1M tokens). Bump `version` when prices change.
// v2: added 1h cache-write multiplier + Sonnet 5 introductory pricing.
const PRICING_VERSION = 2;

// Cache multipliers (× input price) are uniform across Anthropic models today:
//   5-minute-TTL write = 1.25×, 1-hour-TTL write = 2×, cache read = 0.1×.
const CACHE_5M = "1.25";
const CACHE_1H = "2.0";
const CACHE_READ = "0.1";

type Price = {
  model: string;
  input: number;
  output: number;
  // Optional effective window. Rows are looked up by the greatest effectiveFrom
  // that is <= now, so a future-dated row auto-supersedes the current one.
  effectiveFrom?: Date;
};

const ANTHROPIC_PRICES: Price[] = [
  { model: "claude-opus-4-8", input: 5.0, output: 25.0 },
  { model: "claude-opus-4-7", input: 5.0, output: 25.0 },
  { model: "claude-opus-4-6", input: 5.0, output: 25.0 },
  // Sonnet 5: $2/$10 introductory through 2026-08-31, then $3/$15 standard.
  { model: "claude-sonnet-5", input: 2.0, output: 10.0, effectiveFrom: new Date("2026-01-01T00:00:00Z") },
  { model: "claude-sonnet-5", input: 3.0, output: 15.0, effectiveFrom: new Date("2026-09-01T00:00:00Z") },
  { model: "claude-sonnet-4-6", input: 3.0, output: 15.0 },
  { model: "claude-haiku-4-5", input: 1.0, output: 5.0 },
  { model: "claude-fable-5", input: 10.0, output: 50.0 },
];

async function main() {
  for (const p of ANTHROPIC_PRICES) {
    // Dedupe on (provider, model, version, effectiveFrom) so multiple dated rows
    // for the same model can coexist while the seed stays idempotent.
    const conds = [
      eq(modelPricing.provider, "anthropic"),
      eq(modelPricing.model, p.model),
      eq(modelPricing.version, PRICING_VERSION),
    ];
    if (p.effectiveFrom) conds.push(eq(modelPricing.effectiveFrom, p.effectiveFrom));

    const existing = await db
      .select()
      .from(modelPricing)
      .where(and(...conds))
      .limit(1);

    if (existing.length > 0) {
      console.log(`= exists  anthropic/${p.model} v${PRICING_VERSION}`);
      continue;
    }

    await db.insert(modelPricing).values({
      provider: "anthropic",
      model: p.model,
      inputPerMtok: p.input.toFixed(4),
      outputPerMtok: p.output.toFixed(4),
      cacheWriteMult: CACHE_5M,
      cacheWrite1hMult: CACHE_1H,
      cacheReadMult: CACHE_READ,
      version: PRICING_VERSION,
      ...(p.effectiveFrom ? { effectiveFrom: p.effectiveFrom } : {}),
    });
    const when = p.effectiveFrom ? ` from ${p.effectiveFrom.toISOString().slice(0, 10)}` : "";
    console.log(`+ seeded  anthropic/${p.model} v${PRICING_VERSION} ($${p.input}/$${p.output})${when}`);
  }
  console.log("Pricing seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
