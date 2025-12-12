# ImgStudio 程式碼架構概覽

ImgStudio 是一個基於 Next.js 14 的 Web 應用程式，提供使用 Google Vertex AI 的 Imagen 和 Veo 模型進行圖片生成、編輯和視頻生成的功能。

---

## 技術堆疊

| 技術 | 用途 |
|------|------|
| Next.js 14 (App Router) | React 框架，使用 Server Actions |
| Material UI (MUI) | UI 元件庫 |
| Google Cloud Storage | 儲存生成的媒體檔案 |
| Google Vertex AI | Imagen (圖片) 和 Veo (視頻) API |
| Firestore | 儲存媒體元資料，用於 Library 功能 |
| Google IAP | 身份認證 (生產環境) |

---

## 目錄結構

```
app/
├── layout.tsx              # 根佈局，設置 MUI Theme 和 Context Provider
├── page.tsx                # 首頁，顯示 Logo 和登入按鈕
├── routes.tsx              # 定義三個主要頁面路由
├── theme.ts                # MUI 主題配置
├── globals.css             # 全域 CSS
│
├── (studio)/               # 主要功能頁面群組
│   ├── layout.tsx          # 側邊導航佈局
│   ├── generate/page.tsx   # 生成頁面 (圖片/視頻)
│   ├── edit/page.tsx       # 編輯頁面 (圖片編輯)
│   └── library/page.tsx    # 素材庫頁面 (瀏覽共享內容)
│
├── api/                    # Server Actions (後端邏輯)
│   ├── imagen/action.tsx   # Imagen API 呼叫
│   ├── veo/action.tsx      # Veo API 呼叫
│   ├── gemini/action.tsx   # Gemini API (用於 prompt 優化)
│   ├── cloud-storage/      # GCS 操作 (上傳/下載/簽名 URL)
│   ├── firestore/          # Firestore 操作 (元資料儲存)
│   ├── google-auth/        # IAP 認證
│   └── vertex-seg/         # 圖片分割模型 (編輯功能用)
│
├── context/
│   └── app-context.tsx     # React Context，管理全域狀態
│
└── ui/                     # UI 元件
    ├── generate-components/  # 生成頁面專用元件
    ├── edit-components/      # 編輯頁面專用元件
    ├── library-components/   # 素材庫頁面專用元件
    ├── transverse-components/ # 跨頁面共用元件
    └── ux-components/        # 通用 UI 元件
```

---

## 核心功能模組

### 1. 圖片生成 (Imagen)

**檔案**: `app/api/imagen/action.tsx`

主要函式:
- `generateImage()` - 使用 Imagen 4 生成圖片
- `editImage()` - 使用 Imagen 3 編輯圖片
- `upscaleImage()` - 放大圖片解析度

流程:
1. 使用 Google Auth Library 取得認證
2. 建構 prompt (加入風格、參數等)
3. 呼叫 Vertex AI Imagen API
4. 將結果儲存到 GCS
5. 產生 Signed URL 供前端顯示

支援功能:
- Text-to-Image 文字生成圖片
- Reference Images 參考圖片 (風格/主體)
- Negative Prompt 負面提示詞
- 多種比例和輸出格式

### 2. 視頻生成 (Veo)

**檔案**: `app/api/veo/action.tsx`

主要函式:
- `generateVideo()` - 發起視頻生成請求 (Long Running Operation)
- `getVideoGenerationStatus()` - 輪詢生成狀態

流程:
1. 發送請求到 Veo API，取得 Operation Name
2. 前端進行輪詢，使用指數退避策略
3. 完成後從 GCS 取得視頻並產生 Signed URL

支援功能:
- Text-to-Video 文字生成視頻
- Image-to-Video 圖片生成視頻
- Interpolation 插值 (兩張圖片之間生成視頻)
- Camera Presets 相機預設動作
- Audio Generation 音訊生成 (Veo 3)

### 3. 圖片編輯

**檔案**: `app/(studio)/edit/page.tsx`, `app/ui/edit-components/`

功能:
- Inpainting 區域重繪
- Outpainting 圖片擴展
- Background Swap 背景替換
- Upscale 放大

需要:
- `imagen-3.0-capability-001` 編輯模型
- `image-segmentation-001` 分割模型 (自動遮罩)

### 4. 素材庫 (Library)

**檔案**: `app/(studio)/library/page.tsx`

功能:
- 瀏覽團隊共享的媒體內容
- 按 metadata 篩選 (團隊、平台、品牌等)
- 匯出到 Library
- 批次刪除

資料來源:
- Firestore 儲存元資料
- GCS Team Bucket 儲存實際檔案

---

## 資料流程

### 生成圖片流程

```
使用者輸入 Prompt
        ↓
GenerateForm 元件收集參數
        ↓
呼叫 generateImage() Server Action
        ↓
Imagen API 生成圖片 → 儲存到 GCS
        ↓
產生 Signed URL
        ↓
OutputImagesDisplay 顯示結果
        ↓
(可選) 匯出到 Library → Firestore 儲存元資料
```

### 生成視頻流程

```
使用者輸入 Prompt
        ↓
GenerateForm 元件收集參數
        ↓
呼叫 generateVideo() → 取得 Operation Name
        ↓
前端開始輪詢 (Polling)
        ↓
getVideoGenerationStatus() 檢查狀態
        ↓
完成後從 GCS 取得視頻
        ↓
VeoOutputVideosDisplay 顯示結果
```

---

## Context 狀態管理

**檔案**: `app/context/app-context.tsx`

管理的狀態:
- `userID` - 當前使用者 ID
- `gcsURI` - 輸出儲存桶 URI
- `exportMetaOptions` - 匯出欄位配置
- `isLoading` - 載入狀態
- `imageToEdit` - 傳遞給編輯頁面的圖片
- `imageToVideo` - 傳遞給視頻生成的圖片
- `promptToGenerateImage/Video` - 跨頁面傳遞的 prompt

初始化流程:
1. 驗證環境變數是否完整
2. 取得使用者 ID (本地開發用 TEST_DEV_USER_ID，生產用 IAP)
3. 從 GCS 載入 export-fields-options.json 配置

---

## 環境變數

| 變數 | 用途 |
|------|------|
| `NEXT_PUBLIC_PROJECT_ID` | GCP 專案 ID |
| `NEXT_PUBLIC_VERTEX_API_LOCATION` | Vertex AI API 區域 |
| `NEXT_PUBLIC_GCS_BUCKET_LOCATION` | GCS 儲存桶區域 |
| `NEXT_PUBLIC_OUTPUT_BUCKET` | 輸出內容儲存桶 |
| `NEXT_PUBLIC_TEAM_BUCKET` | 共享內容儲存桶 |
| `NEXT_PUBLIC_EXPORT_FIELDS_OPTIONS_URI` | 匯出欄位配置檔 URI |
| `NEXT_PUBLIC_GEMINI_MODEL` | Gemini 模型名稱 |
| `NEXT_PUBLIC_TEST_DEV_USER_ID` | 本地開發用使用者 ID |
| `NEXT_PUBLIC_EDIT_ENABLED` | 啟用編輯功能 |
| `NEXT_PUBLIC_VEO_ENABLED` | 啟用 Veo 視頻生成 |

---

## 關鍵 UI 元件

### 生成相關
- `GenerateForm` - 主要表單，處理 prompt 輸入和參數設定
- `GenerateSettings` - 進階設定 (模型版本、比例、輸出格式等)
- `ReferencePicker` - 參考圖片選擇器
- `ImageDropzone` - 拖放上傳圖片
- `VideoInterpolBox` - 視頻插值設定

### 編輯相關
- `EditForm` - 編輯表單
- `MaskCanvas` - 遮罩繪製畫布
- `SetMaskDialog` - 遮罩設定對話框
- `UpscaleDialog` - 放大設定對話框

### 輸出顯示
- `ImagenOutputImagesDisplay` - 顯示生成的圖片
- `VeoOutputVideosDisplay` - 顯示生成的視頻
- `ExportDialog` - 匯出到 Library 對話框
- `DownloadDialog` - 下載對話框

### 導航
- `SideNavigation` - 側邊導航列

---

## 認證機制

### 本地開發
使用 `NEXT_PUBLIC_TEST_DEV_USER_ID` 環境變數模擬使用者 ID。

### 生產環境
透過 Google IAP (Identity-Aware Proxy) 認證:
1. 使用者透過 IAP 登入
2. `/api/google-auth/route.ts` 解析 IAP header 取得使用者資訊
3. 根據 `PRINCIPAL_TO_USER_FILTERS` 從 email 提取使用者 ID

---

## GCS 儲存結構

```
OUTPUT_BUCKET/
└── {userID}/
    ├── generated-images/
    │   └── {uniqueFolderId}/
    │       └── sample_0.png
    ├── edited-images/
    │   └── {uniqueFolderId}/
    │       └── sample_0.png
    ├── generated-videos/
    │   └── {videoFile}.mp4
    └── upscaled-images/
        └── {imageFile}.png

TEAM_BUCKET/
└── {mediaId}    # 匯出到 Library 的檔案
```

---

## 部署架構

生產環境部署於 Google Cloud:

```
使用者 → Cloud DNS → Load Balancer → IAP → Cloud Run → Vertex AI
                                              ↓
                                        Cloud Storage
                                              ↓
                                         Firestore
```

