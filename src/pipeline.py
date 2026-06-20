"""
STR Completeness Scoring Pipeline.

Orchestrates the parsing, structured scoring, and narrative scoring of
STR reports. Also merges external Ground Truth (accounts, ml_features)
to produce a complete dashboard-ready dataset.
"""

import os
import sys
import re
import argparse
import pandas as pd
import numpy as np

# Allow running from project root or src/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.parser import parse_xml_report
from src.structured_scorer import score_structured_fields
from src.narrative_scorer import score_narrative

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.neighbors import NearestNeighbors
    HAVE_SKLEARN = True
except ImportError:
    HAVE_SKLEARN = False
    print("Warning: scikit-learn not installed, uniqueness will default to 1.0")

AMOUNT_PATTERN = re.compile(r"NPR\s?[\d,]+(?:\.\d+)?|(?:approximately|amounting\s+to)\s+(?:NPR\s?)?[\d,]+(?:\.\d+)?", re.IGNORECASE)
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")

def score_single_report(data):
    """
    Score a single parsed report dict.
    Returns a result dict with all scoring columns and required metadata.
    """
    struct_score, struct_weak, struct_strong = score_structured_fields(data)
    reason_text = data.get("reason", "") or ""
    narr_score, narr_strengths, narr_weaknesses = score_narrative(reason_text)

    # Weighted composite: 40% Structured, 60% Narrative
    total_score = round((0.4 * struct_score) + (0.6 * narr_score), 4)

    # Extract base features
    len_text = len(reason_text.strip())
    # Count unique money amounts
    matches_mony = AMOUNT_PATTERN.findall(reason_text)
    ent_mony_set = set(re.findall(r"[\d,]+\.?\d*", m)[0].replace(",", "") for m in matches_mony if re.findall(r"[\d,]+\.?\d*", m))
    ent_mony = len([a for a in ent_mony_set if len(a) >= 3])
    
    ent_date = len(set(DATE_PATTERN.findall(reason_text)))

    transactions = data.get("transactions", [])
    first_tx = transactions[0] if transactions else {}
    xml_acc_long = first_tx.get("from_account_number", "")
    if not xml_acc_long:
        # Fallback to general sender account if available
        xml_acc_long = data.get("sender_person", {}).get("account_number", "")

    return {
        "report_id": data.get("report_id", "UNKNOWN"),
        "reason": reason_text,
        "xml_acc_long": xml_acc_long,
        "indicator_count": len(data.get("report_indicators", [])),
        "mode_code": data.get("transmode_code", "Unknown"),
        "funds_code": data.get("from_funds_code", "Unknown"),
        "acct_type": data.get("personal_account_type", "Unknown"),
        "country": data.get("from_country", "Unknown") if data.get("from_country") else "Unknown",
        "len": len_text,
        "ent_mony": ent_mony,
        "ent_date": ent_date,
        "completeness_score": round(total_score, 4),
        "final_score": round(total_score, 4), # Will be updated if we do more adjustments
        "weaknesses": "; ".join(struct_weak + narr_weaknesses) if (struct_weak or narr_weaknesses) else "Analytical Signal: Complete",
        "sender_pep": 0 # Placeholder for PEP status
    }

def process_reports(reports_dir, accounts_csv, features_csv, output_file):
    """Process all XML reports and merge with ML features, outputting a ranked CSV."""
    if not os.path.exists(reports_dir):
        print(f"Error: Directory '{reports_dir}' not found.")
        sys.exit(1)

    files = sorted([f for f in os.listdir(reports_dir) if f.endswith(".xml")])
    if not files:
        print(f"Error: No XML files found in '{reports_dir}'.")
        sys.exit(1)

    print(f"Found {len(files)} reports. Processing XMLs...")

    results = []
    errors = []

    for i, filename in enumerate(files, 1):
        file_path = os.path.join(reports_dir, filename)
        try:
            data = parse_xml_report(file_path)
            if data is None:
                errors.append(f"{filename}: parser returned None")
                continue

            # In the notebook, country was pulled from from_country
            if data.get("from_country") is None and data.get("transactions"):
                data["from_country"] = data["transactions"][0].get("from_country", "")

            result = score_single_report(data)
            results.append(result)

        except Exception as e:
            errors.append(f"{filename}: {e}")

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

    # Calculate uniqueness across all reports
    print("Extracting NLP specificity and Scalable Uniqueness...")
    texts = df['reason'].fillna("").tolist()
    if HAVE_SKLEARN and len(texts) > 1:
        tfidf = TfidfVectorizer(max_features=500, stop_words='english')
        tfidf_matrix = tfidf.fit_transform(texts)
        nn = NearestNeighbors(n_neighbors=min(6, len(texts)), metric='cosine')
        nn.fit(tfidf_matrix)
        distances, _ = nn.kneighbors(tfidf_matrix)
        df['uniqueness'] = distances[:, 1:].mean(axis=1)
    else:
        df['uniqueness'] = 1.0

    # 2. Schema-Validated Bridging
    if all(os.path.exists(p) for p in [accounts_csv, features_csv]):
        print(f"Merging external datasets ({accounts_csv}, {features_csv})...")
        acc_map = pd.read_csv(accounts_csv)
        ml_feats = pd.read_csv(features_csv)

        risk = ml_feats.groupby('Sender_account').agg({'is_suspicious_tx':'max','amount_zscore':'mean'}).reset_index()
        df = df.merge(acc_map[['account_number', 'account_id']], left_on='xml_acc_long', right_on='account_number', how='left')
        df = df.merge(risk, left_on='account_id', right_on='Sender_account', how='left')

        df[['is_suspicious_tx', 'amount_zscore']] = df[['is_suspicious_tx', 'amount_zscore']].fillna(0)
    else:
        print("Warning: CSV datasets missing. Proceeding in Pure-XML mode.")
        df['account_number'] = ''
        df['account_id'] = ''
        df['Sender_account'] = ''
        df['is_suspicious_tx'] = 0
        df['amount_zscore'] = 0.0

    # Sort and write
    df = df.sort_values(by="completeness_score", ascending=False).reset_index(drop=True)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_file) if os.path.dirname(output_file) else ".", exist_ok=True)
    df.to_csv(output_file, index=False)
    
    # Also copy to outputs/scored_reports.csv for legacy compatibility
    legacy_out = "outputs/scored_reports.csv"
    os.makedirs(os.path.dirname(legacy_out), exist_ok=True)
    df.to_csv(legacy_out, index=False)

    print(f"\nResults saved to {output_file} and {legacy_out}")

    # Summary statistics
    print(f"\n{'='*60}")
    print(f"  SCORING SUMMARY")
    print(f"{'='*60}")
    print(f"  Reports processed:   {len(df)}")
    print(f"  Score range:         {df['completeness_score'].min():.3f} - {df['completeness_score'].max():.3f}")
    print(f"  Mean score:          {df['completeness_score'].mean():.3f}")
    print(f"  HIGH tier (>=0.70):  {(df['completeness_score'] >= 0.70).sum()}")
    print(f"  MEDIUM tier:         {((df['completeness_score'] >= 0.40) & (df['completeness_score'] < 0.70)).sum()}")
    print(f"  LOW tier (<0.40):    {(df['completeness_score'] < 0.40).sum()}")
    print(f"{'='*60}")

    return df

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="STR Completeness Scorer — Connects data and generates final results")
    parser.add_argument("--reports", type=str, default="data/reports/", help="Path to XML report files")
    parser.add_argument("--accounts", type=str, default="data/accounts.csv", help="Path to accounts.csv")
    parser.add_argument("--features", type=str, default="data/ml_features.csv", help="Path to ml_features.csv")
    parser.add_argument("--output", type=str, default="Results/STR_QUALITY_RANKED_FINAL.csv", help="Path for output CSV file")
    
    args = parser.parse_args()

    process_reports(args.reports, args.accounts, args.features, args.output)
