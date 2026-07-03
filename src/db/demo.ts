import { loadEnv } from "@/lib/env";
loadEnv();

import { db } from "@/db";
import { organizations, proxyKeys, usageEvents } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getPricing, computeCost } from "@/lib/pricing";

const MODELS = [
  { model: "claude-opus-4-8", weight: 3 },
  { model: "claude-sonnet-5", weight: 5 },
  { model: "claude-haiku-4-5", weight: 4 },
  { model: "claude-fable-5", weight: 1 },
];

function pickModel(): string {
  const total = MODELS.reduce((s, m) => s + m.weight, 0);
  let r = Math.random() * total;
  for (const m of MODELS) {
    if ((r -= m.weight) <= 0) return m.model;
  }
  return MODELS[0].model;
}

const rand = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));

async function main() {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .orderBy(desc(organizations.createdAt))
    .limit(1);
  if (!org) {
    console.error("No org found. Sign up first.");
    process.exit(1);
  }
  const [pk] = await db
    .select({ id: proxyKeys.id })
    .from(proxyKeys)
    .where(eq(proxyKeys.orgId, org.id))
    .limit(1);

  const N = 320;
  const DAYS = 30;
  let inserted = 0;

  for (let i = 0; i < N; i++) {
    const model = pickModel();
    const inputTokens = rand(200, 6000);
    const outputTokens = rand(80, 2500);
    const cacheReadInputTokens = Math.random() < 0.5 ? rand(500, 8000) : 0;
    const cacheCreationInputTokens = Math.random() < 0.2 ? rand(200, 3000) : 0;

    const pricing = await getPricing("anthropic", model);
    const { cost, version } = computeCost(
      { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens },
      pricing,
    );

    // Skew recent days a little heavier for a realistic upward trend.
    const dayOffset = Math.floor(Math.pow(Math.random(), 1.4) * DAYS);
    const createdAt = new Date(
      Date.now() - dayOffset * 86400_000 - rand(0, 86400) * 1000,
    );

    const roll = Math.random();
    const status = roll < 0.03 ? "error" : roll < 0.06 ? "refusal" : "ok";

    await db.insert(usageEvents).values({
      orgId: org.id,
      proxyKeyId: pk?.id ?? null,
      provider: "anthropic",
      model,
      inputTokens,
      outputTokens,
      cacheCreationInputTokens,
      cacheReadInputTokens,
      costUsd: cost.toFixed(10),
      pricingVersion: version,
      status,
      stopReason: status === "refusal" ? "refusal" : status === "ok" ? "end_turn" : null,
      latencyMs: rand(300, 8000),
      requestId: `req_demo_${i}`,
      createdAt,
    });
    inserted++;
  }

  console.log(`Seeded ${inserted} demo usage events for org ${org.id}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
