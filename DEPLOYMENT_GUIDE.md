# ImgStudio GCP Deployment Guide

Project: `poc-55-genai`
Region: `us-west1`

---

## Step 0: Setup Vertex AI and Model Access

```bash
# 確認專案設定
gcloud config set project poc-55-genai

# 啟用必要的 API
gcloud services enable aiplatform.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable iap.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable dns.googleapis.com
gcloud services enable compute.googleapis.com
```

**模型訪問狀態：**
| 模型 | 狀態 |
|------|------|
| Imagen 4 (imagen-4.0-generate-001) | Public Preview |
| Imagen 3 Editing (imagen-3.0-capability-001) | 需申請 |
| Image Segmentation (image-segmentation-001) | 需申請 |
| Veo 3.1 (veo-3.1-generate-001) | GA |
| Veo 3.1 Fast (veo-3.1-fast-generate-001) | GA |
| Veo 2 (veo-2.0-generate-001) | Public GA |
| Gemini 2.0 Flash (gemini-2.0-flash-exp) | Public |
| Gemini 2.5 Flash Image (gemini-2.5-flash-image) | Public |
| Gemini 3 Pro Image (gemini-3-pro-image-preview) | Preview (Global endpoint) |

---

## Step 1: Create Cloud Storage Buckets (已完成)

你的 buckets：
- Output: `poc-55-genai-imgstudio-output`
- Library: `poc-55-genai-imgstudio-library`
- Config: `poc-55-genai-imgstudio-config`

確認 `export-fields-options.json` 已上傳到 config bucket。

---

## Step 2: Setup Cloud Build Trigger

### 2.1 Fork Repository
1. 前往 https://github.com/aduboue/img-studio
2. 點擊右上角 **Fork** 按鈕
3. 將代碼 fork 到你的 GitHub 帳戶

### 2.2 Create Cloud Build Trigger

前往 [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers?project=poc-55-genai)

**設定：**
- Name: `imgstudio-deploy`
- Event: `Manual invocation`
- Source: 連接你 fork 的 GitHub repository
- Configuration: `Cloud Build configuration file (yaml)`
- Location: `/cloudbuild.yaml`

**Substitution Variables:**
```
_NEXT_PUBLIC_VERTEX_API_LOCATION = us-west1
_NEXT_PUBLIC_GCS_BUCKET_LOCATION = us-west1
_NEXT_PUBLIC_GEMINI_MODEL = gemini-2.0-flash-001
_NEXT_PUBLIC_OUTPUT_BUCKET = poc-55-genai-imgstudio-output
_NEXT_PUBLIC_TEAM_BUCKET = poc-55-genai-imgstudio-library
_NEXT_PUBLIC_EXPORT_FIELDS_OPTIONS_URI = gs://poc-55-genai-imgstudio-config/export-fields-options.json
_NEXT_PUBLIC_PRINCIPAL_TO_USER_FILTERS = @fifty-five.com
_NEXT_PUBLIC_EDIT_ENABLED = true
_NEXT_PUBLIC_SEG_MODEL = image-segmentation-001
_NEXT_PUBLIC_VEO_ENABLED = true
_NEXT_PUBLIC_VEO_ITV_ENABLED = false
_NEXT_PUBLIC_VEO_ADVANCED_ENABLED = false
```

**Service Account:** 使用預設的 Cloud Build service account

### 2.3 Run Build
手動執行 build，等待完成。

---

## Step 3: Enable IAP and Configure OAuth Consent Screen

### 3.1 Enable IAP API
```bash
gcloud services enable iap.googleapis.com
```

### 3.2 Configure OAuth Consent Screen
前往 [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent?project=poc-55-genai)

- User Type: `Internal` (限制為你的 GCP org domain)
- App Name: `imgstudio`
- User Support Email: 你的 email
- Developer Contact Email: 你的 email

---

## Step 4: Create Application Service Account

```bash
# 創建 Service Account
gcloud iam service-accounts create imgstudio-sa \
  --display-name="ImgStudio Service Account" \
  --project=poc-55-genai

# 授予角色
gcloud projects add-iam-policy-binding poc-55-genai \
  --member="serviceAccount:imgstudio-sa@poc-55-genai.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding poc-55-genai \
  --member="serviceAccount:imgstudio-sa@poc-55-genai.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding poc-55-genai \
  --member="serviceAccount:imgstudio-sa@poc-55-genai.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding poc-55-genai \
  --member="serviceAccount:imgstudio-sa@poc-55-genai.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"

gcloud projects add-iam-policy-binding poc-55-genai \
  --member="serviceAccount:imgstudio-sa@poc-55-genai.iam.gserviceaccount.com" \
  --role="roles/storage.objectUser"

gcloud projects add-iam-policy-binding poc-55-genai \
  --member="serviceAccount:imgstudio-sa@poc-55-genai.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

---

## Step 5: Deploy Cloud Run Service

前往 [Cloud Run](https://console.cloud.google.com/run?project=poc-55-genai)

1. Deploy Container > Service
2. Container image: 從 Artifact Registry 選擇剛 build 的 image
3. Name: `imgstudio-app`
4. Region: `us-west1`
5. Authentication: `Require authentication`
6. Ingress: `Internal` > `Allow traffic from external Application Load Balancers`
7. Container port: `3000`
8. Service account: `imgstudio-sa@poc-55-genai.iam.gserviceaccount.com`

---

## Step 6: Grant IAP Permissions on Cloud Run

```bash
# 創建 IAP service account
gcloud beta services identity create \
  --service=iap.googleapis.com \
  --project=poc-55-genai

# 輸出格式: service-PROJECT_NUMBER@gcp-sa-iap.iam.gserviceaccount.com
```

前往 Cloud Run > Services > 選擇 `imgstudio-app`
- Permissions > Add Principal
- 輸入 IAP service account
- Role: `Cloud Run Invoker`

---

## Step 7: Create DNS Zone

前往 [Cloud DNS](https://console.cloud.google.com/net-services/dns/zones?project=poc-55-genai)

- Zone Name: `imgstudio`
- DNS Name: `imgstudio.YOUR_DOMAIN` (替換為你的域名)
- DNSSEC: Off

---

## Step 8: Create Load Balancer and SSL Certificate

前往 [Load Balancing](https://console.cloud.google.com/net-services/loadbalancing/list/loadBalancers?project=poc-55-genai)

1. Create Load Balancer
2. Type: Application Load Balancer (HTTP/HTTPS)
3. Public Facing, Global

**Frontend:**
- Protocol: HTTPS
- Certificate: Create new Google-managed certificate
- Domain: `imgstudio.YOUR_DOMAIN`

**Backend:**
- Create Backend Service
- Backend type: Serverless Network Endpoint Group
- Create NEG pointing to `imgstudio-app` Cloud Run service

---

## Step 9: Create DNS Record

1. 複製 Load Balancer 的 IP 地址
2. Cloud DNS > 你的 zone > Add Record Set
3. Type: A
4. IPv4 Address: Load Balancer IP

---

## Step 10: Enable IAP and Grant User Access

前往 [Identity-Aware Proxy](https://console.cloud.google.com/security/iap?project=poc-55-genai)

1. 為你的 backend service 啟用 IAP
2. Add Principal > 輸入用戶 email
3. Role: `IAP-secured Web App User`

---

## Step 11: Create Firestore Database

```bash
# 創建 Firestore 資料庫
gcloud firestore databases create \
  --location=us-west1 \
  --type=firestore-native \
  --project=poc-55-genai
```

### Create Composite Index
前往 [Firestore Indexes](https://console.cloud.google.com/firestore/databases/-default-/indexes?project=poc-55-genai)

- Collection ID: `metadata`
- Fields:
  - `combinedFilters` - Array contains
  - `timestamp` - Descending
  - `__name__` - Descending

### Setup Security Rules
前往 Firebase Console > Firestore > Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, get, list, create, update: if
        get(/databases/$(database)/documents/request.auth.uid).data.serviceAccount == 'imgstudio-sa@poc-55-genai.iam.gserviceaccount.com';
      allow delete: if false;
    }
  }
}
```

---

## Deployment Complete

訪問: `https://imgstudio.YOUR_DOMAIN`

---

## Quick Deploy Script

以下命令可以一次執行多個設定步驟：

```bash
PROJECT_ID="poc-55-genai"
REGION="us-west1"
SA_NAME="imgstudio-sa"

# 啟用所有 API
gcloud services enable \
  aiplatform.googleapis.com \
  storage.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  iap.googleapis.com \
  firestore.googleapis.com \
  dns.googleapis.com \
  compute.googleapis.com \
  --project=$PROJECT_ID

# 創建 Service Account 並授予角色
gcloud iam service-accounts create $SA_NAME \
  --display-name="ImgStudio Service Account" \
  --project=$PROJECT_ID

for role in \
  "roles/datastore.user" \
  "roles/logging.logWriter" \
  "roles/secretmanager.secretAccessor" \
  "roles/iam.serviceAccountTokenCreator" \
  "roles/storage.objectUser" \
  "roles/aiplatform.user"; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="$role"
done

echo "Service Account created: ${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
```

