"""
Structured Field Completeness Scorer.

Evaluates how completely and specifically the coded/structured fields
in an STR report are filled. Uses 12 weighted checks across transaction
metadata, party KYC, and report structure.
"""


def _check_code_field(value, label, weight=1.0):
    """Check if a coded field has a specific (non-generic) value."""
    if value and str(value).upper() != "Z":
        return weight, [], [f"{label} specified ({value})"]
    return 0.0, [label], []


def _check_presence(value, label, weight=1.0):
    """Check if a field is present and non-empty."""
    if value and str(value).strip() and str(value) != "0":
        return weight, [], [f"{label} present"]
    return 0.0, [label], []


def score_structured_fields(data):
    """
    Calculates a score (0.0 to 1.0) based on the completeness and specificity
    of structured fields in the STR.

    Uses 12 weighted criteria across:
    - Transaction metadata (codes, modes)
    - Party/KYC completeness (identity documents, contact, address)
    - Report structure (indicators, multi-transaction)

    Returns:
        (score: float, weak_fields: list, strong_fields: list)
    """
    score = 0.0
    max_score = 0.0
    weak_fields = []
    strong_fields = []

    def add_check(earned, max_w, weak, strong):
        nonlocal score, max_score
        score += earned
        max_score += max_w
        weak_fields.extend(weak)
        strong_fields.extend(strong)

    # ── 1. Transaction Mode Code (weight: 1.0) ──────────────────────────
    earned, weak, strong = _check_code_field(
        data.get("transmode_code"), "transaction mode", 1.0
    )
    add_check(earned, 1.0, weak, strong)

    # ── 2. Source of Funds Code (weight: 1.0) ────────────────────────────
    earned, weak, strong = _check_code_field(
        data.get("from_funds_code"), "source of funds", 1.0
    )
    add_check(earned, 1.0, weak, strong)

    # ── 3. Destination of Funds Code (weight: 1.0) ───────────────────────
    earned, weak, strong = _check_code_field(
        data.get("to_funds_code"), "destination of funds", 1.0
    )
    add_check(earned, 1.0, weak, strong)

    # ── 4. Account Type (weight: 1.0) ────────────────────────────────────
    earned, weak, strong = _check_code_field(
        data.get("personal_account_type"), "account type", 1.0
    )
    add_check(earned, 1.0, weak, strong)

    # ── 5. Report Indicators (weight: 1.0) ───────────────────────────────
    indicators = data.get("report_indicators", [])
    if indicators and len(indicators) > 0:
        add_check(1.0, 1.0, [], ["typology indicators present"])
    else:
        add_check(0.0, 1.0, ["typology indicators"], [])

    # ── 6. Sender Identity Document (weight: 1.5) ───────────────────────
    # SSN or passport — critical KYC field
    sender = data.get("sender_person", {})
    has_ssn = bool(sender.get("ssn") and str(sender.get("ssn")) != "0")
    has_passport = bool(sender.get("passport_number"))
    if has_ssn and has_passport:
        add_check(1.5, 1.5, [], ["sender has SSN and passport"])
    elif has_ssn or has_passport:
        add_check(1.0, 1.5, [], ["sender has identity document"])
    else:
        # Check entity-level ID
        entity = data.get("sender_entity", {})
        if entity.get("incorporation_number") or entity.get("tax_number"):
            add_check(1.0, 1.5, [], ["entity has registration/tax number"])
        else:
            add_check(0.0, 1.5, ["sender identity document (SSN/passport)"], [])

    # ── 7. Sender Birthdate (weight: 0.5) ────────────────────────────────
    if sender.get("birthdate"):
        add_check(0.5, 0.5, [], ["sender birthdate present"])
    else:
        # Entity incorporation date as alternative
        entity = data.get("sender_entity", {})
        if entity.get("incorporation_date"):
            add_check(0.5, 0.5, [], ["entity incorporation date present"])
        else:
            add_check(0.0, 0.5, ["sender birthdate/incorporation date"], [])

    # ── 8. Sender Address (weight: 0.5) ──────────────────────────────────
    if sender.get("has_address", False):
        add_check(0.5, 0.5, [], ["sender address present"])
    else:
        add_check(0.0, 0.5, ["sender address"], [])

    # ── 9. Sender Occupation (weight: 0.5) ───────────────────────────────
    if sender.get("occupation"):
        add_check(0.5, 0.5, [], ["sender occupation present"])
    else:
        entity = data.get("sender_entity", {})
        if entity.get("business"):
            add_check(0.5, 0.5, [], ["entity business type present"])
        else:
            add_check(0.0, 0.5, ["sender occupation/business type"], [])

    # ── 10. Transaction Mode Comment (weight: 0.5) ──────────────────────
    comment = data.get("transmode_comment", "")
    if comment and comment.strip():
        add_check(0.5, 0.5, [], ["transaction mode description present"])
    else:
        add_check(0.0, 0.5, ["transaction mode description"], [])

    # ── 11. Cross-border Information (weight: 0.5) ──────────────────────
    # Check if country fields are populated (even if same country)
    txs = data.get("transactions", [])
    has_country_info = False
    for tx in txs:
        if tx.get("from_country") or tx.get("to_country"):
            has_country_info = True
            break
    if has_country_info:
        add_check(0.5, 0.5, [], ["country/cross-border info present"])
    else:
        add_check(0.0, 0.5, ["country/cross-border information"], [])

    # ── 12. Multiple Transactions (weight: 1.0) ─────────────────────────
    tx_count = data.get("transaction_count", 0)
    if tx_count >= 3:
        add_check(1.0, 1.0, [], [f"multiple transactions ({tx_count})"])
    elif tx_count == 2:
        add_check(0.6, 1.0, [], [f"two transactions documented"])
    elif tx_count == 1:
        add_check(0.3, 1.0, [], ["single transaction documented"])
    else:
        add_check(0.0, 1.0, ["transaction details"], [])

    # ── Final ────────────────────────────────────────────────────────────
    final_score = score / max_score if max_score > 0 else 0.0
    final_score = round(min(max(final_score, 0.0), 1.0), 4)

    return final_score, weak_fields, strong_fields
