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
import type { WeaknessCount } from "@/lib/str-types"

export function WeaknessesChart({ data }: { data: WeaknessCount[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted">
        No weaknesses detected.
      </div>
    )
  }
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} aspect={undefined}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, bottom: 4, left: 0 }}
          barCategoryGap="28%"
        >
          <defs>
            <linearGradient id="grad-weakness" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--low)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.95} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="2 4"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: "var(--muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={170}
            tick={{ fill: "var(--text)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={<ChartTooltip titleKey="name" />}
          />
          <Bar
            dataKey="count"
            name="Reports"
            fill="url(#grad-weakness)"
            radius={[0, 4, 4, 0]}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
