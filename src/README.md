# API Documentation

## Overview

This API is designed to facilitate interactions with a Chatbot Service, primarily used for course-related queries and document management. It supports various operations including asking questions, updating answers, managing documents, and more.

## Base URL

The API is accessible at `http://localhost:3003` or `http://localhost:3004` for testing

## Endpoints

### Document Routes

Remember that all routes are prefixed with `/chat/:courseId`.

#### POST `/document`

- **Description**: Uploads documents to the server.
- **Body**:
  - `file`: Multipart form-data file to be uploaded.
- **Response**: JSON object with the uploaded documents' details.

#### DELETE `/:docId/document`

- **Parameters**:
  - `docId`: ID of the document to delete.
- **Description**: Deletes the specified document.
- **Response**: JSON object with the deletion status.

#### POST `/document/url/github`

- **Body**:
  - `url`: URL of the GitHub file to add.
- **Description**: Adds documents from a GitHub URL.
- **Response**: JSON object with the added documents' details.

#### GET `/aggregateDocuments`

- **Description**: Retrieves all aggregated documents.
- **Response**: JSON array of all aggregated documents.

### Question Routes

#### POST `/ask`

- **Body**:
  - `question`: The question to be asked.
  - `history`: The history of the conversation.
- **Description**: Asks a question using the chatbot service.
- **Response**: JSON object with the chatbot's response.

#### PATCH `/question`

- **Body**:
  - `id`: The ID of the question.
  - `question`: The updated question text.
  - `answer`: The updated answer text.
  - `verified`: Boolean indicating if the answer is verified.
  - `sourceDocuments`: Array of source documents related to the question.
- **Description**: Updates an existing question with new information.
- **Response**: JSON object with the update status and details.

#### GET `/resetCourse`

- **Description**: Resets all chatbot data for the course.
- **Response**: JSON object indicating success status.

#### GET `/allQuestions`

- **Description**: Retrieves all questions for a course.
- **Response**: JSON array of all questions.

### Question Routes

#### POST `/ask`

- **Body**:
  - `question`: The question to be asked.
  - `history`: The history of the conversation.
- **Description**: Asks a question using the chatbot service.
- **Response**: JSON object with the chatbot's response.

#### PATCH `/question`

- **Body**:
  - `id`: The ID of the question.
  - `question`: The updated question text (optional).
  - `answer`: The updated answer text (required).
  - `verified`: Boolean indicating if the answer is verified (optional).
  - `sourceDocuments`: Array of source documents related to the question (optional).
- **Description**: Updates an existing question with new information.
- **Response**: JSON object with the update status and details.

#### GET `/resetCourse`

- **Description**: Resets all chatbot data for the course.
- **Response**: JSON object indicating success status.

#### GET `/allQuestions`

- **Description**: Retrieves all questions for a course.
- **Response**: JSON array of all questions.

### Chatbot Routes

#### GET `/hello`

- **Description**: Returns a simple "Hello World!" message.
- **Response**: JSON object with a greeting message.

#### GET `/allChatbotSetting`

- **Description**: Retrieves all chatbot settings.
- **Response**: JSON array of all chatbot settings.

#### GET `/oneChatbotSetting`

- **Description**: Retrieves the current chatbot setting.
- **Response**: JSON object with the current chatbot setting. Includes available model types.

#### PATCH `/updateChatbotSetting`

- **Body**:
  - JSON object containing the new chatbot settings.
- **Description**: Updates the chatbot settings.
- **Response**: JSON object indicating success status.

#### PATCH `/resetChatbotSetting`

- **Description**: Resets the chatbot settings to their default values.
- **Response**: JSON object indicating success status.

## Usage

Ensure proper authorization and content-type (typically `application/json`) headers are set for each request.

## Notes

- The server listens on port 3003.
- Error handling is incorporated into each endpoint.
- The application uses `express` for routing and middleware support.

This API is a comprehensive tool for managing course-specific chatbot interactions and document management, offering a wide range of functionalities to enhance the educational experience.
