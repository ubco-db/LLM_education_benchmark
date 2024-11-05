import requests
import time
import json
import csv
import sys
import os
from typing import List, Dict
from dotenv import load_dotenv
from metrics import ragas_no_context
from metrics.tfidf import TFIDF
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.llms import Ollama
from openai import OpenAI

load_dotenv()

EMBEDDER = os.getenv('EMBEDDER')
CHUNKING = os.getenv('CHUNKING')
PROMPT = os.getenv('PROMPT')
MODEL_NAME = os.getenv('MODEL_NAME')
TEMPERATURE = float(os.getenv('TEMPERATURE'))
TOPK = int(os.getenv('TOPK'))
SIMILARITY_THRESHOLD_DOCUMENTS = float(
    os.getenv('SIMILARITY_THRESHOLD_DOCUMENTS'))
SIMILARITY_THRESHOLD_QUESTIONS = float(
    os.getenv('SIMILARITY_THRESHOLD_QUESTIONS'))
DEVICE = os.getenv('DEVICE')
EVALMODEL = os.getenv('EVALMODEL')

CSV_FILE = 'test_results.csv'
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)
headers = {'HMS_API_TOKEN': 'test_token'}

fieldnames = [
    'section', 'dataset', 'embedder', 'chunking_detail', 'timestamp', 'extra_info', 'device', 'evalmodel', 'Prompt', 'ModelName',
    'Temperature', 'TopK', 'SimilarityThresholdDocuments',
    'SimilarityThresholdQuestions', 'runId', 'category',
    'TFIDFScore', 'ResponseTime', 'answer_correctness',
    'faithfulness', 'answer_similarity', 'answer_relevancy', 'context_precision',
    'context_relevancy', 'context_recall', 'response_json'
]
# Mapping of course names to assistant IDs
course_to_assistant_id = {
    "COSC304": "asst_6afLJ8cgb0gVNpBbuVcwPfXe",
    "COSC404": "asst_PVOIAE9k2ryjGIRsjqDd9EOZ",
    "COSC111": "asst_aeOhU29gUq2a3QkvFbAYXS9m",
    "COSC121": "asst_rppQJGfIHrGR3e7wktDlWmx2"
}

# Initialize the CSV file with headers if it doesn't exist
if not os.path.isfile(CSV_FILE) or os.path.getsize(CSV_FILE) == 0:
    with open(CSV_FILE, 'a', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()


def convert_history_item(history_item: Dict[str, str]) -> Dict[str, str]:
    role_map = {
        'userMessage': 'user',
        'apiMessage': 'assistant'
    }
    return {
        'role': role_map.get(history_item['type'], 'user'),
        'content': history_item['message']
    }


def run_test_case(question: str, expected_answer: str, history: List[Dict], category: str, course_name: str) -> Dict[str, any]:
    try:
        assistant_id = course_to_assistant_id.get(
            course_name, "default_assistant_id")

        # Prepare the messages, including history
        messages = [convert_history_item(item) for item in history]
        messages.append({"role": "user", "content": question})
        start = time.time()
        # query assistant api

        run = client.beta.threads.create_and_run_poll(
            assistant_id=assistant_id,
            thread={
                "messages": messages
            }
        )

        if run.status == 'completed':
            m = client.beta.threads.messages.list(thread_id=run.thread_id)
            client.beta.threads.delete(run.thread_id)
        else:
            print(run.status)
        end = time.time()

        chatbot_answer = m.data[0].content[0].text.value
        print(f"Question: {question}, Answer: {chatbot_answer}")
 
        tfidf_score = TFIDF(chatbot_answer, expected_answer)

        data_sample = {
            'question': [question],
            'answer': [chatbot_answer],
            'contexts': [['No context provided.']],
            'ground_truth': [expected_answer]
        }

        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L12-v2")
        llm = Ollama(model=EVALMODEL, base_url="http://localhost:11433")

        evaluation_results = ragas_no_context.run_ragas_evaluation(
            data_sample, llm, embeddings)
        evaluation_metrics = evaluation_results[0]
        response_json = {
            'history': history,
            'question': question,
            'answer': chatbot_answer
        }
        return {
            'tfidfScore': tfidf_score,
            'responseTime': (end - start) * 1000,
            'course': course_name,
            'response_json': response_json,
            'category': category,
            'expected_answer': expected_answer,
            'evaluation_metrics': evaluation_metrics
        }
    except Exception as e:
        print(f"Error in run_test_case: {e}")
        return {}


def run_section(test_cases: List[Dict], section: str, course: str) -> List[Dict]:
    results = []
    for test_case in test_cases:
        result = run_test_case(test_case['question'], test_case['expectedAnswer'],
                               test_case['history'], test_case['category'], course)
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
        base_directory_path = '../datasets'
        run_id = int(time.time())

        all_results = []

        for course_name in os.listdir(base_directory_path):
            course_path = os.path.join(base_directory_path, course_name)
            if os.path.isdir(course_path):
                data_file_path = os.path.join(course_path, 'data.json')
                if os.path.isfile(data_file_path):

                    with open(data_file_path, 'r') as f:
                        test_data = json.load(f)
                    results = run_all_tests(test_data, course_name, run_id)
                    all_results.extend(results)
                else:
                    print(f"Data file for {course_name} not found at {data_file_path}")

        # Store results in CSV
        for result in all_results:
            with open(CSV_FILE, 'a', newline='') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writerow({
                    'section': result['section'],
                    'dataset': f'../datasets/{result.get("course")}/data.json',
                    'chunking_detail': CHUNKING,
                    'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'device': DEVICE,
                    'evalmodel': EVALMODEL,
                    'Prompt': PROMPT,
                    'ModelName': MODEL_NAME,
                    'Temperature': TEMPERATURE,
                    'runId': run_id,
                    'category': result.get('category', ''),
                    'TFIDFScore': result.get('tfidfScore', ''),
                    'ResponseTime': result.get('responseTime', ''),
                    'answer_correctness': result['evaluation_metrics'].get('answer_correctness', ''),
                    'faithfulness': result['evaluation_metrics'].get('faithfulness', ''),
                    'answer_similarity': result['evaluation_metrics'].get('answer_similarity', ''),
                    'response_json': json.dumps(result['response_json'])
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

