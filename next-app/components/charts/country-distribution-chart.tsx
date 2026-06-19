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
import type { CountryCount } from "@/lib/str-types"

export function CountryDistributionChart({ data }: { data: CountryCount[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} aspect={undefined}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
          barCategoryGap="15%"
        >
          <defs>
            <linearGradient id="grad-orange" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#d97706" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="2 4"
            vertical={false}
          />
          <XAxis
            dataKey="country"
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
            content={<ChartTooltip titleKey="country" />}
          />
          <Bar
            dataKey="count"
            fill="url(#grad-orange)"
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
