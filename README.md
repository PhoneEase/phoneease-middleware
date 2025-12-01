# PhoneEase Middleware

Cloud Run middleware for PhoneEase WordPress plugin. Handles AI training, Twilio webhooks, and Vertex AI integration.

## Architecture

```
WordPress Plugin → Cloud Run Middleware → Vertex AI (Gemini)
                                       → Firestore
                                       → Twilio (future)
```

## Features

- **AI Training Endpoint** (`POST /api/v1/train`) - Chat with Gemini for training
- **Auto-Registration** - Automatically registers new customers on first request
- **Usage Tracking** - Tracks training requests per customer in Firestore
- **Rate Limiting** - Enforces training limits per customer

## Project Structure

```
phoneease-middleware/
├── index.js              # Express server entry point
├── routes/
│   └── train.js          # /api/v1/train endpoint
├── services/
│   ├── firestore.js      # Firestore operations
│   └── vertexai.js       # Vertex AI Gemini integration
├── package.json          # Node.js dependencies
├── Dockerfile            # Container image definition
└── .gcloudignore         # Cloud Run deployment exclusions
```

## Environment Variables

The following environment variables are required:

- `GOOGLE_CLOUD_PROJECT` - Google Cloud project ID (e.g., `white-airship-479502-r1`)
- `VERTEX_AI_LOCATION` - Vertex AI region (default: `us-central1`)
- `VERTEX_AI_MODEL` - Gemini model name (default: `gemini-2.0-flash-exp`)
- `PORT` - Server port (Cloud Run sets this to 8080)

## Local Development

### Prerequisites

- Node.js 18+
- Google Cloud CLI (`gcloud`)
- Access to Google Cloud project `white-airship-479502-r1`

### Setup

1. Install dependencies:
```bash
cd phoneease-middleware
npm install
```

2. Authenticate with Google Cloud:
```bash
gcloud auth application-default login
```

3. Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```
GOOGLE_CLOUD_PROJECT=white-airship-479502-r1
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-2.0-flash-exp
PORT=8080
NODE_ENV=development
```

4. Run locally:
```bash
npm start
```

Or with auto-reload:
```bash
npm run dev
```

5. Test health endpoint:
```bash
curl http://localhost:8080/health
```

## Deployment to Google Cloud Run

### Prerequisites

1. Google Cloud CLI installed and authenticated:
```bash
gcloud auth login
gcloud config set project white-airship-479502-r1
```

2. Enable required APIs:
```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable aiplatform.googleapis.com
```

### Deploy

From the `phoneease-middleware` directory:

```bash
gcloud run deploy phoneease-middleware \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=white-airship-479502-r1,VERTEX_AI_LOCATION=us-central1,VERTEX_AI_MODEL=gemini-2.0-flash-exp
```

This command will:
1. Build a container image from source using Cloud Build
2. Deploy to Cloud Run in `us-central1`
3. Allow unauthenticated access (required for WordPress to call it)
4. Set environment variables

### Verify Deployment

After deployment, you'll see output like:

```
Service [phoneease-middleware] revision [phoneease-middleware-00001-abc] has been deployed and is serving 100 percent of traffic.
Service URL: https://phoneease-middleware-375589245036.us-central1.run.app
```

Test the deployment:

```bash
# Health check
curl https://phoneease-middleware-375589245036.us-central1.run.app/health

# Training endpoint test
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

## API Endpoints

### POST /api/v1/train

Chat with AI for training purposes.

**Request:**
```json
{
  "site_token": "kv6tFnZDDsxPqXWh54RjnbyNNLbVjdxp",
  "message": "What are your business hours?",
  "context": "training",
  "business_info": {
    "business_name": "OTDNews",
    "business_hours": "Monday-Friday 9am-5pm EST",
    "business_description": "News and media company"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "ai_response": "Our business hours are Monday through Friday, 9am to 5pm Eastern Standard Time. How can I assist you?",
  "tokens_used": 45
}
```

**Response (Limit Exceeded):**
```json
{
  "success": false,
  "error": "Training limit exceeded",
  "training_used": 100,
  "training_limit": 100
}
```

**Response (Missing Fields):**
```json
{
  "success": false,
  "error": "Missing required field: business_info.business_name"
}
```

## Firestore Schema

### Collection: `customers`

```javascript
{
  "site_token": "kv6tFnZDDsxPqXWh54RjnbyNNLbVjdxp",
  "business_name": "OTDNews",
  "business_hours": "Monday-Friday 9am-5pm EST",
  "business_description": "News and media company",
  "training_used": 5,
  "training_limit": 100,
  "created_at": "2024-12-01T12:00:00.000Z",
  "updated_at": "2024-12-01T12:30:00.000Z"
}
```

## Manually Add Test Customer to Firestore

You can add a test customer directly in the Firebase Console:

1. Go to: https://console.firebase.google.com/
2. Select project `white-airship-479502-r1`
3. Navigate to Firestore Database
4. Create collection `customers` if it doesn't exist
5. Add document with fields:

```
site_token: kv6tFnZDDsxPqXWh54RjnbyNNLbVjdxp
business_name: OTDNews
business_hours: (optional)
business_description: (optional)
training_used: 0
training_limit: 100
created_at: (timestamp)
updated_at: (timestamp)
```

Or use the auto-registration feature by just making a request - the customer will be created automatically.

## Troubleshooting

### Error: "Permission denied" from Firestore

**Solution:** Ensure Cloud Run service account has Firestore permissions:

```bash
gcloud projects add-iam-policy-binding white-airship-479502-r1 \
  --member="serviceAccount:375589245036-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### Error: "Permission denied" from Vertex AI

**Solution:** Ensure Cloud Run service account has Vertex AI permissions:

```bash
gcloud projects add-iam-policy-binding white-airship-479502-r1 \
  --member="serviceAccount:375589245036-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### Viewing Logs

View Cloud Run logs:

```bash
gcloud run logs read phoneease-middleware \
  --region us-central1 \
  --limit 50
```

Or in Cloud Console:
https://console.cloud.google.com/run/detail/us-central1/phoneease-middleware/logs

## Security Notes

- The `/api/v1/train` endpoint is currently unauthenticated
- Rate limiting is enforced via Firestore `training_limit` field
- In production, consider adding API key authentication
- Firestore security rules should restrict write access

## License

MIT License - PhoneEase Team
