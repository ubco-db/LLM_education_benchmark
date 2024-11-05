from langchain_core.language_models import BaseLanguageModel
from langchain_core.embeddings import Embeddings
import pandas as pd
from ragas import evaluate
from langchain_community.llms import Ollama
from langchain_community.embeddings import HuggingFaceEmbeddings
from ragas.metrics import faithfulness, answer_correctness, context_relevancy, context_precision, context_recall, answer_relevancy, answer_similarity
from datasets import Dataset


def run_ragas_evaluation(data_samples, llm, embeddings):
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L12-v2")

    dataset = Dataset.from_dict(data_samples)

    metrics = [
        answer_similarity,
        answer_correctness,
        answer_relevancy
    ]

    score = evaluate(dataset, metrics=metrics, llm=llm, embeddings=embeddings)
    df = score.to_pandas()
    evaluation_results = df.to_dict(orient='records')

    return evaluation_results
