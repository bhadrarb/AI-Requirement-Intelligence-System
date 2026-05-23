"""
STEP 3 — MISMATCH DETECTION
------------------------------
Finds problems between requirements:
  1. DUPLICATES  — two requirements say almost the same thing
  2. CONFLICTS   — one is vague, one is specific; or one negates the other
  3. AMBIGUITIES — requirement uses unmeasurable words like "fast", "secure"
  4. CROSS-DOC   — issues found across different uploaded files

FIX: Handles single-requirement input (< 2 reqs).
FIX: Handles empty text gracefully.
FIX: Uses both "source" and "source_document" keys safely.
"""

from typing import List, Dict

DUPLICATE_THRESHOLD = 0.65
CONFLICT_THRESHOLD  = 0.40

VAGUE_WORDS = [
    "fast", "efficient", "user-friendly", "secure", "robust",
    "reliable", "good", "easy", "simple", "quickly", "soon",
    "adequate", "sufficient", "reasonable", "appropriate",
    "large number", "many users", "high performance"
]

NEGATION_WORDS = ["not", "never", "no ", "without", "prevent", "disable", "restrict"]

_EMPTY = {
    "duplicates": [], "conflicts": [], "ambiguities": [],
    "cross_document": [], "conflicted_ids": [],
    "similarity_matrix": [], "req_ids": [],
    "summary": {"duplicates": 0, "conflicts": 0, "ambiguities": 0,
                "cross_document": 0, "total_issues": 0}
}


def _vague(text: str) -> List[str]:
    t = text.lower()
    return [w for w in VAGUE_WORDS if w in t]


def _negated(text: str) -> bool:
    t = text.lower()
    return any(w in t for w in NEGATION_WORDS)


def detect_mismatches(requirements: List[Dict]) -> Dict:
    """
    SAFE: returns empty mismatch report if fewer than 2 requirements.
    """
    if not requirements or len(requirements) < 2:
        return dict(_EMPTY)

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
    except ImportError:
        # scikit-learn not available — skip similarity, only do ambiguity
        return _ambiguity_only(requirements)

    texts = [r.get("text", "") for r in requirements]
    ids   = [r.get("req_id", f"REQ_{i}") for i, r in enumerate(requirements)]
    docs  = [r.get("source") or r.get("source_document", "unknown") for r in requirements]

    # Some texts might be empty — replace to avoid TF-IDF errors
    safe_texts = [t if t.strip() else "placeholder" for t in texts]

    try:
        vec    = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", min_df=1)
        matrix = vec.fit_transform(safe_texts)
        sim    = cosine_similarity(matrix)
    except Exception:
        return _ambiguity_only(requirements)

    duplicates, conflicts, cross_doc = [], [], []

    for i in range(len(requirements)):
        for j in range(i + 1, len(requirements)):
            s        = float(sim[i][j])
            same_doc = docs[i] == docs[j]
            vi, vj   = _vague(texts[i]), _vague(texts[j])
            ni, nj   = _negated(texts[i]), _negated(texts[j])

            if s >= DUPLICATE_THRESHOLD:
                issue = {
                    "req_1": ids[i], "req_2": ids[j],
                    "text_1": texts[i], "text_2": texts[j],
                    "similarity": round(s, 3), "type": "duplicate",
                    "same_document": same_doc,
                    "doc_1": docs[i], "doc_2": docs[j],
                    "cross_document": not same_doc
                }
                duplicates.append(issue)
                if not same_doc:
                    cross_doc.append({**issue, "issue_type": "CROSS-DOC DUPLICATE",
                        "explanation": f"Nearly identical in '{docs[i]}' and '{docs[j]}'"})

            elif CONFLICT_THRESHOLD <= s < DUPLICATE_THRESHOLD:
                if vi and not vj:
                    ctype = "ambiguity_conflict"
                    expl  = f"'{docs[i]}' is vague ({', '.join(vi)}); '{docs[j]}' is specific"
                elif vj and not vi:
                    ctype = "ambiguity_conflict"
                    expl  = f"'{docs[j]}' is vague ({', '.join(vj)}); '{docs[i]}' is specific"
                elif ni != nj and s > 0.45:
                    ctype = "contradiction"
                    expl  = "Requirements may contradict each other"
                else:
                    continue

                issue = {
                    "req_1": ids[i], "req_2": ids[j],
                    "text_1": texts[i], "text_2": texts[j],
                    "similarity": round(s, 3), "type": ctype,
                    "same_document": same_doc,
                    "doc_1": docs[i], "doc_2": docs[j],
                    "cross_document": not same_doc, "explanation": expl
                }
                conflicts.append(issue)
                if not same_doc:
                    cross_doc.append({**issue, "issue_type": "CROSS-DOC CONFLICT"})

    ambiguities = _get_ambiguities(requirements)

    conflicted_ids = set()
    for d in duplicates:
        if not d["same_document"]:
            conflicted_ids.update([d["req_1"], d["req_2"]])

    return {
        "duplicates":        duplicates,
        "conflicts":         conflicts,
        "ambiguities":       ambiguities,
        "cross_document":    cross_doc,
        "conflicted_ids":    list(conflicted_ids),
        "similarity_matrix": sim.tolist(),
        "req_ids":           ids,
        "summary": {
            "duplicates":    len(duplicates),
            "conflicts":     len(conflicts),
            "ambiguities":   len(ambiguities),
            "cross_document": len(cross_doc),
            "total_issues":  len(duplicates) + len(conflicts) + len(ambiguities)
        }
    }


def _get_ambiguities(requirements: List[Dict]) -> List[Dict]:
    result = []
    for req in requirements:
        found = _vague(req.get("text", ""))
        if found:
            result.append({
                "req_id":      req.get("req_id", ""),
                "text":        req.get("text", ""),
                "source":      req.get("source") or req.get("source_document", ""),
                "vague_words": found,
                "type":        "vague_language",
                "suggestion":  f"Replace '{', '.join(found)}' with measurable criteria (e.g. 'within 2 seconds')"
            })
    return result


def _ambiguity_only(requirements: List[Dict]) -> Dict:
    ambiguities = _get_ambiguities(requirements)
    return {
        **dict(_EMPTY),
        "ambiguities": ambiguities,
        "req_ids": [r.get("req_id", "") for r in requirements],
        "summary": {**_EMPTY["summary"], "ambiguities": len(ambiguities),
                    "total_issues": len(ambiguities)}
    }
