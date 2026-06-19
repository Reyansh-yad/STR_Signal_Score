import type { Tier } from "./str-types"

export function getTier(score: number): Tier {
  if (score >= 0.75) return "HIGH_SIGNAL"
  if (score >= 0.45) return "NEEDS_REVIEW"
  return "LOW_QUALITY_NOISE"
}

export function getTierColorVar(tier: Tier): string {
  switch (tier) {
    case "HIGH_SIGNAL":
      return "var(--high)"
    case "NEEDS_REVIEW":
      return "var(--med)"
    case "LOW_QUALITY_NOISE":
      return "var(--low)"
  }
}

export function getTierLabel(tier: Tier): string {
  switch (tier) {
    case "HIGH_SIGNAL":
      return "High Signal"
    case "NEEDS_REVIEW":
      return "Needs Review"
    case "LOW_QUALITY_NOISE":
      return "Low Quality"
  }
}

const AMOUNT_RE =
  /(?:NPR|NRS|Rs\.?|USD|EUR|GBP)[\s\d,]+(?:\.\d+)?(?:\s?(?:lakh|crore|million|thousand))?/gi
const DATE_RE =
  /\d{4}-\d{2}-\d{2}|\d{2}[/]\d{2}[/]\d{4}|\d{2}-\d{2}-\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi

export type NarrativeSpan = { t: string; m?: "amt" | "dt" }

/**
 * Splits `text` into plain/mark spans, marking amounts and dates so they
 * render with the demo's amber/blue highlights.
 */
export function highlightNarrative(text: string): NarrativeSpan[] {
  if (!text) return []
  const out: NarrativeSpan[] = []
  const tokens: Array<{ start: number; end: number; m: "amt" | "dt" }> = []
  for (const m of text.matchAll(AMOUNT_RE)) {
    if (m.index !== undefined)
      tokens.push({ start: m.index, end: m.index + m[0].length, m: "amt" })
  }
  for (const m of text.matchAll(DATE_RE)) {
    if (m.index !== undefined)
      tokens.push({ start: m.index, end: m.index + m[0].length, m: "dt" })
  }
  tokens.sort((a, b) => a.start - b.start)
  for (let i = tokens.length - 1; i > 0; i--) {
    if (tokens[i - 1].end > tokens[i].start) tokens.splice(i - 1, 1)
  }
  let cursor = 0
  for (const tok of tokens) {
    if (tok.start > cursor) out.push({ t: text.slice(cursor, tok.start) })
    out.push({ t: text.slice(tok.start, tok.end), m: tok.m })
    cursor = tok.end
  }
  if (cursor < text.length) out.push({ t: text.slice(cursor) })
  return out
}