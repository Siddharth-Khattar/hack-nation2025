# Backend

Welcome to the backend of Hack-Nation, a powerful FastAPI application designed to analyze and serve data from the Polymarket prediction market.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Key Services](#key-services)
- [Data Models](#data-models)
- [Environment Variables](#environment-variables)
- [Docker Setup](#docker-setup)

## Overview

The backend is the core of the Hack-Nation platform, responsible for fetching data from Polymarket, processing it, and exposing it through a RESTful API. It leverages Supabase for data storage and Weaviate for advanced vector search capabilities, enabling complex queries and analysis of market data.

## Features

- **Polymarket Integration**: Fetches real-time data from Polymarket using an enhanced API client.
- **Data Scraping and Processing**: Includes a robust scraper for collecting historical data and scripts for processing and embedding it.
- **Vector Search**: Uses Weaviate to perform semantic searches on market data, enabling powerful and intuitive queries.
- **Relational Data Modeling**: Stores and manages data in a structured way using a PostgreSQL database via Supabase.
- **Scalable and Asynchronous**: Built with FastAPI, providing a high-performance, asynchronous foundation.

## Tech Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (via [Supabase](https://supabase.io/))
- **Vector Database**: [Weaviate](https://weaviate.io/)
- **Language**: [Python](https://www.python.org/)
- **Containerization**: [Docker](https://www.docker.com/)

## Getting Started

To get the backend running locally, follow these steps:

1.  **Create a Virtual Environment**:
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```

2.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Set Up Environment Variables**:
    Create a `.env` file in the `backend` directory and populate it with the necessary credentials for Supabase, Weaviate, and other services. See the [Environment Variables](#environment-variables) section for more details.

4.  **Run the Development Server**:
    ```bash
    uvicorn main:app --reload
    ```

The API will be available at `http://localhost:8000`, with documentation at `http://localhost:8000/docs`.

## Project Structure

The backend codebase is organized as follows:

- **`main.py`**: The entry point for the FastAPI application.
- **`app/`**: The main application module.
  - **`core/`**: Core configuration, including settings and secrets management.
  - **`data_retrieval/`**: Scripts and clients for fetching data from Polymarket, Supabase, and Weaviate.
  - **`routers/`**: API route handlers for different resources (markets, relations, etc.).
  - **`schemas/`**: Pydantic schemas for data validation and serialization.
  - **`services/`**: Business logic for interacting with the database and other services.
  - **`utils/`**: Utility functions, such as market analysis tools and connections to external services like OpenAI.
- **`scripts/`**: Standalone scripts for tasks like data migration and embedding creation.

## API Endpoints

The backend provides several API endpoints for interacting with the data:

- **`/markets`**: Endpoints for fetching and analyzing market data.
- **`/relations`**: Endpoints for retrieving relationships between different entities.
- **`/vectors`**: Endpoints for performing vector searches on the data.
- **`/names`**: Endpoints for managing and resolving entity names.

For a full list of endpoints and their specifications, please refer to the API documentation at `http://localhost:8000/docs`.

## Key Services

- **`database_service.py`**: Handles all interactions with the Supabase PostgreSQL database.
- **`vector_service.py`**: Manages connections and queries to the Weaviate vector database.
- **`relation_service.py`**: Contains the business logic for creating and retrieving relationships between data points.
- **`name_service.py`**: Provides services for managing and resolving entity names.

## Data Models

The data models for the application are defined as Pydantic schemas in the `app/schemas/` directory. These schemas define the structure of the data for markets, relations, and other entities, ensuring data consistency and providing clear API contracts.

## Environment Variables

You'll need to create a `.env` file in the `backend` directory with the following variables:

```env
SUPABASE_URL="your-supabase-url"
SUPABASE_KEY="your-supabase-key"
WEAVIATE_URL="your-weaviate-url"
OPENAI_API_KEY="your-openai-key"
```

## Docker Setup

The backend can also be run using Docker for a more isolated and reproducible environment.

1.  **Build the Docker Image**:
    ```bash
    docker-compose build
    ```

2.  **Run the Docker Container**:
    ```bash
    docker-compose up
    ```

This will start the FastAPI server inside a Docker container, making it easy to deploy and manage.

