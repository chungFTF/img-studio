# ImgStudio 本地開發環境設置指南

本文件記錄在本地運行 ImgStudio 所需的 GCP 配置步驟。

## 前置需求

- Google Cloud SDK (gcloud) 已安裝並登入
- Node.js 18+ 和 npm
- 有權限存取的 GCP 專案

## 專案配置資訊

| 項目 | 值 |
|------|-----|
| Project ID | poc-55-genai |
| Region | us-west1 |
| 服務帳戶 | fifty-five-imgstudio-sa@poc-55-genai.iam.gserviceaccount.com |

---

## 1. 建立 Cloud Storage 儲存桶

建立以下 3 個儲存桶：

```bash
gcloud config set project poc-55-genai

# 輸出內容儲存桶
gcloud storage buckets create gs://poc-55-genai-imgstudio-output \
  --location=us-west1 \
  --uniform-bucket-level-access

# 共享內容儲存桶
gcloud storage buckets create gs://poc-55-genai-imgstudio-library \
  --location=us-west1 \
  --uniform-bucket-level-access

# 配置文件儲存桶
gcloud storage buckets create gs://poc-55-genai-imgstudio-config \
  --location=us-west1 \
  --uniform-bucket-level-access
```

## 2. 上傳配置文件

將 `export-fields-options.json` 上傳到配置儲存桶：

```bash
gcloud storage cp export-fields-options.json \
  gs://poc-55-genai-imgstudio-config/export-fields-options.json
```

## 3. 設置服務帳戶權限

授予服務帳戶存取儲存桶的權限：

```bash
SA_EMAIL="fifty-five-imgstudio-sa@poc-55-genai.iam.gserviceaccount.com"

for bucket in poc-55-genai-imgstudio-config poc-55-genai-imgstudio-output poc-55-genai-imgstudio-library; do
  gcloud storage buckets add-iam-policy-binding gs://$bucket \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/storage.objectUser"
done
```

## 4. 設置本地認證 (服務帳戶模擬)

由於無法建立服務帳戶金鑰，使用服務帳戶模擬方式認證。

### 4.1 授予模擬權限

```bash
gcloud iam service-accounts add-iam-policy-binding \
  fifty-five-imgstudio-sa@poc-55-genai.iam.gserviceaccount.com \
  --member="user:YOUR_EMAIL@fifty-five.com" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project=poc-55-genai
```

### 4.2 設置應用程式預設憑證

```bash
gcloud auth application-default login \
  --impersonate-service-account=fifty-five-imgstudio-sa@poc-55-genai.iam.gserviceaccount.com
```

執行後會開啟瀏覽器進行 OAuth 認證，完成後憑證會儲存在：
`~/.config/gcloud/application_default_credentials.json`

## 5. 建立環境變數檔案

在專案根目錄建立 `.env.local` 檔案：

```bash
# GCP 專案配置
NEXT_PUBLIC_PROJECT_ID=poc-55-genai
NEXT_PUBLIC_VERTEX_API_LOCATION=us-west1
NEXT_PUBLIC_GCS_BUCKET_LOCATION=us-west1

# Gemini 模型
NEXT_PUBLIC_GEMINI_MODEL=gemini-2.0-flash-001

# 用戶 ID 過濾器
NEXT_PUBLIC_PRINCIPAL_TO_USER_FILTERS=@fifty-five.com

# Cloud Storage 儲存桶
NEXT_PUBLIC_OUTPUT_BUCKET=poc-55-genai-imgstudio-output
NEXT_PUBLIC_TEAM_BUCKET=poc-55-genai-imgstudio-library

# 配置文件 URI
NEXT_PUBLIC_EXPORT_FIELDS_OPTIONS_URI=gs://poc-55-genai-imgstudio-config/export-fields-options.json

# 本地開發用戶 ID
NEXT_PUBLIC_TEST_DEV_USER_ID=local-dev-user

# 功能開關
NEXT_PUBLIC_EDIT_ENABLED=false
NEXT_PUBLIC_VEO_ENABLED=true
NEXT_PUBLIC_VEO_ITV_ENABLED=false
NEXT_PUBLIC_VEO_ADVANCED_ENABLED=false
```

## 6. 啟動開發伺服器

```bash
npm install
npm run dev
```

開啟瀏覽器存取 http://localhost:3000

---

## 疑難排解

### 錯誤：Cannot sign data without client_email

原因：本地使用用戶憑證無法進行 GCS URL 簽名。

解決方案：確保已執行步驟 4 設置服務帳戶模擬。

### 錯誤：Could not fetch export metadata options

原因：服務帳戶無權存取配置儲存桶。

解決方案：確保已執行步驟 3 授予儲存桶權限。

### 錯誤：Error loading your profile content

原因：缺少必要的環境變數。

解決方案：確認 `.env.local` 檔案存在且包含所有必要變數。

---

## 相關文件

- 完整部署指南：README.md
- 匯出欄位配置：export-fields-options.json

