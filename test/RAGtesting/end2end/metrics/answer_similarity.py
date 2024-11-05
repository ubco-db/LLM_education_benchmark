from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch


class CrossEncoderSimilarityScorer:
    def __init__(self, model_name: str = 'cross-encoder/ms-marco-MiniLM-L-6-v2'):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            model_name)

    def score(self, ground_truth: str, answer: str) -> float:
        inputs = self.tokenizer(ground_truth, answer,
                                return_tensors='pt', truncation=True)
        with torch.no_grad():
            outputs = self.model(**inputs)

        logits = outputs.logits
        similarity_score = torch.sigmoid(logits).item()

        return similarity_score


cross_encoder_similarity_scorer = CrossEncoderSimilarityScorer()
