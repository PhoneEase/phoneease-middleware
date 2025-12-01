#!/bin/bash
#
# PhoneEase Middleware Deployment Script
#
# Deploys middleware to Google Cloud Run
# Run from the phoneease-middleware directory

set -e  # Exit on error

echo "======================================"
echo "PhoneEase Middleware Deployment"
echo "======================================"
echo ""

# Configuration
PROJECT_ID="white-airship-479502-r1"
REGION="us-central1"
SERVICE_NAME="phoneease-middleware"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check authentication
echo "Checking authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "Error: Not authenticated with gcloud"
    echo "Run: gcloud auth login"
    exit 1
fi

# Set project
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Deploy to Cloud Run
echo ""
echo "Deploying to Cloud Run..."
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,VERTEX_AI_LOCATION=$REGION,VERTEX_AI_MODEL=gemini-2.0-flash-exp"

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo ""
echo "======================================"
echo "Deployment Complete!"
echo "======================================"
echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "Test endpoints:"
echo "  Health: curl $SERVICE_URL/health"
echo "  Train:  curl -X POST $SERVICE_URL/api/v1/train -H 'Content-Type: application/json' -d '{\"site_token\":\"kv6tFnZDDsxPqXWh54RjnbyNNLbVjdxp\",\"message\":\"Test\",\"business_info\":{\"business_name\":\"OTDNews\"}}'"
echo ""
