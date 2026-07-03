import Link from "next/link";
import { StatTile, ChartCard } from "@/components/StatTile";
import { DateRange, type Range } from "@/components/DateRange";
import { SpendChart } from "@/components/charts/SpendChart";
import { ModelBar } from "@/components/charts/ModelBar";
import { fmtUsd, fmtTokens, modelColor } from "@/lib/chartTheme";
import {
  dummySummary,
  dummySpendByDay,
  dummyCostByModel,
  dummyRecent,
} from "@/lib/data/dummy";

const RANGES: Range[] = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
];

export default async function DummyPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = RANGES.some((r) => r.days === Number(sp.days)) ? Number(sp.days) : 30;
  const rangeLabel = days === 365 ? "1 year" : `${days} days`;

  const summary = dummySummary(days);
  const spend = dummySpendByDay(days);
  const byModel = dummyCostByModel(days);
  const recent = dummyRecent(days);

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-indigo-500" />
            <span className="text-sm font-semibold text-white">Token Meter</span>
            <span className="ml-2 rounded bg-amber-950 px-1.5 py-0.5 text-[11px] font-medium text-amber-400">
              demo
            </span>
          </div>
          <Link href="/dashboard" className="text-sm text-neutral-300 hover:text-white">
            Go to dashboard →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">Overview (demo)</h1>
              <p className="mt-1 text-sm text-neutral-400">
                Simulated usage and cost, last {rangeLabel}.
              </p>
            </div>
            <DateRange current={days} basePath="/dummy" ranges={RANGES} />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Total spend" value={fmtUsd(summary.totalCost)} sub={rangeLabel} />
            <StatTile label="Tokens" value={fmtTokens(summary.totalTokens)} sub="all types" />
            <StatTile label="Requests" value={summary.requests.toLocaleString()} />
            <StatTile
              label="Cache hit ratio"
              value={`${(summary.cacheHitRatio * 100).toFixed(0)}%`}
              sub="cached input / total input"
            />
          </div>

          <ChartCard title="Spend over time" subtitle="Daily cost (USD)">
            <SpendChart data={spend} />
          </ChartCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Cost by model" subtitle="Spend per model in range">
              <ModelBar data={byModel} />
            </ChartCard>

            <ChartCard title="Recent requests" subtitle="Latest 20 proxied calls">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-neutral-500">
                    <tr className="border-b border-neutral-800">
                      <th className="py-2 pr-2 font-medium">Model</th>
                      <th className="py-2 pr-2 font-medium tabular-nums">In</th>
                      <th className="py-2 pr-2 font-medium tabular-nums">Out</th>
                      <th className="py-2 pr-2 font-medium tabular-nums">Cost</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-neutral-300">
                    {recent.map((r) => (
                      <tr key={r.id} className="border-b border-neutral-900">
                        <td className="py-2 pr-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: modelColor(r.model) }}
                            />
                            {r.model.replace("claude-", "")}
                          </span>
                        </td>
                        <td className="py-2 pr-2 tabular-nums">{r.inputTokens.toLocaleString()}</td>
                        <td className="py-2 pr-2 tabular-nums">{r.outputTokens.toLocaleString()}</td>
                        <td className="py-2 pr-2 tabular-nums">{fmtUsd(r.cost)}</td>
                        <td className="py-2">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ok: "bg-emerald-950 text-emerald-400",
    refusal: "bg-amber-950 text-amber-400",
    error: "bg-red-950 text-red-400",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] ${map[status] ?? "bg-neutral-800 text-neutral-400"}`}
    >
      {status}
    </span>
  );
}
