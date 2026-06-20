"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { getTierColorVar, getTierLabel, highlightNarrative } from "@/lib/str-shared"
import type { StrRow, Tier } from "@/lib/str-types"

interface DetailedReportsTableProps {
  rows: StrRow[]
}

const TIER_FILTERS: Array<{ id: Tier | "ALL"; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "HIGH_SIGNAL", label: "High Signal" },
  { id: "NEEDS_REVIEW", label: "Needs Review" },
  { id: "LOW_QUALITY_NOISE", label: "Low Quality" },
]

function tierBadgeClass(tier: Tier): string {
  switch (tier) {
    case "HIGH_SIGNAL":
      return "bg-high-dim text-high ring-1 ring-high/30"
    case "NEEDS_REVIEW":
      return "bg-med-dim text-med ring-1 ring-med/30"
    case "LOW_QUALITY_NOISE":
      return "bg-low-dim text-low ring-1 ring-low/30"
  }
}

export function DetailedReportsTable({ rows }: DetailedReportsTableProps) {
  const [filter, setFilter] = useState<Tier | "ALL">("ALL")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const rowsPerPage = 20

  const filtered = useMemo(() => {
    let r = rows.slice().sort((a, b) => b.final_score - a.final_score)
    if (filter !== "ALL") r = r.filter((row) => row.tier === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(
        (row) =>
          row.report_id.toLowerCase().includes(q) ||
          row.reason.toLowerCase().includes(q) ||
          row.country.toLowerCase().includes(q),
      )
    }
    return r
  }, [rows, filter, search])

  const totalPages = Math.ceil(filtered.length / rowsPerPage)
  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  // Reset page when filters change
  useMemo(() => {
    setPage(1)
  }, [filter, search])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          {TIER_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1.5 font-mono text-[11px] font-medium tracking-wide transition-colors",
                filter === f.id
                  ? "bg-panel-2 text-foreground"
                  : "text-muted hover:bg-panel-2/60 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by ID, country, narrative…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto w-full max-w-sm rounded-md border border-border bg-panel-2/60 px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-border-2 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-panel-2/60">
            <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              <th className="px-4 py-2.5 font-medium">Report Details</th>
              <th className="px-4 py-2.5 font-medium text-right w-24">Score</th>
              <th className="px-4 py-2.5 font-medium w-32">Tier</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell w-[50%]">
                Full Narrative
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted">
                  No reports match your search criteria.
                </td>
              </tr>
            ) : (
              paginated.map((row, idx) => (
                <tr key={row.report_id} className="group transition-colors hover:bg-panel-2/40">
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[13px] font-semibold text-foreground">
                        {row.report_id}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground mt-1">
                        Country: {row.country || "—"}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Mode: {row.mode_code || "—"}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Indicators: {row.indicator_count || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <span
                      className="font-mono text-lg font-bold tabular-nums"
                      style={{ color: getTierColorVar(row.tier) }}
                    >
                      {row.final_score.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider",
                        tierBadgeClass(row.tier),
                      )}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: getTierColorVar(row.tier) }}
                      />
                      {getTierLabel(row.tier)}
                    </span>
                  </td>
                  <td className="hidden px-4 py-4 align-top md:table-cell">
                    <div className="text-xs leading-relaxed text-muted-foreground">
                      {highlightNarrative(row.reason).map((seg, i) =>
                        seg.m ? (
                          <mark key={i} className={seg.m}>
                            {seg.t}
                          </mark>
                        ) : (
                          <span key={i}>{seg.t}</span>
                        ),
                      )}
                    </div>
                    {row.weaknesses && row.weaknesses !== "Analytical Signal: Complete" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.weaknesses
                          .split(";")
                          .map((w) => w.trim())
                          .filter(Boolean)
                          .map((w, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-low-dim px-2 py-1 font-mono text-[10px] text-low ring-1 ring-low/20"
                            >
                              {w}
                            </span>
                          ))}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        <div>
          Showing {filtered.length > 0 ? (page - 1) * rowsPerPage + 1 : 0} -{" "}
          {Math.min(page * rowsPerPage, filtered.length)} of {filtered.length} reports
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2 py-1 border border-border rounded-md hover:bg-panel-2 disabled:opacity-50"
          >
            Prev
          </button>
          <span>Page {page} of {totalPages || 1}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || totalPages === 0}
            className="px-2 py-1 border border-border rounded-md hover:bg-panel-2 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
