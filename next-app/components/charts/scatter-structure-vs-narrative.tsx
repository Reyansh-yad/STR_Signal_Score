"use client"

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"
import { ChartTooltip } from "./chart-tooltip"
import type { StrRow } from "@/lib/str-types"

interface Point {
  x: number
  y: number
  score: number
  id: string
  tier: StrRow["tier"]
}

const tierColor: Record<StrRow["tier"], string> = {
  HIGH_SIGNAL: "var(--high)",
  NEEDS_REVIEW: "var(--med)",
  LOW_QUALITY_NOISE: "var(--low)",
}

function buildScatterData(rows: StrRow[]): Point[] {
  return rows.map((r) => ({
    x: r.struct_score,
    y: r.narr_score,
    score: r.final_score,
    id: r.report_id,
    tier: r.tier,
  }))
}

export function StructureVsNarrativeChart({ rows }: { rows: StrRow[] }) {
  const data = buildScatterData(rows)
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} aspect={undefined}>
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
          <XAxis
            type="number"
            dataKey="x"
            name="Structure"
            domain={[0, 1]}
            tick={{
              fill: "var(--muted)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            label={{
              value: "Structure",
              position: "insideBottom",
              offset: -2,
              fill: "var(--muted)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Narrative"
            domain={[0, 1]}
            tick={{
              fill: "var(--muted)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
            tickLine={false}
            axisLine={false}
            label={{
              value: "Narrative",
              angle: -90,
              position: "insideLeft",
              offset: 18,
              fill: "var(--muted)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          />
          <ZAxis range={[38, 38]} />
          <Tooltip
            cursor={{ stroke: "var(--border-2)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null
              const p = payload[0].payload as Point
              return (
                <ChartTooltip
                  active={active}
                  payload={[
                    {
                      name: "Structure",
                      value: p.x.toFixed(3),
                      color: "var(--accent)",
                    },
                    {
                      name: "Narrative",
                      value: p.y.toFixed(3),
                      color: "var(--accent-2)",
                    },
                    {
                      name: "Final",
                      value: p.score.toFixed(3),
                      color: tierColor[p.tier],
                    },
                  ]}
                  label={p.id}
                />
              )
            }}
          />
          <Scatter
            data={data}
            fill="var(--accent)"
            fillOpacity={0.7}
            animationDuration={900}
            animationEasing="ease-out"
            shape={(props: { cx?: number; cy?: number; payload?: Point }) => {
              const { cx, cy, payload } = props
              if (cx === undefined || cy === undefined || !payload) return <g />
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={3.2}
                  fill={tierColor[payload.tier]}
                  fillOpacity={0.78}
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth={0.5}
                />
              )
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
