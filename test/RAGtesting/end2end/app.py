import pandas as pd
from flask import Flask, render_template

# Load the CSV file into a DataFrame
CSV_FILE = 'test_results.csv'

fieldnames = [
    'section', 'dataset', 'embedder', 'chunking_detail', 'timestamp', 'extra_info', 'device', 'evalmodel', 'Prompt', 'ModelName',
    'Temperature', 'TopK', 'SimilarityThresholdDocuments',
    'SimilarityThresholdQuestions', 'runId', 'category',
    'TFIDFScore', 'ResponseTime', 'answer_correctness',
    'faithfulness', 'answer_similarity', 'answer_relevancy', 'context_precision',
    'context_relevancy', 'context_recall', 'response_json'
]

df = pd.read_csv(CSV_FILE, usecols=fieldnames)

# Ensure numeric columns are indeed numeric
numeric_cols = [
    'TFIDFScore', 'ResponseTime', 'answer_similarity', 'answer_correctness'
]
df[numeric_cols] = df[numeric_cols].apply(pd.to_numeric, errors='coerce')
df = df.dropna(subset=numeric_cols)

# Clean the 'dataset' column
df['dataset'] = df['dataset'].apply(lambda x: x.split('/')[2] if '/' in x else x)

# Filter the DataFrame
df_filtered = df[(df['section'] == 'General') & (df['chunking_detail'] == 'no_RAG')]
df_filtered1 = df[(df['section'] == 'General') & (df['chunking_detail'] != 'no_RAG')]

# Group by 'dataset' and calculate mean for numeric columns
comparison_df = df_filtered.groupby(['dataset'])[numeric_cols].mean().reset_index()
comparison_df1 = df_filtered1.groupby(['dataset'])[numeric_cols].mean().reset_index()

# Identify rows with the biggest TFIDF score jumps
df_merged = pd.merge(df_filtered, df_filtered1, on=['dataset', 'section', 'runId'], suffixes=('_no_RAG', '_RAG'))
df_merged['TFIDFScore_diff'] = df_merged['TFIDFScore_RAG'] - df_merged['TFIDFScore_no_RAG']

# Filter for COSC304 and the biggest TFIDF score jumps
top_tfidf_jumps = df_merged.nlargest(3, 'TFIDFScore_diff')
cosc304_top_10 = df_merged[df_merged['dataset'] == 'COSC304'].nlargest(10, 'TFIDFScore_diff')

# Combine the results
comparison_responses = pd.concat([top_tfidf_jumps, cosc304_top_10]).drop_duplicates()

# Select relevant columns
comparison_responses = comparison_responses[['dataset', 'section', 'runId', 'TFIDFScore_no_RAG', 'TFIDFScore_RAG', 'TFIDFScore_diff', 'response_json_no_RAG', 'response_json_RAG']]

# Save to CSV
comparison_responses.to_csv('comparison_responses.csv', index=False)

# Flask app to render the results
app = Flask(__name__)

@app.route('/')
def index():
    comparison_df = pd.read_csv('comparison_responses.csv')
    return render_template('index.html', tables=[comparison_df.to_html(classes='data', header="true")])

if __name__ == '__main__':
    app.run(debug=True, port=5001)
