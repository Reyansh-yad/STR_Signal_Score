# STR Completeness Scorer
### AI/ML Intelligence Hackathon — Track 1: Signal vs Noise Detection

> Automatically scores each Suspicious Transaction Report (STR) on how analytically complete and useful it is — so analysts can prioritise their review queue instead of reading hundreds of reports manually.

---

## The Problem

Financial institutions file Suspicious Transaction Reports (STRs) whenever they detect potentially suspicious activity. But report quality varies wildly:

| Low Quality (Score ≈ 0.0) | High Quality (Score ≈ 1.0) |
|---|---|
| *"Suspicious transaction observed."* | *"Between 2022-11-01 and 2022-11-01, the customer conducted 4 ACH transfers amounting to NPR 7,686,932... deliberately kept below reporting thresholds... consistent with Smurfing FanOut..."* |

An analyst who receives 276 reports cannot treat them equally. This system ranks them by completeness so the most actionable reports rise to the top.

---

## Dataset

All data is synthetic (no real customers or accounts). Amounts are in NPR (Nepali Rupee).

```
dataset/
├── reports/               # 276 STR XML files — PRIMARY input for this track
│   ├── report_000001.xml
│   ├── report_000002.xml
│   └── ...  (up to report_000276.xml)
├── transactions.csv       # 100,222 transaction rows with engineered features
├── accounts.csv           # 65,339 KYC records for all accounts
├── ml_features.csv        # Model-ready numeric features per transaction
└── graph_edges.csv        # Sender → receiver money-flow edge list
```

### Files Used in This Track

| File | Role |
|------|------|
| `reports/*.xml` | **Primary** — STR reports to score |
| `transactions.csv` | Optional — cross-reference transaction facts |
| `accounts.csv` | Optional — verify party/KYC details |

### Report Statistics

- Total reports: **276**
- Narrative length: **32 – 1,291 characters** (avg ~807)
- Vague reports (< 50 chars): **100** — these should score near 0
- Detailed reports (> 500 chars): **176** — these should score higher

### XML Report Structure

Each report contains:

```xml
<report>
  <report_id>RPT-2026-000001</report_id>
  <submission_date>2026-06-14</submission_date>
  <reason>Free-text narrative written by reporting officer</reason>

  <transaction>
    <transmode_code>Z</transmode_code>          <!-- transaction mode -->
    <amount_local>535368.64</amount_local>
    <t_from_my_client>
      <from_funds_code>Z</from_funds_code>      <!-- fund source code -->
      <from_account>
        <personal_account_type>Z</personal_account_type>
        <account_name>John Jensen</account_name>
        ...
      </from_account>
    </t_from_my_client>
    <t_to>
      <to_funds_code>Z</to_funds_code>          <!-- fund destination code -->
      ...
    </t_to>
  </transaction>

  <report_indicators>
    <indicator>OD</indicator>                   <!-- typology indicator -->
  </report_indicators>
</report>
```

---

## Approach

The system uses a **hybrid scoring model** combining two signals:

### 1. Structured Field Score (40% weight) — Rule-Based

Checks how many coded fields are filled with specific (non-generic) values:

| Field | Generic / Empty | Specific |
|-------|----------------|---------|
| `transmode_code` | `Z` (unknown) | `P`, `A`, `F`, etc. |
| `from_funds_code` | `Z` (unknown) | `D`, `W`, `T`, etc. |
| `to_funds_code` | `Z` (unknown) | `D`, `W`, `T`, etc. |
| `personal_account_type` | `Z` (unknown) | `S`, `C`, `F`, etc. |
| `report_indicators` | missing | present |
| Party details | missing fields | name + SSN + DOB present |

### 2. Narrative Quality Score (60% weight) — NLP-Based

Analyses the free-text `reason` field for information density:

- **Entity presence** — specific amounts (NPR figures), dates, account numbers, party names detected via spaCy NER + regex
- **Typology mention** — does the narrative name a known pattern (Smurfing, Layering, Scatter-Gather, etc.)?
- **KYC inconsistency** — does it reference income profile vs. transaction mismatch?
- **Customer explanation** — is the customer's stated reason for the activity mentioned?
- **Boilerplate detection** — TF-IDF similarity against known generic phrases penalises copy-paste narratives
- **Length penalty** — very short narratives are capped regardless of other signals

### Final Score

```
completeness_score = 0.4 × structured_score + 0.6 × narrative_score
```

Each score component is independently explainable — the system flags exactly which fields are missing or weak.

---

## Project Structure

```
str-completeness-scorer/
│
├── data/
│   └── reports/                  # Place the 276 XML files here
│
├── notebooks/
│   └── 01_eda.ipynb              # EDA: field fill rates, narrative distributions
│
├── src/
│   ├── parser.py                 # XML → structured dict for each report
│   ├── structured_scorer.py      # Coded field completeness scorer
│   ├── narrative_scorer.py       # NLP-based narrative quality scorer
│   └── pipeline.py               # Combines scores, outputs ranked DataFrame
│
├── demo/
│   └── app.py                    # Streamlit demo UI
│
├── outputs/
│   └── scored_reports.csv        # Final ranked output
│
├── requirements.txt
└── README.md
```

---

## Quickstart

### 1. Clone & Install

```bash
git clone https://github.com/Reyansh-yad/str-completeness-scorer.git
cd str-completeness-scorer

pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 2. Add Dataset

Place the 276 XML report files into `data/reports/`.

### 3. Run the Scoring Pipeline

```bash
python src/pipeline.py --reports data/reports/ --output outputs/scored_reports.csv
```

Output columns: `report_id`, `completeness_score`, `structured_score`, `narrative_score`, `weak_fields`, `explanation`

### 4. Launch the Demo

```bash
streamlit run demo/app.py
```

---

## Output Format

```csv
report_id,       completeness_score, structured_score, narrative_score, explanation
RPT-2026-000001, 0.08,               0.12,             0.05,            "Narrative too vague (32 chars). Missing: funds_code, account_type, indicators. No amounts/dates/parties detected."
RPT-2026-000122, 0.91,               0.85,             0.94,            "Specific amounts (NPR 7,686,932), dates, 3 named parties, typology identified (Smurfing FanOut), KYC mismatch noted."
```

---

## Tech Stack

| Component | Library |
|-----------|---------|
| XML parsing | `lxml`, `xml.etree.ElementTree` |
| NLP / NER | `spaCy` (en_core_web_sm) |
| Boilerplate detection | `scikit-learn` TF-IDF |
| Regex patterns | `re` (NPR amounts, dates, account numbers) |
| Data processing | `pandas`, `numpy` |
| Demo UI | `streamlit` |

---

## Requirements

```
spacy>=3.7.0
scikit-learn>=1.4.0
pandas>=2.0.0
numpy>=1.26.0
lxml>=5.0.0
streamlit>=1.35.0
```

---

## Evaluation

| Metric | Target |
|--------|--------|
| Score separation | Vague reports (< 50 char narratives) score < 0.2; detailed reports score > 0.7 |
| Explainability | Every score includes a plain-language reason |
| Coverage | All 276 reports scored in < 30 seconds |
| Demo | Live scoring of any uploaded report via Streamlit |


