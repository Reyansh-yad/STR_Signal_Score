"use client"

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import type { TierCount } from "@/lib/str-types"

const TIER_COLORS: Record<TierCount["tier"], string> = {
  HIGH_SIGNAL: "var(--high)",
  NEEDS_REVIEW: "var(--med)",
  LOW_QUALITY_NOISE: "var(--low)",
}

const TIER_LABELS: Record<TierCount["tier"], string> = {
  HIGH_SIGNAL: "High Signal",
  NEEDS_REVIEW: "Needs Review",
  LOW_QUALITY_NOISE: "Low Quality",
}

export function TierBreakdownChart({
  data,
  total,
}: {
  data: TierCount[]
  total: number
}) {
  const safe = data.filter((d) => d.count > 0)
  return (
    <div className="relative h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} aspect={undefined}>
        <PieChart>
          <Pie
            data={safe}
            dataKey="count"
            nameKey="tier"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={3}
            stroke="var(--background)"
            strokeWidth={3}
            startAngle={90}
            endAngle={-270}
            animationDuration={1100}
            animationEasing="ease-out"
          >
            {safe.map((entry) => (
              <Cell key={entry.tier} fill={TIER_COLORS[entry.tier]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-3xl font-medium tabular-nums text-foreground">
          {total.toLocaleString()}
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Total Reports
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((d) => (
          <div
            key={d.tier}
            className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: TIER_COLORS[d.tier] }}
            />
            <span className="text-muted-foreground">{TIER_LABELS[d.tier]}</span>
            <span className="text-foreground">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
