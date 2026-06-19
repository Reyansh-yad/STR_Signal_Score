"use client"

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartTooltip } from "./chart-tooltip"
import type { ScoreSuspicionBin } from "@/lib/str-types"

export function ScoreSuspicionChart({ data }: { data: ScoreSuspicionBin[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} aspect={undefined}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
          barCategoryGap="22%"
        >
          <defs>
            <linearGradient id="grad-cyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00e5a0" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#00e5a0" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="grad-magenta" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity={1} />
              <stop offset="100%" stopColor="#d946ef" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="2 4"
            vertical={false}
          />
          <XAxis
            dataKey="range"
            tick={{ fill: "var(--muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={0}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: "var(--muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "var(--muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val}%`}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null
              // Convert the payload structure to match what ChartTooltip expects
              const mappedPayload = payload.map((p) => ({
                name: p.name,
                value: p.name === "Suspicion Rate" ? `${Number(p.value).toFixed(1)}%` : p.value,
                color: p.name === "Suspicion Rate" ? "#f43f5e" : "#00e5a0",
              }))
              return <ChartTooltip active={active} payload={mappedPayload as any} label={label} />
            }}
          />
          <Bar
            yAxisId="left"
            dataKey="count"
            fill="url(#grad-cyan)"
            name="Report Count"
            animationDuration={900}
            animationEasing="ease-out"
            radius={[2, 2, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="suspicionRate"
            stroke="url(#grad-magenta)"
            strokeWidth={2}
            dot={false}
            name="Suspicion Rate"
            animationDuration={1500}
            animationEasing="ease-in-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
