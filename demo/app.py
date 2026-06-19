import streamlit as st
import pandas as pd
import numpy as np
import os
import sys
import re
import json
import logging
from pathlib import Path
from io import StringIO



try:
    import plotly.express as px
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    HAS_PLOTLY = True
except ImportError:
    HAS_PLOTLY = False
    import matplotlib.pyplot as plt

try:
    from defusedxml import ElementTree as DET
    HAS_XML = True
except ImportError:
    HAS_XML = False

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.neighbors import NearestNeighbors
    HAS_SK = True
except ImportError:
    HAS_SK = False

try:
    from scipy.stats import spearmanr
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))



# ─────────────────────────────────────────────────────────────────────────────
#  PAGE CONFIG
# ─────────────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="STR Signal Intelligence",
    page_icon="🛡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────────────────────────────────────
#  NOTEBOOK SCORING CONFIG  (exact match to Cell 1 / Cell 3)
# ─────────────────────────────────────────────────────────────────────────────
SCORING_CONFIG = {
    "weights": {"structure": 0.30, "narrative": 0.50, "explanation": 0.20},
    "thresholds": {
        "uniqueness_boilerplate": 0.45,
        "vague_penalty_cap": 0.15,
        "boilerplate_penalty": 0.25,
    },
    "explanation_tiers": [(250, 1.0), (80, 0.7), (20, 0.4), (0, 0.1)],
}

VAGUE_PATTERNS = [re.compile(p, re.I) for p in [
    r'\bsuspicious activity\b', r'\bunusual pattern\b',
    r'\bappears suspicious\b', r'\bno explanation provided\b',
]]
AMOUNT_PATTERN = re.compile(
    r'(?:NPR|NRS|Rs\.?|USD|EUR|GBP)[\s\d,]+(?:\.\d+)?(?:\s?(?:lakh|crore|million|thousand))?', re.I)
DATE_PATTERN = re.compile(
    r'\d{4}-\d{2}-\d{2}'
    r'|\d{2}[/]\d{2}[/]\d{4}'
    r'|\d{2}-\d{2}-\d{4}'
    r'|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}'
    r'|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}', re.I)

STRUCTURED_FIELDS = ['mode_code', 'funds_code', 'acct_type', 'country']

# ─────────────────────────────────────────────────────────────────────────────
#  DESIGN TOKENS
# ─────────────────────────────────────────────────────────────────────────────
C = {
    "bg":        "#000000",
    "surface":   "#050505",
    "panel":     "#0a0a0a",
    "border":    "#1a1a1a",
    "border2":   "#222222",
    "text":      "#e2e8f0",
    "muted":     "#64748b",
    "dim":       "#334155",
    "high":      "#00e5a0",
    "high_dim":  "#0a2e22",
    "med":       "#f59e0b",
    "med_dim":   "#2a1f07",
    "low":       "#f43f5e",
    "low_dim":   "#2a0a12",
    "accent":    "#3b82f6",
    "accent2":   "#6366f1",
    "gold":      "#fbbf24",
    "red":       "#ef4444",
}



# ─────────────────────────────────────────────────────────────────────────────
#  SCORING ENGINE  (mirrors notebook Cell 3 exactly)
# ─────────────────────────────────────────────────────────────────────────────
def get_tier(score: float) -> str:
    if score >= 0.75: return "HIGH_SIGNAL"
    if score >= 0.45: return "NEEDS_REVIEW"
    return "LOW_QUALITY_NOISE"

def tier_class(tier: str) -> str:
    return {"HIGH_SIGNAL": "tier-high", "NEEDS_REVIEW": "tier-med", "LOW_QUALITY_NOISE": "tier-low"}.get(tier, "tier-low")

def tier_icon(tier: str) -> str:
    return {"HIGH_SIGNAL": "⬆", "NEEDS_REVIEW": "◈", "LOW_QUALITY_NOISE": "⬇"}.get(tier, "")

def score_color_hex(score: float) -> str:
    if score >= 0.75: return C['high']
    if score >= 0.45: return C['med']
    return C['low']

def score_explanation(text: str, tiers=SCORING_CONFIG["explanation_tiers"]) -> float:
    t_len = len(str(text).strip())
    for threshold, score in tiers:
        if t_len >= threshold: return score
    return 0.0

def get_weaknesses(row) -> str:
    w = []
    if row.get('len', 0) < 150:         w.append("Length insufficient")
    if row.get('ent_mony', 0) == 0:     w.append("Missing financial specifics")
    if row.get('ent_date', 0) == 0:     w.append("Missing transaction dates")
    if row.get('expl_score', 0) < 0.4:  w.append("Explanation missing/generic")
    if row.get('uniqueness', 1) < SCORING_CONFIG["thresholds"]["uniqueness_boilerplate"]:
        w.append("Boilerplate template detected")
    return "; ".join(w) if w else "Analytical Signal: Complete"

def score_dataframe(df: pd.DataFrame, accounts_df: pd.DataFrame = None, ml_features_df: pd.DataFrame = None) -> pd.DataFrame:
    """
    Complete scoring pipeline for the Dashboard. 
    Bridges XML text to CSV risk data and calculates the final 0-1 score.
    """
    cfg = SCORING_CONFIG
    df = df.copy()

    # 1. CLEANUP: Remove old columns if they exist to prevent duplicate errors
    cols_to_remove = ['final_score', 'struct_score', 'narr_score', 'expl_score', 'uniqueness', 'len', 'ent_mony', 'ent_date', 'vague_score', 'is_suspicious_tx', 'amount_zscore']
    df = df.drop(columns=[c for c in cols_to_remove if c in df.columns])

    # 2. DATA BRIDGE: Join XML to Accounts to Features
    if accounts_df is not None:
        # Link XML long number to accounts.csv short ID
        df = df.merge(accounts_df[['account_number', 'account_id']], 
                      left_on='xml_acc_long', right_on='account_number', how='left')

    if ml_features_df is not None and 'account_id' in df.columns:
        # Aggregate features by account to prevent row explosion (the 700 row bug)
        risk_summary = ml_features_df.groupby('Sender_account').agg({
            'is_suspicious_tx': 'max', 
            'amount_zscore': 'mean'
        }).reset_index()
        # Link to ML features
        df = df.merge(risk_summary, left_on='account_id', right_on='Sender_account', how='left')

    # Fill missing risk data with 0
    for col in ['is_suspicious_tx', 'amount_zscore']:
        if col in df.columns:
            df[col] = df[col].fillna(0)
        else:
            df[col] = 0

    # 3. NLP FEATURES: Money, Dates, and Vague language
    texts = df['reason'].fillna("").astype(str).tolist()
    nlp_stats = []
    for text in texts:
        nlp_stats.append([
            len(text),
            len(AMOUNT_PATTERN.findall(text)),
            len(DATE_PATTERN.findall(text)),
            sum(1 for p in VAGUE_PATTERNS if p.search(text.lower()))
        ])
    feat_df = pd.DataFrame(nlp_stats, columns=['len','ent_mony','ent_date','vague_score'], index=df.index)
    df = pd.concat([df, feat_df], axis=1)

    # 4. UNIQUENESS: Boilerplate Detection (k-NN)
    if HAS_SK and len(texts) > 1:
        try:
            tfidf = TfidfVectorizer(max_features=500, stop_words='english')
            mat = tfidf.fit_transform(texts)
            if mat.shape[1] > 0:
                nn = NearestNeighbors(n_neighbors=min(6, len(texts)), metric='cosine')
                nn.fit(mat)
                distances, _ = nn.kneighbors(mat)
                df['uniqueness'] = distances[:, 1:].mean(axis=1)
            else:
                df['uniqueness'] = 1.0
        except:
            df['uniqueness'] = 1.0
    else:
        df['uniqueness'] = 1.0

    # 5. SUB-SCORING: Structure, Narrative, Explanation
    # Structure (30%)
    sf = [c for c in STRUCTURED_FIELDS if c in df.columns]
    filled = df[sf].replace('', np.nan).notna().sum(axis=1)
    if 'indicator_count' in df.columns:
        filled += (df['indicator_count'].fillna(0).astype(int) > 0).astype(int)
    df['struct_score'] = (filled / (len(sf) + 1)).clip(0, 1)

    # Narrative (50%)
    l_cap = df['len'].quantile(0.9) if df['len'].quantile(0.9) > 0 else 1000
    df['narr_score'] = (
        (df['len'].clip(0, l_cap) / l_cap * 0.3) +
        (df['ent_mony'].clip(0, 3) / 3 * 0.4) +
        (df['ent_date'].clip(0, 3) / 3 * 0.3)
    )

    # Explanation (20%)
    if 'cust_expl' in df.columns:
        df['expl_score'] = df['cust_expl'].apply(score_explanation)
    else:
        df['expl_score'] = 0.0

    # 6. FINAL AGGREGATION: Combine scores and apply penalties
    w = cfg["weights"]
    b_penalty = df['uniqueness'].apply(lambda u: cfg["thresholds"]["boilerplate_penalty"] if u < cfg["thresholds"]["uniqueness_boilerplate"] else 0.0)
    v_penalty = (df['vague_score'] * 0.05).clip(0, cfg["thresholds"]["vague_penalty_cap"])

    # This creates the missing 'final_score' column
    raw_final = (df['struct_score'] * w["structure"] + 
                 df['narr_score']   * w["narrative"] + 
                 df['expl_score']   * w["explanation"] - b_penalty - v_penalty)
    
    # Apply Risk Multiplier (from the bridge)
    risk_boost = 1.0 + (df['is_suspicious_tx'] * 0.4)
    df['final_score'] = (raw_final * risk_boost).clip(0.01, 1.0).round(4)

    return df
# ─────────────────────────────────────────────────────────────────────────────
#  DATA LOADING
# ─────────────────────────────────────────────────────────────────────────────
def find_csv() -> tuple:
    base = Path(__file__).parent
    root = base.parent
    dirs = [root/"Results", root/"outputs", root/"data", root/"notebooks", base]
    names = ["STR_PRIORITY_RANKING_FINAL.csv","STR_QUALITY_RANKED_FINAL.csv",
             "scored_reports.csv","str_scores.csv","results.csv","output.csv"]
    for d in dirs:
        for n in names:
            p = d / n
            if p.exists(): return pd.read_csv(p), str(p)
    return None, None

def normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    rename = {}
    for c in df.columns:
        lc = c.lower().strip()
        if "report" in lc and "id" in lc and "indicator" not in lc: rename[c] = "report_id"
        elif lc == "reason":          rename[c] = "reason"
        elif lc in ("weaknesses","weak_fields"): rename[c] = "weaknesses"
        elif "zscore" in lc or "z_score" in lc: rename[c] = "amount_zscore"
        elif "pep" in lc:             rename[c] = "sender_pep"
        elif "suspicious" in lc and "tx" in lc: rename[c] = "is_suspicious_tx"
        elif lc == "cust_expl":       rename[c] = "cust_expl"
        elif lc == "indicator_count": rename[c] = "indicator_count"
        elif lc in ("mode_code","transmode_code"): rename[c] = "mode_code"
        elif lc == "funds_code":      rename[c] = "funds_code"
        elif lc == "acct_type":       rename[c] = "acct_type"
        elif lc == "country":         rename[c] = "country"
        elif lc == "narr_len":        rename[c] = "len"
    df.rename(columns=rename, inplace=True)

    # Score columns: use final_score as primary
    if "final_score" not in df.columns:
        for c in ["completeness_score","score"]:
            if c in df.columns: df["final_score"] = df[c]; break
    if "final_score" not in df.columns and len(df.columns) > 0:
        for c in df.columns:
            if "score" in c.lower(): df["final_score"] = df[c]; break

    if "struct_score" not in df.columns and "completeness_score" in df.columns:
        df["struct_score"] = df["completeness_score"]
    if "tier" not in df.columns and "final_score" in df.columns:
        df["tier"] = df["final_score"].apply(get_tier)
    if "len" not in df.columns:
        df["len"] = df["reason"].fillna("").apply(len) if "reason" in df.columns else 0

    for col in ["reason","weaknesses","cust_expl","mode_code","funds_code",
                "acct_type","country","amount_zscore","sender_pep",
                "is_suspicious_tx","struct_score","narr_score","expl_score",
                "uniqueness","ent_mony","ent_date","vague_score","indicator_count"]:
        if col not in df.columns: df[col] = None
    return df

# ─────────────────────────────────────────────────────────────────────────────
#  CHART HELPERS
# ─────────────────────────────────────────────────────────────────────────────
PLOTLY_BASE = dict(
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    font=dict(color="#94a3b8", family="Space Grotesk"),
    colorway=[C['accent'], C['high'], C['red'], C['gold'], C['accent2']],
    hoverlabel=dict(
        bgcolor="#0a0a0a",
        font_size=13,
        font_family="Space Grotesk",
        bordercolor="#222222"
    )
)
_DEFAULT_MARGIN = dict(t=15, b=40, l=45, r=15)

def make_donut(score: float, label: str, h: int = 190) -> "go.Figure":
    color = score_color_hex(score)
    fig = go.Figure(go.Pie(
        values=[score, 1 - score], hole=0.74,
        marker_colors=[color, C['border']],
        textinfo="none", hoverinfo="skip", sort=False,
    ))
    fig.add_annotation(text=f"<b>{score:.0%}</b>",
        font=dict(size=24, color=color, family="JetBrains Mono"),
        showarrow=False, x=0.5, y=0.56)
    fig.add_annotation(text=label,
        font=dict(size=9, color=C['muted'], family="Space Grotesk"),
        showarrow=False, x=0.5, y=0.38)
    fig.update_layout(**PLOTLY_BASE, showlegend=False,
        height=h, margin=dict(t=5,b=5,l=5,r=5))
    return fig

def make_radar(scores: dict, title: str = "") -> "go.Figure":
    cats = list(scores.keys())
    vals = list(scores.values()) + [list(scores.values())[0]]
    cats_plot = cats + [cats[0]]
    
    # NEW: Helper to convert hex to RGBA for Plotly compatibility
    def hex_to_rgba(hex_val, opacity):
        hex_val = hex_val.lstrip('#')
        r, g, b = tuple(int(hex_val[i:i+2], 16) for i in (0, 2, 4))
        return f'rgba({r}, {g}, {b}, {opacity})'

    fig = go.Figure(go.Scatterpolar(
        r=vals, 
        theta=cats_plot, 
        fill='toself',
        line_color=C['accent'], 
        # FIXED: Use rgba string instead of 8-digit hex
        fillcolor=hex_to_rgba(C['accent'], 0.15), 
        marker=dict(size=5, color=C['accent']),
    ))
    fig.update_layout(**PLOTLY_BASE,
        polar=dict(
            bgcolor="rgba(0,0,0,0)",
            radialaxis=dict(visible=True, range=[0,1], gridcolor=C['border'],
                            tickfont=dict(size=8, color=C['muted']), tickvals=[0.25,0.5,0.75,1.0]),
            angularaxis=dict(gridcolor=C['border'], tickfont=dict(size=9, color=C['text'])),
        ),
        showlegend=False, height=260, margin=dict(t=20,b=20,l=50,r=50))
    return fig

def grid_layout(**kwargs) -> dict:
    return {**PLOTLY_BASE,
            "margin": kwargs.pop("margin", _DEFAULT_MARGIN),
            **kwargs,
            "xaxis": {**kwargs.get("xaxis", {}), "gridcolor": C['border'], "linecolor": C['border']},
            "yaxis": {**kwargs.get("yaxis", {}), "gridcolor": C['border'], "linecolor": C['border']}}

# ─────────────────────────────────────────────────────────────────────────────
#  XML PARSER  (mirrors notebook Cell 2/3)
# ─────────────────────────────────────────────────────────────────────────────
def get_tag(root, tag: str) -> str:
    node = root.find(f'.//{{{""}}}{tag}') or root.find(f'.//{tag}')
    if node is None:
        node = root.find(f'{{*}}{tag}')
    if node is None:
        for elem in root.iter():
            if elem.tag.split('}')[-1] == tag:
                node = elem; break
    return node.text.strip() if node is not None and node.text else ""

def parse_xml_file(path: str) -> dict:
    if not HAS_XML: return {}
    try:
        root = DET.parse(path).getroot()
        return {
            'report_id': get_tag(root, 'report_id'),
            'reason': get_tag(root, 'reason'),
            'cust_expl': get_tag(root, 'customer_explanation'),
            'indicator_count': len(list(root.iter('{*}indicator'))) or len(list(root.iter('indicator'))),
            'mode_code': get_tag(root, 'transmode_code'),
            'funds_code': get_tag(root, 'from_funds_code'),
            'acct_type': get_tag(root, 'personal_account_type'),
            'country': get_tag(root, 'from_country'),
            'xml_acc_long': get_tag(root, 'account'),
        }
    except Exception as e:
        return {'error': str(e)}

# ─────────────────────────────────────────────────────────────────────────────
#  SIDEBAR
# ─────────────────────────────────────────────────────────────────────────────
with st.sidebar:
    

    st.markdown("**Navigation**")
    page = st.radio("", [
        "📊  Dashboard",
        "🔬  EDA Explorer",
        "🔎  Report Detail",
        "⚖   Compare",
        "📁  Upload & Score",
    ], label_visibility="collapsed")

    st.markdown("**Filters**")
    score_range = st.slider("Score range", 0.0, 1.0, (0.0, 1.0), 0.05)
    tier_filter = st.multiselect("Tier",
        ["HIGH_SIGNAL","NEEDS_REVIEW","LOW_QUALITY_NOISE"],
        default=["HIGH_SIGNAL","NEEDS_REVIEW","LOW_QUALITY_NOISE"])

    st.markdown("**Sort**")
    sort_by  = st.selectbox("By", ["final_score","struct_score","narr_score","uniqueness","len"])
    sort_asc = st.checkbox("Ascending", False)

    st.markdown("**Scoring Weights**")
    w_struct = st.slider("Structure",    0.0, 1.0, 0.30, 0.05)
    w_narr   = st.slider("Narrative",   0.0, 1.0, 0.50, 0.05)
    w_expl   = st.slider("Explanation", 0.0, 1.0, 0.20, 0.05)
    if abs(w_struct + w_narr + w_expl - 1.0) > 0.01:
        st.warning("Weights should sum to 1.0")
    SCORING_CONFIG["weights"] = {"structure": w_struct, "narrative": w_narr, "explanation": w_expl}

# ─────────────────────────────────────────────────────────────────────────────
#  HERO
# ─────────────────────────────────────────────────────────────────────────────
import streamlit.components.v1 as components
components.html("""
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
  body {
    margin: 0; padding: 0;
    background-color: transparent;
    color: white;
    font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
    overflow: hidden;
  }
  .hero-container {
    position: relative;
    width: 100%; min-height: 550px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 2rem;
    box-sizing: border-box;
  }
  canvas {
    position: absolute; inset: 0; width: 100%; height: 100%;
    pointer-events: none; z-index: 1;
  }
  .content {
    position: relative; z-index: 10; max-width: 64rem; margin: 0 auto;
    display: flex; flex-direction: column; align-items: center;
  }
  .pill {
    display: inline-flex; align-items: center; border-radius: 9999px;
    border: 1px solid rgba(255,255,255,0.1); background-color: rgba(255,255,255,0.03);
    padding: 6px 16px; font-size: 0.8rem; color: rgba(255,255,255,0.6);
    margin-bottom: 24px; margin-top: 20px;
    backdrop-filter: blur(10px);
  }
  .pill a {
    margin-left: 6px; font-weight: 600; color: white; text-decoration: none;
  }
  .main-box {
    position: relative; border: 1px solid rgba(255,255,255,0.1);
    padding: 3.5rem 2rem; background: rgba(5,5,5,0.8);
    border-radius: 20px; width: 100%; max-width: 800px;
    backdrop-filter: blur(16px);
  }
  .plus-icon {
    position: absolute; color: #ef4444; width: 32px; height: 32px;
  }
  .main-h1 {
    font-size: 4rem; font-weight: 700; line-height: 1.1; letter-spacing: -0.04em; margin: 0;
  }
  .red-text { color: #ef4444; }
  .status-row {
    display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 1.5rem;
  }
  @keyframes ping { 75%, 100% { transform: scale(2.5); opacity: 0; } }
  .dot-wrapper { position: relative; display: flex; height: 12px; width: 12px; align-items: center; justify-content: center; }
  .dot-ping { position: absolute; height: 100%; width: 100%; border-radius: 50%; background-color: #22c55e; opacity: 0.75; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; }
  .dot-solid { position: relative; height: 8px; width: 8px; border-radius: 50%; background-color: #22c55e; }
  .status-text { font-size: 0.85rem; color: #22c55e; margin: 0; font-weight: 500; }
  
  .sub-h1 { margin-top: 2.5rem; font-size: 1.8rem; font-weight: 500; }
  .sub-p { color: rgba(255,255,255,0.6); padding: 1rem 0 2rem 0; font-size: 1.1rem; line-height: 1.6; max-width: 600px; }
  .typewriter { color: #3b82f6; font-weight: 600; }
  #cursor { animation: blink 1s step-start infinite; color: #3b82f6; font-weight: 600; }
  @keyframes blink { 50% { opacity: 0; } }
  
  .buttons { display: flex; align-items: center; justify-content: center; gap: 16px; }
  
  /* ShineBorder css */
  @keyframes shine-pulse {
    0% { background-position: 0% 0%; }
    50% { background-position: 100% 100%; }
    100% { background-position: 0% 0%; }
  }
  .shine-border-wrapper {
    position: relative; display: grid; place-items: center; border-radius: 12px;
    padding: 2px; background-color: transparent; cursor: pointer;
  }
  .shine-border-anim {
    position: absolute; inset: 0; border-radius: inherit; padding: 2px;
    background-image: radial-gradient(circle at 50% 50%, transparent, #ef4444, #3b82f6, transparent);
    background-size: 300% 300%;
    animation: shine-pulse 4s infinite linear;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    z-index: 0;
  }
  .btn-primary {
    position: relative; z-index: 10; background: #fff; color: #000; border: none;
    padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 0.95rem; cursor: pointer;
    font-family: inherit; transition: transform 0.2s;
  }
  .btn-primary:hover { transform: scale(1.02); }
  .btn-secondary {
    background: transparent; color: white; border: 1px solid rgba(255,255,255,0.2);
    padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 0.95rem; cursor: pointer;
    font-family: inherit; transition: all 0.2s;
  }
  .btn-secondary:hover { background: rgba(255,255,255,0.05); }
</style>
</head>
<body>
<div class="hero-container" id="hero">
  <div class="pill">
    Financial Intelligence Unit. <a href="#">AML Analytics</a>
  </div>
  <div class="content">
    <div class="main">
     
      <h1 class="main-h1">Your complete platform for the <span class="red-text">Signal.</span></h1>
      <div class="status-row">
        <span class="dot-wrapper"><span class="dot-ping"></span><span class="dot-solid"></span></span>
        <p class="status-text">Available Now</p>
      </div>
    </div>

    <h1 class="sub-h1">Welcome to STR <span class="red-text" style="font-weight:700">Signal</span> Intelligence</h1>
    <p class="sub-p">
      Automated completeness scoring and intelligence generation to empower financial analysts. We utilize 
      <span class="typewriter" id="typewriter"></span><span id="cursor">|</span>.
    </p>

    <div class="buttons">
      <div class="shine-border-wrapper">
        <div class="shine-border-anim"></div>
        <button class="btn-primary" onclick="window.parent.document.querySelector('.stButton button').click()">Analyze Data</button>
      </div>
      <button class="btn-secondary">View Documentation</button>
    </div>
  </div>
  <canvas id="canvas"></canvas>
</div>

<script>
// Typewriter
const strings = ["NLP Analysis", "Boilerplate Detection", "Completeness Scoring", "TF-IDF & k-NN", "Priority Queues"];
let charIdx = 0, strIdx = 0, isDeleting = false;
function type() {
  const el = document.getElementById("typewriter");
  if (!el) return;
  const curStr = strings[strIdx];
  if (isDeleting) {
    el.innerText = curStr.substring(0, charIdx - 1);
    charIdx--;
  } else {
    el.innerText = curStr.substring(0, charIdx + 1);
    charIdx++;
  }
  let speed = isDeleting ? 30 : 80;
  if (!isDeleting && charIdx === curStr.length) { speed = 1500; isDeleting = true; } 
  else if (isDeleting && charIdx === 0) { isDeleting = false; strIdx = (strIdx + 1) % strings.length; speed = 500; }
  setTimeout(type, speed);
}
type();

// Canvas Spring Animation
function n(e) { this.init(e || {}); }
n.prototype = {
  init: function (e) {
    this.phase = e.phase || 0; this.offset = e.offset || 0;
    this.frequency = e.frequency || 0.001; this.amplitude = e.amplitude || 1;
  },
  update: function () {
    this.phase += this.frequency;
    return this.offset + Math.sin(this.phase) * this.amplitude;
  }
};
function Line(e) { this.init(e || {}); }
Line.prototype = {
  init: function (e) {
    this.spring = e.spring + 0.1 * Math.random() - 0.05;
    this.friction = E.friction + 0.01 * Math.random() - 0.005;
    this.nodes = [];
    for (var t, n = 0; n < E.size; n++) {
      t = new Node(); t.x = pos.x; t.y = pos.y; this.nodes.push(t);
    }
  },
  update: function () {
    let e = this.spring, t = this.nodes[0];
    t.vx += (pos.x - t.x) * e; t.vy += (pos.y - t.y) * e;
    for (var n, i = 0, a = this.nodes.length; i < a; i++) {
      t = this.nodes[i];
      if (i > 0) {
        n = this.nodes[i - 1];
        t.vx += (n.x - t.x) * e; t.vy += (n.y - t.y) * e;
        t.vx += n.vx * E.dampening; t.vy += n.vy * E.dampening;
      }
      t.vx *= this.friction; t.vy *= this.friction;
      t.x += t.vx; t.y += t.vy; e *= E.tension;
    }
  },
  draw: function () {
    let e, t, n = this.nodes[0].x, i = this.nodes[0].y;
    ctx.beginPath(); ctx.moveTo(n, i);
    for (var a = 1, o = this.nodes.length - 2; a < o; a++) {
      e = this.nodes[a]; t = this.nodes[a + 1];
      n = 0.5 * (e.x + t.x); i = 0.5 * (e.y + t.y);
      ctx.quadraticCurveTo(e.x, e.y, n, i);
    }
    e = this.nodes[a]; t = this.nodes[a + 1];
    ctx.quadraticCurveTo(e.x, e.y, t.x, t.y);
    ctx.stroke(); ctx.closePath();
  }
};
function onMousemove(e) {
  function o() { lines = []; for (let e = 0; e < E.trails; e++) lines.push(new Line({ spring: 0.45 + (e / E.trails) * 0.025 })); }
  function c(e) {
    let rect = ctx.canvas.getBoundingClientRect();
    if (e.touches) { pos.x = e.touches[0].clientX - rect.left; pos.y = e.touches[0].clientY - rect.top; } 
    else { pos.x = e.clientX - rect.left; pos.y = e.clientY - rect.top; }
  }
  document.removeEventListener("mousemove", onMousemove);
  document.removeEventListener("touchstart", onMousemove);
  document.addEventListener("mousemove", c); document.addEventListener("touchmove", c);
  c(e); o(); render();
}
function render() {
  if (ctx.running) {
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "hsla(" + Math.round(f.update()) + ",100%,50%,0.04)";
    ctx.lineWidth = 10;
    for (var e, t = 0; t < E.trails; t++) { e = lines[t]; e.update(); e.draw(); }
    window.requestAnimationFrame(render);
  }
}
function resizeCanvas() {
  const container = document.getElementById("hero");
  ctx.canvas.width = container.clientWidth;
  ctx.canvas.height = container.clientHeight;
}
var ctx, f, pos = {x: 0, y: 0}, lines = [], E = { friction: 0.5, trails: 80, size: 50, dampening: 0.025, tension: 0.99 };
function Node() { this.x = 0; this.y = 0; this.vy = 0; this.vx = 0; }
function initCanvas() {
  const canvas = document.getElementById("canvas");
  if(!canvas) return;
  ctx = canvas.getContext("2d"); ctx.running = true;
  f = new n({ phase: Math.random() * 2 * Math.PI, amplitude: 85, frequency: 0.0015, offset: 285 });
  
  const container = document.getElementById("hero");
  pos.x = container.clientWidth / 2; pos.y = container.clientHeight / 2;

  document.addEventListener("mousemove", onMousemove);
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  lines = []; for (let e = 0; e < E.trails; e++) lines.push(new Line({ spring: 0.45 + (e / E.trails) * 0.025 }));
  render();
}
initCanvas();
</script>
</body>
</html>
""", height=650, scrolling=False)

# ─────────────────────────────────────────────────────────────────────────────
#  LOAD DATA
# ─────────────────────────────────────────────────────────────────────────────
df_raw, csv_path = find_csv()

if df_raw is None:
    if page not in ("📁  Upload & Score",):
        st.warning("⚠️ Please upload a scored CSV file on the Upload & Score page first.")
        st.stop()

if df_raw is not None:
    df_all = normalize_df(df_raw.copy())

    # Apply filters
    df = df_all.copy()
    if "final_score" in df.columns:
        df = df[(df["final_score"] >= score_range[0]) & (df["final_score"] <= score_range[1])]
    if tier_filter and "tier" in df.columns:
        df = df[df["tier"].isin(tier_filter)]
    sc = sort_by if sort_by in df.columns else "final_score"
    df = df.sort_values(sc, ascending=sort_asc, na_position="last").reset_index(drop=True)
else:
    df_all = pd.DataFrame()
    df = pd.DataFrame()

# ─────────────────────────────────────────────────────────────────────────────
#  PAGE: DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────
if page == "📊  Dashboard":

    if df.empty:
        st.info("No data loaded. Upload a CSV or XML files to begin.")
    else:
        if csv_path:
            st.info("📂 Loaded: <code>{Path(csv_path).name}</code> · {len(df_all)} total reports · {len(df)} shown")

        total  = len(df)
        high_c = (df["final_score"] >= 0.75).sum()
        rev_c  = ((df["final_score"] >= 0.45) & (df["final_score"] < 0.75)).sum()
        low_c  = (df["final_score"] < 0.45).sum()
        avg_s  = df["final_score"].mean()
        pep_c  = int(df["sender_pep"].fillna(0).astype(float).sum()) if "sender_pep" in df.columns else 0
        uniq_c = (df["uniqueness"].fillna(1) >= SCORING_CONFIG["thresholds"]["uniqueness_boilerplate"]).sum() if "uniqueness" in df.columns else "—"

        

        # Pipeline steps
        

        tab1, tab2 = st.tabs(["📋 Priority Queue", "📈 Score Analytics"])

        with tab1:
            show_cols = [c for c in ["report_id","final_score","struct_score","narr_score",
                         "expl_score","uniqueness","tier","len","weaknesses"]
                         if c in df.columns and df[c].notna().any()]
            fmt = {}
            for c in ["final_score","struct_score","narr_score","expl_score"]:
                if c in show_cols: fmt[c] = "{:.3f}"
            if "uniqueness" in show_cols: fmt["uniqueness"] = "{:.3f}"
            if "len" in show_cols:        fmt["len"]        = "{:.0f}"

            def color_score(val):
                if isinstance(val, (int, float)):
                    if val >= 0.75: return f"color:{C['high']};font-weight:700"
                    if val >= 0.45: return f"color:{C['med']};font-weight:700"
                    return f"color:{C['low']};font-weight:700"
                return ""

            score_cols = [c for c in ["final_score","struct_score","narr_score","expl_score"] if c in show_cols]
            styled = df[show_cols].style.map(color_score, subset=score_cols).format(fmt, na_rep="—")
            st.dataframe(styled, use_container_width=True, height=480)

            col_dl1, col_dl2 = st.columns(2)
            with col_dl1:
                st.download_button("⬇ Download Priority Queue CSV",
                    df.to_csv(index=False).encode(), "STR_PRIORITY_RANKING_FINAL.csv", "text/csv")
            with col_dl2:
                # JSON dashboard export (matches Cell 5)
                top10 = df.nlargest(10,"final_score")
                bot5  = df.nsmallest(5,"final_score")
                dash_df = pd.concat([top10,bot5]).drop_duplicates(subset=["report_id"]) if "report_id" in df.columns else top10
                dashboard = [{
                    "id": str(r.get("report_id","—")),
                    "score": float(r.get("final_score",0)),
                    "status": get_tier(float(r.get("final_score",0))),
                    "reason_preview": str(r.get("reason",""))[:160]+"...",
                    "weaknesses": str(r.get("weaknesses","")).split("; ")
                } for _,r in dash_df.iterrows()]
                st.download_button("⬇ Download Dashboard JSON",
                    json.dumps(dashboard, indent=4).encode(), "str_dashboard_data.json", "application/json")

        with tab2:
            if not HAS_PLOTLY:
                st.info("Install plotly for interactive charts: pip install plotly")
            else:
                ca, cb = st.columns(2)
                with ca:
                    st.subheader("Score Distribution")
                    fig_h = go.Figure()
                    bins = [(0,0.45,C['low'],"Low Quality"),(0.45,0.75,C['med'],"Needs Review"),(0.75,1.0,C['high'],"High Signal")]
                    for lo,hi,col,lbl in bins:
                        sub = df[(df["final_score"]>=lo)&(df["final_score"]<hi)]["final_score"]
                        if len(sub): fig_h.add_trace(go.Histogram(x=sub, nbinsx=10,
                            marker_color=col, name=lbl, opacity=0.85))
                    fig_h.update_layout(**grid_layout(height=300,
                        xaxis={"title":"Final Score"},yaxis={"title":"Count"},
                        barmode="stack",legend=dict(font_size=9,bgcolor="rgba(0,0,0,0)")))
                    st.plotly_chart(fig_h, use_container_width=True)

                with cb:
                    st.subheader("Tier Breakdown")
                    tc = df["tier"].value_counts() if "tier" in df.columns else pd.Series()
                    if len(tc):
                        tc_colors = {
                            "HIGH_SIGNAL": C['high'],
                            "NEEDS_REVIEW": C['med'],
                            "LOW_QUALITY_NOISE": C['low']
                        }
                        fig_p = go.Figure(go.Pie(
                            labels=tc.index, values=tc.values, hole=0.6,
                            marker_colors=[tc_colors.get(t, C['accent']) for t in tc.index],
                            textinfo="label+percent",
                            textfont=dict(size=10, color=C['text']),
                        ))
                        fig_p.update_layout(**PLOTLY_BASE, showlegend=False, height=300,
                            margin=dict(t=10,b=10,l=10,r=10))
                        st.plotly_chart(fig_p, use_container_width=True)

                # Score components scatter
                if "struct_score" in df.columns and "narr_score" in df.columns:
                    st.subheader("Structure vs Narrative Score")
                    fig_sc = go.Figure(go.Scatter(
                        x=df["struct_score"].fillna(0),
                        y=df["narr_score"].fillna(0),
                        mode="markers",
                        marker=dict(
                            size=7, opacity=0.7,
                            color=df["final_score"],
                            colorscale=[[0,C['low']],[0.45,C['med']],[0.75,C['high']],[1,C['high']]],
                            colorbar=dict(title="Score", thickness=10, len=0.7,
                                         tickfont=dict(size=8, color=C['muted'])),
                            line=dict(width=0),
                        ),
                        hovertemplate="<b>%{customdata}</b><br>Struct: %{x:.2f}<br>Narr: %{y:.2f}<extra></extra>",
                        customdata=df["report_id"] if "report_id" in df.columns else df.index,
                    ))
                    fig_sc.update_layout(**grid_layout(height=320,
                        xaxis={"title":"Structure Score"},yaxis={"title":"Narrative Score"}))
                    st.plotly_chart(fig_sc, use_container_width=True)

                # Uniqueness distribution
                if "uniqueness" in df.columns and df["uniqueness"].notna().any():
                    st.subheader("Uniqueness Score · Boilerplate Detection")
                    fig_u = go.Figure()
                    threshold = SCORING_CONFIG["thresholds"]["uniqueness_boilerplate"]
                    unique_sub = df[df["uniqueness"] >= threshold]["uniqueness"]
                    boiler_sub = df[df["uniqueness"] <  threshold]["uniqueness"]
                    if len(unique_sub): fig_u.add_trace(go.Histogram(x=unique_sub, nbinsx=20,
                        marker_color=C['high'], name="Unique", opacity=0.8))
                    if len(boiler_sub): fig_u.add_trace(go.Histogram(x=boiler_sub, nbinsx=20,
                        marker_color=C['low'], name="Boilerplate", opacity=0.8))
                    fig_u.add_vline(x=threshold, line_dash="dash", line_color=C['med'],
                        annotation_text=f"Threshold ({threshold})",
                        annotation_font=dict(size=9, color=C['med']))
                    fig_u.update_layout(**grid_layout(height=280, barmode="overlay",
                        xaxis={"title":"Cosine Distance (higher = more unique)"},
                        yaxis={"title":"Count"},
                        legend=dict(font_size=9,bgcolor="rgba(0,0,0,0)")))
                    st.plotly_chart(fig_u, use_container_width=True)

                # Weaknesses breakdown
                if "weaknesses" in df.columns and df["weaknesses"].notna().any():
                    st.subheader("Top Weaknesses Detected")
                    all_w = []
                    for w in df["weaknesses"].dropna():
                        if str(w) != "Analytical Signal: Complete":
                            all_w.extend([x.strip() for x in str(w).split(";") if x.strip()])
                    if all_w:
                        wc = pd.Series(all_w).value_counts().head(8)
                        fig_w = go.Figure(go.Bar(
                            y=wc.index[::-1], x=wc.values[::-1], orientation="h",
                            marker=dict(
                                color=wc.values[::-1],
                                colorscale=[[0,C['low']],[1,C['accent']]],
                                line=dict(width=0),
                            ),
                            text=wc.values[::-1],
                            textposition="outside",
                            textfont=dict(size=9, color=C['muted']),
                        ))
                        fig_w.update_layout(**grid_layout(height=320,
                            xaxis={"title":"Count"},
                            yaxis={"tickfont":{"size":9}}))
                        st.plotly_chart(fig_w, use_container_width=True)

# ─────────────────────────────────────────────────────────────────────────────
#  PAGE: EDA EXPLORER
# ─────────────────────────────────────────────────────────────────────────────
elif page == "🔬  EDA Explorer":
    st.subheader("Exploratory Data Analysis · Dataset Overview")

    if df.empty:
        st.info("No data loaded.")
    else:
        # EDA stats
        narr_lens = df["len"].dropna().astype(float) if "len" in df.columns else pd.Series([0])
        c1,c2,c3,c4,c5 = st.columns(5)
        for col, val, lbl in [
            (c1, len(df),                     "Total Reports"),
            (c2, f"{narr_lens.mean():.0f}",   "Avg Narr Length"),
            (c3, f"{narr_lens.median():.0f}", "Median Length"),
            (c4, df["country"].nunique() if "country" in df.columns else "—", "Countries"),
            (c5, df["mode_code"].nunique() if "mode_code" in df.columns else "—", "TX Modes"),
        ]:
            col.markdown(f"""
            <div class="eda-stat">
              <div class="eda-stat-val">{val}</div>
              <div class="eda-stat-lbl">{lbl}</div>
            </div>""")

        if not HAS_PLOTLY:
            st.info("Install plotly for charts.")
        else:
            r1c1, r1c2 = st.columns(2)
            with r1c1:
                st.subheader("Narrative Length Distribution")
                if "len" in df.columns:
                    fig_nl = go.Figure()
                    fig_nl.add_trace(go.Histogram(x=df["len"].fillna(0), nbinsx=25,
                        marker_color=C['accent'], opacity=0.8, name="Length"))
                    fig_nl.update_layout(**grid_layout(height=280,
                        xaxis={"title":"Characters"},yaxis={"title":"Count"}))
                    st.plotly_chart(fig_nl, use_container_width=True)

            with r1c2:
                st.subheader("Top Countries (Source of Funds)")
                if "country" in df.columns:
                    cc = df["country"].replace("","Unknown").value_counts().head(10)
                    fig_c = go.Figure(go.Bar(
                        x=cc.index, y=cc.values,
                        marker=dict(color=cc.values,
                            colorscale=[[0,C['border2']],[1,C['accent']]],line=dict(width=0)),
                        text=cc.values, textposition="outside",
                        textfont=dict(size=9,color=C['muted']),
                    ))
                    fig_c.update_layout(**grid_layout(height=280,
                        xaxis={"title":"Country"},yaxis={"title":"Count"}))
                    st.plotly_chart(fig_c, use_container_width=True)

            r2c1, r2c2 = st.columns(2)
            with r2c1:
                st.subheader("Indicators Per Report")
                if "indicator_count" in df.columns and df["indicator_count"].notna().any():
                    ic = df["indicator_count"].fillna(0).astype(int).value_counts().sort_index()
                    fig_i = go.Figure(go.Bar(x=ic.index.astype(str), y=ic.values,
                        marker_color=C['accent2'], opacity=0.85))
                    fig_i.update_layout(**grid_layout(height=280,
                        xaxis={"title":"Indicator Count"},yaxis={"title":"Reports"}))
                    st.plotly_chart(fig_i, use_container_width=True)

            with r2c2:
                st.subheader("Transaction Mode Codes")
                if "mode_code" in df.columns:
                    mc = df["mode_code"].replace("","Unknown").value_counts().head(10)
                    fig_m = go.Figure(go.Bar(
                        y=mc.index[::-1], x=mc.values[::-1], orientation="h",
                        marker_color=C['gold'], opacity=0.85))
                    fig_m.update_layout(**grid_layout(height=280,
                        xaxis={"title":"Count"},yaxis={"tickfont":{"size":9}}))
                    st.plotly_chart(fig_m, use_container_width=True)

            # ── Spearman Validation ──────────────────────────────────────
            st.subheader("Scientific Validation · Spearman Correlation")

            if not HAS_SCIPY:
                st.info("ℹ Install scipy for validation: <code>pip install scipy</code>")
            elif "is_suspicious_tx" not in df.columns:
                st.info("ℹ Validation needs an <code>is_suspicious_tx</code> column in your CSV (ground truth labels).")
            else:
                gt_mask = df["is_suspicious_tx"].notna() & (df["is_suspicious_tx"].astype(str) != "0")
                sv_raw = df["final_score"]
                gv_raw = df["is_suspicious_tx"].astype(float) if gt_mask.any() else pd.Series(dtype=float)

                score_variance = sv_raw.nunique()
                gt_variance    = gv_raw[gt_mask].nunique() if gt_mask.any() else 0

                # ── Diagnosis ──────────────────────────────────────────
                diag_col1, diag_col2, diag_col3 = st.columns(3)
                diag_col1.markdown(f"""
                <div class="eda-stat">
                  <div class="eda-stat-val" style="color:{'#4ade80' if gt_mask.sum()>0 else '#f87171'}">{gt_mask.sum()}</div>
                  <div class="eda-stat-lbl">Ground Truth Records</div>
                </div>""")
                diag_col2.markdown(f"""
                <div class="eda-stat">
                  <div class="eda-stat-val" style="color:{'#4ade80' if score_variance>5 else '#f59e0b'}">{score_variance}</div>
                  <div class="eda-stat-lbl">Unique Score Values</div>
                </div>""")
                diag_col3.markdown(f"""
                <div class="eda-stat">
                  <div class="eda-stat-val" style="color:{'#4ade80' if gt_variance>1 else '#f87171'}">{gt_variance}</div>
                  <div class="eda-stat-lbl">Unique GT Flag Values</div>
                </div>""")

                st.write("")

                # ── Case 1: scores are flat (boilerplate CSV) ──────────
                if score_variance <= 2 and "reason" in df.columns:
                    

                    if st.button("🔄 Re-score with Full Pipeline (TF-IDF + k-NN)", type="primary"):
                        with st.spinner("Running full scoring pipeline on loaded data…"):
                            df_rescored = score_dataframe(df_all.copy())
                            df_rescored["tier"] = df_rescored["final_score"].apply(get_tier)
                            st.session_state["df_rescored"] = df_rescored
                        st.success(f"✓ Re-scored {len(df_rescored)} reports · {df_rescored['final_score'].nunique()} unique score values")
                        st.rerun()

                    # Show rescored results if available
                    if "df_rescored" in st.session_state:
                        df_rs = st.session_state["df_rescored"]
                        sv2 = df_rs["final_score"]
                        

                        if "is_suspicious_tx" in df_rs.columns:
                            gt2 = df_rs["is_suspicious_tx"].astype(float)
                            sv2_masked = sv2[gt2.notna()]
                            gt2_masked = gt2[gt2.notna()]
                            if sv2_masked.nunique() > 1 and gt2_masked.nunique() > 1:
                                corr, pval = spearmanr(sv2_masked, gt2_masked)
                                color   = C['high'] if abs(corr) > 0.3 else C['med'] if abs(corr) > 0.1 else C['low']
                                verdict = "Strong alignment" if abs(corr)>0.3 else "Moderate alignment" if abs(corr)>0.1 else "Weak alignment"
                                

                            # Score distribution after rescoring
                            if HAS_PLOTLY:
                                fig_rs = go.Figure()
                                for lo,hi,col,lbl in [(0,0.45,C['low'],"Low"),(0.45,0.75,C['med'],"Review"),(0.75,1.0,C['high'],"High")]:
                                    sub = df_rs[(df_rs["final_score"]>=lo)&(df_rs["final_score"]<hi)]["final_score"]
                                    if len(sub): fig_rs.add_trace(go.Histogram(x=sub, nbinsx=20,
                                        marker_color=col, name=lbl, opacity=0.85))
                                fig_rs.update_layout(**PLOTLY_BASE, barmode="stack",
                                    margin=_DEFAULT_MARGIN, height=260,
                                    xaxis=dict(title="Re-scored Final Score", gridcolor=C['border']),
                                    yaxis=dict(title="Count", gridcolor=C['border']),
                                    legend=dict(font_size=9, bgcolor="rgba(0,0,0,0)"),
                                    title=dict(text="Score Distribution After Re-scoring", font_size=11, x=0))
                                st.plotly_chart(fig_rs, use_container_width=True)

                        st.download_button("⬇ Download Re-scored CSV",
                            df_rs.to_csv(index=False).encode(),
                            "STR_RESCORED.csv", "text/csv")

                # ── Case 2: gt labels are constant ─────────────────────
                elif gt_mask.any() and gt_variance <= 1:
                    

                    # Still show score vs amount_zscore as proxy validation
                    if "amount_zscore" in df.columns and df["amount_zscore"].notna().any() and HAS_PLOTLY:
                        st.markdown("**Proxy validation: Score vs Amount Z-Score**")
                        az = df["amount_zscore"].astype(float)
                        fs = df["final_score"]
                        if az.nunique() > 5 and fs.nunique() > 1:
                            corr2, pval2 = spearmanr(fs, az.abs())
                            color2 = C['high'] if abs(corr2)>0.2 else C['med']
                            

                # ── Case 3: everything looks good ──────────────────────
                elif gt_mask.any() and score_variance > 1 and gt_variance > 1:
                    gv = gv_raw[gt_mask]
                    sv = sv_raw[gt_mask]
                    corr, pval = spearmanr(sv, gv)
                    color   = C['high'] if abs(corr) > 0.3 else C['med'] if abs(corr) > 0.1 else C['low']
                    verdict = "Strong alignment" if abs(corr)>0.3 else "Moderate alignment" if abs(corr)>0.1 else "Weak alignment"
                    

                else:
                    st.info("ℹ No ground truth records found in the current filter. Widen the Score Range or Tier filter.")

# ─────────────────────────────────────────────────────────────────────────────
#  PAGE: REPORT DETAIL
# ─────────────────────────────────────────────────────────────────────────────
elif page == "🔎  Report Detail":
    if df.empty:
        st.info("No data loaded.")
    else:
        sel_id = st.selectbox("Select Report", df["report_id"].tolist() if "report_id" in df.columns else df.index.tolist())
        row = df[df["report_id"] == sel_id].iloc[0] if "report_id" in df.columns else df.iloc[sel_id]

        fs = float(row.get("final_score") or 0)
        ss = float(row.get("struct_score") or 0)
        ns = float(row.get("narr_score") or 0)
        es = float(row.get("expl_score") or 0)
        un = float(row.get("uniqueness") or 0)
        tier = get_tier(fs)

        # Score donuts
        if HAS_PLOTLY:
            d1,d2,d3,d4 = st.columns(4)
            with d1: st.plotly_chart(make_donut(fs,"Overall"), use_container_width=True)
            with d2: st.plotly_chart(make_donut(ss,"Structure 30%"), use_container_width=True)
            with d3: st.plotly_chart(make_donut(ns,"Narrative 50%"), use_container_width=True)
            with d4: st.plotly_chart(make_donut(es,"Explanation 20%"), use_container_width=True)

            # Radar
            ra, rb = st.columns([1.2, 1.8])
            with ra:
                st.subheader("Score Radar")
                radar_scores = {
                    "Structure": ss,
                    "Narrative": ns,
                    "Explanation": es,
                    "Uniqueness": min(un,1),
                    "Overall": fs,
                }
                st.plotly_chart(make_radar(radar_scores), use_container_width=True)

            with rb:
                st.subheader("Report Metadata")
                pep = row.get("sender_pep", 0)
                zscore = row.get("amount_zscore", None)
                narr_len = row.get("len", None)
                country = row.get("country","—")
                mode = row.get("mode_code","—")
                ind = row.get("indicator_count","—")
                

        # Score bars
        st.subheader("Score Breakdown")
        for lbl, val, note in [
            ("Structure (30%)", ss, f"{w_struct*100:.0f}% weight · Coded fields + indicators"),
            ("Narrative (50%)", ns, f"{w_narr*100:.0f}% weight · Length + amounts + dates"),
            ("Explanation (20%)", es, f"{w_expl*100:.0f}% weight · Customer explanation quality"),
            ("Uniqueness", min(un,1), f"k-NN cosine distance · Threshold: {SCORING_CONFIG['thresholds']['uniqueness_boilerplate']}"),
        ]:
            bar_color = score_color_hex(val)
            

        # Weaknesses
        weak = str(row.get("weaknesses",""))
        if weak and weak not in ("nan","None","","Analytical Signal: Complete"):
            st.subheader("⚠ Weaknesses Detected")
            chips = "".join(f'<span class="chip chip-red">{w.strip()}</span>'
                            for w in weak.split(";") if w.strip())
            st.write(chips)
        elif weak == "Analytical Signal: Complete":
            st.success("✓ Analytical Signal: Complete — no weaknesses detected.")

        # Narrative
        reason = str(row.get("reason",""))
        if reason and reason not in ("nan","None",""):
            st.subheader("📝 Full Narrative")
            # Highlight amounts and dates
            hl = reason
            for m in AMOUNT_PATTERN.findall(reason):
                hl = hl.replace(m, f'<mark style="background:{C["high"]}22;color:{C["high"]};border-radius:3px;padding:0 2px">{m}</mark>', 1)
            for m in DATE_PATTERN.findall(reason):
                hl = hl.replace(m, f'<mark style="background:{C["accent"]}22;color:{C["accent"]};border-radius:3px;padding:0 2px">{m}</mark>', 1)
            st.markdown("{hl}")

# ─────────────────────────────────────────────────────────────────────────────
#  PAGE: COMPARE
# ─────────────────────────────────────────────────────────────────────────────
elif page == "⚖   Compare":
    if df.empty:
        st.info("No data loaded.")
    else:
        ids = df["report_id"].tolist() if "report_id" in df.columns else list(range(len(df)))
        cc1, cc2 = st.columns(2)
        with cc1: id_a = st.selectbox("Report A", ids, key="ca")
        with cc2: id_b = st.selectbox("Report B", ids, index=min(1,len(ids)-1), key="cb")

        row_a = df[df["report_id"]==id_a].iloc[0] if "report_id" in df.columns else df.iloc[id_a]
        row_b = df[df["report_id"]==id_b].iloc[0] if "report_id" in df.columns else df.iloc[id_b]

        if HAS_PLOTLY:
            da, db = st.columns(2)
            with da: st.plotly_chart(make_donut(float(row_a.get("final_score") or 0), str(id_a)[:20]), use_container_width=True)
            with db: st.plotly_chart(make_donut(float(row_b.get("final_score") or 0), str(id_b)[:20]), use_container_width=True)

        # Comparison table
        st.subheader("Side-by-Side Metrics")
        metrics_cmp = [
            ("Overall Score",    "final_score",      "{:.3f}"),
            ("Structure Score",  "struct_score",     "{:.3f}"),
            ("Narrative Score",  "narr_score",       "{:.3f}"),
            ("Explanation",      "expl_score",       "{:.3f}"),
            ("Uniqueness",       "uniqueness",       "{:.3f}"),
            ("Tier",             "tier",             "{}"),
            ("Narr Length",      "len",              "{:.0f}"),
            ("Country",          "country",          "{}"),
            ("TX Mode",          "mode_code",        "{}"),
            ("Amount Z-Score",   "amount_zscore",    "{:.2f}"),
            ("PEP Flag",         "sender_pep",       "{}"),
        ]
        

        for lbl, col, fmt in metrics_cmp:
            va = row_a.get(col); vb = row_b.get(col)
            va_s = fmt.format(va) if va is not None and str(va) not in ("nan","None") else "—"
            vb_s = fmt.format(vb) if vb is not None and str(vb) not in ("nan","None") else "—"
            try:
                fa, fb = float(va), float(vb)
                ca_style = f"color:{C['high']}" if fa > fb else (f"color:{C['low']}" if fa < fb else "")
                cb_style = f"color:{C['high']}" if fb > fa else (f"color:{C['low']}" if fb < fa else "")
            except:
                ca_style = cb_style = ""
            

        

# Narratives
        na1, na2 = st.columns(2)
        with na1:
            st.subheader("Narrative A")
            r = str(row_a.get("reason", ""))
            st.markdown(f"{r if r not in ('nan', 'None', '') else '<em>No narrative</em>'}", unsafe_allow_html=True)
        with na2:
            st.subheader("Narrative B")
            r = str(row_b.get("reason", ""))
            st.markdown(f"{r if r not in ('nan', 'None', '') else '<em>No narrative</em>'}", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
#  PAGE: UPLOAD & SCORE
# ─────────────────────────────────────────────────────────────────────────────
elif page == "📁  Upload & Score":
    st.subheader("Upload XML Files · Run Full Scoring Pipeline")
    st.info("Upload your XML reports below to run the scoring pipeline.")

    if not HAS_XML:
        st.warning("⚠ defusedxml not installed. Run: <code>pip install defusedxml</code>")

    up_tab1, up_tab2 = st.tabs(["📄 XML Files", "📊 CSV Direct"])

    with up_tab1:
        uploaded = st.file_uploader("Drop XML files here", type="xml", accept_multiple_files=True,
            help="Upload STR XML files. The full pipeline (parse → NLP → score) runs on each file.")
        if uploaded and HAS_XML:
            results = []
            temp_dir = Path(__file__).parent.parent / "temp_uploads"
            temp_dir.mkdir(exist_ok=True)
            prog = st.progress(0)
            status = st.empty()
            for i, f in enumerate(uploaded):
                status.markdown(f'<div class="alert-info">Processing {f.name} ({i+1}/{len(uploaded)})…</div>')
                tp = temp_dir / f.name
                try:
                    tp.write_bytes(f.getbuffer())
                    data = parse_xml_file(str(tp))
                    if data and not data.get("error"):
                        results.append(data)
                    elif data.get("error"):
                        st.warning(f"⚠ {f.name}: {data['error']}")
                except Exception as e:
                    st.warning(f"⚠ {f.name}: {e}")
                finally:
                    if tp.exists(): tp.unlink()
                prog.progress((i+1)/len(uploaded))

            status.empty()
            if results:
                df_new = pd.DataFrame(results)
                df_new = score_dataframe(df_new)
                df_new["tier"] = df_new["final_score"].apply(get_tier)
                df_new["weaknesses"] = df_new.apply(get_weaknesses, axis=1)
                df_new = df_new.sort_values("final_score", ascending=False)

                avg = df_new["final_score"].mean()
                h_c = (df_new["final_score"]>=0.75).sum()
                l_c = (df_new["final_score"]<0.45).sum()

                

                show_c = [c for c in ["report_id","final_score","struct_score","narr_score",
                    "expl_score","uniqueness","tier","len","weaknesses"] if c in df_new.columns]
                st.dataframe(df_new[show_c], use_container_width=True, height=400)

                col1, col2 = st.columns(2)
                with col1:
                    st.download_button("⬇ CSV Export",
                        df_new.to_csv(index=False).encode(),
                        "STR_PRIORITY_RANKING_FINAL.csv","text/csv")
                with col2:
                    top10 = df_new.nlargest(10,"final_score")
                    bot5  = df_new.nsmallest(5,"final_score")
                    dash_df2 = pd.concat([top10,bot5]).drop_duplicates(subset=["report_id"]) if "report_id" in df_new.columns else top10
                    dashboard2 = [{
                        "id": str(r.get("report_id","—")),
                        "score": float(r.get("final_score",0)),
                        "status": get_tier(float(r.get("final_score",0))),
                        "reason_preview": str(r.get("reason",""))[:160]+"...",
                        "weaknesses": str(r.get("weaknesses","")).split("; ")
                    } for _,r in dash_df2.iterrows()]
                    st.download_button("⬇ JSON Dashboard",
                        json.dumps(dashboard2,indent=4).encode(),
                        "str_dashboard_data.json","application/json")
            else:
                st.error("No valid reports parsed from uploaded files.")

    with up_tab2:
        st.info("ℹ Drop a pre-existing CSV here to view and re-analyze it directly.")
        up_csv = st.file_uploader("Upload CSV", type="csv")
        if up_csv:
            df_csv = pd.read_csv(up_csv)
            st.success("✓ Loaded {len(df_csv)} rows · {len(df_csv.columns)} columns")
            df_csv = normalize_df(df_csv)
            if "reason" in df_csv.columns and "final_score" not in df_csv.columns:
                with st.spinner("Running scoring pipeline…"):
                    df_csv = score_dataframe(df_csv)
            st.dataframe(df_csv, use_container_width=True, height=400)
            st.download_button("⬇ Download Scored CSV",
                df_csv.to_csv(index=False).encode(),
                "scored_upload.csv","text/csv")