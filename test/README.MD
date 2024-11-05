# Testing Documentation

## Overview

This document provides guidelines on how to run tests, the design of the integration tests, and important considerations to ensure effective and accurate testing outcomes.

## RAG testing

See [RAG testing](RAGtesting/README.md) for more information on end-to-end testing for RAG. It focuses on the quality of the question asking process.

### Running tests

First ensure that database=RAGtest is created in the postgres database. Then run the following commands:

1. yarn RAG-test:server
2. Under the RAGtesting folder, run the tests you want to run. For example, to run the end2end tests, run python end2end/main.py

Note: some of the tests are under construction still and are experimental.

## Integration tests

### Running Tests:

1. yarn integration-test:server
2. yarn test

### Server Setup:

Each test initiates by setting up the listener on port 3004 with a test database, ensuring that the environment closely mimics the production setup but is isolated to prevent side effects.

### Database Handling:

Tests use separate database connections or repositories to interact and verify database states independently, ensuring no shared state across tests.

### Reason for Design:

This setup compensates for the limitations in supertest, which can struggle with complex server structures and nuances. By using the actual listener, the tests can more effectively diagnose connectivity and operational problems.

### Structure:

Each test.ts file manages its database transactions and should be responsible for setting up and tearing down its testing environment, including any required initial database state.

## Important Points to Beware

### Test Case Separation:

Ensure that test cases are isolated to prevent one test from affecting the outcome of another. This is crucial because tests that modify the database could impact subsequent tests.

### Database Resets:

Implement a resetDB function to clear all data from all tables at the beginning of each test file and after each test case. This ensures a clean state for each test and avoids tests affecting each other due to residual data. After reseting the db, should also post to reset, which would notify the server to reset the services.

### Cost Management:

Be mindful of the costs associated with tests that make external API calls. Utilize mocking strategies to simulate API responses where possible. We have implemented llama, using it as much as possible to avoid external API calls.
