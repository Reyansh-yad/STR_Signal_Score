export type Tier = "HIGH_SIGNAL" | "NEEDS_REVIEW" | "LOW_QUALITY_NOISE"

export interface StrRow {
  report_id: string
  reason: string
  xml_acc_long: string
  indicator_count: number
  mode_code: string
  funds_code: string
  acct_type: string
  country: string
  account_number: string
  account_id: string
  sender_account: string
  is_suspicious_tx: number
  amount_zscore: number
  sender_pep: number
  len: number
  ent_mony: number
  ent_date: number
  uniqueness: number
  completeness_score: number
  final_score: number
  weaknesses: string
  /** Derived from `final_score` thresholds. */
  tier: Tier
  /** Derived proxies (CSV has only `completeness_score` + `final_score`). */
  struct_score: number
  narr_score: number
  expl_score: number
}

export interface TierCount {
  tier: Tier
  count: number
}

export interface HistogramBin {
  /** Inclusive lower bound, exclusive upper bound (0..0.1, 0.1..0.2, …). */
  range: string
  lo: number
  hi: number
  low: number
  med: number
  high: number
}

export interface WeaknessCount {
  name: string
  count: number
}

export interface CountryCount {
  country: string
  count: number
}

export interface ModeCount {
  mode: string
  count: number
}

export interface IndicatorCount {
  indicators: number
  count: number
}

export interface NarrativeLengthBin {
  range: string
  lo: number
  hi: number
  count: number
}

export interface ScoreSuspicionBin {
  range: string
  lo: number
  hi: number
  count: number
  suspiciousCount: number
  suspicionRate: number
}

export interface Summary {
  total: number
  high: number
  review: number
  low: number
  avgScore: number
  avgStructure: number
  avgNarrative: number
  avgExplanation: number
  histogram: HistogramBin[]
  tierBreakdown: TierCount[]
  topWeaknesses: WeaknessCount[]
  topCountries: CountryCount[]
  edaNarrLengthBins: NarrativeLengthBin[]
  edaCountries: CountryCount[]
  edaModes: ModeCount[]
  edaIndicatorCounts: IndicatorCount[]
  scoreSuspicionBins: ScoreSuspicionBin[]
}
