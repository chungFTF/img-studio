// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use client'

import React, { useEffect, useState } from 'react'
import { CircularProgress, Box, Typography, Alert } from '@mui/material'
import { useGoogleDrive } from '@/app/context/google-drive-context'
import { downloadDriveImage } from '@/app/api/google-drive/action'

interface GoogleDriveImagePickerProps {
  open: boolean
  onClose: () => void
  onImageSelect: (base64Image: string, fileName: string) => void
}

declare global {
  interface Window {
    google?: any
    gapi?: any
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || ''
const APP_ID = CLIENT_ID.split('-')[0] // Extract app ID from client ID

export default function GoogleDriveImagePicker({ open, onClose, onImageSelect }: GoogleDriveImagePickerProps) {
  const { accessToken, isConnected } = useGoogleDrive()
  const [pickerReady, setPickerReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // Load Google Picker API
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if API key and client ID are set
    if (!API_KEY || !CLIENT_ID) {
      console.error('Google API Key or Client ID not set')
      setError('Google Drive is not properly configured')
      return
    }

    const loadPickerApi = () => {
      // Load gapi script if not already loaded
      if (!window.gapi) {
        const gapiScript = document.createElement('script')
        gapiScript.src = 'https://apis.google.com/js/api.js'
        gapiScript.async = true
        gapiScript.defer = true
        gapiScript.onload = () => {
          window.gapi.load('picker', () => {
            setPickerReady(true)
          })
        }
        gapiScript.onerror = () => {
          console.error('❌ Failed to load Google Picker API')
          setError('Failed to load Google Picker')
        }
        document.body.appendChild(gapiScript)
      } else {
        window.gapi.load('picker', () => {
          setPickerReady(true)
        })
      }
    }

    loadPickerApi()
  }, [])

  // Open picker when open prop changes
  useEffect(() => {
    if (open && pickerReady && isConnected && accessToken) {
      openPicker()
    }
  }, [open, pickerReady, isConnected, accessToken])

  const openPicker = () => {
    if (!window.google || !window.google.picker || !accessToken) {
      console.error('Picker not ready or no access token')
      setError('Google Picker is not ready')
      return
    }

    try {
      // Create and configure the picker
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES)
        .setIncludeFolders(true)
        .setMimeTypes('image/png,image/jpeg,image/jpg,image/webp,image/gif')

      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .addView(new window.google.picker.DocsUploadView())
        .setOAuthToken(accessToken)
        .setDeveloperKey(API_KEY)
        .setAppId(APP_ID)
        .setCallback(pickerCallback)
        .setTitle('Select an image from Google Drive')
        .setLocale('en')
        .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
        .enableFeature(window.google.picker.Feature.MINE_ONLY)
        .build()

      picker.setVisible(true)
    } catch (err: any) {
      console.error('Error opening picker:', err)
      setError('Failed to open Google Picker: ' + err.message)
    }
  }

  const pickerCallback = async (data: any) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const file = data.docs[0]

      setIsDownloading(true)
      setError(null)

      try {
        if (!accessToken) {
          throw new Error('No access token available')
        }

        const result = await downloadDriveImage(accessToken, file.id)

        if (result.error) {
          setError(result.error)
        } else if (result.base64) {
          onImageSelect(result.base64, file.name)
          onClose()
        }
      } catch (err: any) {
        console.error('Error downloading image:', err)
        setError(err.message || 'Failed to download image')
      } finally {
        setIsDownloading(false)
      }
    } else if (data.action === window.google.picker.Action.CANCEL) {
      onClose()
    }
  }

  // Show loading or error state
  if (open && !pickerReady) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
        }}
      >
        <Box
          sx={{
            backgroundColor: 'white',
            padding: 4,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <>
              <CircularProgress />
              <Typography>Loading Google Picker...</Typography>
            </>
          )}
        </Box>
      </Box>
    )
  }

  if (isDownloading) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
        }}
      >
        <Box
          sx={{
            backgroundColor: 'white',
            padding: 4,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <CircularProgress />
          <Typography>Downloading image from Google Drive...</Typography>
        </Box>
      </Box>
    )
  }

  return null
}
