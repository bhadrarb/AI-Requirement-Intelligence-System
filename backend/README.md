# Requirement Intelligence System v2.0

An AI-powered system that transforms software requirement documents into
classified, prioritized, effort-estimated Jira-style tasks — with conflict
detection and smart employee assignment.

---

## Project Structure

```
project/
├── backend/
│   ├── main.py                  ← FastAPI server (run this)
│   ├── train_models.py          ← Train all 3 ML models (run ONCE first)
│   ├── pipeline.py              ← Orchestrates all 6 steps
│   ├── step1_extraction.py      ← TF-IDF scored requirement extraction
│   ├── step2_classification.py  ← SVM: Functional vs Non-Functional
│   ├── step3_mismatch.py        ← Cosine similarity conflict detection
│   ├── step4_priority.py        ← Random Forest priority prediction
│   ├── step5_effort.py          ← Random Forest effort estimation
│   ├── step6_tasks.py           ← Task generation + smart assignment
│   └── requirements.txt
├── data/
│   ├── training/                ← Training data for all 3 ML models
│   └── input_docs/              ← Uploaded documents go here
└── frontend/
    ├── src/
    │   ├── App.jsx              ← Complete React UI (all pages)
    │   └── main.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Setup & Run

### Step 1 — Install Python dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Step 2 — Download NLTK data
```bash
python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab')"
```

### Step 3 — Train all ML models (REQUIRED, run once)
```bash
cd backend
python train_models.py
```
This trains 3 models and saves them to backend/models/:
- classifier.pkl          (SVM for Functional/Non-Functional)
- priority_predictor.pkl  (Random Forest for High/Medium/Low)
- effort_estimator.pkl    (Random Forest Regressor for story points)
- similarity_vectorizer.pkl (TF-IDF for conflict detection)

### Step 4 — Start the backend server
```bash
cd backend
uvicorn main:app --reload --port 8000
```
Backend runs at: http://localhost:8000
API docs at:     http://localhost:8000/docs

### Step 5 — Start the frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: http://localhost:3000

---

## How to Demo (Faculty Presentation)

1. Open http://localhost:3000
2. Click **"Run Demo"** button — no file upload needed
3. System runs full pipeline on sample SRS + PRD documents
4. Navigate through pages:
   - **Dashboard** — statistics overview
   - **Requirements** — extracted and classified requirements
   - **Conflicts** — detected duplicates and ambiguities
   - **Task Board** — Kanban board, click to move tasks
   - **Team** — employee workload visualization
   - **Traceability** — requirement → task → employee mapping

---

## ML Models Explained (For Viva)

### Model 1: SVM Classifier (Step 2)
- **Algorithm**: Support Vector Machine with linear kernel
- **Input**: Requirement text (TF-IDF vectorized, bigrams)
- **Output**: "functional" or "non_functional" + confidence %
- **Training data**: 50 labeled requirements
- **Evaluation**: 5-fold cross-validation, F1 score reported

### Model 2: Random Forest Priority Predictor (Step 4)
- **Algorithm**: Random Forest with 100 trees
- **Input**: Requirement type prefix + text (TF-IDF)
- **Output**: "high", "medium", or "low" priority + confidence %
- **Training data**: 30 labeled priority examples
- **Evaluation**: 5-fold cross-validation, F1 score reported

### Model 3: Random Forest Effort Estimator (Step 5)
- **Algorithm**: Random Forest Regressor
- **Input**: Type + priority prefix + text (TF-IDF)
- **Output**: Story points (1, 2, 3, 5, 8, or 13) — Fibonacci scale
- **Evaluation**: Mean Absolute Error (MAE) reported

### Mismatch Detection (Step 3)
- **Algorithm**: Cosine similarity on TF-IDF vectors
- **Duplicate threshold**: 0.90 similarity
- **Conflict threshold**: 0.75 similarity
- **Also detects**: ambiguous language (vague words like "fast", "secure")

### Task Assignment (Step 6)
- **Algorithm**: Weighted scoring formula
  - Skill match score × 0.5
  - Experience score × 0.3
  - Workload score × 0.2
- Tasks sorted by priority before assignment (high priority gets best employees)

---

## API Endpoints

| Method | Endpoint         | Description                              |
|--------|-----------------|------------------------------------------|
| GET    | /health          | Health check                             |
| POST   | /upload          | Upload .txt requirement documents        |
| POST   | /run             | Run full pipeline on uploaded docs       |
| GET    | /demo            | Run pipeline with built-in sample data   |
| GET    | /results         | Get last pipeline results                |
| GET    | /employees       | List all employees                       |
| POST   | /employees       | Add new employee                         |
| PUT    | /tasks/{task_id} | Update task status (TODO/IN_PROGRESS/DONE)|
