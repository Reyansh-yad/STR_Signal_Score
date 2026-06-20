import { loadReports } from "@/lib/str-data"
import { DetailedReportsTable } from "@/components/sections/detailed-reports-table"
import { SectionLabel } from "@/components/ui/panel"

export default async function ReportsPage() {
  const rows = await loadReports()

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="mb-8">
        <SectionLabel>Full Dataset</SectionLabel>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Detailed Reports
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          View, search, and filter the complete set of analyzed STR reports.
        </p>
      </div>

      <DetailedReportsTable rows={rows} />
    </main>
  )
}
