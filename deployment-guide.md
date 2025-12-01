# PhoneEase Middleware Deployment Guide

This guide walks you through deploying the PhoneEase middleware to Google Cloud Run.

## Prerequisites

### 1. Install Google Cloud CLI

**Windows:**
- Download from: https://cloud.google.com/sdk/docs/install
- Run the installer and follow the prompts
- Restart your terminal after installation

**Verify installation:**
```bash
gcloud --version
```

### 2. Authenticate with Google Cloud

```bash
gcloud auth login
```

This will open a browser window for you to authenticate with your Google account.

### 3. Set Default Project

```bash
gcloud config set project white-airship-479502-r1
```

### 4. Enable Required APIs

Run these commands to enable the necessary Google Cloud APIs:

```bash
# Cloud Run API
gcloud services enable run.googleapis.com

# Cloud Build API (for building container images)
gcloud services enable cloudbuild.googleapis.com

# Firestore API
gcloud services enable firestore.googleapis.com

# Vertex AI API
gcloud services enable aiplatform.googleapis.com
```

## Deployment Steps

### Option 1: Using Deployment Script (Recommended)

**Windows:**
```bash
cd "C:\Users\miral\Local Sites\phoneease-dev\phoneease-middleware"
deploy.bat
```

**Linux/Mac:**
```bash
cd "/c/Users/miral/Local Sites/phoneease-dev/phoneease-middleware"
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Verify gcloud authentication
2. Set the correct project
3. Deploy to Cloud Run
4. Display the service URL and test commands

### Option 2: Manual Deployment

If you prefer to deploy manually:

```bash
cd "C:\Users\miral\Local Sites\phoneease-dev\phoneease-middleware"

gcloud run deploy phoneease-middleware \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=white-airship-479502-r1,VERTEX_AI_LOCATION=us-central1,VERTEX_AI_MODEL=gemini-2.0-flash-exp"
```

**Note:** On Windows, use `^` instead of `\` for line continuation:

```cmd
gcloud run deploy phoneease-middleware ^
  --source . ^
  --region us-central1 ^
  --allow-unauthenticated ^
  --set-env-vars "GOOGLE_CLOUD_PROJECT=white-airship-479502-r1,VERTEX_AI_LOCATION=us-central1,VERTEX_AI_MODEL=gemini-2.0-flash-exp"
```

## Post-Deployment

### 1. Note the Service URL

After successful deployment, you'll see output like:

```
Service [phoneease-middleware] revision [phoneease-middleware-00001-xyz] has been deployed and is serving 100 percent of traffic.
Service URL: https://phoneease-middleware-375589245036.us-central1.run.app
```

**Important:** Copy this URL - you'll need it for testing and WordPress configuration.

### 2. Configure Service Account Permissions

The Cloud Run service needs permissions to access Firestore and Vertex AI.

**Get the service account email:**
```bash
gcloud run services describe phoneease-middleware \
  --region us-central1 \
  --format="value(spec.template.spec.serviceAccountName)"
```

If empty, it uses the default compute service account:
`375589245036-compute@developer.gserviceaccount.com`

**Grant Firestore permissions:**
```bash
gcloud projects add-iam-policy-binding white-airship-479502-r1 \
  --member="serviceAccount:375589245036-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

**Grant Vertex AI permissions:**
```bash
gcloud projects add-iam-policy-binding white-airship-479502-r1 \
  --member="serviceAccount:375589245036-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### 3. Test the Deployment

**Test health endpoint:**
```bash
curl https://phoneease-middleware-375589245036.us-central1.run.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "phoneease-middleware",
  "timestamp": "2024-12-01T10:30:00.000Z"
}
```

**Test training endpoint:**
```bash
curl -X POST https://phoneease-middleware-375589245036.us-central1.run.app/api/v1/train \
  -H "Content-Type: application/json" \
  -d '{
    "site_token": "kv6tFnZDDsxPqXWh54RjnbyNNLbVjdxp",
    "message": "What are your business hours?",
    "context": "training",
    "business_info": {
      "business_name": "OTDNews"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "ai_response": "Thank you for contacting OTDNews. How can I help you today?",
  "tokens_used": 45
}
```

### 4. Initialize Firestore (Optional)

If you want to manually add a test customer, go to Firebase Console:

1. Visit: https://console.firebase.google.com/
2. Select project: `white-airship-479502-r1`
3. Navigate to: Firestore Database
4. Create collection: `customers`
5. Add document with these fields:

```
site_token: kv6tFnZDDsxPqXWh54RjnbyNNLbVjdxp
business_name: OTDNews
training_used: 0
training_limit: 100
created_at: 2024-12-01T10:00:00.000Z
updated_at: 2024-12-01T10:00:00.000Z
```

**Note:** The endpoint auto-registers customers, so this step is optional.

## Troubleshooting

### Error: "command not found: gcloud"

**Solution:** Install Google Cloud CLI from https://cloud.google.com/sdk/docs/install

### Error: "You do not currently have an active account selected"

**Solution:** Authenticate with gcloud:
```bash
gcloud auth login
```

### Error: "Permission denied" during deployment

**Solution:** Ensure you have the necessary IAM roles:
```bash
gcloud projects add-iam-policy-binding white-airship-479502-r1 \
  --member="user:YOUR_EMAIL@gmail.com" \
  --role="roles/run.admin"
```

### Error: "API not enabled"

**Solution:** Enable required APIs:
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com aiplatform.googleapis.com
```

### Error: "Permission denied" from Firestore or Vertex AI

**Solution:** Grant service account permissions (see Post-Deployment step 2 above)

### Deployment takes a long time

**Cause:** Cloud Build is building the container image for the first time.

**Solution:** Wait 2-5 minutes. Subsequent deployments will be faster due to caching.

### Check Logs

View recent logs:
```bash
gcloud run logs read phoneease-middleware \
  --region us-central1 \
  --limit 50
```

View logs in real-time:
```bash
gcloud run logs tail phoneease-middleware \
  --region us-central1
```

Or view in Cloud Console:
https://console.cloud.google.com/run/detail/us-central1/phoneease-middleware/logs

## Redeployment

To redeploy after making code changes:

1. Make your code changes
2. Run the deployment script again:
   ```bash
   deploy.bat  # Windows
   ./deploy.sh  # Linux/Mac
   ```

Cloud Run will automatically create a new revision and route traffic to it.

## Rollback

If something goes wrong, rollback to a previous revision:

1. List revisions:
```bash
gcloud run revisions list \
  --service phoneease-middleware \
  --region us-central1
```

2. Route traffic to a previous revision:
```bash
gcloud run services update-traffic phoneease-middleware \
  --region us-central1 \
  --to-revisions REVISION_NAME=100
```

## Monitoring

View service metrics in Cloud Console:
https://console.cloud.google.com/run/detail/us-central1/phoneease-middleware/metrics

Metrics include:
- Request count
- Request latency
- Container CPU utilization
- Container memory utilization
- Error rate

## Cost Optimization

Cloud Run pricing is based on:
- Request count (first 2M requests/month free)
- CPU/Memory usage (billed per 100ms)
- Data transfer

To optimize costs:
1. Set minimum instances to 0 (default) to scale to zero when not in use
2. Use appropriate CPU/Memory allocation
3. Monitor usage in Cloud Console

## Next Steps

After successful deployment:

1. **Update WordPress Plugin Configuration:**
   - Verify the middleware URL in `includes/class-phoneease-ajax-handlers.php`
   - Should be: `https://phoneease-middleware-375589245036.us-central1.run.app/api/v1/train`

2. **Test from WordPress Admin:**
   - Go to WordPress Admin > PhoneEase > AI Training
   - Send a test message
   - Verify AI response appears

3. **Monitor Logs:**
   - Check Cloud Run logs for any errors
   - Monitor Firestore for customer records and usage tracking

4. **Production Considerations:**
   - Consider adding API key authentication
   - Set up Cloud Monitoring alerts
   - Review Firestore security rules
   - Implement rate limiting at the middleware level

## Support

For issues or questions:
- Check Cloud Run logs: `gcloud run logs read phoneease-middleware --region us-central1`
- Review deployment guide: README.md
- Check service status: `gcloud run services describe phoneease-middleware --region us-central1`
