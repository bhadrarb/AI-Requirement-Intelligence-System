"""
STEP 6 — TASK GENERATION & INTELLIGENT ASSIGNMENT
---------------------------------------------------

MODULE 4 — Explainable Multi-Objective Scoring
MODULE 5 — Allocation Confidence & Fragility
MODULE 6 — Team Stability Index (TSI)
MODULE 7 — Stability Impact Simulation
MODULE 8 — Composite Risk Score

PHASE 5 NEW:
  - detect_dependencies(): auto-infers task dependencies from requirement text
  - dependency_chain_risk(): flags cascade delays when upstream tasks are risky
  - generate_risk_report(): produces the full 5-type project risk report
"""

import re
from typing import List, Dict, Optional

# ── Config ─────────────────────────────────────────────────────────────────
W1 = 0.5
W2 = 0.3
W3 = 0.2
CAPACITY = 20
URGENCY_MAP = {"high": 1.0, "medium": 0.6, "low": 0.2}

SKILL_KEYWORDS = {
    "login":          ["backend"],
    "authentication": ["backend"],
    "password":       ["backend"],
    "register":       ["backend"],
    "api":            ["backend"],
    "database":       ["database"],
    "store":          ["database"],
    "query":          ["database"],
    "ui":             ["frontend"],
    "dashboard":      ["frontend"],
    "display":        ["frontend"],
    "interface":      ["frontend"],
    "button":         ["frontend"],
    "form":           ["frontend"],
    "notification":   ["backend", "frontend"],
    "email":          ["backend"],
    "report":         ["backend", "frontend"],
    "export":         ["backend"],
    "search":         ["backend", "frontend"],
    "encrypt":        ["backend", "security"],
    "security":       ["backend", "security"],
    "performance":    ["backend"],
    "scalab":         ["backend", "devops"],
    "deploy":         ["devops"],
    "server":         ["devops"],
    "cloud":          ["devops"],
    "test":           ["testing"],
    "validation":     ["backend"],
    "upload":         ["backend", "frontend"],
    "download":       ["backend", "frontend"],
}

# Dependency rules: if task text contains KEY, it likely depends on tasks
# containing any of the VALUES
DEPENDENCY_RULES = [
    # auth chain
    (["dashboard", "profile", "account", "notification", "task assign"],
     ["login", "authenticat", "register"]),
    # encryption depends on auth
    (["encrypt", "password", "bcrypt", "hash"],
     ["login", "authenticat", "register"]),
    # report/export depends on data being stored
    (["report", "export", "csv", "pdf", "excel", "traceability"],
     ["store", "database", "dashboard", "project"]),
    # search depends on data existing
    (["search", "filter", "query"],
     ["store", "database", "upload"]),
    # notifications depend on user system
    (["notification", "email", "alert"],
     ["login", "register", "user account"]),
    # task management depends on project creation
    (["task", "assign", "completion", "history", "reorder"],
     ["project", "create project"]),
    # performance/scaling depends on core features
    (["performance", "scalab", "concurrent", "availab"],
     ["login", "database", "api"]),
    # security/compliance depends on auth
    (["gdpr", "complian", "access control", "https", "role"],
     ["login", "authenticat", "encrypt"]),
    # mobile/browser access depends on UI existing
    (["mobile", "browser", "accessible", "responsive"],
     ["dashboard", "display", "interface"]),
]


def extract_required_skills(text: str) -> List[str]:
    t = text.lower()
    skills = set()
    for keyword, skill_list in SKILL_KEYWORDS.items():
        if keyword in t:
            skills.update(skill_list)
    if not skills:
        skills.add("backend")
    return list(skills)


# ════════════════════════════════════════════════════════════════════════════
# MODULE 6 — Team Stability Index
# ════════════════════════════════════════════════════════════════════════════

def compute_tsi(workloads: List[float]) -> float:
    if len(workloads) < 2:
        return 1.0
    total = sum(workloads)
    if total == 0:
        return 1.0
    n    = len(workloads)
    mean = total / n
    var  = sum((w - mean) ** 2 for w in workloads) / n
    worst_mean = total / n
    max_var    = ((total - worst_mean) ** 2 + (n - 1) * worst_mean ** 2) / n
    if max_var == 0:
        return 1.0
    return round(max(0.0, min(1.0, 1 - var / max_var)), 4)


def tsi_status(tsi: float) -> str:
    if tsi >= 0.75: return "Stable"
    if tsi >= 0.50: return "Moderate"
    return "Unstable"


# ════════════════════════════════════════════════════════════════════════════
# MODULE 4 — Score one employee for one task
# ════════════════════════════════════════════════════════════════════════════

def score_employee(emp: Dict, required_skills: List[str],
                   priority: str, effort: int) -> Dict:
    emp_skills  = set(emp.get("skills", []))
    req_skills  = set(required_skills)
    matched     = emp_skills & req_skills
    skill_match = len(matched) / max(len(req_skills), 1)

    if skill_match == 0:
        return {
            "emp_id":            emp["emp_id"],
            "name":              emp.get("name", emp["emp_id"]),
            "constraint_passed": False,
            "reason":            "No matching skills",
            "reason_code":       "NO_SKILL_MATCH",
            "skill_match":       0.0,
            "workload_ratio":    None,
            "deadline_urgency":  None,
            "score":             -1.0,
            "matched_skills":    [],
            "missing_skills":    list(req_skills - emp_skills),
        }

    current_wl = emp.get("current_workload", 0)

    if current_wl + effort > CAPACITY:
        return {
            "emp_id":            emp["emp_id"],
            "name":              emp.get("name", emp["emp_id"]),
            "constraint_passed": False,
            "reason":            f"Capacity exceeded ({current_wl}+{effort} > {CAPACITY})",
            "reason_code":       "CAPACITY_EXCEEDED",
            "skill_match":       round(skill_match, 3),
            "workload_ratio":    round(current_wl / CAPACITY, 3),
            "deadline_urgency":  None,
            "score":             -1.0,
            "matched_skills":    list(matched),
            "missing_skills":    list(req_skills - emp_skills),
        }

    wl_ratio = current_wl / CAPACITY
    urgency  = URGENCY_MAP.get(priority, 0.5)

    # Nonlinear penalty when workload > 80%
    nonlinear_penalty = 0.0
    if wl_ratio > 0.8:
        nonlinear_penalty = (wl_ratio ** 2) * 0.2

    score = round(max(0.0, min(1.0,
        W1 * skill_match - W2 * wl_ratio + W3 * urgency - nonlinear_penalty
    )), 4)

    formula = f"{W1}×{round(skill_match,2)} − {W2}×{round(wl_ratio,2)} + {W3}×{urgency}"
    if nonlinear_penalty > 0:
        formula += f" − {round(nonlinear_penalty,3)}(overload penalty)"
    formula += f" = {score}"

    return {
        "emp_id":            emp["emp_id"],
        "name":              emp.get("name", emp["emp_id"]),
        "constraint_passed": True,
        "reason":            "Passed all constraints",
        "reason_code":       "ELIGIBLE",
        "skill_match":       round(skill_match, 3),
        "workload_ratio":    round(wl_ratio, 3),
        "deadline_urgency":  urgency,
        "score":             score,
        "matched_skills":    list(matched),
        "missing_skills":    list(req_skills - emp_skills),
        "current_workload":  current_wl,
        "capacity":          CAPACITY,
        "nonlinear_penalty": round(nonlinear_penalty, 4),
        "formula":           formula,
    }


# ════════════════════════════════════════════════════════════════════════════
# PHASE 5A — Task Dependency Detection
# ════════════════════════════════════════════════════════════════════════════

def detect_dependencies(tasks: List[Dict]) -> List[Dict]:
    """
    Auto-infers dependencies between tasks based on requirement text patterns.

    Returns a list of dependency relationships:
      { task_id, depends_on, reason, cascade_risk }

    Logic: for each dependency rule (dependent_keywords, prerequisite_keywords),
    if task A text matches dependent_keywords AND task B text matches
    prerequisite_keywords, then A depends on B.
    """
    dependencies = []

    for dependent_task in tasks:
        dep_text = dependent_task.get("description", "").lower()

        for dep_keywords, prereq_keywords in DEPENDENCY_RULES:
            # Check if this task matches the dependent side
            dep_match = any(kw in dep_text for kw in dep_keywords)
            if not dep_match:
                continue

            # Find all tasks that match the prerequisite side
            for prereq_task in tasks:
                if prereq_task["task_id"] == dependent_task["task_id"]:
                    continue

                prereq_text = prereq_task.get("description", "").lower()
                prereq_match = any(kw in prereq_text for kw in prereq_keywords)

                if not prereq_match:
                    continue

                # Avoid duplicate dependency entries
                already_added = any(
                    d["task_id"] == dependent_task["task_id"] and
                    d["depends_on"] == prereq_task["task_id"]
                    for d in dependencies
                )
                if already_added:
                    continue

                # Determine cascade risk
                prereq_assigned = prereq_task.get("assigned_to")
                prereq_risk     = prereq_task.get("risk_level", "Low")
                prereq_wl       = prereq_task.get("workload_ratio", 0) or 0

                if not prereq_assigned:
                    cascade = "Critical"
                    cascade_reason = f"Prerequisite {prereq_task['task_id']} is UNASSIGNED — will block this task"
                elif prereq_risk == "High" or prereq_wl > 0.8:
                    cascade = "High"
                    cascade_reason = (
                        f"Prerequisite {prereq_task['task_id']} assigned to "
                        f"{prereq_task.get('assigned_name', prereq_assigned)} "
                        f"who is heavily loaded — delay likely"
                    )
                elif prereq_risk == "Medium":
                    cascade = "Medium"
                    cascade_reason = (
                        f"Prerequisite {prereq_task['task_id']} has medium risk — "
                        f"monitor closely"
                    )
                else:
                    cascade = "Low"
                    cascade_reason = (
                        f"Prerequisite {prereq_task['task_id']} looks healthy"
                    )

                dependencies.append({
                    "task_id":        dependent_task["task_id"],
                    "task_title":     dependent_task.get("title", ""),
                    "depends_on":     prereq_task["task_id"],
                    "prereq_title":   prereq_task.get("title", ""),
                    "reason":         f"'{dependent_task['task_id']}' requires '{prereq_task['task_id']}' to be completed first",
                    "cascade_risk":   cascade,
                    "cascade_reason": cascade_reason,
                    "prereq_assigned_to":   prereq_assigned,
                    "prereq_assigned_name": prereq_task.get("assigned_name"),
                    "prereq_risk_level":    prereq_risk,
                })

    # Sort by cascade risk severity
    risk_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    dependencies.sort(key=lambda d: risk_order.get(d["cascade_risk"], 4))

    return dependencies


# ════════════════════════════════════════════════════════════════════════════
# PHASE 5B — Full Project Risk Report (5 risk types)
# ════════════════════════════════════════════════════════════════════════════

def generate_risk_report(
    tasks: List[Dict],
    employees: List[Dict],
    dependencies: List[Dict],
    traceability: Dict,
) -> Dict:
    """
    Generates the full 5-type project risk report as per the spec:

    1. OverloadRisk       — developer burnout from too many story points
    2. DeadlineRisk       — sprint capacity exceeded
    3. StabilityRisk      — TSI trending toward instability
    4. SkillConcentrationRisk — bus factor / single-dev skills
    5. AllocationFragility — too many fragile assignments

    Each risk has: level, score, affected_developers, details, mitigation
    """

    emp_workloads: Dict[str, int] = {}
    emp_names:     Dict[str, str] = {}
    for t in tasks:
        eid = t.get("assigned_to")
        if eid:
            emp_workloads[eid] = emp_workloads.get(eid, 0) + t.get("story_points", 0)

    for e in employees:
        emp_names[e["emp_id"]] = e.get("name", e["emp_id"])

    # ── 1. OVERLOAD RISK ──────────────────────────────────────────────────
    overloaded = []
    for eid, pts in emp_workloads.items():
        ratio = pts / CAPACITY
        if ratio > 0.8:
            overloaded.append({
                "emp_id":   eid,
                "name":     emp_names.get(eid, eid),
                "points":   pts,
                "ratio":    round(ratio, 3),
                "severity": "Critical" if ratio >= 1.0 else "High",
            })

    if len(overloaded) >= 3:
        overload_level = "High"
    elif len(overloaded) >= 1:
        overload_level = "Medium"
    else:
        overload_level = "Low"

    overload_score = round(
        sum(max(0, o["ratio"] - 0.8) for o in overloaded) / max(len(employees), 1),
        3
    )

    overload_mitigation = []
    for o in overloaded:
        overload_mitigation.append(
            f"Redistribute {max(0, o['points'] - int(CAPACITY * 0.8))} story points "
            f"from {o['name']} to under-loaded developers"
        )
    if not overload_mitigation:
        overload_mitigation = ["All developers are within healthy workload limits"]

    # ── 2. DEADLINE RISK ─────────────────────────────────────────────────
    sprint_capacity = CAPACITY * max(len(employees), 1)
    total_pts       = sum(t.get("story_points", 0) for t in tasks)
    sprint_ratio    = total_pts / max(sprint_capacity, 1)

    unassigned_tasks = [t for t in tasks if not t.get("assigned_to")]
    unassigned_pts   = sum(t.get("story_points", 0) for t in unassigned_tasks)

    if sprint_ratio > 1.0 or unassigned_pts > 0:
        deadline_level = "High"
    elif sprint_ratio > 0.85:
        deadline_level = "Medium"
    else:
        deadline_level = "Low"

    deadline_score = round(min(1.0, sprint_ratio + (unassigned_pts / max(sprint_capacity, 1))), 3)

    deadline_mitigation = []
    if unassigned_tasks:
        deadline_mitigation.append(
            f"{len(unassigned_tasks)} task(s) unassigned ({unassigned_pts} pts) — "
            f"add developers or extend sprint"
        )
    if sprint_ratio > 0.85:
        deadline_mitigation.append(
            f"Total workload ({total_pts} pts) is {round(sprint_ratio*100)}% of sprint capacity — "
            f"consider splitting into 2 sprints"
        )
    if not deadline_mitigation:
        deadline_mitigation = ["Sprint workload is within capacity"]

    # ── 3. STABILITY RISK ────────────────────────────────────────────────
    final_tsi   = traceability.get("team_stability_index", 1.0)
    tsi_stat    = traceability.get("tsi_status", "Stable")

    # Compute how many tasks caused TSI to drop
    tsi_drops = [
        t for t in tasks
        if (t.get("tsi_impact") or 0) < -0.05
    ]

    if final_tsi < 0.5:
        stability_level = "High"
    elif final_tsi < 0.75 or len(tsi_drops) > len(tasks) * 0.4:
        stability_level = "Medium"
    else:
        stability_level = "Low"

    stability_score = round(1 - final_tsi, 3)

    # Find most and least loaded devs
    sorted_workloads = sorted(emp_workloads.items(), key=lambda x: x[1])
    stability_mitigation = []
    if len(sorted_workloads) >= 2:
        lightest_id, lightest_pts = sorted_workloads[0]
        heaviest_id, heaviest_pts = sorted_workloads[-1]
        gap = heaviest_pts - lightest_pts
        if gap > 5:
            stability_mitigation.append(
                f"Move {gap // 2} story points from "
                f"{emp_names.get(heaviest_id, heaviest_id)} ({heaviest_pts} pts) to "
                f"{emp_names.get(lightest_id, lightest_id)} ({lightest_pts} pts)"
            )
    if not stability_mitigation:
        stability_mitigation = [f"Team balance is {tsi_stat} (TSI: {round(final_tsi*100)}%)"]

    # ── 4. SKILL CONCENTRATION RISK ──────────────────────────────────────
    bus_factors = traceability.get("skill_concentration_risk", [])

    # Also compute from employee data directly
    skill_to_devs: Dict[str, List[str]] = {}
    for emp in employees:
        for skill in emp.get("skills", []):
            skill_to_devs.setdefault(skill, []).append(emp.get("name", emp["emp_id"]))

    critical_skills = []
    for skill, devs in skill_to_devs.items():
        tasks_needing = [t for t in tasks if skill in t.get("required_skills", [])]
        if len(devs) == 1 and len(tasks_needing) > 0:
            critical_skills.append({
                "skill":           skill,
                "only_developer":  devs[0],
                "tasks_affected":  len(tasks_needing),
                "total_pts":       sum(t.get("story_points", 0) for t in tasks_needing),
            })

    if len(critical_skills) >= 3:
        skill_level = "High"
    elif len(critical_skills) >= 1:
        skill_level = "Medium"
    else:
        skill_level = "Low"

    skill_score = round(len(critical_skills) / max(len(skill_to_devs), 1), 3)

    skill_mitigation = []
    for cs in critical_skills[:3]:
        skill_mitigation.append(
            f"Cross-train at least one more developer in '{cs['skill']}' — "
            f"{cs['tasks_affected']} tasks ({cs['total_pts']} pts) depend on "
            f"only {cs['only_developer']}"
        )
    if not skill_mitigation:
        skill_mitigation = ["All skills are covered by multiple developers"]

    # ── 5. ALLOCATION FRAGILITY RISK ────────────────────────────────────
    fragile_tasks = [
        t for t in tasks
        if t.get("allocation_confidence") == "Fragile"
    ]
    no_candidate_tasks = [
        t for t in tasks
        if t.get("allocation_confidence") == "No Candidate"
    ]
    fragility_ratio = len(fragile_tasks) / max(len(tasks), 1)

    if fragility_ratio > 0.6 or len(no_candidate_tasks) > 0:
        fragility_level = "High"
    elif fragility_ratio > 0.3:
        fragility_level = "Medium"
    else:
        fragility_level = "Low"

    fragility_score = round(fragility_ratio + len(no_candidate_tasks) / max(len(tasks), 1), 3)

    fragility_mitigation = []
    if no_candidate_tasks:
        fragility_mitigation.append(
            f"{len(no_candidate_tasks)} task(s) have no candidate at all — "
            f"hire or upskill immediately"
        )
    if fragility_ratio > 0.3:
        fragility_mitigation.append(
            f"{len(fragile_tasks)} of {len(tasks)} assignments are fragile "
            f"(margin < 0.05) — create a backup allocation plan"
        )
    if not fragility_mitigation:
        fragility_mitigation = ["Most assignments have clear winners — allocation is stable"]

    # ── Cascade risk from dependencies ───────────────────────────────────
    critical_cascades = [d for d in dependencies if d["cascade_risk"] == "Critical"]
    high_cascades     = [d for d in dependencies if d["cascade_risk"] == "High"]

    cascade_summary = {
        "total_dependencies": len(dependencies),
        "critical_cascades":  len(critical_cascades),
        "high_cascades":      len(high_cascades),
        "at_risk_chains":     [
            {
                "blocked_task":  d["task_id"],
                "blocked_title": d["task_title"],
                "blocker_task":  d["depends_on"],
                "blocker_title": d["prereq_title"],
                "reason":        d["cascade_reason"],
            }
            for d in (critical_cascades + high_cascades)[:5]  # top 5 worst
        ],
    }

    # ── Overall project health score ─────────────────────────────────────
    level_scores = {"Low": 0, "Medium": 1, "High": 2}
    avg = (
        level_scores[overload_level] +
        level_scores[deadline_level] +
        level_scores[stability_level] +
        level_scores[skill_level] +
        level_scores[fragility_level]
    ) / 5.0

    if avg >= 1.5:
        overall = "High Risk"
        overall_color = "#ef4444"
    elif avg >= 0.8:
        overall = "Medium Risk"
        overall_color = "#f59e0b"
    else:
        overall = "Low Risk"
        overall_color = "#22c55e"

    return {
        "overall_risk":       overall,
        "overall_color":      overall_color,
        "overall_score":      round(avg / 2.0, 3),

        "overload_risk": {
            "type":                 "OverloadRisk",
            "level":                overload_level,
            "score":                overload_score,
            "affected_developers":  [o["name"] for o in overloaded],
            "details":              overloaded,
            "mitigation":           overload_mitigation,
            "description":          "Developer burnout risk from excessive story point allocation",
        },
        "deadline_risk": {
            "type":               "DeadlineRisk",
            "level":              deadline_level,
            "score":              deadline_score,
            "total_points":       total_pts,
            "sprint_capacity":    sprint_capacity,
            "sprint_utilisation": round(sprint_ratio * 100, 1),
            "unassigned_tasks":   len(unassigned_tasks),
            "unassigned_points":  unassigned_pts,
            "mitigation":         deadline_mitigation,
            "description":        "Risk of sprint spillover due to workload exceeding capacity",
        },
        "stability_risk": {
            "type":           "StabilityRisk",
            "level":          stability_level,
            "score":          stability_score,
            "tsi":            final_tsi,
            "tsi_status":     tsi_stat,
            "tsi_drops":      len(tsi_drops),
            "mitigation":     stability_mitigation,
            "description":    "Team workload imbalance risk — uneven distribution across developers",
        },
        "skill_concentration_risk": {
            "type":             "SkillConcentrationRisk",
            "level":            skill_level,
            "score":            skill_score,
            "critical_skills":  critical_skills,
            "bus_factor_count": len(critical_skills),
            "mitigation":       skill_mitigation,
            "description":      "Risk from skills held by only one developer (bus factor)",
        },
        "allocation_fragility": {
            "type":             "AllocationFragility",
            "level":            fragility_level,
            "score":            fragility_score,
            "fragile_count":    len(fragile_tasks),
            "no_candidate":     len(no_candidate_tasks),
            "fragility_ratio":  round(fragility_ratio * 100, 1),
            "mitigation":       fragility_mitigation,
            "description":      "Risk from assignments where the choice between developers was very close",
        },
        "cascade_risk": cascade_summary,
    }


# ════════════════════════════════════════════════════════════════════════════
# Corrective action suggestions (Phase 3)
# ════════════════════════════════════════════════════════════════════════════

def compute_corrective_actions(
    evaluations: List[Dict],
    required_skills: List[str],
    employees: List[Dict],
) -> List[Dict]:
    suggestions = []

    skill_matches = [
        (e, e.get("skill_match", 0))
        for e in evaluations
        if e.get("skill_match", 0) > 0
    ]
    if skill_matches:
        best_partial = max(skill_matches, key=lambda x: x[1])
        emp     = best_partial[0]
        missing = emp.get("missing_skills", [])
        if missing:
            suggestions.append({
                "action":       "UPSKILL",
                "developer":    emp["name"],
                "skill_needed": missing[0],
                "reason":       (
                    f"{emp['name']} has partial skill match. "
                    f"Training in '{missing[0]}' would make them eligible."
                ),
            })

    capacity_rejected = [
        e for e in evaluations
        if e.get("reason_code") == "CAPACITY_EXCEEDED"
    ]
    if capacity_rejected:
        lightest = min(capacity_rejected, key=lambda e: e.get("workload_ratio", 1.0))
        suggestions.append({
            "action":    "REDISTRIBUTE",
            "developer": lightest["name"],
            "reason":    (
                f"{lightest['name']} is over capacity. "
                f"Redistribute some of their existing tasks to free up space."
            ),
        })

    no_skill_at_all = all(
        e.get("reason_code") == "NO_SKILL_MATCH"
        for e in evaluations
    )
    if no_skill_at_all:
        suggestions.append({
            "action":       "HIRE",
            "skill_needed": required_skills[0] if required_skills else "unknown",
            "reason":       (
                f"No current team member has '{required_skills[0] if required_skills else 'required'}' skill. "
                f"Consider hiring or contracting a specialist."
            ),
        })

    if not suggestions:
        suggestions.append({
            "action": "EXTEND_DEADLINE",
            "reason": "All eligible developers are at capacity. Consider extending the sprint.",
        })

    return suggestions


# ════════════════════════════════════════════════════════════════════════════
# MODULE 5 — Allocation Confidence
# ════════════════════════════════════════════════════════════════════════════

def compute_confidence(evaluations: List[Dict]) -> Dict:
    passed = sorted(
        [e for e in evaluations if e.get("constraint_passed")],
        key=lambda x: x["score"],
        reverse=True,
    )
    if len(passed) == 0:
        return {"allocation_confidence": "No Candidate", "margin": 0.0, "best_score": 0.0, "runner_up": None}
    if len(passed) == 1:
        return {"allocation_confidence": "Only Candidate", "margin": 1.0, "best_score": passed[0]["score"], "best_candidate": passed[0]["name"], "runner_up": None}
    best   = passed[0]["score"]
    second = passed[1]["score"]
    margin = round(best - second, 4)
    conf   = "High" if margin > 0.10 else ("Medium" if margin >= 0.05 else "Fragile")
    return {"allocation_confidence": conf, "margin": margin, "best_score": best, "second_best_score": second, "best_candidate": passed[0]["name"], "runner_up": passed[1]["name"]}


# ════════════════════════════════════════════════════════════════════════════
# MODULE 7 — Stability Impact Simulation
# ════════════════════════════════════════════════════════════════════════════

def simulate_stability(emp_state: List[Dict], chosen_id: str, effort: int) -> Dict:
    before = [e.get("current_workload", 0) for e in emp_state]
    after  = [e.get("current_workload", 0) + (effort if e["emp_id"] == chosen_id else 0) for e in emp_state]
    t_before = compute_tsi(before)
    t_after  = compute_tsi(after)
    impact   = round(t_after - t_before, 4)
    return {"tsi_before": t_before, "tsi_after": t_after, "tsi_impact": impact, "tsi_status": tsi_status(t_after), "impact_meaning": "Improves balance" if impact >= 0 else "Increases imbalance"}


# ════════════════════════════════════════════════════════════════════════════
# MODULE 8 — Composite Risk Score
# ════════════════════════════════════════════════════════════════════════════

def compute_risk(margin: float, workload_ratio: float, tsi_impact: float) -> Dict:
    norm_margin = min(margin / 0.3, 1.0)
    tsi_drop    = max(0.0, -tsi_impact)
    risk = round(min(1.0, max(0.0, 0.4*(1-norm_margin) + 0.3*workload_ratio + 0.3*tsi_drop)), 4)
    if risk < 0.35:    level, color = "Low",    "#22c55e"
    elif risk <= 0.65: level, color = "Medium", "#f59e0b"
    else:              level, color = "High",   "#ef4444"
    reasons = []
    if norm_margin < 0.3:    reasons.append("Fragile allocation (very close competitors)")
    if workload_ratio > 0.6: reasons.append("Employee is heavily loaded")
    if tsi_drop > 0.1:       reasons.append("Increases team imbalance")
    if not reasons:          reasons.append("All indicators healthy")
    return {"risk_score": risk, "risk_level": level, "risk_color": color, "risk_reason": " + ".join(reasons), "components": {"fragility_component": round(0.4*(1-norm_margin),4), "workload_component": round(0.3*workload_ratio,4), "stability_component": round(0.3*tsi_drop,4)}}


# ════════════════════════════════════════════════════════════════════════════
# MAIN FUNCTION 1 — Generate tasks
# ════════════════════════════════════════════════════════════════════════════

def generate_tasks(requirements: List[Dict]) -> List[Dict]:
    tasks = []
    for i, req in enumerate(requirements, 1):
        text     = req.get("text", "")
        req_type = req.get("type", "functional")
        is_func  = not req_type.startswith("non")
        title    = re.sub(
            r"^(the system (shall|must|should|will|needs to|has to)|the (software|application|platform) (shall|must))\s*",
            "", text, flags=re.IGNORECASE,
        ).strip()
        title  = (title[0].upper() + title[1:]) if title else text
        prefix = "Implement" if is_func else "Ensure"
        sp     = req.get("effort_points", req.get("story_points", 3))
        tasks.append({
            "task_id":          f"TASK_{i:03d}",
            "title":            f"{prefix}: {title}",
            "type":             "Story" if is_func else "Task",
            "description":      text,
            "requirement_id":   req.get("req_id", ""),
            "priority":         req.get("priority", "medium"),
            "story_points":     sp,
            "effort_label":     req.get("effort_label", "M"),
            "status":           "TODO",
            "assigned_to":      None,
            "assigned_name":    None,
            "required_skills":  extract_required_skills(text),
            "assignment_score": None,
            "source_document":  req.get("source") or req.get("source_document", ""),
        })
    return tasks


# ════════════════════════════════════════════════════════════════════════════
# MAIN FUNCTION 2 — Assign tasks
# ════════════════════════════════════════════════════════════════════════════

def assign_tasks(tasks: List[Dict], employees: List[Dict]) -> List[Dict]:
    if not employees:
        for task in tasks:
            task.update({"assigned_to": None, "assigned_name": None, "assignment_score": 0.0, "allocation_confidence": "No Candidate", "reason_code": "NO_ACTIVE_DEVELOPERS", "margin": 0.0, "risk_score": 1.0, "risk_level": "High", "risk_color": "#ef4444", "risk_reason": "No employees provided", "tsi_before": 1.0, "tsi_after": 1.0, "tsi_impact": 0.0, "tsi_status": "N/A", "constraint_passed": False, "all_evaluations": [], "corrective_actions": [{"action": "HIRE", "reason": "No employees in the system at all."}]})
        return tasks

    state = [{"emp_id": e["emp_id"], "name": e.get("name", e["emp_id"]), "skills": e.get("skills", []), "experience": e.get("experience", 1), "current_workload": e.get("active_task_count", 0) * 2, "capacity": CAPACITY} for e in employees]
    priority_order = {"high": 0, "medium": 1, "low": 2}
    tasks_sorted   = sorted(tasks, key=lambda t: priority_order.get(t.get("priority", "medium"), 1))

    for task in tasks_sorted:
        required  = task["required_skills"]
        effort    = task.get("story_points", 3)
        priority  = task.get("priority", "medium")
        evals     = [score_employee(e, required, priority, effort) for e in state]
        conf_info = compute_confidence(evals)
        eligible  = sorted([e for e in evals if e.get("constraint_passed")], key=lambda x: x["score"], reverse=True)

        if not eligible:
            all_reasons  = [e.get("reason_code", "UNKNOWN") for e in evals]
            reason_code  = "NO_SKILL_MATCH" if all(r=="NO_SKILL_MATCH" for r in all_reasons) else ("CAPACITY_EXCEEDED" if all(r=="CAPACITY_EXCEEDED" for r in all_reasons) else "MIXED_CONSTRAINTS")
            corrective   = compute_corrective_actions(evals, required, employees)
            task.update({"assigned_to": None, "assigned_name": None, "assignment_score": 0.0, "skill_match": 0.0, "workload_ratio": 0.0, "deadline_urgency": URGENCY_MAP.get(priority, 0.5), "allocation_confidence": "No Candidate", "reason_code": reason_code, "margin": 0.0, "tsi_before": compute_tsi([e.get("current_workload",0) for e in state]), "tsi_after": compute_tsi([e.get("current_workload",0) for e in state]), "tsi_impact": 0.0, "tsi_status": "N/A", "impact_meaning": "N/A", "risk_score": 1.0, "risk_level": "High", "risk_color": "#ef4444", "risk_reason": f"No eligible employee found ({reason_code})", "constraint_passed": False, "all_evaluations": evals, "matched_skills": [], "missing_skills": required, "corrective_actions": corrective})
            continue

        best = eligible[0]
        stab = simulate_stability(state, best["emp_id"], effort)
        risk = compute_risk(conf_info["margin"], best["workload_ratio"], stab["tsi_impact"])
        task.update({"assigned_to": best["emp_id"], "assigned_name": best["name"], "assignment_score": best["score"], "skill_match": best["skill_match"], "workload_ratio": best["workload_ratio"], "deadline_urgency": best["deadline_urgency"], "matched_skills": best.get("matched_skills",[]), "missing_skills": best.get("missing_skills",[]), "formula": best.get("formula",""), "nonlinear_penalty": best.get("nonlinear_penalty",0.0), "constraint_passed": True, "reason_code": "ASSIGNED", "corrective_actions": [], "allocation_confidence": conf_info["allocation_confidence"], "margin": conf_info["margin"], "runner_up": conf_info.get("runner_up"), "tsi_before": stab["tsi_before"], "tsi_after": stab["tsi_after"], "tsi_impact": stab["tsi_impact"], "tsi_status": stab["tsi_status"], "impact_meaning": stab["impact_meaning"], "risk_score": risk["risk_score"], "risk_level": risk["risk_level"], "risk_color": risk["risk_color"], "risk_reason": risk["risk_reason"], "risk_components": risk["components"], "all_evaluations": evals})
        for e in state:
            if e["emp_id"] == best["emp_id"]:
                e["current_workload"] += effort
                break

    return tasks


# ════════════════════════════════════════════════════════════════════════════
# MAIN FUNCTION 3 — Build traceability
# ════════════════════════════════════════════════════════════════════════════

def build_traceability(requirements: List[Dict], tasks: List[Dict], employees: List[Dict]) -> Dict:
    req_to_tasks: Dict[str, List[str]] = {}
    for t in tasks:
        rid = t.get("requirement_id", "")
        req_to_tasks.setdefault(rid, []).append(t["task_id"])

    task_to_emp  = {t["task_id"]: t.get("assigned_to") for t in tasks}
    req_status   = {r["req_id"]: ("COVERED" if req_to_tasks.get(r["req_id"]) else "GAP") for r in requirements}
    covered      = sum(1 for s in req_status.values() if s == "COVERED")
    coverage_rate = round(covered / max(len(requirements), 1) * 100, 1)

    emp_workloads: Dict[str, int] = {}
    for t in tasks:
        eid = t.get("assigned_to")
        if eid:
            emp_workloads[eid] = emp_workloads.get(eid, 0) + t.get("story_points", 0)

    final_tsi    = compute_tsi(list(emp_workloads.values()) if emp_workloads else [0])
    risk_counts  = {"Low": 0, "Medium": 0, "High": 0}
    for t in tasks:
        lvl = t.get("risk_level", "Medium")
        if lvl in risk_counts:
            risk_counts[lvl] += 1

    skill_to_devs: Dict[str, List[str]] = {}
    for emp in employees:
        for skill in emp.get("skills", []):
            skill_to_devs.setdefault(skill, []).append(emp.get("name", emp["emp_id"]))

    skill_concentration_risks = []
    for skill, devs in skill_to_devs.items():
        if len(devs) == 1:
            skill_concentration_risks.append({"skill": skill, "only_dev": devs[0], "risk": "BUS_FACTOR", "suggestion": f"Only {devs[0]} has '{skill}' skill. Consider cross-training another team member."})

    return {
        "requirement_to_tasks":     req_to_tasks,
        "task_to_employee":         task_to_emp,
        "requirement_status":       req_status,
        "coverage_rate":            coverage_rate,
        "team_workload":            emp_workloads,
        "team_stability_index":     final_tsi,
        "tsi_status":               tsi_status(final_tsi),
        "risk_summary":             risk_counts,
        "skill_concentration_risk": skill_concentration_risks,
    }
