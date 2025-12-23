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

'use server'

import { GoogleAuth } from 'google-auth-library'

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

/**
 * Lists folders in the user's Google Drive
 */
export async function listDriveFolders(accessToken: string): Promise<{ folders: DriveFolder[]; error?: string }> {
  try {
    // Helper to fetch folders for a given corpora with timeout safeguard
    const fetchFolders = async (corpora: 'user' | 'allDrives') => {
      const collected: DriveFolder[] = []
      let pageToken: string | undefined = undefined

      do {
        const url = new URL('https://www.googleapis.com/drive/v3/files')
        url.searchParams.set('q', 'mimeType="application/vnd.google-apps.folder" and trashed=false')
        url.searchParams.set('fields', 'nextPageToken, files(id,name,mimeType)')
        url.searchParams.set('orderBy', 'name')
        url.searchParams.set('pageSize', '200')
        url.searchParams.set('spaces', 'drive')
        url.searchParams.set('corpora', corpora)
        if (corpora === 'allDrives') {
          url.searchParams.set('includeItemsFromAllDrives', 'true')
          url.searchParams.set('supportsAllDrives', 'true')
        }
        if (pageToken) url.searchParams.set('pageToken', pageToken)

        // Abort after 10s to avoid hanging spinner
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10000)

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        })
        clearTimeout(timer)

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`Failed to list folders (${corpora}): ${response.status} ${errText}`)
        }

        const data = await response.json()
        if (Array.isArray(data.files)) {
          collected.push(...data.files)
        }
        pageToken = data.nextPageToken
      } while (pageToken)

      return collected
    }

    // First try user's Drive; if empty, try allDrives (shared drives)
    let folders = await fetchFolders('user')
    if (folders.length === 0) {
      folders = await fetchFolders('allDrives')
    }

    // Deduplicate by id
    const unique = Array.from(new Map(folders.map((f) => [f.id, f])).values())

    return { folders: unique }
  } catch (error: any) {
    console.error('Error listing Drive folders:', error?.message || error)
    return { folders: [], error: error.message }
  }
}

/**
 * Uploads a file to Google Drive
 */
export async function uploadToDrive(
  accessToken: string,
  fileData: string, // base64 or URL
  fileName: string,
  folderId?: string
): Promise<DriveUploadResult> {
  try {
    // Download file from GCS if it's a URL
    let fileBlob: Buffer
    let mimeType = 'image/png'

    if (fileData.startsWith('http')) {
      // It's a GCS URL, download it first
      const response = await fetch(fileData)
      if (!response.ok) {
        throw new Error('Failed to download file from GCS')
      }
      const arrayBuffer = await response.arrayBuffer()
      fileBlob = Buffer.from(arrayBuffer)
      mimeType = response.headers.get('content-type') || 'image/png'
    } else if (fileData.startsWith('data:')) {
      // It's a base64 data URL
      const matches = fileData.match(/^data:([^;]+);base64,(.+)$/)
      if (!matches) {
        throw new Error('Invalid base64 data URL')
      }
      mimeType = matches[1]
      fileBlob = Buffer.from(matches[2], 'base64')
    } else {
      // Assume it's raw base64
      fileBlob = Buffer.from(fileData, 'base64')
    }

    // Create metadata
    const metadata = {
      name: fileName,
      ...(folderId && { parents: [folderId] }),
    }

    // Use multipart upload
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

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Upload failed')
    }

    const data = await response.json()

    return {
      success: true,
      fileId: data.id,
      fileName: data.name,
      webViewLink: data.webViewLink,
    }
  } catch (error: any) {
    console.error('Error uploading to Drive:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Creates a new folder in Google Drive
 */
export async function createDriveFolder(accessToken: string, folderName: string, parentFolderId?: string): Promise<DriveUploadResult> {
  try {
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentFolderId && { parents: [parentFolderId] }),
    }

    const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to create folder')
    }

    const data = await response.json()

    return {
      success: true,
      fileId: data.id,
      fileName: data.name,
      webViewLink: data.webViewLink,
    }
  } catch (error: any) {
    console.error('Error creating Drive folder:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}
