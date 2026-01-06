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

import React, { useState } from 'react'
import { Box, Typography, IconButton, Grid, Stack } from '@mui/material'
import { Delete, AddPhotoAlternate } from '@mui/icons-material'
import { useDropzone } from 'react-dropzone'
import theme from '../../theme'
import { fileToBase64 } from './EditForm'

const { palette } = theme

interface MultiImageUploaderProps {
  images: string[]
  onChange: (images: string[]) => void
  maxImages?: number
  setErrorMsg: (msg: string) => void
}

export default function MultiImageUploader({
  images,
  onChange,
  maxImages = 5,
  setErrorMsg,
}: MultiImageUploaderProps) {
  const processFiles = async (files: File[]) => {
    setErrorMsg('')

    const remainingSlots = maxImages - images.length
    if (remainingSlots <= 0) {
      setErrorMsg(`Maximum ${maxImages} images allowed`)
      return
    }

    const filesToProcess = files.slice(0, remainingSlots)
    const allowedTypes = ['image/png', 'image/webp', 'image/jpeg']
    const newImages: string[] = []

    for (const file of filesToProcess) {
      if (!allowedTypes.includes(file.type)) {
        setErrorMsg(`Skipped ${file.name}: Only png, jpeg and webp are allowed`)
        continue
      }

      const maxSizeInBytes = 10 * 1024 * 1024
      if (file.size > maxSizeInBytes) {
        setErrorMsg(`Skipped ${file.name}: Image is too large (max 10MB)`)
        continue
      }

      try {
        const base64 = await fileToBase64(file)
        const newImage = `data:${file.type};base64,${base64}`
        newImages.push(newImage)
      } catch (error) {
        console.error('Error processing image:', error)
        setErrorMsg(`Failed to process ${file.name}`)
      }
    }

    if (newImages.length > 0) {
      onChange([...images, ...newImages])
    }
  }

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: processFiles,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp']
    },
    multiple: true,
    noClick: true, // 禁用默认点击行为，我们手动控制
    noKeyboard: true,
  })

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    onChange(newImages)
  }

  return (
    <Box {...getRootProps()} sx={{ width: '100%' }}>
      <input {...getInputProps()} />
      
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography
          variant="body2"
          sx={{
            color: palette.text.secondary,
            fontWeight: 500,
          }}
        >
          Upload Images to Blend ({images.length}/{maxImages})
        </Typography>
        {isDragActive && (
          <Typography variant="caption" sx={{ color: palette.primary.main, fontWeight: 600 }}>
            Drop files here...
          </Typography>
        )}
      </Stack>

      <Grid container spacing={1.5}>
        {/* Uploaded images */}
        {images.map((image, index) => (
          <Grid item xs={4} sm={3} md={2.4} key={index}>
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                paddingBottom: '100%',
                borderRadius: 1,
                overflow: 'hidden',
                border: `2px solid ${palette.primary.main}`,
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: 2,
                  '& .delete-button': {
                    opacity: 1,
                  },
                },
              }}
            >
              <img
                src={image}
                alt={`Image ${index + 1}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  color: 'white',
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {index + 1}
              </Box>
              <IconButton
                className="delete-button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveImage(index)
                }}
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
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

        {/* Add more button */}
        {images.length < maxImages && (
          <Grid item xs={4} sm={3} md={2.4}>
            <Box
              onClick={(e) => {
                e.stopPropagation()
                open() // 触发文件选择器
              }}
              sx={{
                position: 'relative',
                width: '100%',
                paddingBottom: '100%',
                borderRadius: 1,
                overflow: 'hidden',
                border: `2px dashed ${palette.divider}`,
                cursor: 'pointer',
                backgroundColor: 'transparent',
                transition: 'all 0.2s',
                '&:hover': {
                  border: `2px dashed ${palette.primary.main}`,
                  backgroundColor: palette.action.hover,
                },
              }}
            >
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
                <AddPhotoAlternate sx={{ fontSize: '2rem', color: palette.text.secondary }} />
                <Typography variant="caption" sx={{ color: palette.text.secondary, textAlign: 'center', px: 1 }}>
                  Add Image
                </Typography>
              </Box>
            </Box>
          </Grid>
        )}
      </Grid>

      {images.length === 0 && (
        <Box
          onClick={(e) => {
            e.stopPropagation()
            open() // 触发文件选择器
          }}
          sx={{
            mt: 2,
            p: 4,
            border: `2px dashed ${isDragActive ? palette.primary.main : palette.divider}`,
            borderRadius: 1,
            cursor: 'pointer',
            backgroundColor: isDragActive ? palette.action.hover : 'transparent',
            transition: 'all 0.2s',
            '&:hover': {
              border: `2px dashed ${palette.primary.main}`,
              backgroundColor: palette.action.hover,
            },
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <AddPhotoAlternate sx={{ fontSize: '3rem', color: palette.text.secondary, mb: 1 }}/>
            <Typography variant="body1" sx={{ color: palette.text.secondary }}>
              Drop images here or click to upload
            </Typography>
            <Typography variant="caption" sx={{ color: palette.text.disabled }}>
              Upload 2-{maxImages} images to blend together
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}
