"""
STEP 4 — PRIORITY PREDICTION
-------------------------------
Predicts High / Medium / Low priority for each requirement.
Uses Random Forest model (priority_predictor.pkl).

FIX: Robust multi-path model search.
FIX: Rule-based fallback if model missing.
"""

import os
import re
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


_model = None

def _get_model():
    global _model
    if _model is not None:
        return _model
    path = _find_model("priority_predictor.pkl")
    if path is None:
        return None
    try:
        import joblib
        _model = joblib.load(path)
        return _model
    except Exception:
        return None


# ── Rule-based fallback ──────────────────────────────────────────────────────
_HIGH_WORDS = [
    "security", "encrypt", "authenticat", "login", "password", "breach",
    "backup", "critical", "payment", "unauthoriz", "prevent", "data loss",
    "availab", "uptime", "gdpr", "compli"
]
_LOW_WORDS = [
    "theme", "dark mode", "tooltip", "welcome", "tutorial", "shortcut",
    "animation", "onboard", "message", "remember", "last visited",
    "motivational", "customiz"
]

def _rule_priority(text: str, req_type: str) -> tuple[str, float]:
    t = text.lower()
    high_hits = sum(1 for w in _HIGH_WORDS if w in t)
    low_hits  = sum(1 for w in _LOW_WORDS if w in t)
    if high_hits >= 1:
        return "high", min(0.6 + high_hits * 0.1, 0.95)
    if low_hits >= 1:
        return "low", min(0.6 + low_hits * 0.1, 0.95)
    return "medium", 0.65


PRIORITY_ORDER = {"high": 3, "medium": 2, "low": 1}


def predict_priority(requirements: List[Dict]) -> List[Dict]:
    """
    Adds 'priority', 'priority_confidence', 'priority_order' to each requirement.
    SAFE: falls back to rule-based if model unavailable.
    """
    if not requirements:
        return requirements

    model = _get_model()

    if model is not None:
        try:
            combined = [f"{r.get('type','functional')} {r['text']}" for r in requirements]
            labels   = model.predict(combined)
            probas   = model.predict_proba(combined)
            for req, label, proba in zip(requirements, labels, probas):
                req["priority"]            = label
                req["priority_confidence"] = round(float(max(proba)), 3)
                req["priority_order"]      = PRIORITY_ORDER.get(label, 2)
            return requirements
        except Exception:
            pass

    # Rule-based fallback
    for req in requirements:
        label, conf = _rule_priority(req["text"], req.get("type", "functional"))
        req["priority"]            = label
        req["priority_confidence"] = conf
        req["priority_order"]      = PRIORITY_ORDER.get(label, 2)

    return requirements
