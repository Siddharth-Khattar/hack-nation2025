# Docker Deployment Guide

## Local Testing

### 1. Build and Run with Docker Compose

```bash
cd backend
docker-compose up --build
```

The API will be available at http://localhost:8000

### 2. Or Build and Run Manually

```bash
# Build the image
docker build -t hacknation-backend:latest .

# Run the container
docker run -d \
  --name hacknation-backend \
  -p 8000:8000 \
  --env-file .env \
  hacknation-backend:latest
```

### 3. Test the Deployment

```bash
# Health check
curl http://localhost:8000/health

# API Documentation
open http://localhost:8000/docs
```

### 4. View Logs

```bash
# With docker-compose
docker-compose logs -f backend

# Manual docker
docker logs -f hacknation-backend
```

### 5. Stop and Clean Up

```bash
# With docker-compose
docker-compose down

# Manual docker
docker stop hacknation-backend
docker rm hacknation-backend
```

## Digital Ocean Deployment

### 1. Build for Production

```bash
docker build -t registry.digitalocean.com/YOUR_REGISTRY/hacknation-backend:latest .
```

### 2. Push to Digital Ocean Registry

```bash
# Login to DO registry
doctl registry login

# Push image
docker push registry.digitalocean.com/YOUR_REGISTRY/hacknation-backend:latest
```

### 3. Deploy to Digital Ocean App Platform

Use the Digital Ocean dashboard or `doctl` CLI to deploy the container.

## Environment Variables

Required variables in `.env`:
- `SUPABASE_URL`
- `SUPABASE_API_KEY`
- `OPENAI_API_KEY`
- `SCRAPE_INTERVAL_HOURS` (optional, defaults to 1)

## Health Checks

The container includes automatic health checks:
- Endpoint: `/health`
- Interval: 30 seconds
- Timeout: 10 seconds
- Retries: 3

