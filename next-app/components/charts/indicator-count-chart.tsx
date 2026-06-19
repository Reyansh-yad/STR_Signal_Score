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
import type { IndicatorCount } from "@/lib/str-types"

export function IndicatorCountChart({ data }: { data: IndicatorCount[] }) {
  // Convert indicators (number) to string for XAxis rendering
  const mappedData = data.map((d) => ({
    ...d,
    indicatorsStr: String(d.indicators),
  }))

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} aspect={undefined}>
        <BarChart
          data={mappedData}
          margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
          barCategoryGap="20%"
        >
          <defs>
            <linearGradient id="grad-salmon" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fa8072" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="2 4"
            vertical={false}
          />
          <XAxis
            dataKey="indicatorsStr"
            tick={{ fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
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
            content={<ChartTooltip titleKey="indicatorsStr" />}
          />
          <Bar
            dataKey="count"
            fill="url(#grad-salmon)"
            name="Report Count"
            animationDuration={900}
            animationEasing="ease-out"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
