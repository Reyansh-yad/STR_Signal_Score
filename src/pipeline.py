"""
STR Completeness Scoring Pipeline.

Orchestrates the parsing, structured scoring, and narrative scoring of
STR reports. Produces a ranked DataFrame with per-report scores,
explanations, and metadata.
"""

import os
import sys
import argparse
import pandas as pd

# Allow running from project root or src/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.parser import parse_xml_report
from src.structured_scorer import score_structured_fields
from src.narrative_scorer import score_narrative


def _risk_tier(score):
    """Map score to human-readable risk tier."""
    if score >= 0.70:
        return "HIGH"
    if score >= 0.40:
        return "MEDIUM"
    return "LOW"


def _build_explanation(total_score, struct_score, narr_score,
                       struct_weak, struct_strong, narr_strengths, narr_weaknesses):
    """Build a concise, human-readable explanation string."""
    parts = []

    # Overall assessment
    if total_score >= 0.70:
        parts.append("Well-documented report.")
    elif total_score >= 0.40:
        parts.append("Partially complete report.")
    else:
        parts.append("Incomplete/vague report.")

    # Top strengths (max 3)
    all_strengths = struct_strong + narr_strengths
    if all_strengths:
        top = all_strengths[:3]
        parts.append(f"Strengths: {'; '.join(top)}.")

    # Key weaknesses (max 3)
    all_weak = struct_weak + narr_weaknesses
    if all_weak:
        top_weak = all_weak[:3]
        parts.append(f"Issues: {'; '.join(top_weak)}.")

    return " ".join(parts)


def score_single_report(data):
    """
    Score a single parsed report dict.

    Returns a result dict with all scoring columns.
    """
    struct_score, struct_weak, struct_strong = score_structured_fields(data)
    narr_score, narr_strengths, narr_weaknesses = score_narrative(data.get("reason", ""))

    # Weighted composite: 40% Structured, 60% Narrative
    total_score = round((0.4 * struct_score) + (0.6 * narr_score), 4)

    explanation = _build_explanation(
        total_score, struct_score, narr_score,
        struct_weak, struct_strong, narr_strengths, narr_weaknesses,
    )

    reason_text = data.get("reason", "") or ""

    return {
        "report_id": data.get("report_id", "UNKNOWN"),
        "completeness_score": round(total_score, 4),
        "structured_score": round(struct_score, 4),
        "narrative_score": round(narr_score, 4),
        "risk_tier": _risk_tier(total_score),
        "transaction_count": data.get("transaction_count", 0),
        "total_amount": data.get("total_amount", 0.0),
        "is_cross_border": data.get("is_cross_border", False),
        "narrative_length": len(reason_text),
        "counterparty_count": len(data.get("unique_counterparties", set())),
        "weak_fields": "; ".join(struct_weak),
        "strengths": "; ".join(struct_strong + narr_strengths),
        "weaknesses": "; ".join(struct_weak + narr_weaknesses),
        "explanation": explanation,
        "reason": reason_text[:500] if reason_text else "",
    }


def process_reports(reports_dir, output_file):
    """Process all XML reports in a directory and output ranked CSV."""
    if not os.path.exists(reports_dir):
        print(f"Error: Directory '{reports_dir}' not found.")
        sys.exit(1)

    files = sorted([f for f in os.listdir(reports_dir) if f.endswith(".xml")])
    if not files:
        print(f"Error: No XML files found in '{reports_dir}'.")
        sys.exit(1)

    print(f"Found {len(files)} reports. Processing...")

    results = []
    errors = []

    for i, filename in enumerate(files, 1):
        file_path = os.path.join(reports_dir, filename)
        try:
            data = parse_xml_report(file_path)
            if data is None:
                errors.append(f"{filename}: parser returned None")
                continue

            result = score_single_report(data)
            result["source_file"] = filename
            results.append(result)

        except Exception as e:
            errors.append(f"{filename}: {e}")

        # Progress indicator
        if i % 50 == 0 or i == len(files):
            print(f"  Processed {i}/{len(files)}...")

    if errors:
        print(f"\nWarnings ({len(errors)} errors):")
        for err in errors[:5]:
            print(f"  ⚠ {err}")
        if len(errors) > 5:
            print(f"  ... and {len(errors) - 5} more")

    if not results:
        print("No reports were successfully processed.")
        sys.exit(1)

    df = pd.DataFrame(results)
    df = df.sort_values(by="completeness_score", ascending=False).reset_index(drop=True)

    # Summary statistics
    print(f"\n{'='*60}")
    print(f"  SCORING SUMMARY")
    print(f"{'='*60}")
    print(f"  Reports processed:   {len(df)}")
    print(f"  Score range:         {df['completeness_score'].min():.3f} - {df['completeness_score'].max():.3f}")
    print(f"  Mean score:          {df['completeness_score'].mean():.3f}")
    print(f"  Median score:        {df['completeness_score'].median():.3f}")
    print(f"  Std deviation:       {df['completeness_score'].std():.3f}")
    print(f"  HIGH tier (>=0.70):  {(df['completeness_score'] >= 0.70).sum()}")
    print(f"  MEDIUM tier:         {((df['completeness_score'] >= 0.40) & (df['completeness_score'] < 0.70)).sum()}")
    print(f"  LOW tier (<0.40):    {(df['completeness_score'] < 0.40).sum()}")
    print(f"{'='*60}")

    # Save
    os.makedirs(os.path.dirname(output_file) if os.path.dirname(output_file) else ".", exist_ok=True)
    df.to_csv(output_file, index=False)
    print(f"\nResults saved to {output_file}")

    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="STR Completeness Scorer — Score and rank STR reports by analytical completeness"
    )
    parser.add_argument(
        "--reports", type=str, default="data/reports/",
        help="Path to directory containing XML report files",
    )
    parser.add_argument(
        "--output", type=str, default="outputs/scored_reports.csv",
        help="Path for output CSV file",
    )
    args = parser.parse_args()

    process_reports(args.reports, args.output)
