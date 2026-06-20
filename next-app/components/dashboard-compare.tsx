"use client"

import { Panel, SectionLabel } from "@/components/ui/panel"
import { CountUp } from "@/components/ui/count-up"
import type { Summary } from "@/lib/str-types"

function KpiDeltaCard({
  label,
  oldVal,
  newVal,
  sublabel,
  decimals = 0,
}: {
  label: string
  oldVal: number
  newVal: number
  sublabel: string
  decimals?: number
}) {
  const delta = newVal - oldVal
  const isPositive = delta > 0
  const isZero = delta === 0

  return (
    <Panel className="p-5 flex flex-col justify-between">
      <div>
        <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </h4>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-medium tabular-nums text-foreground">
            <CountUp value={newVal} decimals={decimals} />
          </span>
          <span
            className={`font-mono text-xs tabular-nums ${
              isZero
                ? "text-muted-foreground"
                : isPositive
                ? "text-high"
                : "text-low"
            }`}
          >
            {isPositive ? "+" : ""}
            {delta.toFixed(decimals)}
          </span>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{sublabel}</p>
    </Panel>
  )
}

export function DashboardCompare({
  oldSummary,
  newSummary,
}: {
  oldSummary: Summary
  newSummary: Summary
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-6">
      <div className="mb-8">
        <SectionLabel>Compare Results</SectionLabel>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Baseline vs Uploaded Dataset
        </h2>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Core Metrics Delta
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <KpiDeltaCard
            label="Total Reports"
            oldVal={oldSummary.total}
            newVal={newSummary.total}
            sublabel="Uploaded vs Baseline"
          />
          <KpiDeltaCard
            label="Average Score"
            oldVal={oldSummary.avgScore}
            newVal={newSummary.avgScore}
            decimals={3}
            sublabel="Completeness shift"
          />
          <KpiDeltaCard
            label="High Signal"
            oldVal={oldSummary.high}
            newVal={newSummary.high}
            sublabel="≥ 0.75 bucket"
          />
          <KpiDeltaCard
            label="Needs Review"
            oldVal={oldSummary.review}
            newVal={newSummary.review}
            sublabel="0.45 – 0.74 bucket"
          />
          <KpiDeltaCard
            label="Low Quality"
            oldVal={oldSummary.low}
            newVal={newSummary.low}
            sublabel="< 0.45 bucket"
          />
        </div>
      </div>

      <div className="mt-12">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Component Score Averages
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiDeltaCard
            label="Structure Score Avg"
            oldVal={oldSummary.avgStructure}
            newVal={newSummary.avgStructure}
            decimals={3}
            sublabel="Coded fields"
          />
          <KpiDeltaCard
            label="Narrative Score Avg"
            oldVal={oldSummary.avgNarrative}
            newVal={newSummary.avgNarrative}
            decimals={3}
            sublabel="NLP density & uniqueness"
          />
          <KpiDeltaCard
            label="Explanation Score Avg"
            oldVal={oldSummary.avgExplanation}
            newVal={newSummary.avgExplanation}
            decimals={3}
            sublabel="Length & explicit explanations"
          />
        </div>
      </div>
    </section>
  )
}
