"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { getTierColorVar, getTierLabel, highlightNarrative } from "@/lib/str-shared"
import type { StrRow, Tier } from "@/lib/str-types"

interface TopReportsTableProps {
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

function truncate(s: string, n: number) {
  if (s.length <= n) return s
  return s.slice(0, n - 1).trimEnd() + "…"
}

export function TopReportsTable({ rows }: TopReportsTableProps) {
  const [filter, setFilter] = useState<Tier | "ALL">("ALL")
  const [search, setSearch] = useState("")

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
    return r.slice(0, 12)
  }, [rows, filter, search])

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
          placeholder="Filter by id, country, narrative…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto w-full max-w-xs rounded-md border border-border bg-panel-2/60 px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-border-2 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-panel-2/60">
            <tr className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              <th className="px-4 py-2.5 font-medium">Report</th>
              <th className="px-4 py-2.5 font-medium">Country</th>
              <th className="px-4 py-2.5 font-medium text-right">Score</th>
              <th className="px-4 py-2.5 font-medium">Tier</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                Narrative Preview
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-muted"
                >
                  No reports match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr
                  key={row.report_id}
                  className="group transition-colors hover:bg-panel-2/40"
                >
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted tabular-nums">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="font-mono text-[13px] font-medium text-foreground">
                        {row.report_id}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.country || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <span
                      className="font-mono text-base font-semibold tabular-nums"
                      style={{ color: getTierColorVar(row.tier) }}
                    >
                      {row.final_score.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider",
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
                  <td className="hidden px-4 py-3 align-top md:table-cell">
                    <div className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {highlightNarrative(truncate(row.reason, 220)).map(
                        (seg, i) =>
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
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {row.weaknesses
                          .split(";")
                          .map((w) => w.trim())
                          .filter(Boolean)
                          .slice(0, 3)
                          .map((w, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-low-dim px-1.5 py-0.5 font-mono text-[10px] text-low ring-1 ring-low/20"
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

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Showing {filtered.length} of {rows.length} reports · sorted by final
        score · threshold ≥ 0.75 = High Signal · ≥ 0.45 = Needs Review
      </p>
    </div>
  )
}