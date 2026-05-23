"""
main.py — FastAPI Backend
--------------------------
Endpoints:
  GET  /health              — Health check
  POST /upload              — Upload .txt or .pdf files
  POST /run                 — Run full pipeline
  GET  /demo                — Run pipeline on built-in sample data
  GET  /results             — Return last pipeline results
  GET  /metrics             — ML model training metrics
  GET  /employees           — List default employees
  POST /employees           — Add employee to session
  PUT  /tasks/{task_id}     — Update task status
  DELETE /reset             — Clear uploaded files

  PHASE 5 NEW:
  GET  /risk-report         — Full 5-type project risk report
  GET  /dependencies        — Task dependency chains
"""

import os
import json
import shutil
import traceback
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from pipeline import run_pipeline

app = FastAPI(title="Requirement Intelligence System", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Paths ─────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "..", "data", "input_docs")
MODELS_DIR = os.path.join(BASE_DIR, "..", "data", "models")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

# ── In-memory session state ───────────────────────────────────────────────
_last_result:      dict = {}
_last_employees:   list = []
_session_employees: List[dict] = []


# ── Pydantic models ───────────────────────────────────────────────────────
class Employee(BaseModel):
    emp_id:            str
    name:              str
    skills:            List[str]
    experience:        int
    current_project:   str = "P1"
    active_task_count: Optional[int] = 0


class RunRequest(BaseModel):
    employees: List[Employee]


class TaskStatusUpdate(BaseModel):
    status: str  # "TODO" | "IN_PROGRESS" | "DONE"


# ── Sample data for /demo ─────────────────────────────────────────────────
DEMO_DOCUMENTS = [
    {
        "source": "sample_srs.txt",
        "text": """
        The system shall allow users to log in using username and password.
        The system shall enable users to register a new account with email validation.
        The system shall allow users to reset their password via email.
        The system shall display a dashboard after successful login.
        The system shall allow admins to create and manage user accounts.
        The system shall send email notifications for task assignments.
        The system shall allow users to search requirements by keyword.
        The system shall generate reports in CSV and PDF formats.
        The system must respond to all user requests within 2 seconds.
        The system shall be available 99.9 percent of the time.
        The system shall encrypt all user passwords using bcrypt.
        The system shall support up to 10000 concurrent users.
        The system shall comply with GDPR data privacy regulations.
        """
    },
    {
        "source": "sample_prd.txt",
        "text": """
        The system shall allow project managers to create new projects.
        The system shall enable tracking of task completion status.
        The system shall support multi-user collaboration on projects.
        The system shall provide a task history log for each project.
        The system should allow users to log in securely.
        The system shall allow export of traceability matrix to Excel.
        The system shall use HTTPS for all communications.
        The system shall be accessible on mobile and desktop browsers.
        The system shall support drag and drop task reordering.
        """
    }
]

DEMO_EMPLOYEES = [
    {"emp_id": "E001", "name": "Arjun Kumar",  "skills": ["backend", "database"],          "experience": 4, "current_project": "P1", "active_task_count": 0},
    {"emp_id": "E002", "name": "Priya Sharma", "skills": ["frontend", "testing"],           "experience": 3, "current_project": "P1", "active_task_count": 0},
    {"emp_id": "E003", "name": "Rahul Verma",  "skills": ["backend", "security", "devops"], "experience": 6, "current_project": "P1", "active_task_count": 0},
    {"emp_id": "E004", "name": "Sneha Patel",  "skills": ["frontend", "database"],          "experience": 2, "current_project": "P1", "active_task_count": 0},
    {"emp_id": "E005", "name": "Vikram Singh", "skills": ["devops", "testing", "backend"],  "experience": 5, "current_project": "P1", "active_task_count": 0},
]


# ── PDF helper ────────────────────────────────────────────────────────────
def extract_pdf_text(filepath: str) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(filepath)
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except ImportError:
        pass
    try:
        import pdfplumber
        with pdfplumber.open(filepath) as pdf:
            return "\n".join(p.extract_text() or "" for p in pdf.pages).strip()
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF support requires pypdf: pip install pypdf")


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "message": "Requirement Intelligence System v3.0 is running"}


@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    saved = []
    for file in files:
        if not file.filename:
            continue
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in [".txt", ".pdf"]:
            continue
        dest = os.path.join(UPLOAD_DIR, file.filename)
        file.file.seek(0)
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        saved.append(file.filename)
    if not saved:
        raise HTTPException(status_code=400, detail="No valid .txt or .pdf files uploaded.")
    return {"message": f"{len(saved)} file(s) uploaded", "files": saved, "file_count": len(saved)}


@app.post("/run")
async def run_analysis(request: RunRequest):
    global _last_result, _last_employees
    if not os.path.exists(UPLOAD_DIR) or not os.listdir(UPLOAD_DIR):
        raise HTTPException(status_code=400, detail="No documents uploaded yet. Use POST /upload first.")

    documents = []
    for filename in os.listdir(UPLOAD_DIR):
        filepath = os.path.join(UPLOAD_DIR, filename)
        ext      = os.path.splitext(filename)[1].lower()
        try:
            if ext == ".txt":
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()
            elif ext == ".pdf":
                text = extract_pdf_text(filepath)
            else:
                continue
            if text.strip():
                documents.append({"text": text, "source": filename})
        except Exception:
            continue

    if not documents:
        raise HTTPException(status_code=400, detail="No readable content in uploaded files.")

    employees        = [emp.dict() for emp in request.employees]
    _last_employees  = employees
    result           = run_pipeline(documents, employees)
    _last_result     = result

    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message", "Pipeline error"))
    return result


@app.get("/demo")
def run_demo():
    global _last_result, _last_employees
    _last_employees = DEMO_EMPLOYEES
    result          = run_pipeline(DEMO_DOCUMENTS, DEMO_EMPLOYEES)
    _last_result    = result
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message", "Demo pipeline error"))
    return result


@app.get("/results")
def get_results():
    if not _last_result:
        raise HTTPException(status_code=404, detail="No results yet. Run /demo or /run first.")
    return _last_result


@app.get("/employees")
def get_employees():
    return DEMO_EMPLOYEES


@app.post("/employees")
def add_employee(emp: Employee):
    _session_employees.append(emp.dict())
    return {"message": "Employee added", "employee": emp.dict()}


@app.put("/tasks/{task_id}")
def update_task_status(task_id: str, update: TaskStatusUpdate):
    valid_statuses = {"TODO", "IN_PROGRESS", "DONE"}
    if update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")
    if not _last_result or "tasks" not in _last_result:
        raise HTTPException(status_code=404, detail="No tasks available. Run pipeline first.")
    for task in _last_result["tasks"]:
        if task.get("task_id") == task_id:
            task["status"] = update.status
            return {"message": "Status updated", "task_id": task_id, "status": update.status}
    raise HTTPException(status_code=404, detail=f"Task {task_id} not found.")


@app.get("/metrics")
def get_metrics():
    metrics = {}
    for name in ["classifier_metrics", "priority_metrics", "effort_metrics"]:
        path = os.path.join(MODELS_DIR, f"{name}.json")
        try:
            if os.path.exists(path):
                with open(path) as f:
                    metrics[name] = json.load(f)
            else:
                metrics[name] = None
        except Exception:
            metrics[name] = None
    return metrics


# ── PHASE 5: /risk-report endpoint ───────────────────────────────────────

@app.get("/risk-report")
def get_risk_report():
    """
    Returns the full 5-type project risk report + dependency chains.
    Requires /demo or /run to have been called first.
    """
    if not _last_result or "tasks" not in _last_result:
        raise HTTPException(status_code=404, detail="No results yet. Run /demo or /run first.")

    try:
        from step6_tasks import detect_dependencies, generate_risk_report

        tasks        = _last_result.get("tasks", [])
        traceability = _last_result.get("traceability", {})
        employees    = _last_employees or DEMO_EMPLOYEES

        # Detect dependency chains
        dependencies = detect_dependencies(tasks)

        # Generate full risk report
        risk_report = generate_risk_report(
            tasks        = tasks,
            employees    = employees,
            dependencies = dependencies,
            traceability = traceability,
        )

        return {
            "status":       "success",
            "risk_report":  risk_report,
            "dependencies": dependencies,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk report error: {str(e)}\n{traceback.format_exc()}")


# ── PHASE 5: /dependencies endpoint ──────────────────────────────────────

@app.get("/dependencies")
def get_dependencies():
    """
    Returns task dependency chains detected from requirement text analysis.
    """
    if not _last_result or "tasks" not in _last_result:
        raise HTTPException(status_code=404, detail="No results yet. Run /demo or /run first.")

    try:
        from step6_tasks import detect_dependencies
        tasks        = _last_result.get("tasks", [])
        dependencies = detect_dependencies(tasks)
        return {
            "status":       "success",
            "count":        len(dependencies),
            "dependencies": dependencies,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dependency detection error: {str(e)}")


@app.delete("/reset")
def reset():
    global _last_result, _session_employees, _last_employees
    if os.path.exists(UPLOAD_DIR):
        shutil.rmtree(UPLOAD_DIR)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    _last_result       = {}
    _session_employees = []
    _last_employees    = []
    return {"message": "Reset successful"}
