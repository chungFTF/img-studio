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
import { Box, Grid, IconButton, Typography, Tooltip, Stack, Button } from '@mui/material'
import { Delete, Add, AddPhotoAlternate, CloudUpload } from '@mui/icons-material'
import { useDropzone } from 'react-dropzone'
import { useGoogleDrive } from '@/app/context/google-drive-context'
import GoogleDriveImagePicker from '../edit-components/GoogleDriveImagePicker'
import theme from '../../theme'

const { palette } = theme

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to convert file to base64'))
      }
    }
    reader.onerror = (error) => reject(error)
  })
}

export interface CachedImage {
  id: string
  base64Image: string
  timestamp: number
  name?: string
}

const STORAGE_KEY = 'imgstudio_image_cache'
const MAX_CACHE_SIZE = 5 // Maximum number of images to cache

export const ImageCacheStorage = ({
  onImageSelect,
  showAddButton = false,
}: {
  onImageSelect: (base64Image: string) => void
  showAddButton?: boolean
}) => {
  const [cachedImages, setCachedImages] = useState<CachedImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showDrivePicker, setShowDrivePicker] = useState(false)
  
  const { isConnected, connectDrive, isReady } = useGoogleDrive()

  // Load cached images from localStorage
  useEffect(() => {
    loadCachedImages()
  }, [refreshTrigger])

  // Listen for storage events to update when images are added from other sources
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadCachedImages()
      }
    }

    // Listen for custom event when addImageToCache is called
    const handleCacheUpdate = () => {
      loadCachedImages()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('imageCacheUpdated', handleCacheUpdate)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('imageCacheUpdated', handleCacheUpdate)
    }
  }, [])

  // Handle file upload
  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    
    setIsUploading(true)
    try {
      const file = acceptedFiles[0]
      const allowedTypes = ['image/png', 'image/webp', 'image/jpeg']

      if (!allowedTypes.includes(file.type)) {
        alert('Wrong input image format - Only png, jpeg and webp are allowed')
        return
      }

      // Check file size (limit to 10MB)
      const maxSizeInBytes = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSizeInBytes) {
        alert('Image file is too large. Please use an image smaller than 10MB.')
        return
      }

      const base64Image = await fileToBase64(file)
      addImageToCacheInternal(base64Image, file.name)
      setRefreshTrigger(prev => prev + 1) // Trigger reload
    } catch (error) {
      console.error('Error uploading image to cache:', error)
      alert('Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp']
    },
    multiple: false
  })

  const loadCachedImages = () => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEY)
        if (cached) {
          const images = JSON.parse(cached) as CachedImage[]
          setCachedImages(images)
        }
      } catch (error) {
        console.error('Error loading cached images:', error)
      }
    }
  }

  const saveCachedImages = (images: CachedImage[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(images))
        setCachedImages(images)
      } catch (error) {
        console.error('Error saving cached images:', error)
      }
    }
  }

  const addImageToCacheInternal = (base64Image: string, name?: string) => {
    try {
      // Check if image already exists
      const exists = cachedImages.some((img) => img.base64Image === base64Image)
      if (exists) return

      // Add new image
      const newImage: CachedImage = {
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        base64Image,
        timestamp: Date.now(),
        name,
      }

      let updatedImages = [newImage, ...cachedImages]

      // Keep only MAX_CACHE_SIZE images
      if (updatedImages.length > MAX_CACHE_SIZE) {
        updatedImages = updatedImages.slice(0, MAX_CACHE_SIZE)
      }

      saveCachedImages(updatedImages)
    } catch (error) {
      console.error('Error adding image to cache:', error)
    }
  }

  const deleteImage = (id: string) => {
    const updatedImages = cachedImages.filter((img) => img.id !== id)
    saveCachedImages(updatedImages)
  }

  const handleImageClick = (base64Image: string) => {
    onImageSelect(base64Image)
  }

  const handleGoogleDriveClick = async () => {
    if (!isConnected) {
      try {
        await connectDrive()
        // After connecting, open picker
        setShowDrivePicker(true)
      } catch (error) {
        console.error('Error connecting to Google Drive:', error)
      }
    } else {
      setShowDrivePicker(true)
    }
  }

  const handleDriveImageSelect = (base64Image: string, fileName: string) => {
    addImageToCacheInternal(base64Image, fileName)
    setRefreshTrigger(prev => prev + 1)
    onImageSelect(base64Image)
    setShowDrivePicker(false)
  }

  const handleDrivePickerClose = () => {
    setShowDrivePicker(false)
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography
          variant="h6"
          sx={{
            color: palette.text.primary,
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          Image Cache ({cachedImages.length}/{MAX_CACHE_SIZE})
        </Typography>
        
        {isReady && (
          <Button
            size="small"
            startIcon={<CloudUpload />}
            onClick={handleGoogleDriveClick}
            sx={{ textTransform: 'none' }}
          >
            {isConnected ? 'Google Drive' : 'Connect Drive'}
          </Button>
        )}
      </Stack>

      <Grid container spacing={1}>
        {/* Upload box */}
        <Grid item xs={4} sm={3} md={2}>
          <Box
            {...getRootProps()}
            sx={{
              position: 'relative',
              width: '100%',
              paddingBottom: '100%', // Square aspect ratio
              borderRadius: 1,
              overflow: 'hidden',
              border: `2px dashed ${isDragActive ? palette.primary.main : palette.divider}`,
              cursor: 'pointer',
              backgroundColor: isDragActive ? palette.action.hover : 'transparent',
              transition: 'all 0.2s',
              '&:hover': {
                border: `2px dashed ${palette.primary.main}`,
                backgroundColor: palette.action.hover,
              },
            }}
          >
            <input {...getInputProps()} />
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
              }}
            >
              {isUploading ? (
                <Typography variant="caption" sx={{ color: palette.text.secondary }}>
                  Uploading...
                </Typography>
              ) : (
                <>
                  <AddPhotoAlternate sx={{ fontSize: '2rem', color: palette.text.secondary }} />
                  <Typography variant="caption" sx={{ color: palette.text.secondary, textAlign: 'center', px: 1 }}>
                    Upload
                  </Typography>
                </>
              )}
            </Box>
          </Box>
        </Grid>

        {/* Cached images */}
        {cachedImages.map((image) => (
            <Grid item xs={4} sm={3} md={2} key={image.id}>
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  paddingBottom: '100%', // Square aspect ratio
                  borderRadius: 1,
                  overflow: 'hidden',
                  border: `1px solid ${palette.divider}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    border: `2px solid ${palette.primary.main}`,
                    boxShadow: 2,
                    '& .delete-button': {
                      opacity: 1,
                    },
                  },
                }}
                onClick={() => handleImageClick(image.base64Image)}
              >
                <img
                  src={image.base64Image}
                  alt={image.name || 'Cached image'}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                <IconButton
                  className="delete-button"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteImage(image.id)
                  }}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    padding: '4px',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 0, 0, 0.8)',
                    },
                  }}
                  size="small"
                >
                  <Delete sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Box>
            </Grid>
        ))}
      </Grid>

      {/* Google Drive Image Picker */}
      <GoogleDriveImagePicker
        open={showDrivePicker}
        onClose={handleDrivePickerClose}
        onImageSelect={handleDriveImageSelect}
      />
    </Box>
  )
}

// Helper function to add an image to cache (export for use in other components)
export const addImageToCache = (base64Image: string, name?: string) => {
  if (typeof window === 'undefined') return

  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    let images: CachedImage[] = cached ? JSON.parse(cached) : []

    // Check if image already exists (by comparing base64)
    const exists = images.some((img) => img.base64Image === base64Image)
    if (exists) return

    // Add new image
    const newImage: CachedImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      base64Image,
      timestamp: Date.now(),
      name,
    }

    images.unshift(newImage) // Add to beginning

    // Keep only MAX_CACHE_SIZE images
    if (images.length > MAX_CACHE_SIZE) {
      images = images.slice(0, MAX_CACHE_SIZE)
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(images))
    
    // Dispatch custom event to notify ImageCacheStorage components
    window.dispatchEvent(new CustomEvent('imageCacheUpdated'))
  } catch (error) {
    console.error('Error adding image to cache:', error)
  }
}

// Helper function to clear all cached images
export const clearImageCache = () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing image cache:', error)
    }
  }
}
