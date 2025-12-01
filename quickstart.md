# PhoneEase Middleware - Quick Start Guide

Get the middleware running in 5 minutes.

## 1. Install Prerequisites (5 min)

### Install Google Cloud CLI

**Windows:**
```bash
# Download and run installer
https://cloud.google.com/sdk/docs/install
```

**After installation, restart your terminal**

### Verify Installation
```bash
gcloud --version
```

## 2. Authenticate (1 min)

```bash
gcloud auth login
gcloud config set project white-airship-479502-r1
```

## 3. Enable APIs (2 min)

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com aiplatform.googleapis.com
```

## 4. Deploy (3-5 min)

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

Wait for deployment to complete (3-5 minutes first time).

## 5. Grant Permissions (1 min)

```bash
# Firestore access
gcloud projects add-iam-policy-binding white-airship-479502-r1 \
  --member="serviceAccount:375589245036-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"

# Vertex AI access
gcloud projects add-iam-policy-binding white-airship-479502-r1 \
  --member="serviceAccount:375589245036-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

## 6. Test (30 sec)

**Test health:**
```bash
curl https://phoneease-middleware-375589245036.us-central1.run.app/health
```

**Test training endpoint:**
```bash
curl -X POST https://phoneease-middleware-375589245036.us-central1.run.app/api/v1/train \
  -H "Content-Type: application/json" \
  -d "{\"site_token\":\"kv6tFnZDDsxPqXWh54RjnbyNNLbVjdxp\",\"message\":\"Test\",\"business_info\":{\"business_name\":\"OTDNews\"}}"
```

**Expected output:**
```json
{
  "success": true,
  "ai_response": "Hello! Thank you for contacting OTDNews. How can I help you today?",
  "tokens_used": 45
}
```

## 7. Test from WordPress (30 sec)

1. Go to: WordPress Admin > PhoneEase > AI Training
2. Type a message: "What are your business hours?"
3. Click "Send"
4. Verify AI response appears

## Done!

You're all set. The middleware is deployed and ready to use.

## Troubleshooting

**404 Error?**
- Check the service URL is correct
- Verify deployment succeeded: `gcloud run services list`

**Permission Denied?**
- Run the permission commands in step 5
- Wait 1-2 minutes for permissions to propagate

**500 Error?**
- Check logs: `gcloud run logs read phoneease-middleware --region us-central1`
- Verify APIs are enabled (step 3)

## Next Steps

- Review full documentation: `README.md`
- Check detailed deployment guide: `DEPLOYMENT-GUIDE.md`
- Monitor logs: Cloud Console > Cloud Run > phoneease-middleware > Logs
