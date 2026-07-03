"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { INK, SERIES_BLUE, fmtUsd, fmtUsdAxis } from "@/lib/chartTheme";
import type { DayPoint } from "@/lib/data/usage";

export function SpendChart({ data }: { data: DayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_BLUE} stopOpacity={0.35} />
            <stop offset="100%" stopColor={SERIES_BLUE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={INK.grid} vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: INK.muted, fontSize: 11 }}
          tickFormatter={(d: string) => d.slice(5)}
          axisLine={{ stroke: INK.axis }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: INK.muted, fontSize: 11 }}
          tickFormatter={(v: number) => fmtUsdAxis(v)}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ stroke: INK.axis }}
          contentStyle={{
            background: INK.surface,
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: INK.secondary }}
          itemStyle={{ color: INK.primary }}
          formatter={(v) => [fmtUsd(Number(v)), "Cost"]}
        />
        <Area
          type="monotone"
          dataKey="cost"
          stroke={SERIES_BLUE}
          strokeWidth={2}
          fill="url(#spendFill)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
