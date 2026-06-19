"use client"

import * as React from "react"

const accentByKey: Record<string, string> = {
  HIGH_SIGNAL: "var(--high)",
  NEEDS_REVIEW: "var(--med)",
  LOW_QUALITY_NOISE: "var(--low)",
  high: "var(--high)",
  med: "var(--med)",
  low: "var(--low)",
}

export interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number | string
    color?: string
    payload?: Record<string, unknown> & { range?: string; tier?: string; name?: string }
  }>
  label?: string | number
  titleKey?: string
}

export function ChartTooltip({
  active,
  payload,
  label,
  titleKey = "name",
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const title = (label ?? (payload[0]?.payload?.[titleKey] as string)) as string

  return (
    <div className="rounded-lg border border-border bg-panel-2/95 px-3 py-2 shadow-2xl backdrop-blur-md">
      {title ? (
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          {title}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        {payload.map((entry, i) => {
          const color =
            entry.color ??
            accentByKey[entry.name ?? ""] ??
            (entry.payload?.tier
              ? accentByKey[entry.payload.tier as string]
              : "var(--text)")
          return (
            <div
              key={i}
              className="flex items-center gap-2 font-mono text-xs tabular-nums"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: color }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="ml-auto pl-3 text-foreground">
                {typeof entry.value === "number"
                  ? entry.value.toLocaleString()
                  : entry.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
