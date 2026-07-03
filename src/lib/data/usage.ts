import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

function sinceDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export type Summary = {
  totalCost: number;
  totalTokens: number;
  requests: number;
  inputTokens: number;
  cacheReadTokens: number;
  cacheHitRatio: number; // cacheRead / (input + cacheRead)
};

export async function getSummary(orgId: string, days: number): Promise<Summary> {
  const since = sinceDate(days);
  const { rows } = await db.execute<{
    total_cost: string | null;
    total_tokens: string | null;
    requests: string | null;
    input_tokens: string | null;
    cache_read_tokens: string | null;
  }>(sql`
    select
      coalesce(sum(cost_usd), 0) as total_cost,
      coalesce(sum(input_tokens + output_tokens + cache_read_input_tokens + cache_creation_input_tokens), 0) as total_tokens,
      count(*) as requests,
      coalesce(sum(input_tokens), 0) as input_tokens,
      coalesce(sum(cache_read_input_tokens), 0) as cache_read_tokens
    from usage_events
    where org_id = ${orgId} and created_at >= ${since}
  `);
  const r = rows[0];
  const input = Number(r?.input_tokens ?? 0);
  const cacheRead = Number(r?.cache_read_tokens ?? 0);
  const denom = input + cacheRead;
  return {
    totalCost: Number(r?.total_cost ?? 0),
    totalTokens: Number(r?.total_tokens ?? 0),
    requests: Number(r?.requests ?? 0),
    inputTokens: input,
    cacheReadTokens: cacheRead,
    cacheHitRatio: denom > 0 ? cacheRead / denom : 0,
  };
}

export type DayPoint = { day: string; cost: number; tokens: number; requests: number };

export async function getSpendByDay(orgId: string, days: number): Promise<DayPoint[]> {
  const since = sinceDate(days);
  const { rows } = await db.execute<{
    day: string;
    cost: string;
    tokens: string;
    requests: string;
  }>(sql`
    select
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
      coalesce(sum(cost_usd), 0) as cost,
      coalesce(sum(input_tokens + output_tokens + cache_read_input_tokens + cache_creation_input_tokens), 0) as tokens,
      count(*) as requests
    from usage_events
    where org_id = ${orgId} and created_at >= ${since}
    group by 1
    order by 1
  `);
  return rows.map((r) => ({
    day: r.day,
    cost: Number(r.cost),
    tokens: Number(r.tokens),
    requests: Number(r.requests),
  }));
}

export type ModelPoint = { model: string; cost: number; tokens: number; requests: number };

export async function getCostByModel(orgId: string, days: number): Promise<ModelPoint[]> {
  const since = sinceDate(days);
  const { rows } = await db.execute<{
    model: string;
    cost: string;
    tokens: string;
    requests: string;
  }>(sql`
    select
      model,
      coalesce(sum(cost_usd), 0) as cost,
      coalesce(sum(input_tokens + output_tokens + cache_read_input_tokens + cache_creation_input_tokens), 0) as tokens,
      count(*) as requests
    from usage_events
    where org_id = ${orgId} and created_at >= ${since}
    group by 1
    order by sum(cost_usd) desc
  `);
  return rows.map((r) => ({
    model: r.model,
    cost: Number(r.cost),
    tokens: Number(r.tokens),
    requests: Number(r.requests),
  }));
}

export type RecentRequest = {
  id: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  status: string;
  latencyMs: number | null;
  createdAt: Date;
};

export async function getRecentRequests(
  orgId: string,
  days: number,
  limit = 20,
): Promise<RecentRequest[]> {
  const since = sinceDate(days);
  const { rows } = await db.execute<{
    id: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: string;
    status: string;
    latency_ms: number | null;
    created_at: string;
  }>(sql`
    select id, model, input_tokens, output_tokens, cost_usd, status, latency_ms, created_at
    from usage_events
    where org_id = ${orgId} and created_at >= ${since}
    order by created_at desc
    limit ${limit}
  `);
  return rows.map((r) => ({
    id: r.id,
    model: r.model,
    inputTokens: Number(r.input_tokens),
    outputTokens: Number(r.output_tokens),
    cost: Number(r.cost_usd),
    status: r.status,
    latencyMs: r.latency_ms,
    createdAt: new Date(r.created_at),
  }));
}
