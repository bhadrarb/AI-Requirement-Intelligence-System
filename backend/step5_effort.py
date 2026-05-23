"""
STEP 5 — EFFORT ESTIMATION
-----------------------------
Predicts story points (1, 2, 3, 5, 8, 13) for each requirement.
Uses Random Forest Regressor (effort_estimator.pkl).

FIX: Robust multi-path model search.
FIX: Rule-based fallback if model missing.
"""

import os
from typing import List, Dict

_HERE = os.path.dirname(os.path.abspath(__file__))
_SEARCH_PATHS = [
    os.path.join(_HERE, "models"),
    os.path.join(_HERE, "..", "data", "models"),
    os.path.join(_HERE, "..", "models"),
    os.path.join(_HERE),
]

def _find_model(filename: str):
    for p in _SEARCH_PATHS:
        full = os.path.join(p, filename)
        if os.path.exists(full):
            return full
    return None


FIBONACCI = [1, 2, 3, 5, 8, 13]
LABELS    = {1: "XS", 2: "S", 3: "M", 5: "L", 8: "XL", 13: "XXL"}

_model = None

def _get_model():
    global _model
    if _model is not None:
        return _model
    path = _find_model("effort_estimator.pkl")
    if path is None:
        return None
    try:
        import joblib
        _model = joblib.load(path)
        return _model
    except Exception:
        return None


def _snap_fibonacci(value: float) -> int:
    return min(FIBONACCI, key=lambda f: abs(f - value))


# ── Rule-based fallback ──────────────────────────────────────────────────────
_COMPLEX_WORDS = [
    "traceability", "duplicate", "conflict", "real-time", "oauth",
    "integrate", "gdpr", "concurrent", "two-factor", "jira", "availab"
]
_SIMPLE_WORDS = [
    "tooltip", "welcome", "dark mode", "shortcut", "message", "theme",
    "remember", "motivational", "label", "toggle"
]

def _rule_effort(text: str, priority: str, req_type: str) -> float:
    t = text.lower()
    base = {"high": 6.0, "medium": 4.0, "low": 2.0}.get(priority, 4.0)
    if req_type == "non_functional":
        base += 1.5
    if any(w in t for w in _COMPLEX_WORDS):
        base += 3.0
    if any(w in t for w in _SIMPLE_WORDS):
        base = max(1.0, base - 2.0)
    return base


def estimate_effort(requirements: List[Dict]) -> List[Dict]:
    """
    Adds 'effort_points', 'effort_label', 'effort_raw' to each requirement.
    SAFE: falls back to rule-based if model unavailable.
    """
    if not requirements:
        return requirements

    model = _get_model()

    if model is not None:
        try:
            combined = [
                f"{r.get('type','functional')} priority_{r.get('priority','medium')} {r['text']}"
                for r in requirements
            ]
            raw_preds = model.predict(combined)
            for req, raw in zip(requirements, raw_preds):
                pts = _snap_fibonacci(float(raw))
                req["effort_points"] = pts
                req["effort_label"]  = LABELS.get(pts, "M")
                req["effort_raw"]    = round(float(raw), 2)
            return requirements
        except Exception:
            pass

    # Rule-based fallback
    for req in requirements:
        raw = _rule_effort(req["text"], req.get("priority", "medium"), req.get("type", "functional"))
        pts = _snap_fibonacci(raw)
        req["effort_points"] = pts
        req["effort_label"]  = LABELS.get(pts, "M")
        req["effort_raw"]    = round(raw, 2)

    return requirements
