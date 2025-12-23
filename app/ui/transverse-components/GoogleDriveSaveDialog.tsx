'use client' // React component must be client

import * as React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Stack,
  TextField,
} from '@mui/material'
import { FolderOpen, Edit } from '@mui/icons-material'

// 声明 Google Picker 全局类型
declare global {
  interface Window {
    google?: any
    gapi?: any
  }
}

export interface DriveFolder {
  id: string
  name: string
  mimeType: string
}

export interface DriveUploadResult {
  success: boolean
  fileId?: string
  fileName?: string
  webViewLink?: string
  error?: string
}

// --------------------- React Component ---------------------

interface GoogleDriveSaveDialogProps {
  open: boolean
  onClose: () => void
  accessToken: string
  fileName: string
  fileData: string
}

export default function GoogleDriveSaveDialog({
  open,
  onClose,
  accessToken,
  fileName,
  fileData,
}: GoogleDriveSaveDialogProps) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [successLink, setSuccessLink] = React.useState<string | null>(null)
  const [selectedFolder, setSelectedFolder] = React.useState<{ id: string; name: string } | null>(null)
  const [pickerApiLoaded, setPickerApiLoaded] = React.useState(false)
  const [editedFileName, setEditedFileName] = React.useState(fileName)

  // 当 fileName 改变时更新 editedFileName
  React.useEffect(() => {
    setEditedFileName(fileName)
  }, [fileName])

  // 加载 Google Picker API
  React.useEffect(() => {
    if (open && !pickerApiLoaded) {
      loadPickerApi()
    }
  }, [open])

  const loadPickerApi = () => {
    if (window.gapi?.load) {
      window.gapi.load('picker', () => {
        setPickerApiLoaded(true)
      })
    } else {
      // 加载 gapi 脚本
      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = () => {
        window.gapi.load('picker', () => {
          setPickerApiLoaded(true)
        })
      }
      document.body.appendChild(script)
    }
  }

  const handleOpenPicker = () => {
    if (!pickerApiLoaded || !window.google?.picker) {
      setError('Google Picker is still loading. Please wait...')
      return
    }

    const picker = new window.google.picker.PickerBuilder()
      .addView(
        new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
          .setSelectFolderEnabled(true)
          .setMimeTypes('application/vnd.google-apps.folder')
      )
      .setOAuthToken(accessToken)
      .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '')
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const folder = data.docs[0]
          setSelectedFolder({
            id: folder.id,
            name: folder.name,
          })
          setError(null)
        }
      })
      .build()

    picker.setVisible(true)

    // 设置 z-index - Google Picker 会创建一个 div.picker-dialog
    setTimeout(() => {
      const pickerDialog = document.querySelector('.picker-dialog')
      if (pickerDialog) {
        (pickerDialog as HTMLElement).style.zIndex = '10000'
      }
    }, 100)
  }

  const handleSave = async () => {
    if (!selectedFolder) {
      setError('Please select a folder')
      return
    }

    if (!editedFileName.trim()) {
      setError('Please enter a file name')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await uploadToDrive(accessToken, fileData, editedFileName.trim(), selectedFolder.id)
      if (!result.success) {
        setError(result.error || 'Failed to save file')
      } else {
        setSuccessLink(result.webViewLink || null)
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedFolder(null)
    setEditedFileName(fileName)
    setError(null)
    setSuccessLink(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#ffffff',
          minHeight: 400,
        },
      }}
    >
      <DialogTitle sx={{ backgroundColor: '#ffffff', pb: 1 }}>
        <Typography component="span" sx={{ fontWeight: 500, color: '#202124', fontSize: '1.25rem', display: 'block' }}>
          Save to Google Drive
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ backgroundColor: '#ffffff', pt: 2 }}>
        {!accessToken ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" sx={{ color: '#5F6368', mb: 2 }}>
              Please connect to Google Drive to save files.
            </Typography>
            <Typography variant="body2" sx={{ color: '#80868B', fontSize: '0.875rem' }}>
              Close this dialog and look for the "Connect Google Drive" option.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={3}>
            {/* 文件名编辑 */}
            <Box>
              <Typography variant="body2" sx={{ color: '#5F6368', mb: 1, fontSize: '0.875rem' }}>
                File name:
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editedFileName}
                onChange={(e) => setEditedFileName(e.target.value)}
                placeholder="Enter file name"
                InputProps={{
                  startAdornment: <Edit sx={{ mr: 1, color: '#5F6368', fontSize: 20 }} />,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#F8F9FA',
                  },
                }}
              />
            </Box>

            {/* 选择的文件夹显示 */}
            {selectedFolder && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: '#E8F0FE',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <FolderOpen sx={{ color: '#1967D2', fontSize: 24 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: '#5F6368', fontSize: '0.75rem' }}>
                    Selected folder:
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#202124', fontWeight: 500 }}>
                    {selectedFolder.name}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  onClick={() => setSelectedFolder(null)}
                  sx={{ textTransform: 'none' }}
                >
                  Change
                </Button>
              </Box>
            )}

            {/* 选择文件夹按钮 */}
            {!selectedFolder && (
              <Button
                variant="contained"
                startIcon={<FolderOpen />}
                onClick={handleOpenPicker}
                disabled={!pickerApiLoaded}
                fullWidth
                size="large"
                sx={{
                  py: 1.5,
                  textTransform: 'none',
                  fontSize: '1rem',
                }}
              >
                {pickerApiLoaded ? 'Select Folder from Google Drive' : 'Loading Google Picker...'}
              </Button>
            )}

            {!selectedFolder && pickerApiLoaded && (
              <Typography variant="caption" sx={{ color: '#5F6368', textAlign: 'center', display: 'block' }}>
                You can browse, search, and create folders in the picker
              </Typography>
            )}

            {error && (
              <Alert severity="error">
                {error}
              </Alert>
            )}

            {successLink && (
              <Alert severity="success">
                File saved successfully!{' '}
                <a href={successLink} target="_blank" rel="noopener noreferrer" style={{ color: '#1967D2' }}>
                  Open in Drive
                </a>
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ backgroundColor: '#ffffff', px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={loading} sx={{ textTransform: 'none' }}>
          {successLink ? 'Close' : 'Cancel'}
        </Button>
        {!successLink && (
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={loading || !selectedFolder}
            sx={{ textTransform: 'none' }}
          >
            {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Save to Drive
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

// --------------------- Google Drive Functions ---------------------

export async function uploadToDrive(
  accessToken: string,
  fileData: string,
  fileName: string,
  folderId?: string
): Promise<DriveUploadResult> {
  try {
    let fileBlob: Buffer
    let mimeType = 'image/png'

    if (fileData.startsWith('http')) {
      const response = await fetch(fileData)
      if (!response.ok) throw new Error('Failed to download file from URL')
      const arrayBuffer = await response.arrayBuffer()
      fileBlob = Buffer.from(arrayBuffer)
      mimeType = response.headers.get('content-type') || 'image/png'
    } else if (fileData.startsWith('data:')) {
      const matches = fileData.match(/^data:([^;]+);base64,(.+)$/)
      if (!matches) throw new Error('Invalid base64 data URL')
      mimeType = matches[1]
      fileBlob = Buffer.from(matches[2], 'base64')
    } else {
      fileBlob = Buffer.from(fileData, 'base64')
    }

    const metadata: any = { name: fileName }
    if (folderId) metadata.parents = [folderId]

    const boundary = '-------314159265358979323846'
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelimiter = `\r\n--${boundary}--`

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      fileBlob.toString('base64') +
      closeDelimiter

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipartRequestBody,
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Upload failed')
    }

    const data = await response.json()
    return { success: true, fileId: data.id, fileName: data.name, webViewLink: data.webViewLink }
  } catch (error: any) {
    console.error('Error uploading to Drive:', error)
    return { success: false, error: error.message }
  }
}

export async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<DriveUploadResult> {
  try {
    const metadata: any = { name: folderName, mimeType: 'application/vnd.google-apps.folder' }
    if (parentFolderId) metadata.parents = [parentFolderId]

    const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to create folder')
    }

    const data = await response.json()
    return { success: true, fileId: data.id, fileName: data.name, webViewLink: data.webViewLink }
  } catch (error: any) {
    console.error('Error creating Drive folder:', error)
    return { success: false, error: error.message }
  }
}
