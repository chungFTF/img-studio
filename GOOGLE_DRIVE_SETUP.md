# Google Drive Integration Setup

## 📋 Overview
This application now supports saving generated images and videos directly to Google Drive. Users can:
- Connect their Google Drive account
- Select a destination folder (or create new folders)
- Save files with one click from the History page

## 🔧 Setup Instructions

### 1. Enable Google Drive API in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `${NEXT_PUBLIC_PROJECT_ID}`
3. Navigate to **APIs & Services** > **Library**
4. Search for "Google Drive API"
5. Click **Enable**

### 2. Create OAuth 2.0 Client ID

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Choose **Application type**: **Web application**
4. **Name**: `ImgStudio Web Client`
5. **Authorized JavaScript origins**:
   - `http://localhost:3000` (for local development)
   - `https://your-production-domain.com` (for production)
6. **Authorized redirect URIs**:
   - `http://localhost:3000` (for local development)
   - `https://your-production-domain.com` (for production)
7. Click **Create**
8. **Copy the Client ID**

### 3. (Optional) Create API Key for Google Picker

**Note:** API Key is optional. Google Picker can work without it using only OAuth token.

If you want to create one:

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **API key**
3. Copy the API key
4. (Optional) Click **Restrict key** to add restrictions:
   - Under "Application restrictions", select "HTTP referrers (web sites)"
   - Add your domain (e.g., `localhost:3000`, `your-domain.com`)
   - Under "API restrictions", select "Restrict key"
   - Choose "Google Drive API" and "Google Picker API"

### 4. Configure Environment Variables

Create or update your `.env.local` file in the project root:

```bash
# Copy this to .env.local and replace with your actual values
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com

# Optional: API Key for Google Picker (can work without it)
# NEXT_PUBLIC_GOOGLE_API_KEY=your-api-key-here
```

**Important Notes:**
- Variables **MUST** start with `NEXT_PUBLIC_` to be accessible in the browser
- **Required:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - Get from Google Cloud Console > APIs & Services > Credentials
- **Optional:** `NEXT_PUBLIC_GOOGLE_API_KEY` - Only needed if you want additional quota/analytics
- Client ID format: `1234567890-abcdefg.apps.googleusercontent.com`
- API Key format: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- Restart your dev server after adding these variables

### 5. Deploy Changes

If using Cloud Run:
```bash
# Build and deploy
npm run build
gcloud run deploy imgstudio --set-env-vars NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here
```

## 🎯 Features

### User Flow

1. **Connect Google Drive**
   - User clicks "Connect Google Drive" button in the sidebar
   - OAuth consent screen appears
   - User grants permission to access Drive files
   - Connection status shows "Drive Connected"

2. **Save to Drive**
   - Navigate to History page
   - Find the image/video you want to save
   - Click the cloud upload icon (📤) next to the item
   - Dialog opens showing:
     - List of existing folders
     - Option to create new folder
     - Selected destination
   - Click "Save to Drive"
   - File is uploaded to selected folder

3. **Manage Connection**
   - Click "Disconnect" to revoke access
   - Token is cleared from browser
   - Can reconnect anytime

## 🔐 Security & Privacy

- **Scope**: `https://www.googleapis.com/auth/drive.file`
  - Only files created by this app are accessible
  - Cannot read or modify other Drive files
- **Token Storage**: Access tokens stored in browser localStorage
- **Token Expiry**: Tokens automatically expire after 1 hour
- **Revocation**: Users can disconnect anytime

## 📁 File Structure

```
app/
├── api/
│   └── google-drive/
│       └── action.tsx           # Server-side Drive API functions
├── context/
│   └── google-drive-context.tsx # Client-side OAuth & state management
└── ui/
    └── transverse-components/
        ├── GoogleDriveSaveDialog.tsx  # Folder picker dialog
        └── GoogleDriveStatus.tsx      # Connection status widget
```

## 🧪 Testing

### Local Development

1. Start dev server: `npm run dev`
2. Navigate to History page
3. Click "Connect Google Drive"
4. Grant permissions in OAuth consent screen
5. Try saving a file to different folders

### Common Issues

**Issue**: "Google Drive is not configured"
- **Cause**: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is not set or empty
- **Solution**: 
  1. Make sure you created the `.env.local` file
  2. Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id`
  3. Restart dev server: `npm run dev`

**Issue**: "Google Drive services are still loading. Please wait a moment and try again."
- **Cause**: Google Identity Services script is still loading
- **Solution**: 
  1. Wait 2-3 seconds and try again
  2. Check browser console for errors
  3. Make sure you're not blocking third-party scripts

**Issue**: "Failed to load Google Drive services"
- **Cause**: Google Identity Services script failed to load
- **Solution**:
  1. Check your internet connection
  2. Disable ad blockers or privacy extensions
  3. Check browser console for specific errors
  4. Try a different browser

**Issue**: "Failed to connect to Google Drive"
- **Solution**: 
  - Verify Client ID is correct and matches your OAuth credentials
  - Check that authorized JavaScript origins are configured
  - Clear browser cache and try again

**Issue**: "Upload failed" error
- **Solution**: 
  - Verify Drive API is enabled in Google Cloud Console
  - Check network tab for specific error messages
  - Ensure file URL is accessible
  - Try reconnecting your Google Drive account

**Issue**: Connection button is disabled
- **Cause**: Google Identity Services is not ready yet
- **Solution**: Wait for the page to fully load (status will show "Loading Google Drive...")

## 🎨 UI Components

### GoogleDriveStatus
- Displays connection status in sidebar
- Connect/Disconnect buttons
- Shows cloud icon with status color

### GoogleDriveSaveDialog
- Modal dialog for file saving
- Folder list with selection
- Create new folder functionality
- Progress indicators

### History Page Integration
- Cloud upload icon button on each item
- Positioned next to delete button
- Disabled if file URL not available

## 📊 API Functions

### `listDriveFolders(accessToken)`
- Lists all folders in user's Drive
- Returns: `{ folders: DriveFolder[], error?: string }`

### `uploadToDrive(accessToken, fileData, fileName, folderId?)`
- Uploads file to Drive
- Supports URLs and base64 data
- Returns: `DriveUploadResult`

### `createDriveFolder(accessToken, folderName, parentFolderId?)`
- Creates new folder
- Returns: `DriveUploadResult`

## 🚀 Future Enhancements

- [ ] Batch upload multiple files
- [ ] Progress bar for large files
- [ ] Folder tree view instead of flat list
- [ ] Remember last used folder
- [ ] Direct share links generation
- [ ] Folder search/filter

## 📝 Notes

- Files are saved with descriptive names: `{type}_{model}_{date}.{format}`
- Original file format is preserved
- No file size limit (respects Drive quotas)
- Upload happens server-side for better security
