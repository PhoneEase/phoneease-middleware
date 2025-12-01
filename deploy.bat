@echo off
REM PhoneEase Middleware Deployment Script (Windows)
REM
REM Deploys middleware to Google Cloud Run
REM Run from the phoneease-middleware directory

echo ======================================
echo PhoneEase Middleware Deployment
echo ======================================
echo.

REM Configuration
set PROJECT_ID=white-airship-479502-r1
set REGION=us-central1
set SERVICE_NAME=phoneease-middleware

REM Check if gcloud is installed
where gcloud >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: gcloud CLI is not installed
    echo Install from: https://cloud.google.com/sdk/docs/install
    exit /b 1
)

REM Set project
echo Setting project to %PROJECT_ID%...
gcloud config set project %PROJECT_ID%

REM Deploy to Cloud Run
echo.
echo Deploying to Cloud Run...
echo Region: %REGION%
echo Service: %SERVICE_NAME%
echo.

gcloud run deploy %SERVICE_NAME% ^
  --source . ^
  --region %REGION% ^
  --allow-unauthenticated ^
  --set-env-vars "GOOGLE_CLOUD_PROJECT=%PROJECT_ID%,VERTEX_AI_LOCATION=%REGION%,VERTEX_AI_MODEL=gemini-2.0-flash-exp"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Deployment failed!
    exit /b 1
)

REM Get service URL
for /f "delims=" %%i in ('gcloud run services describe %SERVICE_NAME% --region=%REGION% --format="value(status.url)"') do set SERVICE_URL=%%i

echo.
echo ======================================
echo Deployment Complete!
echo ======================================
echo.
echo Service URL: %SERVICE_URL%
echo.
echo Test endpoints:
echo   Health: curl %SERVICE_URL%/health
echo   Train:  curl -X POST %SERVICE_URL%/api/v1/train -H "Content-Type: application/json" -d "{\"site_token\":\"kv6tFnZDDsxPqXWh54RjnbyNNLbVjdxp\",\"message\":\"Test\",\"business_info\":{\"business_name\":\"OTDNews\"}}"
echo.
