"""
STEP 2 — ML REQUIREMENT CLASSIFICATION
----------------------------------------
Labels each requirement as "functional" or "non_functional".
Uses pre-trained SVM model (classifier.pkl).

FIX: Robust model path resolution — works whether you run from backend/ or project root.
FIX: Graceful fallback if model not found (rule-based fallback).
"""

import os
import re
from typing import List, Dict

# ── Path resolution (works from any working directory) ──────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
_SEARCH_PATHS = [
    os.path.join(_HERE, "models"),
    os.path.join(_HERE, "..", "data", "models"),
    os.path.join(_HERE, "..", "models"),
    os.path.join(_HERE),
]

def _find_model(filename: str) -> str | None:
    for p in _SEARCH_PATHS:
        full = os.path.join(p, filename)
        if os.path.exists(full):
            return full
    return None


_classifier = None

def _get_classifier():
    global _classifier
    if _classifier is not None:
        return _classifier
    path = _find_model("classifier.pkl")
    if path is None:
        return None  # will use fallback
    try:
        import joblib
        _classifier = joblib.load(path)
        return _classifier
    except Exception:
        return None


# ── Rule-based fallback ──────────────────────────────────────────────────────
_NFR_KEYWORDS = [
    "performance", "speed", "availab", "uptime", "latency", "response time",
    "scalab", "concurrent", "encrypt", "security", "https", "backup",
    "recover", "gdpr", "complian", "millisecond", "second", "percent",
    "uptime", "mobile", "browser", "deploy", "owasp", "access control",
    "reliability", "maintainab", "portab"
]

def _rule_classify(text: str) -> tuple[str, float]:
    t = text.lower()
    hits = sum(1 for kw in _NFR_KEYWORDS if kw in t)
    if hits >= 1:
        return "non_functional", min(0.6 + hits * 0.05, 0.95)
    return "functional", 0.75


def classify_requirements(requirements: List[Dict]) -> List[Dict]:
    """
    Adds 'type' and 'type_confidence' to each requirement.
    Falls back to rule-based if model unavailable.
    SAFE: never crashes.
    """
    if not requirements:
        return requirements

    clf = _get_classifier()

    if clf is not None:
        try:
            texts  = [r["text"] for r in requirements]
            labels = clf.predict(texts)
            probas = clf.predict_proba(texts)
            for req, label, proba in zip(requirements, labels, probas):
                req["type"]            = label
                req["type_confidence"] = round(float(max(proba)), 3)
            return requirements
        except Exception:
            pass  # fall through to rule-based

    # Rule-based fallback
    for req in requirements:
        label, conf = _rule_classify(req["text"])
        req["type"]            = label
        req["type_confidence"] = conf

    return requirements
