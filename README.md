<div align="center">

```
███████╗████████╗██████╗     ███████╗██╗ ██████╗ ███╗   ██╗ █████╗ ██╗
██╔════╝╚══██╔══╝██╔══██╗    ██╔════╝██║██╔════╝ ████╗  ██║██╔══██╗██║
███████╗   ██║   ██████╔╝    ███████╗██║██║  ███╗██╔██╗ ██║███████║██║
╚════██║   ██║   ██╔══██╗    ╚════██║██║██║   ██║██║╚██╗██║██╔══██║██║
███████║   ██║   ██║  ██║    ███████║██║╚██████╔╝██║ ╚████║██║  ██║███████╗
╚══════╝   ╚═╝   ╚═╝  ╚═╝    ╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
                              S C O R E
```

### AI/ML Intelligence Hackathon — Track 1: Signal vs Noise Detection

[![Live Demo](https://img.shields.io/badge/🔗%20Live%20Demo-str--signal--score.vercel.app-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://str-signal-score.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Reyansh--yad-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Reyansh-yad/str-completeness-scorer)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![spaCy](https://img.shields.io/badge/NLP-spaCy-09A3D5?style=for-the-badge)](https://spacy.io)
[![Streamlit](https://img.shields.io/badge/Demo-Streamlit-FF4B4B?style=for-the-badge&logo=streamlit&logoColor=white)](https://streamlit.io)

> **Automatically scores each Suspicious Transaction Report (STR) on analytical completeness** —
> so financial crime analysts can prioritise their review queue instead of reading 276 reports blind.

</div>

---

## ⚠️ The Problem

Financial institutions file STRs whenever suspicious activity is detected. But report quality varies wildly:

<table>
<tr>
<th>🟢 Signal &nbsp; (Score ≈ 1.0)</th>
<th>🔴 Noise &nbsp; (Score ≈ 0.0)</th>
</tr>
<tr>
<td><em>"Between 2022-11-01 and 2022-11-01, the customer conducted 4 ACH transfers amounting to NPR 7,686,932… deliberately kept below reporting thresholds… consistent with <strong>Smurfing FanOut</strong>…"</em></td>
<td><em>"Suspicious transaction observed."</em></td>
</tr>
</table>

An analyst reviewing **276 reports** cannot treat them equally.
This system ranks them by completeness so the most actionable reports surface first.

---

## 📊 Dataset

> All data is **synthetic** — no real customers, accounts, or financial institutions. Amounts in NPR (Nepali Rupee).

```
dataset/
├── 📁 reports/           # 276 STR XML files — PRIMARY input
├── 📄 transactions.csv   # 100,222 transaction rows with engineered features
├── 📄 accounts.csv       # 65,339 KYC records
├── 📄 ml_features.csv    # Model-ready numeric features per transaction
└── 📄 graph_edges.csv    # Sender → receiver money-flow edge list
```

| Stat | Value |
|------|-------|
| Total reports | **276** |
| Narrative length range | 32 – 1,291 characters |
| 🔴 Vague reports (< 50 chars) | **100** — target score `< 0.2` |
| 🟢 Detailed reports (> 500 chars) | **176** — target score `> 0.7` |

---

## 🧠 Scoring Model

The system uses a **hybrid model** — deterministic field checks combined with NLP analysis.

```
╔══════════════════════════════════════════════════════════════╗
║         completeness_score = 0.4 × structured_score         ║
║                            + 0.6 × narrative_score          ║
╚══════════════════════════════════════════════════════════════╝
```

### 🔷 Structured Field Score — 40% weight

Checks how many coded fields carry specific, non-generic values:

| Field | ❌ Generic (penalised) | ✅ Specific (rewarded) |
|-------|----------------------|----------------------|
| `transmode_code` | `Z` (unknown) | `P`, `A`, `F`, … |
| `from_funds_code` | `Z` (unknown) | `D`, `W`, `T`, … |
| `to_funds_code` | `Z` (unknown) | `D`, `W`, `T`, … |
| `personal_account_type` | `Z` (unknown) | `S`, `C`, `F`, … |
| `report_indicators` | missing | present |
| Party details | incomplete | name + SSN + DOB |

### 🔶 Narrative Quality Score — 60% weight

Analyses the free-text `reason` field across six signals:

| Signal | What it checks |
|--------|---------------|
| 🏷️ **Entity presence** | NPR amounts, dates, account numbers, party names (spaCy NER + regex) |
| 🔍 **Typology mention** | Named patterns: Smurfing, Layering, Scatter-Gather, etc. |
| ⚖️ **KYC inconsistency** | Income profile vs. transaction mismatch referenced |
| 💬 **Customer explanation** | Customer's stated reason for activity mentioned |
| 🚫 **Boilerplate detection** | TF-IDF similarity against generic phrases; copy-paste penalised |
| 📏 **Length penalty** | Very short narratives capped regardless of other signals |

---

## 📤 Output

Each scored report gets a plain-language explanation alongside its score:

```csv
report_id,       completeness_score, structured_score, narrative_score, explanation
RPT-2026-000001, 0.08,               0.12,             0.05,  "Narrative too vague (32 chars). Missing: funds_code, account_type, indicators. No amounts/dates/parties detected."
RPT-2026-000122, 0.91,               0.85,             0.94,  "Specific amounts (NPR 7,686,932), dates, 3 named parties, typology: Smurfing FanOut, KYC mismatch noted."
```


---

## 🚀 Quickstart

### 1. Clone & Install

```bash
git clone https://github.com/Reyansh-yad/str-completeness-scorer.git
cd str-completeness-scorer

pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 2. Add Dataset

Place the 276 XML report files into `data/reports/`.

### 3. Run the Pipeline

```bash
python src/pipeline.py --reports data/reports/ --output outputs/scored_reports.csv
```

### 4. Launch the Streamlit Demo

```bash
streamlit run demo/app.py
```

### 5. Launch the Next.js App

```bash
cd next-app
npm install
npm run dev
```

> Or visit the hosted version directly → [str-signal-score.vercel.app](https://str-signal-score.vercel.app)

---

## 🛠️ Tech Stack

| Layer | Library |
|-------|---------|
| XML parsing | `lxml`, `xml.etree.ElementTree` |
| NLP / NER | `spaCy` (en_core_web_sm) |
| Boilerplate detection | `scikit-learn` TF-IDF |
| Pattern matching | `re` — NPR amounts, dates, account numbers |
| Data processing | `pandas`, `numpy` |
| Streamlit UI | `streamlit` |
| Frontend | `Next.js`, `TypeScript`, `Three.js` |
| Hosting | Vercel |

---

## 📋 Requirements

```
spacy>=3.7.0
scikit-learn>=1.4.0
pandas>=2.0.0
numpy>=1.26.0
lxml>=5.0.0
streamlit>=1.35.0
```

---

## 🎯 Evaluation Targets

| Metric | Target |
|--------|--------|
| 📈 Score separation | Vague (< 50 chars) → `< 0.2` &nbsp;&nbsp; Detailed (> 500 chars) → `> 0.7` |
| 💡 Explainability | Every score includes a plain-language reason |
| ⚡ Speed | All 276 reports scored in < 30 seconds |
| 🖥️ Demo | Live scoring of any uploaded STR |

---

## ✅ Deliverables

| Deliverable | Link |
|-------------|------|
| 📦 GitHub Repository | [Reyansh-yad/str-completeness-scorer](https://github.com/Reyansh-yad/str-completeness-scorer) |
| 📓 Colab EDA Notebook | `notebooks/01_eda.ipynb` |
| 📊 Scored CSV | `outputs/scored_reports.csv` |
| 🌐 Hosted Demo | [str-signal-score.vercel.app](https://str-signal-score.vercel.app) |
| 📑 Presentation | Submitted separately |

---

## 👥 Team

> Built for the **AI/ML Intelligence Hackathon — Track 1: Signal vs Noise Detection**

<div align="center">

| | Name | GitHub |
|--|------|--------|
| 👨‍💻 | **Reyansh Yadav**  | [![GitHub](https://img.shields.io/badge/Reyansh--yad-181717?style=flat-square&logo=github)](https://github.com/Reyansh-yad) |
| 👨‍💻 | **Shashank Shrestha** | [![GitHub](https://img.shields.io/badge/shashankstha-181717?style=flat-square&logo=github)](https://github.com/shashankstha) |

</div>

---

<div align="center">

Made with 🧠 + ☕ for the AI/ML Intelligence Hackathon

</div>
