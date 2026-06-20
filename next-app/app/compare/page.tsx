import { SectionLabel } from "@/components/ui/panel"
import { FileUpload } from "@/components/ui/file-upload"

export default function ComparePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <div className="mb-12 text-center">
        <SectionLabel>Dataset Comparison</SectionLabel>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Upload New Reports
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-sm text-muted-foreground leading-relaxed">
          Upload a batch of raw XML reports to process them through the scoring pipeline, 
          or upload a pre-scored CSV file. The system will compute the metrics and 
          display a side-by-side comparison against the baseline dataset.
        </p>
      </div>

      <FileUpload />
    </main>
  )
}
