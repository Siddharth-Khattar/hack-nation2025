# Frontend

Welcome to the frontend of Hack-Nation, a Next.js application for visualizing and interacting with data from the Hack-Nation backend.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Key Components](#key-components)
- [API Interaction](#api-interaction)
- [Deployment](#deployment)

## Overview

The frontend is a modern web application built with Next.js and TypeScript. It provides an interactive force graph visualization to explore the relationships between various data points fetched from the backend. The interface is designed to be intuitive, allowing users to search, filter, and inspect nodes in the graph to gain insights into the data.

## Features

- **Interactive Force Graph**: A D3-powered force graph that dynamically displays the relationships between nodes.
- **Node Inspection**: Click on any node to view detailed information in a dedicated panel.
- **Search and Filtering**: Easily search for specific nodes or filter the graph based on various criteria.
- **Zoom and Pan**: Navigate the graph with intuitive zoom and pan controls.
- **Real-time Updates**: The graph can be updated in real-time as new data is fetched from the backend.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Data Visualization**: [D3.js](https://d3js.org/)
- **State Management**: React Hooks and Context API

## Getting Started

To get the frontend up and running, follow these steps:

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run the Development Server**:
    ```bash
    npm run dev
    ```

3.  **Open in Browser**:
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure

The frontend codebase is organized as follows:

- **`src/app`**: The main application pages and layout.
- **`src/components`**: Reusable React components, such as the `ForceGraph`, `SearchBar`, and info panels.
- **`src/hooks`**: Custom React hooks for managing state, simulation, and user interactions.
- **`src/lib`**: Core logic, including API clients, data transformations, and D3 helpers.
- **`src/types`**: TypeScript type definitions for the application's data structures.
- **`src/utils`**: Utility functions and mock data for testing.

## Key Components

- **`ForceGraph.tsx`**: The central component for rendering the interactive graph. It uses D3 for the physics simulation and rendering of nodes and links.
- **`NodeInfoPanel.tsx`**: A panel that displays detailed information about the currently selected node.
- **`SearchBar.tsx`**: A search input that allows users to find and focus on specific nodes in the graph.
- **`useForceSimulation.ts`**: A custom hook that manages the D3 force simulation, updating node positions and ensuring smooth animations.
- **`useGraphData.ts`**: A hook for fetching and processing the graph data from the backend API.

## API Interaction

The frontend communicates with the backend via a REST API. The API client is defined in `src/lib/api/client.ts`, which handles requests to the various endpoints for fetching market data, relations, and other information.

## Deployment

The easiest way to deploy the frontend is to use the [Vercel Platform](https://vercel.com/new), which is optimized for Next.js applications. For more details, see the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).
