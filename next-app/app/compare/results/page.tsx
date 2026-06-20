import { loadReports, computeSummary } from "@/lib/str-data"
import { DashboardCompare } from "@/components/dashboard-compare"
import path from "node:path"
import fs from "node:fs/promises"

export default async function CompareResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id: datasetId } = await searchParams

  if (!datasetId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Missing dataset ID.</p>
      </div>
    )
  }

  // Load old baseline data
  const oldRows = await loadReports()
  const oldSummary = computeSummary(oldRows)

  // Determine path for new dataset
  const newPath = path.join(process.cwd(), "..", "outputs", "compare", `${datasetId}.csv`)

  try {
    // Check if the file exists before trying to parse
    await fs.access(newPath)
  } catch (err) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-red-400">Processed dataset not found or still processing.</p>
        <p className="text-sm text-muted-foreground font-mono">{newPath}</p>
      </div>
    )
  }

  let newRows
  try {
    newRows = await loadReports(newPath)
  } catch (err: any) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-red-400">Failed to parse uploaded dataset.</p>
        <p className="text-sm text-muted-foreground">{err.message}</p>
      </div>
    )
  }

  const newSummary = computeSummary(newRows)

  return <DashboardCompare oldSummary={oldSummary} newSummary={newSummary} />
}
