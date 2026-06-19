"use client"

import { useEffect } from "react"
import { Panel, SectionLabel } from "@/components/ui/panel"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard crashed:", error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Panel className="max-w-lg p-8">
        <SectionLabel>Error</SectionLabel>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">
          Couldn&apos;t load the report queue.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred while reading the scored CSV."}
        </p>
        <p className="mt-2 text-xs text-muted">
          Make sure <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono">python src/pipeline.py</code>{" "}
          has been run so <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono">Results/STR_QUALITY_RANKED_FINAL.csv</code>{" "}
          exists.
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-[1.02]"
        >
          Try again
        </button>
      </Panel>
    </main>
  )
}