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
import type { NarrativeLengthBin } from "@/lib/str-types"

export function NarrativeLengthChart({ data }: { data: NarrativeLengthBin[] }) {
  // We compute a smoothed line by just rendering a Monotone line over the bars
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} aspect={undefined}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
          barCategoryGap="10%"
        >
          <defs>
            <linearGradient id="grad-teal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.3} />
            </linearGradient>
            <linearGradient id="grad-line-teal" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity={1} />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.4} />
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
            interval="preserveStartEnd"
            minTickGap={20}
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
            dataKey="count"
            fill="url(#grad-teal)"
            name="Report Count"
            animationDuration={900}
            animationEasing="ease-out"
            radius={[2, 2, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="url(#grad-line-teal)"
            strokeWidth={2}
            dot={false}
            name="Trend"
            animationDuration={1500}
            animationEasing="ease-in-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
