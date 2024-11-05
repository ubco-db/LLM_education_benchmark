from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np


def TFIDF(answer: str, expected_answer: str) -> float:
    vectorizer = TfidfVectorizer().fit_transform([answer, expected_answer])
    vectors = vectorizer.toarray()
    cosine_sim = (vectors[0] @ vectors[1]) / \
        (np.linalg.norm(vectors[0]) * np.linalg.norm(vectors[1]))
    return cosine_sim
