import os
import requests
from requests_toolbelt.multipart.encoder import MultipartEncoder

# Base directory path for datasets
base_directory_path = '../datasets'
endpoint_base = 'http://localhost:3004/chat/'

def upload_file(file_path, course_id):
    try:
        with open(file_path, 'rb') as f:
            file_content = f.read()

            multipart_data = MultipartEncoder(
                fields={
                    'file': (os.path.basename(file_path), file_content, 'application/pdf'),
                    'source': ('blob', '{"source": "testSource"}', 'application/json')
                }
            )

            headers = {
                'Content-Type': multipart_data.content_type,
                'HMS_API_TOKEN': 'test_token'
            }

            response = requests.post(
                f'{endpoint_base}{course_id}/document', data=multipart_data, headers=headers)
            response.raise_for_status()
            print(f'Uploaded {file_path}: {response.status_code}')
    except requests.exceptions.RequestException as e:
        print(f'Error uploading {file_path}: {e}')
        if e.response:
            print(f'Response content: {e.response.content}')


def scan_and_upload_files(base_path):
    try:
        current_dir = os.getcwd()
        print(f'Current working directory: {current_dir}')

        # Construct the absolute path
        absolute_base_path = os.path.abspath(os.path.join(current_dir, base_path))

        if not os.path.exists(absolute_base_path):
            print(f'Directory does not exist: {absolute_base_path}')
            return

        for course_dir in os.listdir(absolute_base_path):
            course_path = os.path.join(absolute_base_path, course_dir)
            if os.path.isdir(course_path):
                course_id = course_dir
                files_path = os.path.join(course_path, 'files')
                print(f'Scanning course: {course_id} in directory: {files_path}')

                if not os.path.exists(files_path):
                    print(f'Directory does not exist: {files_path}')
                    continue

                for file_name in os.listdir(files_path):
                    file_path = os.path.join(files_path, file_name)
                    if os.path.isfile(file_path):
                        upload_file(file_path, course_id)

    except Exception as e:
        print(f'Error scanning directory: {e}')


if __name__ == '__main__':
    scan_and_upload_files(base_directory_path)
