"""
Narrative Quality Scorer.

Analyzes the free-text reason/narrative of an STR report for analytical
completeness and information density. Uses ~10 graduated criteria including
boilerplate detection, entity density, typology identification, and more.
"""

import re
import math

try:
    import spacy
    try:
        nlp = spacy.load("en_core_web_sm")
    except OSError:
        nlp = None
except ImportError:
    nlp = None

# ── Known boilerplate phrases common in templated/vague reports ──────────
BOILERPLATE_PHRASES = [
    "suspicious transaction observed",
    "this report is submitted out of an abundance of caution",
    "for the compliance unit's further analysis",
    "does not, by itself, constitute a determination of wrongdoing",
    "report filed by reporting entity",
    "in the reviewing officer's judgement",
    "the customer has been with the institution for some years",
    "which the desk weighed before escalating",
    "no adverse media or sanctions matches were identified",
    "the velocity and aggregate value of the funds are not fully consistent",
    "during the branch's periodic transaction-monitoring review",
    "after an internal threshold alert was triggered",
]

# ── Expanded typology list matching all patterns in the dataset ──────────
TYPOLOGIES = [
    "smurfing", "layering", "structuring", "fan-out", "fanout", "fan out",
    "scatter-gather", "scatter gather", "scattergather",
    "kyc mismatch", "kyc inconsistency",
    "cyclic flow", "cyclicflow", "cyclic-flow",
    "behavioural change", "behavioral change",
    "over-invoicing", "over invoicing", "overinvoicing",
    "fan in", "fan-in", "fanin",
    "cash withdrawal", "cash deposit",
    "round tripping", "round-tripping", "roundtripping",
    "shell company", "money laundering", "terrorist financing",
    "trade-based laundering", "trade based laundering",
    "layering chain", "rapid succession",
]

# ── Regex patterns ───────────────────────────────────────────────────────
NPR_AMOUNT_RE = re.compile(
    r"NPR\s?[\d,]+(?:\.\d+)?|"
    r"(?:approximately|amounting\s+to)\s+(?:NPR\s?)?[\d,]+(?:\.\d+)?",
    re.IGNORECASE,
)
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
ACCOUNT_RE = re.compile(r"NP\d{18,22}")
KYC_MISMATCH_RE = re.compile(
    r"income\s+profile|not\s+(?:fully\s+)?consistent|mismatch|"
    r"declared\s+income|velocity.*funds|disproportionate",
    re.IGNORECASE,
)
CROSS_BORDER_RE = re.compile(
    r"cross[- ]?border|routed\s+to\s+counterpart|outside.*corridor|"
    r"international|foreign\s+(?:currency|exchange)",
    re.IGNORECASE,
)
COUNTERPARTY_RE = re.compile(
    r"counterpart(?:y|ies)\s+observed\s+were\s+(.+?)(?:\.|For\s+context)",
    re.IGNORECASE,
)


def _compute_boilerplate_ratio(text):
    """
    Compute what fraction of the narrative is boilerplate text.
    Returns a ratio from 0.0 (fully original) to 1.0 (fully boilerplate).
    """
    text_lower = text.lower()
    total_chars = len(text_lower)
    if total_chars == 0:
        return 1.0

    boilerplate_chars = 0
    for phrase in BOILERPLATE_PHRASES:
        idx = text_lower.find(phrase)
        while idx != -1:
            boilerplate_chars += len(phrase)
            idx = text_lower.find(phrase, idx + len(phrase))

    return min(boilerplate_chars / total_chars, 1.0)


def _count_unique_amounts(text):
    """Count unique NPR amounts mentioned in the text."""
    matches = NPR_AMOUNT_RE.findall(text)
    # Extract just the numeric parts for deduplication
    amounts = set()
    for m in matches:
        nums = re.findall(r"[\d,]+\.?\d*", m)
        for n in nums:
            cleaned = n.replace(",", "")
            if len(cleaned) >= 3:  # Ignore very small numbers
                amounts.add(cleaned)
    return len(amounts)


def _count_unique_dates(text):
    """Count unique dates mentioned in the text."""
    return len(set(DATE_RE.findall(text)))


def _count_named_counterparties(text):
    """Count named counterparties from the narrative."""
    match = COUNTERPARTY_RE.search(text)
    if match:
        names = match.group(1)
        # Split by comma and count
        parts = [p.strip() for p in names.split(",") if p.strip()]
        return len(parts)
    return 0


def _unique_word_ratio(text):
    """Ratio of unique words to total words (lexical diversity)."""
    words = text.lower().split()
    if len(words) < 10:
        return 0.0
    return len(set(words)) / len(words)


def score_narrative(reason):
    """
    Analyzes the free-text reason for analytical completeness.

    Returns:
        (score: float 0.0-1.0, strengths: list, weaknesses: list)
    """
    if not reason or len(reason.strip()) == 0:
        return 0.0, [], ["Empty narrative"]

    text = reason.strip()
    char_count = len(text)
    score = 0.0
    max_score = 0.0
    strengths = []
    weaknesses = []

    def add(earned, max_w, strong_msg=None, weak_msg=None):
        nonlocal score, max_score
        score += earned
        max_score += max_w
        if strong_msg and earned > 0:
            strengths.append(strong_msg)
        if weak_msg and earned <= 0:
            weaknesses.append(weak_msg)

    # ── 1. Narrative Length (max: 2.0) ───────────────────────────────────
    max_score += 2.0
    if char_count < 50:
        score += 0.0
        weaknesses.append(f"Narrative too vague ({char_count} chars)")
    elif char_count < 200:
        score += 0.4
        weaknesses.append(f"Narrative is short ({char_count} chars)")
    elif char_count < 500:
        score += 1.0
        strengths.append("Moderate narrative length")
    elif char_count < 1000:
        score += 1.6
        strengths.append("Detailed narrative length")
    else:
        score += 2.0
        strengths.append(f"Comprehensive narrative ({char_count} chars)")

    # ── 2. Specific Amounts (max: 1.5) ──────────────────────────────────
    amt_count = _count_unique_amounts(text)
    max_score += 1.5
    if amt_count >= 3:
        score += 1.5
        strengths.append(f"Multiple specific amounts ({amt_count})")
    elif amt_count >= 1:
        score += 1.0
        strengths.append("Specific amounts detected")
    else:
        weaknesses.append("No specific amounts mentioned")

    # ── 3. Specific Dates (max: 1.0) ────────────────────────────────────
    date_count = _count_unique_dates(text)
    max_score += 1.0
    if date_count >= 2:
        score += 1.0
        strengths.append(f"Multiple dates referenced ({date_count})")
    elif date_count >= 1:
        score += 0.7
        strengths.append("Specific dates detected")
    else:
        weaknesses.append("No specific dates mentioned")

    # ── 4. Typology Identification (max: 1.0) ───────────────────────────
    text_lower = text.lower()
    found_typologies = [t for t in TYPOLOGIES if t in text_lower]
    max_score += 1.0
    if len(found_typologies) >= 2:
        score += 1.0
        strengths.append(f"Multiple typologies identified ({', '.join(found_typologies[:3])})")
    elif len(found_typologies) == 1:
        score += 0.8
        strengths.append(f"Typology identified ({found_typologies[0]})")
    else:
        weaknesses.append("No clear typology/pattern mentioned")

    # ── 5. Boilerplate Detection (penalty: -2.0 to 0.0) ────────────────
    bp_ratio = _compute_boilerplate_ratio(text)
    max_score += 2.0
    if bp_ratio < 0.15:
        score += 2.0
        strengths.append("Highly original narrative")
    elif bp_ratio < 0.35:
        score += 1.5
        strengths.append("Mostly original narrative")
    elif bp_ratio < 0.55:
        score += 1.0
        weaknesses.append("Moderate boilerplate detected")
    elif bp_ratio < 0.75:
        score += 0.5
        weaknesses.append("Heavy boilerplate detected")
    else:
        score += 0.0
        weaknesses.append("Narrative is mostly boilerplate text")

    # ── 6. Entity Density via spaCy (max: 1.5) ─────────────────────────
    max_score += 1.5
    if nlp:
        doc = nlp(text)
        entities = [
            ent for ent in doc.ents
            if ent.label_ in ("PERSON", "ORG", "GPE", "DATE", "MONEY", "CARDINAL")
        ]
        unique_ents = set((ent.text, ent.label_) for ent in entities)
        ent_count = len(unique_ents)
        if ent_count >= 6:
            score += 1.5
            strengths.append(f"High information density ({ent_count} entities)")
        elif ent_count >= 3:
            score += 1.0
            strengths.append(f"Good entity density ({ent_count} entities)")
        elif ent_count >= 1:
            score += 0.5
            strengths.append("Some entities detected")
        else:
            weaknesses.append("Low entity density")
    else:
        # Fallback heuristic: count capitalized multi-word sequences
        cap_words = re.findall(r"[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+", text)
        if len(cap_words) >= 3:
            score += 1.0
        elif len(cap_words) >= 1:
            score += 0.5
        else:
            weaknesses.append("Low entity density (spaCy unavailable)")

    # ── 7. Account Numbers (max: 1.0) ───────────────────────────────────
    acct_matches = ACCOUNT_RE.findall(text)
    max_score += 1.0
    if len(acct_matches) >= 2:
        score += 1.0
        strengths.append(f"Account numbers referenced ({len(acct_matches)})")
    elif len(acct_matches) >= 1:
        score += 0.6
        strengths.append("Account number referenced")
    else:
        # Not a strong weakness — narrative may not need explicit account numbers
        pass

    # ── 8. Named Counterparties (max: 1.0) ──────────────────────────────
    cp_count = _count_named_counterparties(text)
    max_score += 1.0
    if cp_count >= 3:
        score += 1.0
        strengths.append(f"Multiple counterparties named ({cp_count})")
    elif cp_count >= 1:
        score += 0.6
        strengths.append(f"Counterparties named ({cp_count})")
    else:
        weaknesses.append("No named counterparties")

    # ── 9. KYC Mismatch Language (max: 0.5) ─────────────────────────────
    max_score += 0.5
    if KYC_MISMATCH_RE.search(text):
        score += 0.5
        strengths.append("KYC/income mismatch noted")
    else:
        weaknesses.append("No KYC inconsistency discussion")

    # ── 10. Cross-border Mention (max: 0.5) ─────────────────────────────
    max_score += 0.5
    if CROSS_BORDER_RE.search(text):
        score += 0.5
        strengths.append("Cross-border activity referenced")
    else:
        pass  # Not always applicable

    # ── 11. Lexical Diversity (bonus/penalty: ±0.5) ─────────────────────
    uwratio = _unique_word_ratio(text)
    max_score += 0.5
    if uwratio >= 0.55:
        score += 0.5
        strengths.append(f"Good lexical diversity ({uwratio:.0%})")
    elif uwratio >= 0.40:
        score += 0.3
    else:
        if char_count > 100:
            weaknesses.append("Low lexical diversity (repetitive language)")

    # ── Final Score ─────────────────────────────────────────────────────
    final_score = score / max_score if max_score > 0 else 0.0

    # Cap very short narratives
    if char_count < 50:
        final_score = min(final_score, 0.15)
    elif char_count < 100:
        final_score = min(final_score, 0.30)

    final_score = round(min(max(final_score, 0.0), 1.0), 4)

    return final_score, strengths, weaknesses
