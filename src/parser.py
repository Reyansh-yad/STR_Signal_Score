"""
XML Parser for STR Reports.

Parses goAML-style XML reports and returns a rich structured dictionary
containing all transactions, party details, and KYC signals.
"""

import os
from defusedxml import ElementTree as ET


def _get_text(parent, tag):
    """Get text from a tag, handling namespaces."""
    node = parent.find(f".//{tag}")
    return node.text.strip() if node is not None and node.text else None


def _parse_person(person_node):
    """Extract person details from a t_person element."""
    if person_node is None:
        return {}
    return {
        "first_name": _get_text(person_node, "first_name"),
        "last_name": _get_text(person_node, "last_name"),
        "gender": _get_text(person_node, "gender"),
        "birthdate": _get_text(person_node, "birthdate"),
        "birth_place": _get_text(person_node, "birth_place"),
        "mothers_name": _get_text(person_node, "mothers_name"),
        "ssn": _get_text(person_node, "ssn"),
        "passport_number": _get_text(person_node, "passport_number"),
        "passport_country": _get_text(person_node, "passport_country"),
        "nationality": _get_text(person_node, "nationality1"),
        "residence": _get_text(person_node, "residence"),
        "occupation": _get_text(person_node, "occupation"),
        "tax_number": _get_text(person_node, "tax_number"),
        "has_address": person_node.find(".//addresses/address") is not None,
        "has_phone": person_node.find(".//phones/phone") is not None,
    }


def _parse_entity(entity_node):
    """Extract entity (company) details from a t_entity element."""
    if entity_node is None:
        return {}
    return {
        "name": _get_text(entity_node, "name"),
        "legal_form": _get_text(entity_node, "incorporation_legal_form"),
        "incorporation_number": _get_text(entity_node, "incorporation_number"),
        "business": _get_text(entity_node, "business"),
        "incorporation_country": _get_text(entity_node, "incorporation_country_code"),
        "incorporation_date": _get_text(entity_node, "incorporation_date"),
        "tax_number": _get_text(entity_node, "tax_number"),
    }


def _parse_account(account_node, prefix="from"):
    """Extract account details from a from_account or to_account element."""
    if account_node is None:
        return {}

    result = {
        f"{prefix}_institution": _get_text(account_node, "institution_name"),
        f"{prefix}_institution_code": _get_text(account_node, "institution_code"),
        f"{prefix}_branch": _get_text(account_node, "branch"),
        f"{prefix}_account_number": _get_text(account_node, "account"),
        f"{prefix}_currency": _get_text(account_node, "currency_code"),
        f"{prefix}_account_name": _get_text(account_node, "account_name"),
        f"{prefix}_account_type": _get_text(account_node, "personal_account_type"),
        f"{prefix}_opened": _get_text(account_node, "opened"),
    }

    # Extract signatory person details
    signatory = account_node.find(".//signatory")
    if signatory is not None:
        person = signatory.find(".//t_person")
        if person is not None:
            result[f"{prefix}_person"] = _parse_person(person)

    # Extract entity details (for corporate accounts)
    entity = account_node.find(".//t_entity")
    if entity is not None:
        result[f"{prefix}_entity"] = _parse_entity(entity)

    return result


def _parse_transaction(tx_node):
    """Parse a single transaction element into a structured dict."""
    if tx_node is None:
        return None

    tx = {
        "transaction_number": _get_text(tx_node, "transactionnumber"),
        "internal_ref": _get_text(tx_node, "internal_ref_number"),
        "location": _get_text(tx_node, "transaction_location"),
        "date": _get_text(tx_node, "date_transaction"),
        "value_date": _get_text(tx_node, "value_date"),
        "transmode_code": _get_text(tx_node, "transmode_code"),
        "transmode_comment": _get_text(tx_node, "transmode_comment"),
        "amount_local": _get_text(tx_node, "amount_local"),
        "comments": _get_text(tx_node, "comments"),
    }

    # From side
    t_from = tx_node.find(".//t_from_my_client")
    if t_from is not None:
        tx["from_funds_code"] = _get_text(t_from, "from_funds_code")
        tx["from_country"] = _get_text(t_from, "from_country")

        # Foreign currency
        foreign = t_from.find(".//from_foreign_currency")
        if foreign is not None:
            tx["from_foreign_currency"] = _get_text(foreign, "foreign_currency_code")
            tx["from_foreign_amount"] = _get_text(foreign, "foreign_amount")
            tx["from_exchange_rate"] = _get_text(foreign, "foreign_exchange_rate")

        from_account = t_from.find(".//from_account")
        tx.update(_parse_account(from_account, "from"))

    # To side
    t_to = tx_node.find(".//t_to")
    if t_to is not None:
        tx["to_funds_code"] = _get_text(t_to, "to_funds_code")
        tx["to_country"] = _get_text(t_to, "to_country")

        to_account = t_to.find(".//to_account")
        tx.update(_parse_account(to_account, "to"))

    return tx


def parse_xml_report(file_path):
    """
    Parses an STR XML report and returns a rich structured dictionary.

    Returns a dict with:
        - report_id, reason (narrative)
        - transactions: list of all transaction dicts
        - transaction_count: number of transactions
        - total_amount: sum of all transaction amounts
        - unique_counterparties: set of to_account_name values
        - is_cross_border: whether any from_country != to_country
        - reporting_person: dict of reporting officer details
        - report_indicators: list of indicator codes
        - Aggregated structured fields from first transaction for backward compat
    """
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()

        report_id = _get_text(root, "report_id")
        reason = _get_text(root, "reason")
        submission_date = _get_text(root, "submission_date")
        entity_reference = _get_text(root, "entity_reference")

        # Reporting person
        rp_node = root.find(".//reporting_person")
        reporting_person = {}
        if rp_node is not None:
            reporting_person = {
                "first_name": _get_text(rp_node, "first_name"),
                "last_name": _get_text(rp_node, "last_name"),
                "occupation": _get_text(rp_node, "occupation"),
            }

        # Parse ALL transactions
        transactions = []
        for tx_node in root.findall(".//transaction"):
            tx = _parse_transaction(tx_node)
            if tx:
                transactions.append(tx)

        # Aggregate transaction-level signals
        total_amount = 0.0
        counterparties = set()
        is_cross_border = False
        for tx in transactions:
            # Amount
            amt_str = tx.get("amount_local")
            if amt_str:
                try:
                    total_amount += float(amt_str)
                except (ValueError, TypeError):
                    pass
            # Counterparties
            to_name = tx.get("to_account_name")
            if to_name:
                counterparties.add(to_name)
            from_name = tx.get("from_account_name")
            if from_name:
                counterparties.add(from_name)
            # Cross-border check
            fc = tx.get("from_country", "")
            tc = tx.get("to_country", "")
            if fc and tc and fc != tc:
                is_cross_border = True

        # Indicators
        indicators = []
        report_indicators = root.find(".//report_indicators")
        if report_indicators is not None:
            for ind in report_indicators.findall(".//indicator"):
                if ind.text:
                    indicators.append(ind.text.strip())

        # Build result — backward-compatible fields from first transaction
        first_tx = transactions[0] if transactions else {}

        return {
            "report_id": report_id,
            "reason": reason,
            "submission_date": submission_date,
            "entity_reference": entity_reference,
            "reporting_person": reporting_person,

            # First-transaction fields (backward compat)
            "transmode_code": first_tx.get("transmode_code"),
            "transmode_comment": first_tx.get("transmode_comment"),
            "from_funds_code": first_tx.get("from_funds_code"),
            "to_funds_code": first_tx.get("to_funds_code"),
            "personal_account_type": first_tx.get("from_account_type"),
            "amount": first_tx.get("amount_local"),
            "date": first_tx.get("date"),

            # Rich transaction data
            "transactions": transactions,
            "transaction_count": len(transactions),
            "total_amount": round(total_amount, 2),
            "unique_counterparties": counterparties,
            "is_cross_border": is_cross_border,

            # Indicators
            "report_indicators": indicators,

            # Party completeness signals (from first tx sender)
            "sender_person": first_tx.get("from_person", {}),
            "sender_entity": first_tx.get("from_entity", {}),
        }
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
        return None
