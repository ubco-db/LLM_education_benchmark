"""
Aims to test the similarity between similar questions
1. retrieve test cases from datasets_similar
2. send to our RAG pipeline
3. evaluate and put the results in a csv file
4. make sure results include similarityLevel from original test cases"""

import os
import json
import requests
import time
import csv
from typing import List, Dict
from dotenv import load_dotenv
from metrics import ragas_metrics
from metrics.tfidf import TFIDF
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.llms import Ollama

# Load environment variables
load_dotenv()

# Retrieve environment variables
EMBEDDER = os.getenv('EMBEDDER')
CHUNKING = os.getenv('CHUNKING')
PROMPT = os.getenv('PROMPT')
MODEL_NAME = os.getenv('MODEL_NAME')
TEMPERATURE = float(os.getenv('TEMPERATURE'))
TOPK = int(os.getenv('TOPK'))
SIMILARITY_THRESHOLD_DOCUMENTS = float(os.getenv('SIMILARITY_THRESHOLD_DOCUMENTS'))
SIMILARITY_THRESHOLD_QUESTIONS = float(os.getenv('SIMILARITY_THRESHOLD_QUESTIONS'))
DEVICE = os.getenv('DEVICE')
EVALMODEL = os.getenv('EVALMODEL')

# Define CSV file path and headers
CSV_FILE = 'test_results.csv'
headers = {'HMS_API_TOKEN': 'test_token'}

fieldnames = [
    'section', 'dataset', 'embedder', 'chunking_detail', 'timestamp', 'extra_info', 'device', 'evalmodel', 'Prompt', 'ModelName',
    'Temperature', 'TopK', 'SimilarityThresholdDocuments',
    'SimilarityThresholdQuestions', 'runId', 'category',
    'TFIDFScore', 'ResponseTime', 'answer_correctness',
    'faithfulness', 'answer_similarity', 'answer_relevancy', 'context_precision',
    'context_relevancy', 'context_recall', 'response_json', 'similarityLevel'
]

# Initialize the CSV file with headers if it doesn't exist
if not os.path.isfile(CSV_FILE) or os.path.getsize(CSV_FILE) == 0:
    with open(CSV_FILE, 'a', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

def read_json_files(base_dir):
    data = []
    for root, _, files in os.walk(base_dir):
        for file in files:
            if file.endswith('data.json'):
                file_path = os.path.join(root, file)
                with open(file_path, 'r') as f:
                    json_data = json.load(f)
                    data.append(json_data)
    return data

def update_chatbot_settings(course_id):
    response = requests.patch(f'http://localhost:3004/chat/{course_id}/updateChatbotSetting', json={
        'prompt': PROMPT,
        'modelName': MODEL_NAME,
        'temperature': TEMPERATURE,
        'topK': TOPK,
        'similarityThresholdDocuments': SIMILARITY_THRESHOLD_DOCUMENTS,
        'similarityThresholdQuestions': SIMILARITY_THRESHOLD_QUESTIONS,
    }, headers=headers)
    print(f"Settings Response for {course_id}: {response.json()}")

def run_test_case(question: str, expected_answer: str, history: List[Dict], category: str, course_name: str, similarity_level: str) -> Dict[str, any]:
    try:
        start = time.time()
        response = requests.post(f'http://localhost:3004/chat/{course_name}/ask', json={
            'question': question,
            'history': history,
        }, headers=headers)
        end = time.time()

        response_json = response.json()
        print(f"Chatbot Response: {response_json}")

        chatbot_answer = response_json['answer']
        contexts = [doc['content'] for doc in response_json['sourceDocuments']]
        tfidf_score = TFIDF(chatbot_answer, expected_answer)

        data_sample = {
            'question': [question],
            'answer': [chatbot_answer],
            'contexts': [contexts],
            'ground_truth': [expected_answer]
        }

        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L12-v2")
        llm = Ollama(model=EVALMODEL, base_url="http://localhost:11434")

        evaluation_results = ragas_metrics.run_ragas_evaluation(
            data_sample, llm, embeddings)
        evaluation_metrics = evaluation_results[0]

        return {
            'tfidfScore': tfidf_score,
            'responseTime': (end - start) * 1000,
            'response_json': response_json,
            'contexts': contexts,
            'course': course_name,
            'category': [category],
            'expected_answer': expected_answer,
            'evaluation_metrics': evaluation_metrics,
            'similarityLevel': similarity_level
        }
    except Exception as e:
        print(f"Error in run_test_case: {e}")
        return {}

def run_section(test_cases: List[Dict], section: str, course: str) -> List[Dict]:
    results = []
    for test_case in test_cases:
        for similar_question in test_case['similarQuestions']:
            result = run_test_case(similar_question['question'], similar_question['expectedAnswer'],test_case['history'], test_case['category'], course, similar_question['similarityLevel'])
            if result:
                result['section'] = section
                results.append(result)
    return results

def run_all_tests(test_data: Dict[str, List[Dict]], course: str, run_id: int) -> List[Dict]:
    print(f'Running tests for course {course}')
    course_results = []
    for section, test_cases in test_data.items():
        results = run_section(test_cases, section, course)
        course_results.extend(results)
    return course_results

if __name__ == "__main__":
    try:
        base_directory_path = '../sample_datasets'
        run_id = int(time.time())

        all_results = []

        for course_name in os.listdir(base_directory_path):
            course_path = os.path.join(base_directory_path, course_name)
            if os.path.isdir(course_path):
                data_file_path = os.path.join(course_path, 'data.json')
                if os.path.isfile(data_file_path):
                    update_chatbot_settings(course_name)
                    with open(data_file_path, 'r') as f:
                        test_data = json.load(f)
                    results = run_all_tests(test_data, course_name, run_id)
                    all_results.extend(results)
                else:
                    print(f"Data file for {course_name} not found at {data_file_path}")

        for result in all_results:
            with open(CSV_FILE, 'a', newline='') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writerow({
                    'section': result['section'],
                    'dataset': f'../datasets/{result.get("course")}/data.json',
                    'embedder': EMBEDDER,
                    'chunking_detail': CHUNKING,
                    'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'device': DEVICE,
                    'evalmodel': EVALMODEL,
                    'Prompt': PROMPT,
                    'ModelName': MODEL_NAME,
                    'Temperature': TEMPERATURE,
                    'TopK': TOPK,
                    'SimilarityThresholdDocuments': SIMILARITY_THRESHOLD_DOCUMENTS,
                    'SimilarityThresholdQuestions': SIMILARITY_THRESHOLD_QUESTIONS,
                    'runId': run_id,
                    'category': result.get('category', ''),
                    'TFIDFScore': result.get('tfidfScore', ''),
                    'ResponseTime': result.get('responseTime', ''),
                    'answer_correctness': result['evaluation_metrics'].get('answer_correctness', ''),
                    'faithfulness': result['evaluation_metrics'].get('faithfulness', ''),
                    'answer_similarity': result['evaluation_metrics'].get('answer_similarity', ''),
                    'answer_relevancy': result['evaluation_metrics'].get('answer_relevancy', ''),
                    'context_precision': result['evaluation_metrics'].get('context_precision', ''),
                    'context_relevancy': result['evaluation_metrics'].get('context_relevancy', ''),
                    'context_recall': result['evaluation_metrics'].get('context_recall', ''),
                    'response_json': json.dumps(result['response_json']),
                    'similarityLevel': result.get('similarityLevel', '')
                })
    except Exception as e:
        print(f"Error in main: {e}")
    finally:
        try:
            for course_name in os.listdir(base_directory_path):
                requests.delete(
                    f'http://localhost:3004/chat/{course_name}/deleteAllQuestions', headers=headers)
        except Exception as e:
            print(f"Error in cleanup: {e}")
