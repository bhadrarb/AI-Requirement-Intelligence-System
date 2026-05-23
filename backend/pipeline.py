"""
pipeline.py — Orchestrator
---------------------------
Calls all 6 steps in order. Returns one complete result dict.

FIX: Full try/except at each step — if one step fails, pipeline still returns partial data.
FIX: Correct import of predict_priority (not predict_priorities).
"""

import os
import sys
import traceback

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from step1_extraction    import extract_requirements
from step2_classification import classify_requirements
from step3_mismatch      import detect_mismatches
from step4_priority      import predict_priority
from step5_effort        import estimate_effort
from step6_tasks         import generate_tasks, assign_tasks, build_traceability


def run_pipeline(documents: list, employees: list) -> dict:
    """
    Runs the full 6-step pipeline.
    Returns a result dict — never throws an exception to the caller.
    """
    try:
        # ── STEP 1: Extract ──────────────────────────────────────────────────
        all_requirements = []
        for doc in documents:
            try:
                reqs = extract_requirements(doc.get("text", ""), doc.get("source", "unknown"))
                all_requirements.extend(reqs)
            except Exception as e:
                print(f"[STEP1 ERROR] {doc.get('source','?')}: {e}")

        if not all_requirements:
            return {
                "status": "warning",
                "message": "No requirements found in uploaded documents.",
                "requirements": [], "tasks": [], "mismatches": {}, "traceability": {}
            }

        # ── STEP 2: Classify ─────────────────────────────────────────────────
        try:
            classified = classify_requirements(all_requirements)
        except Exception as e:
            print(f"[STEP2 ERROR] {e}")
            classified = all_requirements  # carry forward unclassified

        # ── STEP 3: Mismatch detection ───────────────────────────────────────
        try:
            mismatch_report = detect_mismatches(classified)
        except Exception as e:
            print(f"[STEP3 ERROR] {e}")
            mismatch_report = {
                "duplicates": [], "conflicts": [], "ambiguities": [],
                "cross_document": [], "conflicted_ids": [],
                "similarity_matrix": [], "req_ids": [],
                "summary": {"duplicates": 0, "conflicts": 0, "ambiguities": 0,
                            "cross_document": 0, "total_issues": 0}
            }

        conflicted_ids = set(mismatch_report.get("conflicted_ids", []))
        validated = [r for r in classified if r["req_id"] not in conflicted_ids]
        if not validated:
            validated = classified  # fallback: use all if everything conflicted

        # ── STEP 4: Priority ─────────────────────────────────────────────────
        try:
            validated = predict_priority(validated)
        except Exception as e:
            print(f"[STEP4 ERROR] {e}")
            for r in validated:
                r.setdefault("priority", "medium")
                r.setdefault("priority_confidence", 0.5)
                r.setdefault("priority_order", 2)

        # ── STEP 5: Effort ───────────────────────────────────────────────────
        try:
            validated = estimate_effort(validated)
        except Exception as e:
            print(f"[STEP5 ERROR] {e}")
            for r in validated:
                r.setdefault("effort_points", 3)
                r.setdefault("effort_label", "M")
                r.setdefault("effort_raw", 3.0)

        # ── STEP 6: Tasks ────────────────────────────────────────────────────
        try:
            tasks = generate_tasks(validated)
            tasks = assign_tasks(tasks, employees)
            traceability = build_traceability(validated, tasks, employees)
        except Exception as e:
            print(f"[STEP6 ERROR] {e}\n{traceback.format_exc()}")
            tasks = []
            traceability = {}

        return {
            "status":       "success",
            "requirements": classified,
            "mismatches":   mismatch_report,
            "tasks":        tasks,
            "traceability": traceability,
        }

    except Exception as e:
        return {
            "status":  "error",
            "message": str(e),
            "detail":  traceback.format_exc()
        }
