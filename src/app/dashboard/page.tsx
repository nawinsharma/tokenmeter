import { requireSession } from "@/lib/session";
import {
  getSummary,
  getSpendByDay,
  getCostByModel,
  getRecentRequests,
} from "@/lib/data/usage";
import { StatTile, ChartCard } from "@/components/StatTile";
import { DateRange } from "@/components/DateRange";
import { SpendChart } from "@/components/charts/SpendChart";
import { ModelBar } from "@/components/charts/ModelBar";
import { fmtUsd, fmtTokens, modelColor } from "@/lib/chartTheme";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;

  const [summary, spend, byModel, recent] = await Promise.all([
    getSummary(session.orgId, days),
    getSpendByDay(session.orgId, days),
    getCostByModel(session.orgId, days),
    getRecentRequests(session.orgId, days),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Overview</h1>
          <p className="mt-1 text-sm text-neutral-400">Usage and cost, last {days} days.</p>
        </div>
        <DateRange current={days} />
      </div>

      {summary.requests === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-8 text-center">
          <p className="text-sm text-neutral-300">No usage yet in this window.</p>
          <p className="mt-1 text-sm text-neutral-500">
            Add a provider key and issue a proxy key under <b>Keys</b>, then route your Anthropic
            traffic through the proxy.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Total spend" value={fmtUsd(summary.totalCost)} sub={`${days} days`} />
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
        </>
      )}
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
    <span className={`rounded px-1.5 py-0.5 text-[11px] ${map[status] ?? "bg-neutral-800 text-neutral-400"}`}>
      {status}
    </span>
  );
}
