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
import { useEffect, useRef, useState } from 'react'
import Grid from '@mui/material/Grid2'
import Box from '@mui/material/Box'
import { Typography, Dialog, DialogContent, IconButton, Chip, Stack } from '@mui/material'
import { PlayCircleOutline, Close, Fullscreen, ClearAll } from '@mui/icons-material'

import GenerateForm from '../../ui/generate-components/GenerateForm'
import OutputImagesDisplay from '../../ui/transverse-components/ImagenOutputImagesDisplay'
import OutputVideosDisplay from '@/app/ui/transverse-components/VeoOutputVideosDisplay'
import { ChipGroup } from '@/app/ui/ux-components/InputChipGroup'

import { appContextDataDefault, useAppContext } from '../../context/app-context'
import { imageGenerationUtils, ImageI, ImageRandomPrompts } from '../../api/generate-image-utils'
import {
  InterpolImageI,
  OperationMetadataI,
  videoGenerationUtils,
  VideoI,
  VideoRandomPrompts,
} from '@/app/api/generate-video-utils'
import { getVideoGenerationStatus } from '@/app/api/veo/action'
import { downloadMediaFromGcs, uploadMetadataJSON } from '@/app/api/cloud-storage/action'
import { getAspectRatio } from '@/app/ui/edit-components/EditImageDropzone'
import { saveGenerationMetadata, GenerationMetadata } from '@/app/api/generation-metadata'
import theme from '../../theme'

// Constants
const { palette } = theme
const INITIAL_POLLING_INTERVAL_MS = 6000
const MAX_POLLING_INTERVAL_MS = 60000
const BACKOFF_FACTOR = 1.2
const MAX_POLLING_ATTEMPTS = 30
const JITTER_FACTOR = 0.2

type GenerationMode = 'Generate an Image' | 'Generate a Video'

export default function Page() {
  const [generationMode, setGenerationMode] = useState<GenerationMode>('Generate an Image')
  const [isLoading, setIsLoading] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<ImageI[]>([])
  const [generatedVideos, setGeneratedVideos] = useState<VideoI[]>([])
  const [generatedCount, setGeneratedCount] = useState(0)
  const [generationErrorMsg, setGenerationErrorMsg] = useState('')

  const { appContext, error: appContextError, setAppContext } = useAppContext()

  const [initialPrompt, setInitialPrompt] = useState<string | null>(null)
  const [initialITVimage, setInitialITVimage] = useState<InterpolImageI | null>(null)

  // Recent generations state (localStorage)
  const [recentGenerations, setRecentGenerations] = useState<(ImageI | VideoI)[]>([])
  const [playingRecentVideo, setPlayingRecentVideo] = useState<string | null>(null)
  const [fullscreenMedia, setFullscreenMedia] = useState<{
    url: string
    item: ImageI | VideoI
    isVideo: boolean
  } | null>(null)
  const STORAGE_KEY_RECENT = 'recent_generations'
  const MAX_RECENT_ITEMS = 10

  // Polling state
  const [pollingOperation, setPollingOperation] = useState<{ name: string; metadata: OperationMetadataI } | null>(null)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollingAttemptsRef = useRef(0)
  const pollingIntervalRef = useRef(INITIAL_POLLING_INTERVAL_MS)

  // Load recent generations from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_RECENT)
        if (stored) {
          const parsed = JSON.parse(stored)
          setRecentGenerations(Array.isArray(parsed) ? parsed : [])
        }
      } catch (error) {
        console.error('Error loading recent generations:', error)
      }
    }
  }, [])

  // Effect for handling prompts from other pages (e.g., Library)
  useEffect(() => {
    const { promptToGenerateImage, promptToGenerateVideo } = appContext ?? {}
    const prompt = promptToGenerateImage || promptToGenerateVideo
    if (prompt) {
      const isImage = !!promptToGenerateImage
      setGenerationMode(isImage ? 'Generate an Image' : 'Generate a Video')
      setInitialPrompt(prompt)
      setAppContext((prev) => ({
        ...(prev ?? appContextDataDefault),
        promptToGenerateImage: '',
        promptToGenerateVideo: '',
      }))
    }
  }, [appContext?.promptToGenerateImage, appContext?.promptToGenerateVideo, setAppContext])

  // Effect for handling image-to-video from other pages
  useEffect(() => {
    if (!appContext?.imageToVideo) return

    const fetchAndSetImage = async (gcsPath: string) => {
      setGenerationMode('Generate a Video')
      try {
        const { data } = await downloadMediaFromGcs(gcsPath)
        if (!data) throw new Error('No image data returned from storage.')

        const imageSrc = `data:image/png;base64,${data}`
        const img = new window.Image()
        img.onload = () => {
          setInitialITVimage({
            format: 'png',
            base64Image: imageSrc,
            purpose: 'first',
            ratio: getAspectRatio(img.width, img.height),
            width: img.width,
            height: img.height,
          })
          setAppContext((prev) => ({ ...(prev ?? appContextDataDefault), imageToVideo: '' }))
        }
        img.onerror = () => {
          throw new Error('Error loading image for dimension calculation.')
        }
        img.src = imageSrc
      } catch (error) {
        console.error('Error fetching image for ITV:', error)
        setGenerationErrorMsg(
          `Failed to load image for video generation: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    fetchAndSetImage(appContext.imageToVideo)
  }, [appContext?.imageToVideo, setAppContext])

  const stopPolling = () => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }
    setPollingOperation(null)
  }

  // Polling effect for video generation
  useEffect(() => {
    if (!pollingOperation) return

    const poll = async () => {
      if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
        setGenerationErrorMsg(`Video generation timed out after ${MAX_POLLING_ATTEMPTS} attempts.`)
        stopPolling()
        return
      }
      pollingAttemptsRef.current++

      try {
        const statusResult = await getVideoGenerationStatus(
          pollingOperation.name,
          appContext,
          pollingOperation.metadata.formData,
          pollingOperation.metadata.prompt,
          pollingOperation.metadata.startTime,
          pollingOperation.metadata.startMs
        )

        // If polling was stopped while waiting for status
        if (!pollingTimeoutRef.current) return

        if (statusResult.done) {
          if (statusResult.error) {
            setGenerationErrorMsg(statusResult.error)
          } else if (statusResult.videos?.length) {
            setGeneratedVideos(statusResult.videos)
            setGeneratedImages([])
            
            // Save to localStorage and History
            saveToRecentGenerations(statusResult.videos)
            saveVideoToHistory(statusResult.videos, pollingOperation.metadata)
          } else {
            setGenerationErrorMsg('Video generation finished, but no results were returned.')
          }
          stopPolling()
          setIsLoading(false)
        } else {
          // Not done, schedule next poll
          const jitter = pollingIntervalRef.current * JITTER_FACTOR * (Math.random() - 0.5)
          const nextInterval = Math.round(pollingIntervalRef.current + jitter)
          pollingIntervalRef.current = Math.min(pollingIntervalRef.current * BACKOFF_FACTOR, MAX_POLLING_INTERVAL_MS)
          pollingTimeoutRef.current = setTimeout(poll, nextInterval)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
        setGenerationErrorMsg(`Error checking video status: ${message}`)
        stopPolling()
        setIsLoading(false)
      }
    }

    pollingTimeoutRef.current = setTimeout(poll, pollingIntervalRef.current)

    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
    }
  }, [pollingOperation, appContext])

  const resetGenerationState = (newMode?: GenerationMode) => {
    setIsLoading(false)
    setGenerationErrorMsg('')
    setGeneratedImages([])
    setGeneratedVideos([])
    setGeneratedCount(0)
    setInitialPrompt(null)
    if (newMode === 'Generate an Image' || !newMode) {
      setInitialITVimage(null)
    }
    stopPolling()
  }

  const handleModeSwitch = ({ clickedValue }: { clickedValue: GenerationMode }) => {
    if (clickedValue !== generationMode && !isLoading) {
      setGenerationMode(clickedValue)
      resetGenerationState(clickedValue)
    }
  }

  const handleRequestSent = (loading: boolean, count: number) => {
    setIsLoading(loading)
    setGeneratedCount(count)
    setGenerationErrorMsg('')
    setGeneratedImages([])
    setGeneratedVideos([])
  }

  // Save generations to localStorage
  const saveToRecentGenerations = (items: (ImageI | VideoI)[]) => {
    if (typeof window === 'undefined') return
    
    try {
      const updated = [...items, ...recentGenerations].slice(0, MAX_RECENT_ITEMS)
      setRecentGenerations(updated)
      localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updated))
    } catch (error) {
      console.error('Error saving to recent generations:', error)
    }
  }

  // Save video generation to History
  const saveVideoToHistory = async (videos: VideoI[], metadata: OperationMetadataI) => {
    if (!videos.length) {
      console.log('📋 No videos to save to history')
      return
    }
    
    try {
      const video = videos[0] // Use first video for metadata
      const generationMetadata: GenerationMetadata = {
        id: `video_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString(),
        type: 'video',
        model: video.modelVersion,
        prompt: metadata.prompt,
        negativePrompt: metadata.formData.negativePrompt || undefined,
        parameters: {
          userQuery: metadata.prompt, // Original user query/prompt
          aspectRatio: metadata.formData.aspectRatio,
          resolution: metadata.formData.resolution,
          duration: `${metadata.formData.durationSeconds}s`,
          sampleCount: metadata.formData.sampleCount,
          isVideoWithAudio: metadata.formData.isVideoWithAudio,
          style: metadata.formData.style,
          secondary_style: metadata.formData.secondary_style,
        },
        outputs: videos.map(v => ({
          url: v.src,
          gcsUri: v.gcsUri,
          format: v.format,
          width: v.width,
          height: v.height,
          duration: v.duration,
        })),
        performance: {
          tokensUsed: video.metadata?.tokensUsed,
          inputTokens: video.metadata?.inputTokens,
          outputTokens: video.metadata?.outputTokens,
          totalTokens: video.metadata?.totalTokens,
          executionTimeMs: video.metadata?.executionTimeMs || 0,
          startTime: metadata.startTime,
          endTime: video.metadata?.endTime || new Date().toISOString(),
        },
        cost: video.metadata?.estimatedCost ? {
          estimatedCost: video.metadata.estimatedCost,
          currency: 'USD',
        } : undefined,
      }
      
      console.log('📋 Saving video to history:', generationMetadata.id)
      const result = await saveGenerationMetadata(generationMetadata)
      if (result.success) {
        console.log('✅ Video saved to history:', result.path)
      } else {
        console.error('❌ Failed to save video to history:', result.error)
      }
      
      // Also upload metadata to GCS alongside each video
      const bucketName = process.env.NEXT_PUBLIC_TEAM_BUCKET
      if (bucketName && appContext?.userID) {
        for (const vid of videos) {
          try {
            // Extract the path from gcsUri (gs://bucket/path/file.mp4 -> path/file.mp4)
            const gcsPath = vid.gcsUri.replace(`gs://${bucketName}/`, '')
            // Replace file extension with .json
            const jsonPath = gcsPath.replace(/\.(mp4|mov|webm)$/i, '.json')
            
            // Create a simplified metadata object for GCS
            const gcsMetadata = {
              model: video.modelVersion,
              prompt: metadata.prompt,
              aspectRatio: metadata.formData.aspectRatio,
              resolution: metadata.formData.resolution,
              duration: metadata.formData.durationSeconds,
              timestamp: new Date().toISOString(),
              performance: {
                tokensUsed: video.metadata?.tokensUsed,
                totalTokens: video.metadata?.totalTokens,
                executionTimeMs: video.metadata?.executionTimeMs,
              },
            }
            
            await uploadMetadataJSON(gcsMetadata, bucketName, jsonPath)
            console.log(`📤 Uploaded metadata to GCS: ${jsonPath}`)
          } catch (error) {
            console.error(`Failed to upload metadata for ${vid.gcsUri}:`, error)
          }
        }
      }
    } catch (error) {
      console.error('Error saving video to history:', error)
    }
  }

  // Save image generation to History
  const saveImageToHistory = async (images: ImageI[]) => {
    if (!images.length) {
      console.log('📋 No images to save to history')
      return
    }
    
    try {
      const image = images[0] // Use first image for metadata
      const generationMetadata: GenerationMetadata = {
        id: `image_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString(),
        type: 'image',
        model: image.modelVersion,
        prompt: image.prompt,
        negativePrompt: undefined,
        parameters: {
          userQuery: image.prompt, // Original user query/prompt
          aspectRatio: image.ratio,
          sampleCount: images.length,
        },
        outputs: images.map(img => ({
          url: img.src,
          gcsUri: img.gcsUri,
          format: img.format,
          width: img.width,
          height: img.height,
        })),
        performance: {
          tokensUsed: image.metadata?.tokensUsed,
          inputTokens: image.metadata?.inputTokens,
          outputTokens: image.metadata?.outputTokens,
          totalTokens: image.metadata?.totalTokens,
          executionTimeMs: image.metadata?.executionTimeMs || 0,
          startTime: image.metadata?.startTime || new Date().toISOString(),
          endTime: image.metadata?.endTime || new Date().toISOString(),
        },
        cost: image.metadata?.estimatedCost ? {
          estimatedCost: image.metadata.estimatedCost,
          currency: 'USD',
        } : undefined,
      }
      
      console.log('📋 Saving image to history:', generationMetadata.id)
      const result = await saveGenerationMetadata(generationMetadata)
      if (result.success) {
        console.log('✅ Image saved to history:', result.path)
      } else {
        console.error('❌ Failed to save image to history:', result.error)
      }
      
      // Also upload metadata to GCS alongside each image
      const bucketName = process.env.NEXT_PUBLIC_TEAM_BUCKET
      if (bucketName && appContext?.userID) {
        for (const img of images) {
          try {
            // Extract the path from gcsUri (gs://bucket/path/file.png -> path/file.png)
            const gcsPath = img.gcsUri.replace(`gs://${bucketName}/`, '')
            // Replace file extension with .json
            const jsonPath = gcsPath.replace(/\.(png|jpg|jpeg|webp)$/i, '.json')
            
            // Create a complete metadata object for GCS
            const gcsMetadata = {
              model: image.modelVersion,
              prompt: image.prompt,
              aspectRatio: image.ratio,
              timestamp: new Date().toISOString(),
              performance: {
                executionTimeMs: image.metadata?.executionTimeMs,
                startTime: image.metadata?.startTime,
                endTime: image.metadata?.endTime,
                tokensUsed: image.metadata?.tokensUsed,
                inputTokens: image.metadata?.inputTokens,
                outputTokens: image.metadata?.outputTokens,
                totalTokens: image.metadata?.totalTokens,
                perImageTokens: image.metadata?.perImageTokens,
                estimatedCost: image.metadata?.estimatedCost,
              },
              parameters: image.metadata?.parameters || {},
            }
            
            await uploadMetadataJSON(gcsMetadata, bucketName, jsonPath)
            console.log(`📤 Uploaded metadata to GCS: ${jsonPath}`)
          } catch (error) {
            console.error(`Failed to upload metadata for ${img.gcsUri}:`, error)
          }
        }
      }
    } catch (error) {
      console.error('Error saving image to history:', error)
    }
  }

  const handleImageGeneration = (newImages: ImageI[]) => {
    setGeneratedImages(newImages)
    setIsLoading(false)
    
    // Save to localStorage and History
    saveToRecentGenerations(newImages)
    saveImageToHistory(newImages)
  }

  const handleVideoPollingStart = (operationName: string, metadata: OperationMetadataI) => {
    // Clear any existing polling WITHOUT changing the loading state
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }

    pollingAttemptsRef.current = 0
    pollingIntervalRef.current = INITIAL_POLLING_INTERVAL_MS
    setPollingOperation({ name: operationName, metadata })
  }

  const handleNewError = (newErrorMsg: string) => {
    setGenerationErrorMsg(newErrorMsg)
    stopPolling()
    setIsLoading(false)
  }

  if (appContext?.isLoading) {
    return (
      <Box p={5}>
        <Typography
          variant="h3"
          sx={{ fontWeight: 400, color: appContextError ? palette.error.main : palette.primary.main }}
        >
          {appContextError
            ? 'Error loading your profile content! Retry or contact you IT admin.'
            : 'Loading your profile content...'}
        </Typography>
      </Box>
    )
  }

  const isImageMode = generationMode === 'Generate an Image'
  const isVideoEnabled = process.env.NEXT_PUBLIC_VEO_ENABLED === 'true'

  const commonFormProps = {
    isLoading,
    errorMsg: generationErrorMsg,
    initialPrompt: initialPrompt ?? '',
    onRequestSent: handleRequestSent,
    onNewErrorMsg: handleNewError,
  }

  const imageFormProps = {
    ...commonFormProps,
    generationType: 'Image' as const,
    onImageGeneration: handleImageGeneration,
    randomPrompts: ImageRandomPrompts,
    generationFields: imageGenerationUtils,
    promptIndication:
      'Describe your image: subjects, visual looks, actions, arrangement, setting (time/ place/ weather), style, lighting, colors, mood',
  }

  const videoFormProps = {
    ...commonFormProps,
    generationType: 'Video' as const,
    onVideoPollingStart: handleVideoPollingStart,
    randomPrompts: VideoRandomPrompts,
    generationFields: videoGenerationUtils,
    initialITVimage: initialITVimage ?? undefined,
    promptIndication:
      'Describe your video: subjects, visual looks, actions, arrangement, movements, camera motion, setting (time/ place/ weather), style, lighting, colors, mood',
  }

  // Check if item is video
  const isVideoItem = (item: ImageI | VideoI): item is VideoI => {
    return 'duration' in item
  }

  return (
    <Box p={5} sx={{ maxHeight: '100vh' }}>
      <Grid wrap="nowrap" container spacing={6} direction="row" columns={2}>
        <Grid size={1.1} flex={0} sx={{ maxWidth: 700, minWidth: 610 }}>
          <ChipGroup
            width="100%"
            required={false}
            options={['Generate an Image', 'Generate a Video']}
            value={generationMode}
            disabled={isLoading || !isVideoEnabled}
            onChange={handleModeSwitch}
            handleChipClick={handleModeSwitch}
            weight={500}
          />

          {isImageMode && <GenerateForm key="image-form" {...imageFormProps} />}
          {isVideoEnabled && !isImageMode && <GenerateForm key="video-form" {...videoFormProps} />}
          
          {/* Recent Generations - Moved to left side */}
          {recentGenerations.length > 0 && !isLoading && (
            <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${palette.divider}` }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 500, color: palette.text.secondary }}>
                Recent Generations
              </Typography>
              <Grid container spacing={2}>
                {recentGenerations.slice(0, 6).map((item, index) => {
                  const isVideo = isVideoItem(item)
                  return (
                    <Grid key={item.key + '_recent_' + index} size={{ xs: 6, sm: 6, md: 4 }}>
                      <Box
                        sx={{
                          position: 'relative',
                          cursor: 'pointer',
                          borderRadius: 1,
                          overflow: 'hidden',
                          '&:hover': {
                            opacity: 0.8,
                            transform: 'scale(1.02)',
                            transition: 'all 0.2s',
                          },
                        }}
                      >
                        <Box
                          onClick={() => {
                            setFullscreenMedia({
                              url: item.src,
                              item: item,
                              isVideo: isVideo,
                            })
                          }}
                          sx={{ 
                            cursor: 'pointer',
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                          }}
                        >
                          {isVideo ? (
                            <>
                              <video
                                src={item.src}
                                style={{
                                  width: '100%',
                                  height: 'auto',
                                  display: 'block',
                                  backgroundColor: palette.grey[900],
                                }}
                                muted
                                loop
                                playsInline
                                preload="metadata"
                                onLoadedMetadata={(e) => {
                                  const video = e.currentTarget
                                  video.currentTime = 1
                                }}
                              />
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <PlayCircleOutline sx={{ fontSize: '3rem', color: 'white', opacity: 0.9 }} />
                              </Box>
                            </>
                          ) : (
                            <img
                              src={item.src}
                              alt={item.altText}
                              style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block',
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    </Grid>
                  )
                })}
              </Grid>
            </Box>
          )}
        </Grid>
        <Grid size={0.9} flex={1} sx={{ pt: 14, maxWidth: 850, minWidth: 400 }}>
          {isImageMode ? (
            <OutputImagesDisplay
              isLoading={isLoading}
              generatedImagesInGCS={generatedImages}
              generatedCount={generatedCount}
              isPromptReplayAvailable={true}
            />
          ) : (
            <OutputVideosDisplay
              isLoading={isLoading}
              generatedVideosInGCS={generatedVideos}
              generatedCount={generatedCount}
            />
          )}
        </Grid>
      </Grid>

      {/* Fullscreen Media Player Dialog */}
      <Dialog
        open={!!fullscreenMedia}
        onClose={() => setFullscreenMedia(null)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            maxWidth: '90vw',
            maxHeight: '90vh',
            m: 2,
          },
        }}
      >
        <IconButton
          onClick={() => setFullscreenMedia(null)}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'white',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1,
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
            },
          }}
        >
          <Close />
        </IconButton>
        
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {fullscreenMedia && (
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {fullscreenMedia.isVideo ? (
                <video
                  src={fullscreenMedia.url}
                  controls
                  autoPlay
                  loop
                  style={{
                    maxWidth: '100%',
                    maxHeight: '80vh',
                    width: 'auto',
                    height: 'auto',
                  }}
                />
              ) : (
                <img
                  src={fullscreenMedia.url}
                  alt="Generated content"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '80vh',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                  }}
                />
              )}
              
              {/* Media metadata */}
              <Box sx={{ mt: 2, px: 3, pb: 3, width: '100%', maxWidth: 800 }}>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Chip
                    label={fullscreenMedia.isVideo ? '🎬 Video' : '🖼️ Image'}
                    size="small"
                    sx={{ bgcolor: palette.primary.main, color: 'white' }}
                  />
                  {fullscreenMedia.item.modelVersion && (
                    <Chip
                      label={fullscreenMedia.item.modelVersion}
                      size="small"
                      sx={{ bgcolor: palette.grey[700], color: 'white' }}
                    />
                  )}
                </Stack>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
