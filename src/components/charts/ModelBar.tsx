"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { INK, modelColor, fmtUsd } from "@/lib/chartTheme";
import type { ModelPoint } from "@/lib/data/usage";

export function ModelBar({ data }: { data: ModelPoint[] }) {
  const height = Math.max(120, data.length * 44 + 16);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
        barCategoryGap={10}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="model"
          tick={{ fill: INK.secondary, fontSize: 12 }}
          tickFormatter={(m: string) => m.replace("claude-", "")}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{
            background: INK.surface,
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: INK.secondary }}
          itemStyle={{ color: INK.primary }}
          formatter={(v, _n, p) => [
            `${fmtUsd(Number(v))} · ${(p?.payload as ModelPoint | undefined)?.requests ?? 0} reqs`,
            "Cost",
          ]}
        />
        <Bar dataKey="cost" radius={[0, 4, 4, 0]} label={<CostLabel />} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.model} fill={modelColor(d.model)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Direct value label at the end of each bar (selective labeling).
function CostLabel(props: unknown) {
  const { x, y, width, height, value } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    value: number;
  };
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      fill={INK.secondary}
      fontSize={11}
      dominantBaseline="middle"
    >
      {fmtUsd(value)}
    </text>
  );
}
