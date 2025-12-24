# PhoneEase Middleware

Cloud Run middleware for PhoneEase WordPress plugin. Handles AI training, Twilio webhooks, and Vertex AI integration.

## Architecture

```
WordPress Plugin → Cloud Run Middleware → Vertex AI (Gemini)
                                       → Firestore
                                       → Twilio
```

## Features

- **Customer Registration** (`POST /api/v1/customers/register`) - Register customers with Twilio sub-accounts and phone numbers
- **AI Training Endpoint** (`POST /api/v1/train`) - Chat with Gemini for training
- **Auto-Registration** - Automatically registers new customers on first request
- **Usage Tracking** - Tracks training and call usage per customer in Firestore
- **Rate Limiting** - Enforces training and call limits per customer
- **Twilio Integration** - Creates sub-accounts and provisions phone numbers with area code matching

## Project Structure

```
phoneease-middleware/
├── index.js              # Express server entry point
├── routes/
│   ├── train.js          # /api/v1/train endpoint
│   ├── chat.js           # /api/v1/chat endpoint
│   └── register.js       # /api/v1/customers/register endpoint
├── services/
│   ├── firestore.js      # Firestore operations
│   ├── vertexai.js       # Vertex AI Gemini integration
│   └── twilio.js         # Twilio sub-account and phone provisioning
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
- Twilio account credentials (for Twilio integration features)
- Vertex AI API key (for Gemini AI features)

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

4. Configure environment variables in `.env`:

   **Required Variables:**
   - `GOOGLE_CLOUD_PROJECT` - Your Google Cloud project ID (e.g., `white-airship-479502-r1`)
   - `VERTEX_AI_LOCATION` - Region for Vertex AI (default: `us-central1`)
   - `VERTEX_AI_MODEL` - Gemini model name (default: `gemini-2.0-flash-exp`)
   - `TWILIO_ACCOUNT_SID` - Your Twilio Account SID (get from [Twilio Console](https://console.twilio.com))
   - `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token (get from [Twilio Console](https://console.twilio.com))
   - `VERTEX_AI_API_KEY` - Your Vertex AI API Key (get from [Google Cloud Console](https://console.cloud.google.com/apis/credentials))
   - `PORT` - Server port (default: `8080`)
   - `NODE_ENV` - Environment mode (`development` or `production`)

   **Getting Credentials:**
   - **Twilio Credentials:** Log into [Twilio Console](https://console.twilio.com) → Account Info section
   - **Vertex AI API Key:** Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create Credentials → API Key

   **Example `.env` file:**
   ```
   GOOGLE_CLOUD_PROJECT=white-airship-479502-r1
   VERTEX_AI_LOCATION=us-central1
   VERTEX_AI_MODEL=gemini-2.0-flash-exp
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   VERTEX_AI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   PORT=8080
   NODE_ENV=development
   MIDDLEWARE_URL=https://phoneease-middleware-pr6tyivo4a-uc.a.run.app
   ```

5. Run locally:
```bash
npm start
```

Or with auto-reload during development:
```bash
npm run dev
```

6. Test health endpoint:
```bash
curl http://localhost:8080/health
```

7. Verify environment variables loaded:
```bash
node -e "require('dotenv').config(); console.log('Project:', process.env.GOOGLE_CLOUD_PROJECT); console.log('Twilio SID:', process.env.TWILIO_ACCOUNT_SID ? 'Loaded' : 'Missing'); console.log('Vertex AI Key:', process.env.VERTEX_AI_API_KEY ? 'Loaded' : 'Missing');"
```

**Security Note:** Never commit `.env` files to git. The `.gitignore` file ensures they're excluded from version control.

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

### POST /api/v1/customers/register

Register a new customer with Twilio sub-account and provisioned phone number.

**Request:**
```json
{
  "business_name": "My Business",
  "business_phone": "(786) 333-7300",
  "site_url": "https://mybusiness.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "site_token": "550e8400-e29b-41d4-a716-446655440000",
  "phone_number": "+17865551234",
  "twilio_subaccount_sid": "ACxxxxx",
  "message": "Customer registered successfully"
}
```

**Response (Missing Business Name):**
```json
{
  "success": false,
  "error": "business_name is required and must be a non-empty string"
}
```

**Response (Twilio Service Unavailable):**
```json
{
  "success": false,
  "error": "Twilio service unavailable",
  "details": "Failed to create sub-account. Please try again later."
}
```

**Response (No Phone Numbers Available):**
```json
{
  "success": false,
  "error": "Phone number provisioning failed",
  "details": "No phone numbers available in area code 786"
}
```

**Area Code Matching:**
- If `business_phone` provided: Extracts area code and searches for numbers in that area
- If `business_phone` not provided: Uses default area code (786 - Miami)
- If no numbers in preferred area code: Falls back to any available number nationwide

**Supported Phone Formats:**
- E.164: `+17863337300`
- Formatted: `(786) 333-7300`
- Dashed: `786-333-7300`
- Plain: `7863337300`

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

**Auto-Registered Customers (Legacy):**
```javascript
{
  "site_token": "kv6tFnZDDsxPqXWh54RjnbyNNLbVjdxp",
  "business_name": "OTDNews",
  "business_hours": "Monday-Friday 9am-5pm EST",
  "business_description": "News and media company",
  "training_used": 5,
  "training_limit": 100,
  "created_at": "2025-12-01T12:00:00.000Z",
  "updated_at": "2025-12-01T12:30:00.000Z"
}
```

**Fully Registered Customers (via /api/v1/customers/register):**
```javascript
{
  // Identity
  "site_token": "550e8400-e29b-41d4-a716-446655440000",
  "business_name": "My Business",
  "business_phone": "(786) 333-7300",
  "site_url": "https://mybusiness.com",

  // Phone Configuration
  "phone_number": "+17865551234",
  "twilio_subaccount_sid": "ACxxxxx",
  "twilio_subaccount_token": "auth_token_here",

  // Call Tracking - Billable vs Filtered
  "calls_limit": 100,
  "billable_calls_used": 0,
  "filtered_calls": 0,
  "total_calls": 0,
  "spam_calls": 0,
  "silent_calls": 0,
  "test_calls": 0,

  // Training Tracking
  "training_limit": 100,
  "training_used": 5,

  // Billing Period
  "billing_period_start": "2025-12-23T12:00:00.000Z",
  "billing_period_end": "2026-01-22T12:00:00.000Z",

  // Status
  "status": "active",

  // Timestamps
  "created_at": "2025-12-23T12:00:00.000Z",
  "updated_at": "2025-12-23T12:30:00.000Z"
}
```

**Field Descriptions:**

*Identity:*
- `site_token` - Unique customer identifier (UUID v4)
- `business_name` - Customer's business name
- `business_phone` - Customer's phone number (optional, used for area code matching)
- `site_url` - Customer's website URL (optional)

*Phone Configuration:*
- `phone_number` - Provisioned Twilio number in E.164 format
- `twilio_subaccount_sid` - Twilio sub-account SID
- `twilio_subaccount_token` - Twilio sub-account auth token

*Call Tracking - Billable vs Filtered:*
- `calls_limit` - Maximum billable calls per billing period (default: 100)
- `billable_calls_used` - Calls that count toward limit (default: 0)
- `filtered_calls` - Spam/bots/silent calls - FREE (default: 0)
- `total_calls` - All calls for analytics (default: 0)
- `spam_calls` - Spam/robocalls (subset of filtered, default: 0)
- `silent_calls` - Silent/abandoned calls (subset of filtered, default: 0)
- `test_calls` - Owner test calls - FREE (default: 0)

*Training Tracking:*
- `training_limit` - Maximum training requests per billing period (default: 100)
- `training_used` - Current training usage counter (default: 0)

*Billing Period:*
- `billing_period_start` - Start of 30-day billing cycle
- `billing_period_end` - End of 30-day billing cycle

*Status:*
- `status` - Account status: `active`, `suspended`, or `cancelled`

*Timestamps:*
- `created_at` - Timestamp when customer was created
- `updated_at` - Timestamp of last update

---

### Call Billing Logic

PhoneEase uses fair billing that only charges for legitimate customer calls:

**Billable Calls** (count toward `calls_limit`):
- Real customer calls with actual conversations
- Incrementing `billable_calls_used`
- When limit reached → call rejected

**Filtered Calls** (FREE - don't count toward limit):
- **Spam/Robocalls**: Identified by AI as spam/telemarketing
- **Silent Calls**: No speech detected within timeout
- **Test Calls**: Owner testing their phone system
- These increment `filtered_calls` but NOT `billable_calls_used`

**Analytics:**
- `total_calls` = `billable_calls_used` + `filtered_calls`
- Helps customers understand call patterns without being charged for spam

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

## Deployment Status

### Current Status
- **Code Status:** Complete and ready for deployment
- **Deployment Status:** Not yet deployed to Google Cloud Run
- **Testing Status:** Local testing complete, production testing pending

### Next Steps
1. Run `deploy.bat` (Windows) or `deploy.sh` (Mac/Linux)
2. Grant service account permissions (Firestore, Vertex AI)
3. Test health endpoint
4. Test training endpoint from WordPress

### Production URL (When Deployed)
```
https://phoneease-middleware-375589245036.us-central1.run.app
```

## WordPress Integration

### How WordPress Connects

WordPress plugin makes HTTP POST requests to the `/api/v1/train` endpoint when users interact with the AI Training interface.

**WordPress Side:**
- File: `includes/class-phoneease-ajax-handlers.php`
- Method: `handle_train_ai()`
- Endpoint: Hardcoded middleware URL

**Request Flow:**
1. User sends message in AI Training chat
2. WordPress AJAX handler receives request
3. Handler retrieves `site_token` from options
4. Handler calls middleware `/api/v1/train` endpoint
5. Middleware processes request (Firestore + Vertex AI)
6. Middleware returns AI response
7. WordPress displays response in chat interface

### Integration Testing

After deployment, test the integration:

1. **From WordPress:**
   - Go to: PhoneEase → AI Training
   - Send test message: "What are your business hours?"
   - Verify AI response appears

2. **Check Firestore:**
   - Go to Firebase Console
   - Verify customer document created
   - Verify `training_used` incremented

3. **Check Cloud Run Logs:**
   ```bash
   gcloud run logs read phoneease-middleware --region us-central1 --limit 50
   ```

## Testing

### Local Testing

1. Start local server:
   ```bash
   npm start
   ```

2. Test health endpoint:
   ```bash
   curl http://localhost:8080/health
   ```

3. Test training endpoint:
   ```bash
   curl -X POST http://localhost:8080/api/v1/train \
     -H "Content-Type: application/json" \
     -d '{
       "site_token": "test_token_123",
       "message": "What are your business hours?",
       "business_info": {
         "business_name": "Test Business"
       }
     }'
   ```

### Production Testing

After deployment:

1. Health check:
   ```bash
   curl https://phoneease-middleware-375589245036.us-central1.run.app/health
   ```

2. Training endpoint:
   ```bash
   curl -X POST https://phoneease-middleware-375589245036.us-central1.run.app/api/v1/train \
     -H "Content-Type: application/json" \
     -d '{
       "site_token": "kv6tFnZDDsxPqXWh54RjnbyNNLbVjdxp",
       "message": "What are your business hours?",
       "business_info": {
         "business_name": "OTDNews"
       }
     }'
   ```

3. Verify response:
   ```json
   {
     "success": true,
     "ai_response": "Thank you for contacting OTDNews. How can I help you today?",
     "tokens_used": 42
   }
   ```

## Security Notes

- The `/api/v1/train` endpoint is currently unauthenticated
- Rate limiting is enforced via Firestore `training_limit` field
- In production, consider adding API key authentication
- Firestore security rules should restrict write access
- Site tokens act as customer identifiers, not authentication tokens

## Monitoring and Maintenance

### Monitoring

**Cloud Run Metrics:**
- Request count
- Error rate
- Latency
- Memory usage
- CPU usage

**Firestore Metrics:**
- Document reads/writes
- Storage usage
- Customer count

**Vertex AI Metrics:**
- API requests per day
- Tokens per minute
- Error rate

### Logs

View real-time logs:
```bash
gcloud run logs tail phoneease-middleware --region us-central1
```

View recent logs:
```bash
gcloud run logs read phoneease-middleware --region us-central1 --limit 100
```

Filter by severity:
```bash
gcloud run logs read phoneease-middleware --region us-central1 --log-filter="severity>=ERROR"
```

### Maintenance

**Regular Tasks:**
- Monitor error logs weekly
- Review Firestore customer records
- Check API quota usage
- Update dependencies monthly
- Review security patches

**Scaling:**
- Cloud Run auto-scales from 0 to 100 instances
- No manual scaling required
- Monitor costs as usage grows
- Consider reserved instances for high traffic

## Future Endpoints

### POST /api/v1/webhooks/twilio/voice (Planned)

Handle incoming phone calls via Twilio webhook.

**Request:** TwiML from Twilio
**Response:** TwiML for AI response

### POST /api/v1/webhooks/twilio/sms (Planned)

Handle incoming SMS messages via Twilio webhook.

**Request:** SMS from Twilio
**Response:** TwiML for AI response

## Contributing

This is a private repository for PhoneEase infrastructure. For bug reports or feature requests, contact the development team.

## License

MIT License - PhoneEase Team
