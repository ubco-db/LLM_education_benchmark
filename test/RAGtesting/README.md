# Overview of RAG tests

Testing the server /ask endpoint to come up with scores and metrics to evaluate how well the server is performing.
A note is that it is compartmentalized into different types of tests. For example, we need to measure given context how well does it answer.

Great sources for information on testing:

1. [Evaluation metrics for RAG](https://docs.ragas.io/en/stable/references/metrics.html)
2. [Chunking and embedding](https://github.com/FullStackRetrieval-com/RetrievalTutorials/blob/main/tutorials/LevelsOfTextSplitting/5_Levels_Of_Text_Splitting.ipynb)
3. [langchain evaluation](https://python.langchain.com/v0.1/docs/guides/productionization/evaluation/)

## Types of tests

### 1. Human generated test datasets

Human come up with ground truth answers for a given question and context. The server is then asked to generate answers for the same question and context. This results in a dataset of question, context, ground truth answers and server generated answers.

1. **TF-IDF tests**: TF-IDF is a traditional method to convert text to numerical vectors based on term frequency and inverse document frequency, which can then be compared using cosine similarity.
2. **LLM evaluations**: Ask LLM to evaluate the server's answers for a given question and context.

### 2. LLM evaluation tests

Ask LLM to evaluate the server's answers for a given question and context. This is separated from ground truth data.

## Different metrics of testing

We do not aim to test the raw capabilities of base models, but the ability of the server to retrieve context and genenerate answers. The metrics are as follows:

1. **Performance**: How long does it take for the server to generate an answer?

2 **Answer_Similarity**: How similar are the generated answers to the ground truth answers? TF-IDF score.

3. **answer_correctness**: How accurate are the answers.

4. **answer_relevance**: Alignment of the answer with the question's intent and its effective use of the provided context to produce a response that is both informative and on-topic.

5. **context_precision**: Examines whether the context includes all necessary details and excludes unnecessary or misleading information that could lead to incorrect answers. High precision implies that the context closely and accurately targets the information needed to answer the question correctly without superfluous data.

6. **context_relevance**: How relevant is the context provided to the question and answer.
   (sources that went back to clients)

7. **context_recall**: How well does the retrieval process omit information that relates to question.
