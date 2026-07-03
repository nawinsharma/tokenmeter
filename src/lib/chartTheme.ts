// Validated dark-surface palette (from the dataviz reference instance).
// Categorical hues assigned in fixed order — never cycled by rank.
export const CATEGORICAL = [
  "#4a90e2", // 1 blue
  "#199e70", // 2 aqua
  "#c98500", // 3 yellow
  "#008300", // 4 green
  "#9085e9", // 5 violet
  "#e66767", // 6 red
  "#d55181", // 7 magenta
  "#d95926", // 8 orange
] as const;

export const INK = {
  primary: "#ffffff",
  secondary: "#c3c2b7",
  muted: "#7a7a74", // axis/tick labels
  grid: "#333331",
  axis: "#454542",
  surface: "#1a1a19",
};

export const SERIES_BLUE = CATEGORICAL[0];

// Stable model → hue mapping so a model keeps its color regardless of rank.
const MODEL_SLOT: Record<string, number> = {
  "claude-fable-5": 4, // violet
  "claude-opus-4-8": 0, // blue
  "claude-opus-4-7": 5, // red
  "claude-opus-4-6": 7, // orange
  "claude-sonnet-5": 1, // aqua
  "claude-sonnet-4-6": 6, // magenta
  "claude-haiku-4-5": 2, // yellow
};

export function modelColor(model: string): string {
  if (model in MODEL_SLOT) return CATEGORICAL[MODEL_SLOT[model]];
  // Deterministic fallback for unknown models.
  let h = 0;
  for (let i = 0; i < model.length; i++) h = (h * 31 + model.charCodeAt(i)) >>> 0;
  return CATEGORICAL[h % CATEGORICAL.length];
}

export function fmtUsd(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(5)}`;
}

// Compact form for axis ticks — avoids the 5-decimal small-value format that
// overflows the axis gutter (e.g. $0 instead of $0.00000).
export function fmtUsdAxis(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (n >= 1) return `$${Math.round(n)}`;
  return `$${n.toFixed(2)}`;
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
