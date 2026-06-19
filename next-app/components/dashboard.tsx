import { Panel, SectionLabel, KpiCard } from "@/components/ui/panel"
import { CountUp } from "@/components/ui/count-up"
import { ScoreDistributionChart } from "@/components/charts/score-distribution-chart"
import { TierBreakdownChart } from "@/components/charts/tier-breakdown-chart"
import { WeaknessesChart } from "@/components/charts/weaknesses-chart"
import { StructureVsNarrativeChart } from "@/components/charts/scatter-structure-vs-narrative"
import { ScoreSuspicionChart } from "@/components/charts/score-suspicion-chart"
import { TopReportsTable } from "@/components/sections/top-reports-table"
import { EdaSection } from "@/components/sections/eda-section"
import type { StrRow, Summary } from "@/lib/str-types"

export function Dashboard({ rows, summary }: { rows: StrRow[]; summary: Summary }) {
  return (
    <section
      id="dashboard"
      className="mx-auto max-w-7xl scroll-mt-16 px-4 pb-24 pt-12 md:px-6"
    >
      {/* Section header */}
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <SectionLabel>Signal Intelligence · Live Dashboard</SectionLabel>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Completeness scores across the report queue
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Hybrid scoring blends structured-field completeness (40%) with
            NLP-based narrative quality (60%). Reports are ranked so analysts
            see the highest-signal cases first.
          </p>
        </div>
        <div className="font-mono text-[11px] text-muted">
          276 reports scored · pipeline latency &lt; 30 s
        </div>
      </div>

      <div id="overview" className="scroll-mt-24">
        {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total Reports"
          value={<CountUp value={summary.total} />}
          sublabel="Across the active queue"
          tone="neutral"
        />
        <KpiCard
          label="Average Score"
          value={
            <CountUp value={summary.avgScore} decimals={3} />
          }
          sublabel="Hybrid completeness"
          tone="accent"
        />
        <KpiCard
          label="High Signal"
          value={<CountUp value={summary.high} />}
          sublabel="≥ 0.75 · priority queue"
          tone="high"
        />
        <KpiCard
          label="Needs Review"
          value={<CountUp value={summary.review} />}
          sublabel="0.45 – 0.74"
          tone="med"
        />
        <KpiCard
          label="Low Quality"
          value={<CountUp value={summary.low} />}
          sublabel="< 0.45 · low signal"
          tone="low"
        />
      </div>
      </div>

      <EdaSection summary={summary} />

      {/* Scoring Engine Section */}
      <div id="scoring" className="mt-12 scroll-mt-24">
        <div className="mb-2">
          <SectionLabel>Scoring Engine</SectionLabel>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Completeness & Suspicion Scoring
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Analysis of the final hybrid scores across the report queue.
          </p>
        </div>

        {/* Chart grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel className="p-5">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <SectionLabel>Distribution</SectionLabel>
              <h3 className="mt-1.5 text-lg font-semibold text-foreground">
                Score Distribution
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Reports bucketed across the 0–1 scale, stacked by tier.
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted">
              <LegendDot color="var(--low)" label="Low" />
              <LegendDot color="var(--med)" label="Review" />
              <LegendDot color="var(--high)" label="High" />
            </div>
          </div>
          <ScoreDistributionChart data={summary.histogram} />
        </Panel>

        <Panel className="p-5">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <SectionLabel>Efficacy</SectionLabel>
              <h3 className="mt-1.5 text-lg font-semibold text-foreground">
                Score vs Suspicion Rate
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Correlation between completeness score and ground-truth suspicion.
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted">
              <LegendDot color="var(--high)" label="Count" />
              <LegendDot color="#f43f5e" label="Suspicion %" />
            </div>
          </div>
          <ScoreSuspicionChart data={summary.scoreSuspicionBins} />
        </Panel>

        <Panel className="p-5">
          <div className="mb-3">
            <SectionLabel>Composition</SectionLabel>
            <h3 className="mt-1.5 text-lg font-semibold text-foreground">
              Tier Breakdown
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              How the queue distributes across analytical tiers.
            </p>
          </div>
          <TierBreakdownChart
            data={summary.tierBreakdown}
            total={summary.total}
          />
        </Panel>

        <Panel className="p-5">
          <div className="mb-3">
            <SectionLabel>Diagnostics</SectionLabel>
            <h3 className="mt-1.5 text-lg font-semibold text-foreground">
              Structure vs Narrative
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Each point is one report — colour shows the tier it landed in.
            </p>
          </div>
          <StructureVsNarrativeChart rows={rows} />
        </Panel>

        <Panel className="p-5">
          <div className="mb-3">
            <SectionLabel>Failure Modes</SectionLabel>
            <h3 className="mt-1.5 text-lg font-semibold text-foreground">
              Top Weaknesses Detected
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Most common reasons reports fall below the signal bar.
            </p>
          </div>
          <WeaknessesChart data={summary.topWeaknesses} />
        </Panel>
      </div>

      {/* Sub-score callouts */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SubScorePanel
          label="Structured Field Score"
          value={summary.avgStructure}
          weight={0.3}
          description="Coded-field completeness: funds, mode, account type, country, indicators."
        />
        <SubScorePanel
          label="Narrative Quality Score"
          value={summary.avgNarrative}
          weight={0.5}
          description="NLP density: amounts, dates, party names and length, penalised for boilerplate."
        />
        <SubScorePanel
          label="Explanation Quality"
          value={summary.avgExplanation}
          weight={0.2}
          description="Customer-explanation tier based on length and specificity."
        />
      </div>
      </div>

      {/* Priority queue table */}
      <div id="queue" className="mt-12 scroll-mt-24">
        <Panel className="p-5">
        <div className="mb-4">
          <SectionLabel>Priority Queue</SectionLabel>
          <h3 className="mt-1.5 text-lg font-semibold text-foreground">
            Highest-Signal Reports
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Analyst action queue — sorted by final completeness score.
          </p>
        </div>
        <TopReportsTable rows={rows} />
        </Panel>
      </div>
    </section>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  )
}

function SubScorePanel({
  label,
  value,
  weight,
  description,
}: {
  label: string
  value: number
  weight: number
  description: string
}) {
  const pct = Math.round(value * 100)
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          weight · {(weight * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-medium tabular-nums text-foreground">
          <CountUp value={pct} />
        </span>
        <span className="font-mono text-sm text-muted">/ 100</span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent via-high to-med transition-[width] duration-700"
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
    </Panel>
  )
}