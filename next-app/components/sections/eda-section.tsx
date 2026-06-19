import { Panel, SectionLabel, KpiCard } from "@/components/ui/panel"
import { CountUp } from "@/components/ui/count-up"
import { NarrativeLengthChart } from "@/components/charts/narrative-length-chart"
import { CountryDistributionChart } from "@/components/charts/country-distribution-chart"
import { IndicatorCountChart } from "@/components/charts/indicator-count-chart"
import { TransactionModesChart } from "@/components/charts/transaction-modes-chart"
import type { Summary } from "@/lib/str-types"

export function EdaSection({ summary }: { summary: Summary }) {
  const avgNarrLength = Math.round(
    summary.edaNarrLengthBins.reduce((acc, bin) => acc + (bin.lo + bin.hi) / 2 * bin.count, 0) / summary.total
  )
  const countriesSeen = summary.topCountries.length
  const maxIndicators = summary.edaIndicatorCounts.reduce((acc, b) => Math.max(acc, b.indicators), 0)

  return (
    <div id="eda" className="mt-12 flex flex-col gap-6 scroll-mt-24">
      <div className="mb-2">
        <SectionLabel>Exploratory Data Analysis</SectionLabel>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Dataset Distribution & Quality
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Mandatory EDA checking raw report quality before scoring pipeline execution.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Avg Narrative Length"
          value={<CountUp value={avgNarrLength} />}
          sublabel="Characters"
          tone="accent"
        />
        <KpiCard
          label="Countries Seen"
          value={<CountUp value={countriesSeen} />}
          sublabel="Unique Origins"
          tone="med"
        />
        <KpiCard
          label="Max Indicators"
          value={<CountUp value={maxIndicators} />}
          sublabel="Per Report"
          tone="high"
        />
        <KpiCard
          label="Total Processed"
          value={<CountUp value={summary.total} />}
          sublabel="Valid XML Reports"
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel className="p-5">
          <div className="mb-3">
            <SectionLabel>Length Distribution</SectionLabel>
            <h3 className="mt-1.5 text-lg font-semibold text-foreground">
              Narrative Length
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Histogram of report narrative lengths with density trend.
            </p>
          </div>
          <NarrativeLengthChart data={summary.edaNarrLengthBins} />
        </Panel>

        <Panel className="p-5">
          <div className="mb-3">
            <SectionLabel>Geography</SectionLabel>
            <h3 className="mt-1.5 text-lg font-semibold text-foreground">
              Top 10 Countries
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Distribution of reports by origin country.
            </p>
          </div>
          <CountryDistributionChart data={summary.edaCountries} />
        </Panel>

        <Panel className="p-5">
          <div className="mb-3">
            <SectionLabel>Indicators</SectionLabel>
            <h3 className="mt-1.5 text-lg font-semibold text-foreground">
              Indicators Per Report
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Number of structured indicators attached to each report.
            </p>
          </div>
          <IndicatorCountChart data={summary.edaIndicatorCounts} />
        </Panel>

        <Panel className="p-5">
          <div className="mb-3">
            <SectionLabel>Transaction Types</SectionLabel>
            <h3 className="mt-1.5 text-lg font-semibold text-foreground">
              Top Transaction Modes
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Primary mode of transaction reported.
            </p>
          </div>
          <TransactionModesChart data={summary.edaModes} />
        </Panel>
      </div>
    </div>
  )
}
