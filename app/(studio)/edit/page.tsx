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

import * as React from 'react'
import Grid from '@mui/material/Grid2'
import Box from '@mui/material/Box'
import { useCallback, useEffect, useState } from 'react'
import { ImageI } from '../../api/generate-image-utils'
import OutputImagesDisplay from '../../ui/transverse-components/ImagenOutputImagesDisplay'
import { useAppContext } from '../../context/app-context'
import { Typography } from '@mui/material'
import { saveGenerationMetadata, GenerationMetadata } from '@/app/api/generation-metadata'
import { uploadMetadataJSON } from '@/app/api/cloud-storage/action'

import theme from '../../theme'
import EditForm from '@/app/ui/edit-components/EditForm'
import { redirect } from 'next/navigation'
import { editPageStateDefault } from '../../context/app-context'
const { palette } = theme

// LocalStorage key for persistence
const EDIT_PAGE_STATE_KEY = 'img-studio-edit-page-state'

export default function Page() {
  const { appContext, error, setAppContext } = useAppContext()
  
  // Initialize state from context or localStorage
  const [editedImagesInGCS, setEditedImagesInGCS] = useState<ImageI[]>(() => {
    if (appContext?.editPageState?.editedImagesInGCS) {
      return appContext.editPageState.editedImagesInGCS
    }
    // Try to restore from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(EDIT_PAGE_STATE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return parsed.editedImagesInGCS || []
        } catch (e) {
          console.error('Failed to parse saved edit state:', e)
        }
      }
    }
    return []
  })
  
  const [isEditLoading, setIsEditLoading] = useState(false)
  const [editErrorMsg, setEditErrorMsg] = useState('')
  const [editedCount, setEditedCount] = useState<number>(() => {
    return appContext?.editPageState?.editedCount || 0
  })
  const [isUpscaledDLAvailable, setIsUpscaleDLAvailable] = useState(() => {
    return appContext?.editPageState?.isUpscaledDLAvailable ?? true
  })
  
  // Save state to context and localStorage whenever it changes
  useEffect(() => {
    const state = {
      editedImagesInGCS,
      editedCount,
      isUpscaledDLAvailable,
    }
    
    // Save to context (full state)
    setAppContext((prev) => ({
      ...prev!,
      editPageState: {
        ...prev?.editPageState,
        ...state,
      },
    }))
    
    // Save to localStorage with error handling
    if (typeof window !== 'undefined') {
      try {
        // Create a lightweight version for localStorage
        // Store only GCS URIs and minimal metadata, not base64 data
        const lightImages = editedImagesInGCS.map(img => ({
          key: img.key,
          gcsUri: img.gcsUri,
          prompt: img.prompt,
          width: img.width,
          height: img.height,
          ratio: img.ratio,
          // Exclude src (base64) to save space
        }))
        
        const lightState = {
          editedImagesInGCS: lightImages,
          editedCount,
          isUpscaledDLAvailable,
        }
        
        localStorage.setItem(EDIT_PAGE_STATE_KEY, JSON.stringify(lightState))
      } catch (error) {
        // Handle QuotaExceededError gracefully
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded, clearing old edit state')
          try {
            // Clear old state to free up space
            localStorage.removeItem(EDIT_PAGE_STATE_KEY)
            // Try saving minimal state
            localStorage.setItem(EDIT_PAGE_STATE_KEY, JSON.stringify({
              editedCount,
              isUpscaledDLAvailable,
            }))
          } catch (clearError) {
            console.error('Failed to save minimal state:', clearError)
          }
        } else {
          console.error('Error saving edit state to localStorage:', error)
        }
      }
    }
  }, [editedImagesInGCS, editedCount, isUpscaledDLAvailable, setAppContext])

  const handleImageGeneration = async (newImages: ImageI[]) => {
    setEditedImagesInGCS(newImages)
    setIsEditLoading(false)
    
    // Save to history
    await saveImagesToHistory(newImages)
  }

  const saveImagesToHistory = async (images: ImageI[]) => {
    if (!images || images.length === 0) return

    try {
      for (const image of images) {
        const metadata: GenerationMetadata = {
          id: image.key || `edit_${Date.now()}`,
          type: 'image',
          model: image.modelVersion || 'unknown',
          prompt: image.prompt || '',
          timestamp: new Date().toISOString(),
          outputs: [{
            url: image.src,
            gcsUri: image.gcsUri,
            format: image.format || 'png',
            width: image.width,
            height: image.height,
          }],
          parameters: {
            mode: image.mode || 'Edited',
            width: image.width?.toString() || '',
            height: image.height?.toString() || '',
            ratio: image.ratio || '',
          },
          performance: {},
          cost: {},
        }

        // Save to local history
        await saveGenerationMetadata(metadata)

        // Upload metadata to GCS
        if (image.gcsUri) {
          const bucketName = image.gcsUri.split('/')[2]
          const objectPath = image.gcsUri.split('/').slice(3).join('/')
          const metadataPath = objectPath.replace(/\.(png|jpg|jpeg|webp)$/, '.json')

          const gcsMetadata = {
            type: 'image',
            model: image.modelVersion || 'unknown',
            prompt: image.prompt || '',
            timestamp: new Date().toISOString(),
            parameters: metadata.parameters,
            performance: metadata.performance,
            cost: metadata.cost,
          }

          await uploadMetadataJSON(gcsMetadata, bucketName, metadataPath)
        }
      }
    } catch (error) {
      console.error('Error saving edited images to history:', error)
    }
  }

  const handleRequestSent = (valid: boolean, count: number, isUpscaledDLAvailable: boolean) => {
    setIsUpscaleDLAvailable(isUpscaledDLAvailable)
    editErrorMsg !== '' && valid && setEditErrorMsg('')
    setIsEditLoading(valid)
    setEditedCount(count)
  }
  const handleNewErrorMsg = useCallback((newErrorMsg: string) => {
    setEditErrorMsg(newErrorMsg)
    setIsEditLoading(false)
  }, [])

  if (appContext?.isLoading === true) {
    return (
      <Box p={5}>
        <Typography
          variant="h3"
          sx={{ fontWeight: 400, color: error === null ? palette.primary.main : palette.error.main }}
        >
          {error === null
            ? 'Loading your profile content...'
            : 'Error while loading your profile content! Retry or contact you IT admin.'}
        </Typography>
      </Box>
    )
  } else if (process.env.NEXT_PUBLIC_EDIT_ENABLED === 'false') {
    redirect('/generate')
  } else {
    return (
      <Box p={5} sx={{ maxHeight: '100vh' }}>
        <Grid wrap="nowrap" container spacing={6} direction="row" columns={2}>
          <Grid size={1.1} flex={0} sx={{ maxWidth: 700, minWidth: 610 }}>
            <EditForm
              isLoading={isEditLoading}
              onRequestSent={handleRequestSent}
              onImageGeneration={handleImageGeneration}
              onNewErrorMsg={handleNewErrorMsg}
              errorMsg={editErrorMsg}
            />
          </Grid>
          <Grid size={0.9} flex={1} sx={{ pt: 11, maxWidth: 850, minWidth: 400 }}>
            <OutputImagesDisplay
              isLoading={isEditLoading}
              generatedImagesInGCS={editedImagesInGCS}
              generatedCount={editedCount}
              isPromptReplayAvailable={false}
              isUpscaledDLAvailable={isUpscaledDLAvailable}
            />
          </Grid>
        </Grid>
      </Box>
    )
  }
}
