import "server-only"
import { readFile } from "node:fs/promises"
import path from "node:path"
import type {
  CountryCount,
  HistogramBin,
  IndicatorCount,
  ModeCount,
  NarrativeLengthBin,
  ScoreSuspicionBin,
  StrRow,
  Summary,
  TierCount,
  WeaknessCount,
} from "./str-types"
import { getTier } from "./str-shared"

/**
 * Server-only. Reads Wave-main/Results/STR_QUALITY_RANKED_FINAL.csv
 * relative to the next-app project root.
 */
const CSV_PATH = path.join(
  process.cwd(),
  "..",
  "Results",
  "STR_QUALITY_RANKED_FINAL.csv",
)

/** Quoted-aware single-line CSV parser. */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else {
      if (ch === ",") {
        out.push(cur)
        cur = ""
      } else if (ch === '"' && cur.length === 0) {
        inQuotes = true
      } else {
        cur += ch
      }
    }
  }
  out.push(cur)
  return out
}

const toNum = (v: string | undefined, fallback = 0): number => {
  if (v === undefined || v === null || v === "") return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const toStr = (v: string | undefined): string => (v ?? "").trim()

export async function loadReports(): Promise<StrRow[]> {
  let raw: string
  try {
    raw = await readFile(CSV_PATH, "utf8")
  } catch (err) {
    throw new Error(
      `Could not read ${CSV_PATH}: ${(err as Error).message}. ` +
        `Run the Python pipeline first (python src/pipeline.py) to generate the scored CSV.`,
    )
  }

  // Strip BOM, normalise newlines, drop empty trailing lines.
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trimEnd()
  const lines = text.split("\n")
  if (lines.length < 2) {
    throw new Error("CSV has no data rows.")
  }

  const header = parseCsvLine(lines[0]).map((h) => h.trim())
  const idx = (name: string) => {
    const i = header.indexOf(name)
    if (i < 0) throw new Error(`CSV missing column: ${name}`)
    return i
  }

  const I = {
    report_id: idx("report_id"),
    reason: idx("reason"),
    xml_acc_long: idx("xml_acc_long"),
    indicator_count: idx("indicator_count"),
    mode_code: idx("mode_code"),
    funds_code: idx("funds_code"),
    acct_type: idx("acct_type"),
    country: idx("country"),
    account_number: idx("account_number"),
    account_id: idx("account_id"),
    Sender_account: idx("Sender_account"),
    is_suspicious_tx: idx("is_suspicious_tx"),
    amount_zscore: idx("amount_zscore"),
    sender_pep: idx("sender_pep"),
    len: idx("len"),
    ent_mony: idx("ent_mony"),
    ent_date: idx("ent_date"),
    uniqueness: idx("uniqueness"),
    completeness_score: idx("completeness_score"),
    final_score: idx("final_score"),
    weaknesses: idx("weaknesses"),
  }

  const rows: StrRow[] = []
  for (let li = 1; li < lines.length; li++) {
    if (!lines[li]) continue
    const cells = parseCsvLine(lines[li])
    const finalScore = toNum(cells[I.final_score], 0)
    rows.push({
      report_id: toStr(cells[I.report_id]),
      reason: toStr(cells[I.reason]),
      xml_acc_long: toStr(cells[I.xml_acc_long]),
      indicator_count: toNum(cells[I.indicator_count]),
      mode_code: toStr(cells[I.mode_code]),
      funds_code: toStr(cells[I.funds_code]),
      acct_type: toStr(cells[I.acct_type]),
      country: toStr(cells[I.country]) || "Unknown",
      account_number: toStr(cells[I.account_number]),
      account_id: toStr(cells[I.account_id]),
      sender_account: toStr(cells[I.Sender_account]),
      is_suspicious_tx: toNum(cells[I.is_suspicious_tx]),
      amount_zscore: toNum(cells[I.amount_zscore]),
      sender_pep: toNum(cells[I.sender_pep]),
      len: toNum(cells[I.len]),
      ent_mony: toNum(cells[I.ent_mony]),
      ent_date: toNum(cells[I.ent_date]),
      uniqueness: toNum(cells[I.uniqueness], 1),
      completeness_score: toNum(cells[I.completeness_score]),
      final_score: finalScore,
      weaknesses: toStr(cells[I.weaknesses]),
      tier: getTier(finalScore),
      struct_score: 0,
      narr_score: 0,
      expl_score: 0,
    })
  }

  // Derive sub-scores as proxies (the source CSV only carries final_score +
  // completeness_score; these keep the per-component UI useful without
  // requiring a pipeline re-run).
  for (const r of rows) {
    r.struct_score = deriveStructScore(r)
    r.narr_score = deriveNarrScore(r)
    r.expl_score = deriveExplScore(r)
  }

  return rows
}

function deriveStructScore(r: StrRow): number {
  // Coded-field fill rate, modulated by indicator count and suspicious flag.
  let filled = 0
  let total = 0
  for (const v of [r.mode_code, r.funds_code, r.acct_type, r.country]) {
    total++
    if (v && v !== "Z" && v !== "Unknown" && v !== "") filled++
  }
  let score = total > 0 ? filled / total : 0
  if (r.indicator_count > 0) score = Math.min(1, score + 0.15)
  if (r.is_suspicious_tx > 0) score = Math.min(1, score + 0.1)
  return clamp01(score)
}

function deriveNarrScore(r: StrRow): number {
  const lenScore = Math.min(1, r.len / 1200)
  const moneyScore = Math.min(1, r.ent_mony / 3)
  const dateScore = Math.min(1, r.ent_date / 3)
  const uniqScore = Math.min(1, Math.max(0, r.uniqueness))
  return clamp01(
    lenScore * 0.35 + moneyScore * 0.25 + dateScore * 0.25 + uniqScore * 0.15,
  )
}

function deriveExplScore(r: StrRow): number {
  // Heuristic — present in the demo as a length-tiered function. Look for
  // explicit customer-explanation phrases in the narrative.
  const t = r.reason.toLowerCase()
  let score = 0.1
  if (t.includes("customer") || t.includes("explanation")) score += 0.35
  if (t.includes("stated") || t.includes("explained")) score += 0.2
  if (r.len >= 250) score += 0.25
  else if (r.len >= 80) score += 0.15
  else if (r.len >= 20) score += 0.05
  if (r.uniqueness > 0.45) score += 0.1
  return clamp01(score)
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

export function computeSummary(rows: StrRow[]): Summary {
  const total = rows.length
  let high = 0
  let review = 0
  let low = 0
  let sumScore = 0
  let sumStruct = 0
  let sumNarr = 0
  let sumExpl = 0

  // 10 bins: [0,0.1), [0.1,0.2), …, [0.9,1.0]
  const bins: HistogramBin[] = Array.from({ length: 10 }, (_, i) => ({
    range: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`,
    lo: i / 10,
    hi: (i + 1) / 10,
    low: 0,
    med: 0,
    high: 0,
  }))

  const scoreSuspicionBins: ScoreSuspicionBin[] = Array.from(
    { length: 10 },
    (_, i) => ({
      range: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`,
      lo: i / 10,
      hi: (i + 1) / 10,
      count: 0,
      suspiciousCount: 0,
      suspicionRate: 0,
    }),
  )

  const weaknessMap = new Map<string, number>()
  const countryMap = new Map<string, number>()
  const modeMap = new Map<string, number>()
  const indicatorMap = new Map<number, number>()
  let maxNarrLen = 0
  for (const r of rows) {
    if (r.len > maxNarrLen) maxNarrLen = r.len
  }
  
  // Create 25 bins for narrative length
  const narrBinSize = Math.max(10, Math.ceil(maxNarrLen / 25))
  const narrBins: NarrativeLengthBin[] = Array.from({ length: 25 }, (_, i) => ({
    range: `${i * narrBinSize}-${(i + 1) * narrBinSize - 1}`,
    lo: i * narrBinSize,
    hi: (i + 1) * narrBinSize,
    count: 0,
  }))

  for (const r of rows) {
    sumScore += r.final_score
    sumStruct += r.struct_score
    sumNarr += r.narr_score
    sumExpl += r.expl_score
    if (r.tier === "HIGH_SIGNAL") high++
    else if (r.tier === "NEEDS_REVIEW") review++
    else low++

    // Score histogram (last bin includes 1.0).
    const s = Math.max(0, Math.min(0.9999, r.final_score))
    const binIdx = Math.min(9, Math.floor(s * 10))
    if (r.tier === "HIGH_SIGNAL") bins[binIdx].high++
    else if (r.tier === "NEEDS_REVIEW") bins[binIdx].med++
    else bins[binIdx].low++

    // Score vs Suspicion
    scoreSuspicionBins[binIdx].count++
    if (r.is_suspicious_tx === 1) {
      scoreSuspicionBins[binIdx].suspiciousCount++
    }

    // Weaknesses — skip the "complete" marker.
    if (
      r.weaknesses &&
      r.weaknesses !== "Analytical Signal: Complete" &&
      r.weaknesses.toLowerCase() !== "nan"
    ) {
      for (const w of r.weaknesses.split(";")) {
        const name = w.trim()
        if (!name) continue
        weaknessMap.set(name, (weaknessMap.get(name) ?? 0) + 1)
      }
    }

    if (r.country) {
      countryMap.set(r.country, (countryMap.get(r.country) ?? 0) + 1)
    }
    
    if (r.mode_code) {
      modeMap.set(r.mode_code, (modeMap.get(r.mode_code) ?? 0) + 1)
    }

    const indCount = r.indicator_count || 0
    indicatorMap.set(indCount, (indicatorMap.get(indCount) ?? 0) + 1)

    const narrIdx = Math.min(24, Math.floor(r.len / narrBinSize))
    narrBins[narrIdx].count++
  }

  for (const b of scoreSuspicionBins) {
    b.suspicionRate = b.count > 0 ? (b.suspiciousCount / b.count) * 100 : 0
  }

  const tierBreakdown: TierCount[] = [
    { tier: "HIGH_SIGNAL", count: high },
    { tier: "NEEDS_REVIEW", count: review },
    { tier: "LOW_QUALITY_NOISE", count: low },
  ]

  const topWeaknesses: WeaknessCount[] = [...weaknessMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const topCountries: CountryCount[] = [...countryMap.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const edaModes: ModeCount[] = [...modeMap.entries()]
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const edaIndicatorCounts: IndicatorCount[] = [...indicatorMap.entries()]
    .map(([indicators, count]) => ({ indicators, count }))
    .sort((a, b) => a.indicators - b.indicators)

  return {
    total,
    high,
    review,
    low,
    avgScore: total ? sumScore / total : 0,
    avgStructure: total ? sumStruct / total : 0,
    avgNarrative: total ? sumNarr / total : 0,
    avgExplanation: total ? sumExpl / total : 0,
    histogram: bins,
    tierBreakdown,
    topWeaknesses,
    topCountries,
    edaNarrLengthBins: narrBins,
    edaCountries: topCountries,
    edaModes,
    edaIndicatorCounts,
    scoreSuspicionBins,
  }
}
