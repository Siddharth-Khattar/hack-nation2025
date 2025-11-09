# Hack-Nation

🌐 **Live Demo**: [https://bet-graph.vercel.app/](https://bet-graph.vercel.app/)

Welcome to Hack-Nation, a full-stack platform for analyzing and visualizing data from Polymarket, a decentralized prediction market. This project combines a powerful Python backend for data processing with a dynamic Next.js frontend for interactive visualization, along with a set of autonomous agents for automated data collection and trading.

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Real-time Market Analysis**: Ingests and processes data from Polymarket to provide insights into market trends and dynamics.
- **Interactive Force Graph**: Visualizes complex relationships between markets, traders, and other entities in an intuitive and interactive graph interface.
- **Autonomous Agents**: A set of configurable agents that can perform tasks such as data scraping, market monitoring, and automated trading.
- **Vector Search**: Leverages Weaviate for powerful vector search capabilities, enabling semantic search over market data.
- **Scalable Architecture**: Built with a modern stack including FastAPI, Next.js, and Docker for a scalable and maintainable system.

## Project Structure

The repository is organized into three main components:

- **`hacknation2025/frontend`**: The Next.js web application that provides the user interface and data visualization components. See the [frontend README](./hacknation2025/frontend/README.md) for more details.
- **`hacknation2025/backend`**: The Python backend that handles data retrieval, processing, and serves the API for the frontend. See the [backend README](./hacknation2025/backend/README.md) for more details.
- **`agents`**: A collection of Python scripts for running autonomous agents that interact with Polymarket and other data sources. See the [agents README](./agents/README.md) for more information.

## Getting Started

To get started with Hack-Nation, you'll need to set up the backend, frontend, and optionally the agents. Please refer to the README file in each respective directory for detailed setup instructions.

### Prerequisites

- Docker and Docker Compose
- Node.js and npm (or yarn)
- Python 3.10+

## Usage

Once the application is running, you can open your browser to `http://localhost:3000` to access the web interface. From there, you can explore the force graph, search for specific markets, and view detailed information about different nodes.

The backend API is accessible at `http://localhost:8000`, and you can find the API documentation at `http://localhost:8000/docs`.

## Contributing

We welcome contributions to Hack-Nation! If you'd like to contribute, please read our [CONTRIBUTING.md](./agents/CONTRIBUTING.md) file for guidelines on how to get started.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
