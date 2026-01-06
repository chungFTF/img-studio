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

import React from 'react'
import { Box, Typography, IconButton, Grid, Stack } from '@mui/material'
import { Delete, AddPhotoAlternate } from '@mui/icons-material'
import { useDropzone } from 'react-dropzone'
import theme from '../../theme'
import { fileToBase64 } from './EditForm'

const { palette } = theme

interface ImageInsertUploaderProps {
  baseImage: string | null
  insertImage: string | null
  onBaseImageChange: (image: string | null) => void
  onInsertImageChange: (image: string | null) => void
  setErrorMsg: (msg: string) => void
}

export default function ImageInsertUploader({
  baseImage,
  insertImage,
  onBaseImageChange,
  onInsertImageChange,
  setErrorMsg,
}: ImageInsertUploaderProps) {
  const processFile = async (file: File): Promise<string | null> => {
    const allowedTypes = ['image/png', 'image/webp', 'image/jpeg']

    if (!allowedTypes.includes(file.type)) {
      setErrorMsg('Wrong input image format - Only png, jpeg and webp are allowed')
      return null
    }

    const maxSizeInBytes = 10 * 1024 * 1024
    if (file.size > maxSizeInBytes) {
      setErrorMsg('Image file is too large. Please use an image smaller than 10MB.')
      return null
    }

    try {
      const base64 = await fileToBase64(file)
      return `data:${file.type};base64,${base64}`
    } catch (error) {
      console.error('Error processing image:', error)
      setErrorMsg('Failed to process image')
      return null
    }
  }

  const onBaseImageDrop = async (acceptedFiles: File[]) => {
    setErrorMsg('')
    if (acceptedFiles.length === 0) return

    const result = await processFile(acceptedFiles[0])
    if (result) {
      onBaseImageChange(result)
    }
  }

  const onInsertImageDrop = async (acceptedFiles: File[]) => {
    setErrorMsg('')
    if (acceptedFiles.length === 0) return

    const result = await processFile(acceptedFiles[0])
    if (result) {
      onInsertImageChange(result)
    }
  }

  const baseDropzone = useDropzone({
    onDrop: onBaseImageDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp']
    },
    multiple: false,
    noClick: false,
  })

  const insertDropzone = useDropzone({
    onDrop: onInsertImageDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp']
    },
    multiple: false,
    noClick: false,
  })

  return (
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={2}>
        {/* Base Image */}
        <Grid item xs={12} sm={6}>
          <Typography variant="body2" sx={{ color: palette.text.primary, fontWeight: 600, mb: 1 }}>
            1. Base Image
          </Typography>
          <Box
            {...baseDropzone.getRootProps()}
            sx={{
              position: 'relative',
              width: '100%',
              height: 250,
              borderRadius: 1,
              overflow: 'hidden',
              border: `2px ${baseImage ? 'solid' : 'dashed'} ${baseDropzone.isDragActive ? palette.primary.main : baseImage ? palette.success.main : palette.divider}`,
              cursor: 'pointer',
              backgroundColor: baseDropzone.isDragActive ? palette.action.hover : 'transparent',
              transition: 'all 0.2s',
              '&:hover': {
                border: `2px ${baseImage ? 'solid' : 'dashed'} ${palette.primary.main}`,
                backgroundColor: palette.action.hover,
              },
            }}
          >
            <input {...baseDropzone.getInputProps()} />
            {baseImage ? (
              <>
                <img
                  src={baseImage}
                  alt="Base image"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation()
                    onBaseImageChange(null)
                  }}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 0, 0, 0.8)',
                    },
                  }}
                  size="small"
                >
                  <Delete />
                </IconButton>
              </>
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                }}
              >
                <AddPhotoAlternate sx={{ fontSize: '3rem', color: palette.text.secondary }} />
                <Typography variant="body2" sx={{ color: palette.text.secondary, textAlign: 'center' }}>
                  Drop or click to upload base image
                </Typography>
                <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                  This is the main image where you'll insert
                </Typography>
              </Box>
            )}
          </Box>
        </Grid>

        {/* Insert Image */}
        <Grid item xs={12} sm={6}>
          <Typography variant="body2" sx={{ color: palette.text.primary, fontWeight: 600, mb: 1 }}>
            2. Image to Insert
          </Typography>
          <Box
            {...insertDropzone.getRootProps()}
            sx={{
              position: 'relative',
              width: '100%',
              height: 250,
              borderRadius: 1,
              overflow: 'hidden',
              border: `2px ${insertImage ? 'solid' : 'dashed'} ${insertDropzone.isDragActive ? palette.primary.main : insertImage ? palette.success.main : palette.divider}`,
              cursor: 'pointer',
              backgroundColor: insertDropzone.isDragActive ? palette.action.hover : 'transparent',
              transition: 'all 0.2s',
              '&:hover': {
                border: `2px ${insertImage ? 'solid' : 'dashed'} ${palette.primary.main}`,
                backgroundColor: palette.action.hover,
              },
            }}
          >
            <input {...insertDropzone.getInputProps()} />
            {insertImage ? (
              <>
                <img
                  src={insertImage}
                  alt="Image to insert"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation()
                    onInsertImageChange(null)
                  }}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 0, 0, 0.8)',
                    },
                  }}
                  size="small"
                >
                  <Delete />
                </IconButton>
              </>
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                }}
              >
                <AddPhotoAlternate sx={{ fontSize: '3rem', color: palette.text.secondary }} />
                <Typography variant="body2" sx={{ color: palette.text.secondary, textAlign: 'center' }}>
                  Drop or click to upload image to insert
                </Typography>
                <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                  This image will be inserted into the selected zone
                </Typography>
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>

      {baseImage && insertImage && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: palette.success.light + '20', borderRadius: 1, border: `1px solid ${palette.success.main}` }}>
          <Typography variant="body2" sx={{ color: palette.success.dark, fontWeight: 500 }}>
            ✓ Both images uploaded. Now click "Select zone" to choose where to insert the second image.
          </Typography>
        </Box>
      )}
    </Box>
  )
}

