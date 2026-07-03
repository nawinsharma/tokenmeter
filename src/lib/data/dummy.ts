// Deterministic fake usage for the /dummy showcase route.
// Generates a full year of daily-per-model events (seeded, stable across renders),
// then aggregates the trailing N days into the same shapes the real dashboard uses.
import type { DayPoint, ModelPoint, Summary, RecentRequest } from "./usage";

const CACHE_WRITE_MULT = 1.25;
const CACHE_READ_MULT = 0.1;

// Pricing per 1M tokens (mirrors the seeded model_pricing table).
const MODELS = [
  { model: "claude-opus-4-8", inPrice: 5, outPrice: 25, weight: 0.22 },
  { model: "claude-sonnet-5", inPrice: 3, outPrice: 15, weight: 0.4 },
  { model: "claude-haiku-4-5", inPrice: 1, outPrice: 5, weight: 0.3 },
  { model: "claude-fable-5", inPrice: 10, outPrice: 50, weight: 0.08 },
];

// Seeded PRNG so the generated year is identical on every render/request.
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayKey(daysAgo: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

type DayModel = {
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreate: number;
  cacheRead: number;
  cost: number;
};
type FullDay = { day: string; daysAgo: number; models: DayModel[] };

function buildYear(): FullDay[] {
  const rng = mulberry32(1337);
  const days: FullDay[] = [];
  for (let daysAgo = 364; daysAgo >= 0; daysAgo--) {
    const day = dayKey(daysAgo);
    const dow = new Date(day + "T00:00:00Z").getUTCDay(); // 0 Sun .. 6 Sat
    const weekend = dow === 0 || dow === 6;
    const progress = (364 - daysAgo) / 364; // 0 oldest .. 1 newest
    const trend = 0.6 + progress * 0.9; // volume grows ~1.5x over the year
    const seasonal = weekend ? 0.55 : 1; // quieter on weekends

    const models: DayModel[] = MODELS.map((m) => {
      const noise = 0.7 + rng() * 0.6;
      const requests = Math.max(0, Math.round(120 * m.weight * trend * seasonal * noise));
      const avgIn = 800 + rng() * 2500;
      const avgOut = 300 + rng() * 1200;
      const inputTokens = Math.round(requests * avgIn);
      const outputTokens = Math.round(requests * avgOut);
      const cacheRead = Math.round(inputTokens * (0.3 + rng() * 0.4));
      const cacheCreate = Math.round(inputTokens * (0.05 + rng() * 0.1));
      const cost =
        (inputTokens * m.inPrice) / 1e6 +
        (outputTokens * m.outPrice) / 1e6 +
        (cacheCreate * m.inPrice * CACHE_WRITE_MULT) / 1e6 +
        (cacheRead * m.inPrice * CACHE_READ_MULT) / 1e6;
      return { model: m.model, requests, inputTokens, outputTokens, cacheCreate, cacheRead, cost };
    });
    days.push({ day, daysAgo, models });
  }
  return days;
}

// Built once per server process.
const YEAR: FullDay[] = buildYear();

function windowDays(days: number): FullDay[] {
  return YEAR.filter((d) => d.daysAgo < days);
}

export function dummySummary(days: number): Summary {
  let totalCost = 0,
    totalTokens = 0,
    requests = 0,
    input = 0,
    cacheRead = 0;
  for (const d of windowDays(days)) {
    for (const m of d.models) {
      totalCost += m.cost;
      totalTokens += m.inputTokens + m.outputTokens + m.cacheRead + m.cacheCreate;
      requests += m.requests;
      input += m.inputTokens;
      cacheRead += m.cacheRead;
    }
  }
  const denom = input + cacheRead;
  return {
    totalCost,
    totalTokens,
    requests,
    inputTokens: input,
    cacheReadTokens: cacheRead,
    cacheHitRatio: denom > 0 ? cacheRead / denom : 0,
  };
}

export function dummySpendByDay(days: number): DayPoint[] {
  return windowDays(days).map((d) => {
    let cost = 0,
      tokens = 0,
      requests = 0;
    for (const m of d.models) {
      cost += m.cost;
      tokens += m.inputTokens + m.outputTokens + m.cacheRead + m.cacheCreate;
      requests += m.requests;
    }
    return { day: d.day, cost, tokens, requests };
  });
}

export function dummyCostByModel(days: number): ModelPoint[] {
  const acc = new Map<string, ModelPoint>();
  for (const d of windowDays(days)) {
    for (const m of d.models) {
      const e = acc.get(m.model) ?? { model: m.model, cost: 0, tokens: 0, requests: 0 };
      e.cost += m.cost;
      e.tokens += m.inputTokens + m.outputTokens + m.cacheRead + m.cacheCreate;
      e.requests += m.requests;
      acc.set(m.model, e);
    }
  }
  return [...acc.values()].sort((a, b) => b.cost - a.cost);
}

export function dummyRecent(days: number, limit = 20): RecentRequest[] {
  const rng = mulberry32(99);
  const now = Date.now();
  const statuses = ["ok", "ok", "ok", "ok", "ok", "ok", "refusal", "error"];
  const spanMs = Math.min(days, 3) * 24 * 3600 * 1000; // recent rows land in the last few days
  const rows: RecentRequest[] = Array.from({ length: limit }, (_, i) => {
    const m = MODELS[Math.floor(rng() * MODELS.length)];
    const inputTokens = Math.round(500 + rng() * 6000);
    const outputTokens = Math.round(200 + rng() * 3000);
    const cost = (inputTokens * m.inPrice) / 1e6 + (outputTokens * m.outPrice) / 1e6;
    return {
      id: `dummy-${i}`,
      model: m.model,
      inputTokens,
      outputTokens,
      cost,
      status: statuses[Math.floor(rng() * statuses.length)],
      latencyMs: Math.round(400 + rng() * 4000),
      createdAt: new Date(now - rng() * spanMs),
    };
  });
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
