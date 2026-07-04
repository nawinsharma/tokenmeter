import Link from "next/link";

export type Range = { days: number; label: string };

const RANGES: Range[] = [
  { days: 1, label: "24h" },
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

export function DateRange({
  current,
  basePath = "/dashboard",
  ranges = RANGES,
}: {
  current: number;
  basePath?: string;
  ranges?: Range[];
}) {
  return (
    <div className="inline-flex rounded-md border border-neutral-800 p-0.5">
      {ranges.map((r) => {
        const active = r.days === current;
        return (
          <Link
            key={r.days}
            href={`${basePath}?days=${r.days}`}
            className={`rounded px-3 py-1 text-xs font-medium transition ${
              active
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {r.label}
          </Link>
        );
      })}
    </div>
  );
}
