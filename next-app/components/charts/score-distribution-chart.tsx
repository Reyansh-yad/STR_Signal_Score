"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartTooltip } from "./chart-tooltip"
import type { HistogramBin } from "@/lib/str-types"

export function ScoreDistributionChart({ data }: { data: HistogramBin[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} aspect={undefined}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
          barCategoryGap="22%"
        >
          <defs>
            <linearGradient id="grad-low" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--low)" stopOpacity={0.9} />
              <stop offset="100%" stopColor="var(--low)" stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="grad-med" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--med)" stopOpacity={0.9} />
              <stop offset="100%" stopColor="var(--med)" stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="grad-high" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--high)" stopOpacity={0.95} />
              <stop offset="100%" stopColor="var(--high)" stopOpacity={0.45} />
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
            tick={{ fill: "var(--muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            content={<ChartTooltip titleKey="range" />}
          />
          <Bar
            dataKey="low"
            stackId="a"
            fill="url(#grad-low)"
            name="Low Quality"
            animationDuration={900}
            animationEasing="ease-out"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="med"
            stackId="a"
            fill="url(#grad-med)"
            name="Needs Review"
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="high"
            stackId="a"
            fill="url(#grad-high)"
            name="High Signal"
            animationDuration={900}
            animationEasing="ease-out"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
