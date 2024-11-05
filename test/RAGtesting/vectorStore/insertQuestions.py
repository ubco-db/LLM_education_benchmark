import os
import json
import requests
from typing import List, Dict
import time

def retrieve_questions(base_directory_path: str) -> List[Dict[str, str]]:
    all_questions = []

    for course_name in os.listdir(base_directory_path):
        course_path = os.path.join(base_directory_path, course_name)
        if os.path.isdir(course_path):
            print(f"Starting to process course: {course_name}")
            data_file_path = os.path.join(course_path, 'data.json')
            if os.path.isfile(data_file_path):
                with open(data_file_path, 'r') as f:
                    test_data = json.load(f)
                for section, test_cases in test_data.items():
                    for test_case in test_cases:
                        question = test_case.get('question', '')
                        answer = test_case.get('expectedAnswer', '')
                        if question and answer:
                            all_questions.append({
                                'question': question,
                                'answer': answer,
                                'course': course_name,
                                'section': section
                            })
            else:
                print(f"Data file for {course_name} not found at {data_file_path}")
    return all_questions

def insert_questions_into_db(questions: List[Dict[str, str]], base_api_url: str):
    for item in questions:
        question = item['question']
        answer = item['answer']
        course_name = item['course']
        
        document_text = f"{question} {answer}"
        metadata = {
            'answer': answer,
            'source': 'inserted_questions',
            'loc': {
                'lines': {
                    'to': 0,
                    'from': 0,
                },
                'pageNumber': 0,
            },
            'courseId': course_name
        }

        api_url = f"{base_api_url}/{course_name}/documentChunk"

        try:
            response = requests.post(
                api_url,
                json={'documentText': document_text, 'metadata': metadata},
                headers={'HMS_API_TOKEN': 'test_token'}
            )

            if response.status_code == 200:
                print(f"Successfully inserted: {question}")
            else:
                print(f"Failed to insert: {question} with status code {response.status_code}")
        except Exception as e:
            print(f"Error inserting question {question}: {e}")

if __name__ == "__main__":
    try:
        base_directory_path = '../datasets'
        base_api_url = "http://localhost:3004/chat"
        
        questions = retrieve_questions(base_directory_path)
        insert_questions_into_db(questions, base_api_url)
    except Exception as e:
        print(f"Error: {e}")
