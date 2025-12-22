#!/bin/bash
set -e

PROJECT_ID="poc-55-genai"
REGION="asia-east1"
SERVICE_NAME="fifty-five-imgstudio-app"

echo "🚀 Starting deployment to Cloud Run..."
echo "📦 Project: ${PROJECT_ID}"
echo "🌏 Region: ${REGION}"
echo "🚢 Service: ${SERVICE_NAME}"
echo ""

# Step 1: Build Docker image with Cloud Build
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1: Building Docker image..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions="\
_NEXT_PUBLIC_VERTEX_API_LOCATION=us-west1,\
_NEXT_PUBLIC_GCS_BUCKET_LOCATION=us-west1,\
_NEXT_PUBLIC_GEMINI_MODEL=gemini-2.0-flash-001,\
_NEXT_PUBLIC_OUTPUT_BUCKET=${PROJECT_ID}-imgstudio-output,\
_NEXT_PUBLIC_TEAM_BUCKET=${PROJECT_ID}-imgstudio-library,\
_NEXT_PUBLIC_EXPORT_FIELDS_OPTIONS_URI=gs://${PROJECT_ID}-imgstudio-config/export-fields-options.json,\
_NEXT_PUBLIC_PRINCIPAL_TO_USER_FILTERS=@fifty-five.com,\
_NEXT_PUBLIC_EDIT_ENABLED=true,\
_NEXT_PUBLIC_SEG_MODEL=image-segmentation-001,\
_NEXT_PUBLIC_VEO_ENABLED=true,\
_NEXT_PUBLIC_VEO_ITV_ENABLED=true,\
_NEXT_PUBLIC_VEO_ADVANCED_ENABLED=false" \
  --project=${PROJECT_ID}

if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo ""
echo "✅ Build completed successfully!"
echo ""

# Step 2: Deploy to Cloud Run
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚢 Step 2: Deploying to Cloud Run..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get the service account being used
SA_EMAIL=$(gcloud run services describe ${SERVICE_NAME} \
  --region=${REGION} \
  --project=${PROJECT_ID} \
  --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null || echo "fifty-five-imgstudio-sa@${PROJECT_ID}.iam.gserviceaccount.com")

echo "Using service account: ${SA_EMAIL}"

gcloud run deploy ${SERVICE_NAME} \
  --image=gcr.io/${PROJECT_ID}/img-studio:latest \
  --region=${REGION} \
  --platform=managed \
  --service-account=${SA_EMAIL} \
  --no-allow-unauthenticated \
  --port=3000 \
  --project=${PROJECT_ID}

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed!"
  exit 1
fi

echo ""
echo "✅ Deployment completed successfully!"
echo ""

# Step 3: Verify IAP configuration
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 Step 3: Verifying IAP configuration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region=${REGION} \
  --project=${PROJECT_ID} \
  --format="value(status.url)")

echo "Service URL: ${SERVICE_URL}"
echo ""
echo "✅ IAP should be configured at the Load Balancer level"
echo "🔗 Check IAP: https://console.cloud.google.com/security/iap?project=${PROJECT_ID}"
echo ""

# Step 4: Show deployment info
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Deployment Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Image: gcr.io/${PROJECT_ID}/img-studio:latest"
echo "✅ Service: ${SERVICE_NAME}"
echo "✅ Region: ${REGION}"
echo "✅ Service Account: ${SA_EMAIL}"
echo "✅ Service URL: ${SERVICE_URL}"
echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Access via Load Balancer URL (with IAP)"
echo "  2. Verify IAP users have access"
echo "  3. Test new features:"
echo "     - Image-to-video (Veo 3.1)"
echo "     - Enhanced loading animations"
echo "     - Metadata tracking with tokens/costs"
echo "     - History page (/history)"
echo ""
