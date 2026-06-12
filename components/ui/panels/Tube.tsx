"use client";

interface TubeProps {
  label: string;
  value: number; // 0–1
  color: string;
}

/** Liquid-light progress tube (Stitch global-map language). */
export default function Tube({ label, value, color }: TubeProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="font-label text-[0.62rem] font-semibold uppercase tracking-wider text-ink-soft">
          {label}
        </span>
        <span className="font-heading text-[0.62rem] font-bold text-ink">{pct}%</span>
      </div>
      <div className="tube">
        <div
          className="tube-fill"
          style={{ width: `${pct}%`, ["--tube-color" as string]: color }}
        />
      </div>
    </div>
  );
}
