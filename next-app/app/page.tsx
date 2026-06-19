import { loadReports, computeSummary } from "@/lib/str-data"
import { Hero } from "@/components/hero"
import { Dashboard } from "@/components/dashboard"

export default async function Page() {
  const rows = await loadReports()
  const summary = computeSummary(rows)

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Hero />
      <Dashboard rows={rows} summary={summary} />
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-2 px-6 py-8 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <div className="font-mono uppercase tracking-[0.18em]">
            STR Signal Intelligence · AI/ML AML Hackathon
          </div>
          <div className="font-mono text-[11px]">
            {rows.length} reports · powered by Next.js {`16`}, Recharts &amp; Framer Motion
          </div>
        </div>
      </footer>
    </main>
  )
}