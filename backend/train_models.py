"""
train_models.py — Train & Save All ML Models
----------------------------------------------
Run this ONCE before starting the backend.

Trains:
  1. SVM Classifier       → functional vs non_functional
  2. Random Forest        → priority (high / medium / low)
  3. Random Forest Reg    → effort (1,2,3,5,8,13 story points)
  4. TF-IDF Vectorizer    → for similarity/mismatch detection

FIX: Also saves *_metrics.json files so /metrics endpoint works.
FIX: Searches for training data in multiple locations.
FIX: Handles missing training data gracefully.
"""

import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Search for training data in multiple locations
_DATA_SEARCH = [
    os.path.join(BASE_DIR, "..", "data", "training"),
    os.path.join(BASE_DIR, "data", "training"),
    os.path.join(BASE_DIR, "..", "training"),
    BASE_DIR,
]

_MODELS_SEARCH = [
    os.path.join(BASE_DIR, "..", "data", "models"),
    os.path.join(BASE_DIR, "models"),
]

def _find_data_dir():
    for p in _DATA_SEARCH:
        if os.path.isdir(p):
            # Check if it has at least one json file
            if any(f.endswith(".json") for f in os.listdir(p)):
                return p
    # Fallback: use same directory as this script
    return BASE_DIR

def _find_or_create_models_dir():
    for p in _MODELS_SEARCH:
        if os.path.isdir(p):
            return p
    # Create first option
    os.makedirs(_MODELS_SEARCH[0], exist_ok=True)
    return _MODELS_SEARCH[0]

DATA_DIR   = _find_data_dir()
MODELS_DIR = _find_or_create_models_dir()

print(f"Data dir:   {DATA_DIR}")
print(f"Models dir: {MODELS_DIR}")


def load_json(filename: str) -> list:
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Training file not found: {path}\nMake sure {filename} is in {DATA_DIR}")
    with open(path) as f:
        return json.load(f)


def save_metrics(name: str, data: dict):
    path = os.path.join(MODELS_DIR, f"{name}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  ✓ Metrics saved: {path}")


# ══════════════════════════════════════════════════════════
# MODEL 1 — SVM Classifier
# ══════════════════════════════════════════════════════════
def train_classifier():
    print("\n─── Training Model 1: Requirement Classifier (SVM) ───")
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.svm import SVC
    from sklearn.model_selection import cross_val_score
    from sklearn.metrics import classification_report
    from sklearn.pipeline import Pipeline
    import joblib

    data   = load_json("classification_data.json")
    texts  = [d["text"] for d in data]
    labels = [d["label"] for d in data]

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1,2), max_features=5000, sublinear_tf=True)),
        ("clf",   SVC(kernel="linear", C=1.0, probability=True))
    ])

    scores = cross_val_score(pipeline, texts, labels, cv=5, scoring="f1_macro")
    print(f"  Cross-validated F1: {scores.mean():.3f} ± {scores.std():.3f}")

    pipeline.fit(texts, labels)
    path = os.path.join(MODELS_DIR, "classifier.pkl")
    joblib.dump(pipeline, path)
    print(f"  ✓ Saved: {path}")

    preds = pipeline.predict(texts)
    report = classification_report(labels, preds, output_dict=True)
    print(f"\n  Classification Report:\n{classification_report(labels, preds)}")

    save_metrics("classifier_metrics", {
        "cv_f1_mean": round(float(scores.mean()), 4),
        "cv_f1_std":  round(float(scores.std()), 4),
        "report":     report,
        "n_samples":  len(data)
    })


# ══════════════════════════════════════════════════════════
# MODEL 2 — Random Forest Priority Predictor
# ══════════════════════════════════════════════════════════
def train_priority_predictor():
    print("\n─── Training Model 2: Priority Predictor (Random Forest) ───")
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import cross_val_score
    from sklearn.metrics import classification_report
    from sklearn.pipeline import Pipeline
    import joblib

    data   = load_json("priority_data.json")
    labels = [d["label"] for d in data]
    texts  = [f"{d['type']} {d['text']}" for d in data]

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1,2), max_features=3000, sublinear_tf=True)),
        ("clf",   RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced"))
    ])

    scores = cross_val_score(pipeline, texts, labels, cv=5, scoring="f1_macro")
    print(f"  Cross-validated F1: {scores.mean():.3f} ± {scores.std():.3f}")

    pipeline.fit(texts, labels)
    path = os.path.join(MODELS_DIR, "priority_predictor.pkl")
    joblib.dump(pipeline, path)
    print(f"  ✓ Saved: {path}")

    preds = pipeline.predict(texts)
    report = classification_report(labels, preds, output_dict=True)
    print(f"\n  Classification Report:\n{classification_report(labels, preds)}")

    save_metrics("priority_metrics", {
        "cv_f1_mean": round(float(scores.mean()), 4),
        "cv_f1_std":  round(float(scores.std()), 4),
        "report":     report,
        "n_samples":  len(data)
    })


# ══════════════════════════════════════════════════════════
# MODEL 3 — Random Forest Effort Regressor
# ══════════════════════════════════════════════════════════
def train_effort_estimator():
    print("\n─── Training Model 3: Effort Estimator (Random Forest Regressor) ───")
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.model_selection import cross_val_score
    from sklearn.metrics import mean_absolute_error
    from sklearn.pipeline import Pipeline
    import joblib

    data    = load_json("effort_data.json")
    efforts = [d["effort"] for d in data]
    texts   = [f"{d['type']} priority_{d['priority']} {d['text']}" for d in data]

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1,2), max_features=3000, sublinear_tf=True)),
        ("reg",   RandomForestRegressor(n_estimators=100, random_state=42))
    ])

    scores = cross_val_score(pipeline, texts, efforts, cv=5, scoring="neg_mean_absolute_error")
    print(f"  Cross-validated MAE: {-scores.mean():.2f} story points")

    pipeline.fit(texts, efforts)
    path = os.path.join(MODELS_DIR, "effort_estimator.pkl")
    joblib.dump(pipeline, path)
    print(f"  ✓ Saved: {path}")

    preds = pipeline.predict(texts)
    mae   = mean_absolute_error(efforts, preds)
    print(f"  Training MAE: {mae:.2f} story points")

    save_metrics("effort_metrics", {
        "cv_mae_mean": round(float(-scores.mean()), 4),
        "cv_mae_std":  round(float(scores.std()), 4),
        "train_mae":   round(float(mae), 4),
        "n_samples":   len(data)
    })


# ══════════════════════════════════════════════════════════
# VECTORIZER — for similarity detection (step3)
# ══════════════════════════════════════════════════════════
def train_similarity_vectorizer():
    print("\n─── Training Similarity TF-IDF Vectorizer ───")
    from sklearn.feature_extraction.text import TfidfVectorizer
    import joblib

    all_data = (
        load_json("classification_data.json") +
        load_json("priority_data.json") +
        load_json("effort_data.json")
    )
    texts = [d["text"] for d in all_data]

    vec = TfidfVectorizer(ngram_range=(1,2), max_features=8000, sublinear_tf=True)
    vec.fit(texts)
    path = os.path.join(MODELS_DIR, "similarity_vectorizer.pkl")
    joblib.dump(vec, path)
    print(f"  Vocabulary size: {len(vec.vocabulary_)} terms")
    print(f"  ✓ Saved: {path}")


# ── Main ──────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  REQUIREMENT INTELLIGENCE SYSTEM — MODEL TRAINING")
    print("=" * 60)

    try:
        train_classifier()
        train_priority_predictor()
        train_effort_estimator()
        train_similarity_vectorizer()

        print("\n" + "=" * 60)
        print("  ALL MODELS TRAINED SUCCESSFULLY")
        print(f"  Models saved to: {MODELS_DIR}")
        print("  You can now run: uvicorn main:app --reload --port 8000")
        print("=" * 60)
    except FileNotFoundError as e:
        print(f"\n❌ ERROR: {e}")
        print("Make sure your training JSON files exist in data/training/")
        sys.exit(1)
    except Exception as e:
        import traceback
        print(f"\n❌ Unexpected error: {e}")
        traceback.print_exc()
        sys.exit(1)
