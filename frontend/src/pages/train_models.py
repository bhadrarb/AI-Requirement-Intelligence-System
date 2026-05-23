"""
TRAIN ALL ML MODELS
====================
This script trains 3 separate ML models:
  1. Requirement Classifier   → SVM that labels requirements as functional/non_functional
  2. Priority Predictor       → Random Forest that predicts High/Medium/Low priority
  3. Effort Estimator         → Random Forest Regressor that predicts story points (1-13)

Run this ONCE before starting the backend server.
All models are saved as .pkl files in backend/models/
"""

import json
import os
import joblib
import numpy as np

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_DIR    = os.path.join(BASE_DIR, "..", "data", "training")
MODELS_DIR  = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ─── Helper: load JSON ────────────────────────────────────────────────────────
def load(filename):
    with open(os.path.join(DATA_DIR, filename), "r") as f:
        return json.load(f)


# ══════════════════════════════════════════════════════════════════════════════
# MODEL 1 — REQUIREMENT CLASSIFIER (SVM)
# What it does: reads a requirement sentence → predicts functional or non_functional
# Why SVM: works very well on text classification with small datasets
# ══════════════════════════════════════════════════════════════════════════════
def train_classifier():
    print("\n─── Training Model 1: Requirement Classifier (SVM) ───")

    data   = load("classification_data.json")
    texts  = [d["text"] for d in data]
    labels = [d["label"] for d in data]

    # TfidfVectorizer converts text into numbers
    # ngram_range=(1,2) means we use single words AND pairs of words as features
    # This helps capture phrases like "response time" or "log in"
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=5000,
            sublinear_tf=True          # dampens very frequent words
        )),
        ("clf", SVC(
            kernel="linear",           # linear kernel works best for text
            C=1.0,
            probability=True           # enables predict_proba() for confidence %
        ))
    ])

    # Cross-validation: train on 5 different splits and average accuracy
    # This gives a realistic accuracy number (not inflated by lucky split)
    scores = cross_val_score(pipeline, texts, labels, cv=5, scoring="f1_macro")
    print(f"  Cross-validated F1 Score: {scores.mean():.3f} ± {scores.std():.3f}")

    # Train on full data and save
    pipeline.fit(texts, labels)
    joblib.dump(pipeline, os.path.join(MODELS_DIR, "classifier.pkl"))

    # Show full report on training data
    preds = pipeline.predict(texts)
    print("\n  Classification Report (on training data):")
    print(classification_report(labels, preds))
    print("  ✓ Saved: backend/models/classifier.pkl")


# ══════════════════════════════════════════════════════════════════════════════
# MODEL 2 — PRIORITY PREDICTOR (Random Forest)
# What it does: reads requirement text + type → predicts High/Medium/Low priority
# Why Random Forest: handles mixed features (text + categorical) well
# ══════════════════════════════════════════════════════════════════════════════
def train_priority_predictor():
    print("\n─── Training Model 2: Priority Predictor (Random Forest) ───")

    data   = load("priority_data.json")
    labels = [d["label"] for d in data]

    # Feature engineering: combine text with requirement type
    # This teaches the model that "non_functional + security words = high priority"
    combined_texts = [
        f"{d['type']} {d['text']}" for d in data
    ]

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=3000,
            sublinear_tf=True
        )),
        ("clf", RandomForestClassifier(
            n_estimators=100,          # 100 decision trees voted together
            random_state=42,
            class_weight="balanced"    # handles if one priority has fewer examples
        ))
    ])

    scores = cross_val_score(pipeline, combined_texts, labels, cv=5, scoring="f1_macro")
    print(f"  Cross-validated F1 Score: {scores.mean():.3f} ± {scores.std():.3f}")

    pipeline.fit(combined_texts, labels)
    joblib.dump(pipeline, os.path.join(MODELS_DIR, "priority_predictor.pkl"))

    preds = pipeline.predict(combined_texts)
    print("\n  Classification Report:")
    print(classification_report(labels, preds))
    print("  ✓ Saved: backend/models/priority_predictor.pkl")


# ══════════════════════════════════════════════════════════════════════════════
# MODEL 3 — EFFORT ESTIMATOR (Random Forest Regressor)
# What it does: reads requirement → predicts story points (1, 2, 3, 5, 8, 13)
# Why Regression: effort is a number, not a category
# Story points follow Fibonacci: 1, 2, 3, 5, 8, 13 (standard agile)
# ══════════════════════════════════════════════════════════════════════════════
def train_effort_estimator():
    print("\n─── Training Model 3: Effort Estimator (Random Forest Regressor) ───")

    data    = load("effort_data.json")
    efforts = [d["effort"] for d in data]

    # Priority map: convert text priority to number so model understands ordering
    priority_map = {"high": 3, "medium": 2, "low": 1}
    type_map     = {"functional": 1, "non_functional": 0}

    # Combine text + numeric features
    combined_texts = [
        f"{d['type']} priority_{d['priority']} {d['text']}" for d in data
    ]

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=3000,
            sublinear_tf=True
        )),
        ("reg", RandomForestRegressor(
            n_estimators=100,
            random_state=42
        ))
    ])

    # For regression we use MAE (Mean Absolute Error) — lower = better
    scores = cross_val_score(pipeline, combined_texts, efforts,
                             cv=5, scoring="neg_mean_absolute_error")
    print(f"  Cross-validated MAE: {-scores.mean():.2f} story points")

    pipeline.fit(combined_texts, efforts)
    joblib.dump(pipeline, os.path.join(MODELS_DIR, "effort_estimator.pkl"))

    preds = pipeline.predict(combined_texts)
    mae   = mean_absolute_error(efforts, preds)
    print(f"  Training MAE: {mae:.2f} story points")
    print("  ✓ Saved: backend/models/effort_estimator.pkl")


# ══════════════════════════════════════════════════════════════════════════════
# ALSO SAVE: TF-IDF vectorizer trained on all requirement text combined
# Used by mismatch/similarity detection in step3
# ══════════════════════════════════════════════════════════════════════════════
def train_similarity_vectorizer():
    print("\n─── Training Similarity TF-IDF Vectorizer ───")

    # Combine all text from all training sets
    all_data = (
        load("classification_data.json") +
        load("priority_data.json") +
        load("effort_data.json")
    )
    all_texts = [d["text"] for d in all_data]

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=8000,
        sublinear_tf=True
    )
    vectorizer.fit(all_texts)
    joblib.dump(vectorizer, os.path.join(MODELS_DIR, "similarity_vectorizer.pkl"))
    print(f"  Vocabulary size: {len(vectorizer.vocabulary_)} terms")
    print("  ✓ Saved: backend/models/similarity_vectorizer.pkl")


# ─── Run all ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  REQUIREMENT INTELLIGENCE SYSTEM — MODEL TRAINING")
    print("=" * 60)

    train_classifier()
    train_priority_predictor()
    train_effort_estimator()
    train_similarity_vectorizer()

    print("\n" + "=" * 60)
    print("  ALL MODELS TRAINED AND SAVED SUCCESSFULLY")
    print("  You can now run: uvicorn main:app --reload")
    print("=" * 60)
