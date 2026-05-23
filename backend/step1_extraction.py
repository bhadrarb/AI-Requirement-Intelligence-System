"""
STEP 1 — REQUIREMENT EXTRACTION
---------------------------------
Reads raw text → finds sentences that look like requirements.
Scores each sentence on: modal verbs, action verbs, subject patterns, TF-IDF.
Threshold: score >= 0.4 → keep as requirement.
"""

import re
import math
import nltk
from typing import List, Dict

# Download quietly — won't crash if already present
nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)

from nltk.tokenize import sent_tokenize

MODAL_STRONG   = ["shall", "must"]
MODAL_MODERATE = ["should", "will", "is required to", "are required to", "needs to", "need to"]

ACTION_VERBS = [
    "allow", "enable", "provide", "support", "ensure", "maintain",
    "generate", "display", "store", "process", "validate", "authenticate",
    "authorize", "notify", "send", "receive", "create", "update", "delete",
    "log", "track", "calculate", "detect", "prevent", "enforce"
]

SUBJECT_PATTERNS = [
    r"the system", r"the application", r"the platform",
    r"the software", r"the tool", r"the module"
]


def _tfidf_scores(sentences: List[str]) -> Dict[int, float]:
    word_doc_count = {}
    tokenized = []
    for sentence in sentences:
        words = set(re.findall(r'\b\w+\b', sentence.lower()))
        tokenized.append(words)
        for w in words:
            word_doc_count[w] = word_doc_count.get(w, 0) + 1

    N = max(len(sentences), 1)
    scores = {}
    for i, words in enumerate(tokenized):
        if not words:
            scores[i] = 0.0
            continue
        s = sum((1.0 / len(words)) * math.log(N / (1 + word_doc_count.get(w, 1))) for w in words)
        scores[i] = max(0.0, s)

    max_s = max(scores.values()) if scores else 1.0
    if max_s > 0:
        scores = {k: v / max_s for k, v in scores.items()}
    return scores


def _score(sentence: str, tfidf: float) -> float:
    s = sentence.lower().strip()
    score = 0.0
    if any(m in s for m in MODAL_STRONG):
        score += 0.5
    elif any(m in s for m in MODAL_MODERATE):
        score += 0.3
    if any(v in s for v in ACTION_VERBS):
        score += 0.2
    if any(re.search(p, s) for p in SUBJECT_PATTERNS):
        score += 0.2
    score += tfidf * 0.2
    n = len(s.split())
    if n < 5 or n > 60:
        score *= 0.5
    return min(score, 1.0)


def extract_requirements(text: str, source: str = "unknown") -> List[Dict]:
    """
    Returns list of requirement dicts with: req_id, text, source, confidence
    SAFE: never crashes — returns [] on any error.
    """
    try:
        sentences = sent_tokenize(text)
    except Exception:
        # Fallback: split on period if NLTK fails
        sentences = [s.strip() for s in text.split('.') if s.strip()]

    tfidf = _tfidf_scores(sentences)
    results = []
    for i, sent in enumerate(sentences):
        sent = sent.strip()
        if not sent:
            continue
        conf = _score(sent, tfidf.get(i, 0.0))
        if conf >= 0.4:
            results.append({
                "req_id":     f"REQ_{i+1:03d}",
                "text":       sent,
                "source":     source,
                "confidence": round(conf, 3)
            })
    return results
