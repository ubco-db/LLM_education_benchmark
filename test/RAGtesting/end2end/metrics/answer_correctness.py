from typing import Dict, Any

CORRECTNESS_INSTRUCTIONS = """\
You will be given two texts: a ground truth and an answer. Your task is to classify the statements in the answer into one of the following categories based on the ground truth:

- TP (true positive): A statement present in the answer that is directly supported by one or more statements in the ground truth.
- FP (false positive): A statement present in the answer but not directly supported by any statement in the ground truth.
- FN (false negative): A statement present in the ground truth but missing from the answer.

Each statement can only belong to one of the categories. For each classification, provide a reason explaining why the statement was classified as such.

Format your response as follows:
- TP: "statement" - Reason
- FP: "statement" - Reason
- FN: "statement" - Reason
"""

EXAMPLES = [
    {
        "question": """What powers the sun and what is its primary function?""",
        "answer": [
            "The sun is powered by nuclear fission, similar to nuclear reactors on Earth.",
            "The primary function of the sun is to provide light to the solar system.",
        ],
        "ground_truth": [
            "The sun is powered by nuclear fusion, where hydrogen atoms fuse to form helium.",
            "This fusion process in the sun's core releases a tremendous amount of energy.",
            "The energy from the sun provides heat and light, which are essential for life on Earth.",
            "The sun's light plays a critical role in Earth's climate system.",
            "Sunlight helps to drive the weather and ocean currents.",
        ],
        "classification": {
            "TP": [
                {
                    "statement": "The primary function of the sun is to provide light to the solar system.",
                    "reason": "This statement is somewhat supported by the ground truth mentioning the sun providing light and its roles, though it focuses more broadly on the sun's energy.",
                }
            ],
            "FP": [
                {
                    "statement": "The sun is powered by nuclear fission, similar to nuclear reactors on Earth.",
                    "reason": "This statement is incorrect and contradicts the ground truth which states that the sun is powered by nuclear fusion.",
                }
            ],
            "FN": [
                {
                    "statement": "The sun is powered by nuclear fusion, where hydrogen atoms fuse to form helium.",
                    "reason": "This accurate description of the sun’s power source is not included in the answer.",
                },
                {
                    "statement": "This fusion process in the sun's core releases a tremendous amount of energy.",
                    "reason": "This process and its significance are not mentioned in the answer.",
                },
                {
                    "statement": "The energy from the sun provides heat and light, which are essential for life on Earth.",
                    "reason": "The answer only mentions light, omitting the essential aspects of heat and its necessity for life, which the ground truth covers.",
                },
                {
                    "statement": "The sun's light plays a critical role in Earth's climate system.",
                    "reason": "This broader impact of the sun’s light on Earth's climate system is not addressed in the answer.",
                },
                {
                    "statement": "Sunlight helps to drive the weather and ocean currents.",
                    "reason": "The effect of sunlight on weather patterns and ocean currents is omitted in the answer.",
                },
            ],
        },
    },
    {
        "question": """What is the boiling point of water?""",
        "answer": [
            "The boiling point of water is 100 degrees Celsius at sea level"
        ],
        "ground_truth": [
            "The boiling point of water is 100 degrees Celsius (212 degrees Fahrenheit) at sea level.",
            "The boiling point of water can change with altitude.",
        ],
        "classification": {
            "TP": [
                {
                    "statement": "The boiling point of water is 100 degrees Celsius at sea level",
                    "reason": "This statement is directly supported by the ground truth which specifies the boiling point of water as 100 degrees Celsius at sea level.",
                }
            ],
            "FP": [],
            "FN": [
                {
                    "statement": "The boiling point of water can change with altitude.",
                    "reason": "This additional information about how the boiling point of water can vary with altitude is not mentioned in the answer.",
                }
            ],
        },
    },
]


def classify_statements(question: str, ground_truth: str, answer: str, llm) -> Dict[str, Any]:
    prompt = f"{CORRECTNESS_INSTRUCTIONS}\n\nQuestion: {
        question}\nAnswer: {answer}\nGround Truth: {ground_truth}\n\nEvaluation:"

    for example in EXAMPLES:
        prompt += f"\n\nExample:\nQuestion: {example['question']}\nAnswer: {example['answer']}\nGround Truth: {
            example['ground_truth']}\nClassification: {example['classification']}"

    response = llm.invoke(prompt)
    classifications = response.strip()

    # Parse the classifications
    def parse_classifications(classification_str, label):
        classifications_list = []
        lines = classification_str.splitlines()
        capture = False
        for line in lines:
            if line.startswith(label):
                capture = True
                statement = line[len(label)+1:].strip()
                classifications_list.append(statement)
            elif capture and line.startswith("-"):
                reason = line[1:].strip()
                classifications_list[-1] = {
                    "statement": classifications_list[-1], "reason": reason}
                capture = False
        return classifications_list

    tp = parse_classifications(classifications, 'TP:')
    fp = parse_classifications(classifications, 'FP:')
    fn = parse_classifications(classifications, 'FN:')

    # Compute the statement presence score
    tp_count = len(tp)
    fp_count = len(fp)
    fn_count = len(fn)
    statement_presence_score = tp_count / \
        (tp_count + 0.5 * (fp_count + fn_count)) if tp_count > 0 else 0

    return {
        "score": statement_presence_score,
        "explanation": classifications
    }
