# GitHub Workflow Setup Guide

## ✅ Fixed Issues

I've fixed the following issues in your `.github/workflows/google-cloudrun-docker.yml`:

1. ✅ Fixed branch name (removed extra quotes)
2. ✅ Fixed double `$$` syntax error
3. ✅ Fixed Docker build path (now uses `./backend`)
4. ✅ Added environment variables for Cloud Run deployment
5. ✅ Fixed output formatting
6. ✅ Updated Dockerfile to use Python 3.11 (more stable)

## 🔧 Setup Required

### 1. Google Cloud Project Setup

**Update these values in the workflow (lines 38-41):**

```yaml
env:
  PROJECT_ID: 'YOUR-GCP-PROJECT-ID'          # Change this
  REGION: 'europe-west3'                      # Or your preferred region
  SERVICE: 'hacknation-backend'               # Or your service name
  WORKLOAD_IDENTITY_PROVIDER: 'projects/YOUR-PROJECT-NUMBER/locations/global/workloadIdentityPools/github/providers/github-provider'
```

### 2. Enable Google Cloud APIs

In Google Cloud Console, enable:
- Artifact Registry API
- Cloud Run API
- IAM Credentials API

```bash
gcloud services enable artifactregistry.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable iamcredentials.googleapis.com
```

### 3. Create Artifact Registry Repository

```bash
gcloud artifacts repositories create hacknation-backend \
  --repository-format=docker \
  --location=europe-west3 \
  --description="HackNation Backend Docker images"
```

### 4. Set Up Workload Identity Federation

This allows GitHub Actions to authenticate to Google Cloud without service account keys:

```bash
# Create workload identity pool
gcloud iam workload-identity-pools create "github" \
  --project="YOUR-PROJECT-ID" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create workload identity provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="YOUR-PROJECT-ID" \
  --location="global" \
  --workload-identity-pool="github" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"

gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/run.developer"

# Allow GitHub repo to impersonate service account
gcloud iam service-accounts add-iam-policy-binding \
  "github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/YOUR-PROJECT-NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/Cyro292/hacknation2025"
```

### 5. Add GitHub Secrets

In your GitHub repository settings (`Settings > Secrets and variables > Actions`), add:

1. **`GCP_SERVICE_ACCOUNT_EMAIL`**
   ```
   github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com
   ```

2. **`SUPABASE_URL`**
   ```
   https://rwgiijnjmmrurmovkktb.supabase.co
   ```

3. **`SUPABASE_API_KEY`**
   ```
   Your Supabase service role key
   ```

4. **`OPENAI_API_KEY`**
   ```
   Your OpenAI API key
   ```

## 📝 What the Workflow Does

1. **Triggers**: On every push to `main` branch
2. **Authenticates**: Uses Workload Identity Federation (no keys!)
3. **Builds**: Docker image from `./backend/Dockerfile`
4. **Pushes**: Image to Google Artifact Registry
5. **Deploys**: To Cloud Run with environment variables
6. **Outputs**: Deployment URL

## 🐛 Local Docker Build Issue

The Docker build is currently failing due to **network timeouts** connecting to Docker Hub. This is not a configuration issue.

**Quick fixes to try:**

1. **Restart Docker Desktop**
2. **Change DNS**:
   - Docker Desktop > Settings > Docker Engine
   - Add: `"dns": ["8.8.8.8", "8.8.4.4"]`
3. **Try again later** (Docker Hub might be slow)

The workflow will build in GitHub Actions (usually faster).

## 🚀 Testing Locally with Docker Compose

Once the network issue resolves:

```bash
cd backend
docker-compose up --build
```

Test:
```bash
curl http://localhost:8000/health
```

## 📊 Monitoring

After deployment, monitor at:
- https://console.cloud.google.com/run
- View logs in Cloud Logging
- Set up alerts for errors

## ✅ Checklist

- [ ] Update PROJECT_ID, REGION, SERVICE in workflow
- [ ] Enable required Google Cloud APIs
- [ ] Create Artifact Registry repository
- [ ] Set up Workload Identity Federation
- [ ] Add GitHub Secrets
- [ ] Push to main branch to trigger deployment
- [ ] Verify deployment in Cloud Run console

