ANSWER_RELEVANCE_INSTRUCTIONS = """\
You will be given a question, a ground truth, and an answer. Your task is to evaluate the relevance of the answer based on the question's intent and its alignment with the ground truth. Consider the following factors:

- **Answer Relevance**: How well does the answer address the question's intent?
- **Informative Content**: Does the answer provide informative and useful content based on the ground truth?
- **Non-committal Responses**: If the answer is non-committal (e.g., "I don't know") while the ground truth is committal, it should receive 1 point.
- **Conciseness**: Is the answer concise and to the point?

Format your response with a score out of 10 for answer relevance and an explanation for the score. Use the following format:
- Score: X/10 - Explanation
"""

ANSWER_RELEVANCE_EXAMPLES = [
    {
        "question": """What is the boiling point of water?""",
        "answer": """The boiling point of water is 100 degrees Celsius at sea level.""",
        "ground_truth": """The boiling point of water is 100 degrees Celsius (212 degrees Fahrenheit) at sea level. The boiling point of water can change with altitude.""",
        "evaluation": {
            "score": 8,
            "explanation": "The answer is correct and relevant, but it could be more informative by including the detail that the boiling point can change with altitude."
        }
    },
    {
        "question": """What is the capital of France?""",
        "answer": """I don't know.""",
        "ground_truth": """The capital of France is Paris.""",
        "evaluation": {
            "score": 1,
            "explanation": "The answer is non-committal and does not provide the information that the capital of France is Paris."
        }
    }
]


def AnswerRelevancyScore(question: str, answer: str, ground_truth: str, llm) -> float:
    prompt = f"{ANSWER_RELEVANCE_INSTRUCTIONS}\n\nQuestion: {question}\nAnswer: {answer}\nGround Truth: {ground_truth}\n\nEvaluation:"

    for example in ANSWER_RELEVANCE_EXAMPLES:
        prompt += f"\n\nExample:\nQuestion: {example['question']}\nAnswer: {example['answer']}\nGround Truth: {example['ground_truth']}\nEvaluation: Score: {example['evaluation']['score']}/10 - {example['evaluation']['explanation']}"

    response = llm.invoke(prompt)
    evaluation = response.strip()

    # Extract the score from the evaluation
    score_line = next(line for line in evaluation.splitlines()
                      if line.startswith("Score:"))
    score = float(score_line.split("/")[0].split(":")[1].strip())

    return score
