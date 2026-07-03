import { loadEnv } from "@/lib/env";
loadEnv();

import { db } from "@/db";
import { modelPricing } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Current Anthropic pricing (USD per 1M tokens). Bump `version` when prices change.
const PRICING_VERSION = 1;

const ANTHROPIC_PRICES: Array<{
  model: string;
  input: number;
  output: number;
}> = [
  { model: "claude-opus-4-8", input: 5.0, output: 25.0 },
  { model: "claude-opus-4-7", input: 5.0, output: 25.0 },
  { model: "claude-opus-4-6", input: 5.0, output: 25.0 },
  { model: "claude-sonnet-5", input: 3.0, output: 15.0 },
  { model: "claude-sonnet-4-6", input: 3.0, output: 15.0 },
  { model: "claude-haiku-4-5", input: 1.0, output: 5.0 },
  { model: "claude-fable-5", input: 10.0, output: 50.0 },
];

async function main() {
  for (const p of ANTHROPIC_PRICES) {
    const existing = await db
      .select()
      .from(modelPricing)
      .where(
        and(
          eq(modelPricing.provider, "anthropic"),
          eq(modelPricing.model, p.model),
          eq(modelPricing.version, PRICING_VERSION),
        ),
      )
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
      cacheWriteMult: "1.25",
      cacheReadMult: "0.1",
      version: PRICING_VERSION,
    });
    console.log(`+ seeded  anthropic/${p.model} v${PRICING_VERSION} ($${p.input}/$${p.output})`);
  }
  console.log("Pricing seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
