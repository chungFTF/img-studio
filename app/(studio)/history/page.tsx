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
import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Stack,
  Chip,
  IconButton,
  Grid,
  Tabs,
  Tab,
  Alert,
  Button,
  Dialog,
  DialogContent,
} from '@mui/material'
import { Delete, Image as ImageIcon, VideoLibrary, CloudDownload, PlayCircleOutline, Close, Fullscreen, DeleteSweep, ClearAll, CloudUpload } from '@mui/icons-material'

import theme from '../../theme'
import { loadGenerationHistory, deleteGenerationSession, GenerationMetadata, saveGenerationMetadata, clearAllHistory } from '../../api/generation-metadata'
import { listFilesFromGCS, getSignedURL, readMetadataJSON, downloadMediaFromGcs } from '../../api/cloud-storage/action'
import LoadingAnimation from '../../ui/ux-components/LoadingAnimation'
import GenerationMetadataDisplay from '../../ui/ux-components/GenerationMetadataDisplay'
import GoogleDriveSaveDialog from '../../ui/transverse-components/GoogleDriveSaveDialog'
import { useGoogleDrive } from '../../context/google-drive-context'

const { palette } = theme

export default function HistoryPage() {
  const [history, setHistory] = useState<GenerationMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')
  const [isImporting, setIsImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [loadingUrls, setLoadingUrls] = useState(false)
  
  // Full screen video player state
  const [fullscreenVideo, setFullscreenVideo] = useState<{
    url: string
    metadata: GenerationMetadata
  } | null>(null)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  
  // Google Drive save dialog state
  const [driveDialogOpen, setDriveDialogOpen] = useState(false)
  const [selectedFileForDrive, setSelectedFileForDrive] = useState<{ url: string; fileName: string; fileData: string } | null>(null)
  const [loadingFileData, setLoadingFileData] = useState(false)
  const { accessToken, isConnected, connectDrive, disconnectDrive, isReady } = useGoogleDrive()
  const ITEMS_PER_PAGE = 6

  useEffect(() => {
    loadHistory()
  }, [])

  // Load signed URLs only for current page items (lazy loading)
  useEffect(() => {
    const loadCurrentPageUrls = async () => {
      // Filter to get current page items
      const filtered = history.filter((item) => {
        if (filter === 'all') return true
        return item.type === filter
      })
      
      const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
      const endIdx = startIdx + ITEMS_PER_PAGE
      const currentPageItems = filtered.slice(startIdx, endIdx)
      
      // Check if we need to load any URLs
      const itemsNeedingUrls = currentPageItems.filter(
        item => !signedUrls[item.id] && item.outputs[0] && !item.outputs[0].url && item.outputs[0].gcsUri
      )
      
      if (itemsNeedingUrls.length === 0) return
      
      setLoadingUrls(true)
      const urlsToLoad: Record<string, string> = {}
      
      for (const item of itemsNeedingUrls) {
        try {
          const signedUrl = await getSignedURL(item.outputs[0].gcsUri)
          if (typeof signedUrl === 'string') {
            urlsToLoad[item.id] = signedUrl
          }
        } catch (error) {
          console.error('Error getting signed URL for:', item.outputs[0].gcsUri, error)
        }
      }
      
      if (Object.keys(urlsToLoad).length > 0) {
        setSignedUrls(prev => ({ ...prev, ...urlsToLoad }))
      }
      
      setLoadingUrls(false)
    }

    if (history.length > 0) {
      loadCurrentPageUrls()
    }
  }, [history, currentPage, filter])

  const loadHistory = async () => {
    setIsLoading(true)
    setError(null)

    const result = await loadGenerationHistory()

    if (result.success && result.data) {
      // Server already returns only the 30 most recent records
      setHistory(result.data)
    } else {
      setError(result.error || 'Failed to load history')
    }

    setIsLoading(false)
  }

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this generation?')) return

    const result = await deleteGenerationSession(sessionId)

    if (result.success) {
      setHistory(history.filter((item) => item.id !== sessionId))
    } else {
      alert(`Failed to delete: ${result.error}`)
    }
  }

  const handleSaveToDrive = async (gcsUri: string, fileName: string, itemType: 'image' | 'video', format?: string) => {
    if (!accessToken) {
      alert('Please connect to Google Drive first')
      return
    }

    if (!gcsUri || !gcsUri.startsWith('gs://')) {
      alert('Invalid file source. GCS URI is required.')
      return
    }

    setLoadingFileData(true)
    try {
      // Download file from GCS server-side to avoid CORS issues
      const result = await downloadMediaFromGcs(gcsUri)
      
      if (result.error || !result.data) {
        throw new Error(result.error || 'Failed to download file from GCS')
      }

      // Determine MIME type from file extension or item type
      const getMimeType = (): string => {
        const ext = format || fileName.split('.').pop()?.toLowerCase()
        if (itemType === 'video') {
          if (ext === 'mp4') return 'video/mp4'
          if (ext === 'mov') return 'video/quicktime'
          if (ext === 'webm') return 'video/webm'
          return 'video/mp4' // default
        } else {
          if (ext === 'png') return 'image/png'
          if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
          if (ext === 'webp') return 'image/webp'
          return 'image/png' // default
        }
      }
      
      const mimeType = getMimeType()
      const fileData = `data:${mimeType};base64,${result.data}`
      
      setSelectedFileForDrive({ url: gcsUri, fileName, fileData })
      setDriveDialogOpen(true)
    } catch (error) {
      console.error('Error loading file for Drive:', error)
      alert('Failed to load file for Google Drive upload: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoadingFileData(false)
    }
  }

  const handleCloseDriveDialog = () => {
    setDriveDialogOpen(false)
    setSelectedFileForDrive(null)
  }

  const handleClearImported = async () => {
    if (!confirm('Clear all imported records? This will only remove imported history entries, not the actual files in GCS.')) return

    const importedRecords = history.filter(item => item.id.startsWith('imported_'))
    
    if (importedRecords.length === 0) {
      alert('No imported records found.')
      return
    }

    let deletedCount = 0
    for (const item of importedRecords) {
      const result = await deleteGenerationSession(item.id)
      if (result.success) {
        deletedCount++
      }
    }

    setHistory(history.filter((item) => !item.id.startsWith('imported_')))
    alert(`✅ Cleared ${deletedCount} imported records. You can re-import with updated format.`)
  }

  const handleImportFromGCS = async () => {
    if (!confirm('Import past generations from GCS bucket? This may take a while.')) return

    setIsImporting(true)
    setImportMessage('📥 Loading the 30 most recent files from GCS...')

    try {
      // List all files from GCS
      const result = await listFilesFromGCS()

      if (result.error) {
        setImportMessage(`Error: ${result.error}`)
        setIsImporting(false)
        return
      }

      // Sort files by updated time (newest first) and take only the first 30
      const allFiles = result.files.sort((a: any, b: any) => 
        new Date(b.updated).getTime() - new Date(a.updated).getTime()
      )
      const files = allFiles.slice(0, 30)
      
      setImportMessage(`📥 Importing ${files.length} most recent files...`)

      let importedCount = 0
      let skippedCount = 0

      // Process each file and create history entry
      for (const file of files) {
        try {
          // Skip non-media files
          if (!file.contentType?.startsWith('image/') && !file.contentType?.startsWith('video/')) {
            skippedCount++
            continue
          }

          const isVideo = file.contentType.startsWith('video/')

          // Try to read metadata JSON file
          let gcsMetadata = null
          try {
            // Replace file extension with .json to find metadata file
            const jsonUri = file.gcsUri.replace(/\.(png|jpg|jpeg|webp|mp4|mov|webm)$/i, '.json')
            const metadataResult = await readMetadataJSON(jsonUri)
            if (metadataResult.success && metadataResult.data) {
              gcsMetadata = metadataResult.data
            }
          } catch (error) {
            // No metadata found, using defaults
          }

          // Create a metadata entry with data from GCS metadata if available
          const metadata: GenerationMetadata = {
            id: `imported_${Date.parse(file.updated)}_${Math.random().toString(36).substring(7)}`,
            timestamp: file.updated,
            type: isVideo ? 'video' : 'image',
            model: gcsMetadata?.model || (isVideo ? 'veo' : 'imagen'),
            prompt: gcsMetadata?.prompt || '',
            parameters: {
              imported: true,
              originalPath: file.name,
              // Include all parameters from GCS metadata
              ...(gcsMetadata?.parameters || {}),
              // Also include top-level parameters for backward compatibility
              ...(gcsMetadata?.aspectRatio && { aspectRatio: gcsMetadata.aspectRatio }),
              ...(gcsMetadata?.resolution && { resolution: gcsMetadata.resolution }),
              ...(gcsMetadata?.duration && { duration: `${gcsMetadata.duration}s` }),
            },
            outputs: [
              {
                url: '', // Will be generated on-demand
                gcsUri: file.gcsUri,
                format: file.contentType || 'unknown',
                width: undefined,
                height: undefined,
                duration: isVideo ? undefined : undefined,
              },
            ],
            performance: {
              // Use complete performance data from GCS if available
              ...(gcsMetadata?.performance?.tokensUsed && { tokensUsed: gcsMetadata.performance.tokensUsed }),
              ...(gcsMetadata?.performance?.inputTokens && { inputTokens: gcsMetadata.performance.inputTokens }),
              ...(gcsMetadata?.performance?.outputTokens && { outputTokens: gcsMetadata.performance.outputTokens }),
              ...(gcsMetadata?.performance?.totalTokens && { totalTokens: gcsMetadata.performance.totalTokens }),
              ...(gcsMetadata?.performance?.executionTimeMs && { executionTimeMs: gcsMetadata.performance.executionTimeMs }),
              startTime: gcsMetadata?.performance?.startTime || gcsMetadata?.timestamp || file.updated,
              endTime: gcsMetadata?.performance?.endTime || gcsMetadata?.timestamp || file.updated,
            },
            cost: gcsMetadata?.performance?.estimatedCost ? {
              estimatedCost: gcsMetadata.performance.estimatedCost,
              currency: 'USD',
            } : undefined,
          }

          const saveResult = await saveGenerationMetadata(metadata)
          if (saveResult.success) {
            importedCount++
          } else {
            skippedCount++
          }
        } catch (error) {
          console.error('Error importing file:', file.name, error)
          skippedCount++
        }
      }

      setImportMessage(`✅ Import complete! Imported: ${importedCount}, Skipped: ${skippedCount}`)
      
      // Reload history
      setTimeout(() => {
        loadHistory()
        setImportMessage(null)
      }, 2000)
    } catch (error) {
      console.error('Error importing from GCS:', error)
      setImportMessage(`❌ Import failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsImporting(false)
    }
  }

  const filteredHistory = history.filter((item) => {
    if (filter === 'all') return true
    return item.type === filter
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const displayedHistory = filteredHistory.slice(startIndex, endIndex)
  const hasMore = currentPage < totalPages

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter])

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <LoadingAnimation message="Loading history..." type="circular" size="large" />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 5, maxWidth: 2000, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h3" sx={{ fontWeight: 600, color: palette.primary.main }}>
        Generation History
      </Typography>
        <Stack direction="row" spacing={2}>
          {/* Google Drive 连接按钮 */}
          {isConnected ? (
            <Button
              variant="outlined"
              startIcon={<CloudUpload />}
              onClick={disconnectDrive}
              sx={{
                borderColor: palette.success.main,
                color: palette.success.main,
                '&:hover': {
                  borderColor: palette.success.dark,
                  backgroundColor: palette.success.light + '20',
                },
              }}
            >
              Drive Connected
            </Button>
          ) : (
            <Button
              variant="outlined"
              startIcon={<CloudUpload />}
              onClick={connectDrive}
              disabled={!isReady}
              sx={{
                borderColor: palette.primary.main,
                color: palette.primary.main,
                '&:hover': {
                  borderColor: palette.primary.dark,
                  backgroundColor: palette.primary.light + '20',
                },
              }}
            >
              {isReady ? 'Connect Google Drive' : 'Loading...'}
            </Button>
          )}
          <IconButton
            onClick={async () => {
              if (window.confirm('Clear all cached data and generation history?\n\nThis will:\n- Clear localStorage (prompts, images, recent generations)\n- Delete all generation history records\n- Reload the page')) {
                try {
                  // Clear localStorage
                  localStorage.clear()
                  
                  // Clear server-side history
                  const result = await clearAllHistory()
                  
                  if (result.success) {
                    window.location.reload()
                  } else {
                    alert(`Failed to clear history: ${result.error}`)
                  }
                } catch (error) {
                  console.error('Error clearing all data:', error)
                  alert('Failed to clear all data')
                }
              }
            }}
            sx={{
              bgcolor: palette.warning.main,
              color: 'white',
              '&:hover': { bgcolor: palette.warning.dark },
            }}
            title="Clear all cache and history"
          >
            <ClearAll />
          </IconButton>
          <IconButton
            onClick={handleClearImported}
            sx={{
              bgcolor: palette.error.main,
              color: 'white',
              '&:hover': { bgcolor: palette.error.dark },
            }}
            title="Clear all imported records"
          >
            <DeleteSweep />
          </IconButton>
          <IconButton
            onClick={handleImportFromGCS}
            disabled={isImporting}
            sx={{
              bgcolor: palette.primary.main,
              color: 'white',
              '&:hover': { bgcolor: palette.primary.dark },
              '&:disabled': { bgcolor: palette.grey[400] },
            }}
            title="Import past generations from GCS bucket"
          >
            <CloudDownload />
          </IconButton>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {importMessage && (
        <Alert severity={importMessage.includes('❌') ? 'error' : 'info'} sx={{ mb: 3 }}>
          {importMessage}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={filter} 
          onChange={(_, newValue) => setFilter(newValue)}
          sx={{ 
            minHeight: 40,
            '& .MuiTab-root': { 
              minHeight: 40, 
              py: 1,
              fontSize: '0.875rem'
            }
          }}
        >
          <Tab label="All" value="all" />
          <Tab 
            label="Images" 
            value="image" 
            icon={<ImageIcon sx={{ fontSize: '1.1rem' }} />} 
            iconPosition="start" 
          />
          <Tab 
            label="Videos" 
            value="video" 
            icon={<VideoLibrary sx={{ fontSize: '1.1rem' }} />} 
            iconPosition="start" 
          />
        </Tabs>
      </Box>

      {filteredHistory.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body1" sx={{ color: palette.text.disabled, fontWeight: 500 }}>
            No generation history found
          </Typography>
          <Typography variant="body2" sx={{ color: palette.text.disabled, mt: 1, fontSize: '0.875rem' }}>
            Your generated images and videos will appear here
          </Typography>
          <Typography variant="caption" sx={{ color: palette.text.secondary, mt: 2, display: 'block', fontSize: '0.8rem' }}>
            💡 Click the <CloudDownload fontSize="small" sx={{ verticalAlign: 'middle', mx: 0.5, fontSize: '1rem' }} /> button above to import past generations from GCS bucket
          </Typography>
        </Box>
      ) : (
        <>
        <Grid container spacing={1.5} sx={{ maxWidth: 1400, margin: '0 auto' }}>
            {displayedHistory.map((item) => {
              const mediaUrl = item.outputs[0]?.url || signedUrls[item.id]
              const isVideo = item.type === 'video'
              const isPlaying = playingVideo === item.id
              
              return (
                <Grid item xs={12} sm={6} md={4} lg={4} key={item.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                    backgroundColor: palette.background.paper,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                {item.outputs[0] && (
                    <Box
                      sx={{
                        position: 'relative',
                        height: 280,
                        backgroundColor: palette.grey[900],
                        overflow: 'hidden',
                      }}
                    >
                      {isVideo ? (
                        <>
                          <video
                            id={`video-${item.id}`}
                            src={mediaUrl}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            onLoadedMetadata={(e) => {
                              // Seek to 1 second for thumbnail
                              const video = e.currentTarget
                              video.currentTime = 1
                            }}
                          />
                          <Box
                            onClick={() => {
                              setFullscreenVideo({
                                url: mediaUrl,
                                metadata: item,
                              })
                            }}
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              backgroundColor: 'rgba(0,0,0,0.3)',
                              transition: 'background-color 0.2s',
                              '&:hover': {
                                backgroundColor: 'rgba(0,0,0,0.5)',
                              },
                            }}
                          >
                            <Stack alignItems="center" spacing={1}>
                              <PlayCircleOutline
                                sx={{
                                  fontSize: 64,
                                  color: 'white',
                                  opacity: 0.9,
                                }}
                              />
                              <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>
                                Click to play
                              </Typography>
                            </Stack>
                          </Box>
                        </>
                      ) : (
                        <Box
                          onClick={() => {
                            setFullscreenVideo({
                              url: mediaUrl,
                              metadata: item,
                            })
                          }}
                          sx={{ 
                            cursor: 'pointer',
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            '&:hover img': {
                              opacity: 0.8,
                            },
                          }}
                        >
                          <img
                            src={mediaUrl}
                    alt={item.prompt}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                              transition: 'opacity 0.2s',
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                )}

                <CardContent sx={{ 
                  flexGrow: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  backgroundColor: palette.background.paper,
                  p: 1,
                  '&:last-child': { pb: 1 },
                }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.2 }}>
                    <Stack direction="row" spacing={0.3} sx={{ minWidth: 0, flex: 1 }}>
                    <Chip
                      label={item.type}
                      size="small"
                      icon={item.type === 'video' ? <VideoLibrary /> : <ImageIcon />}
                      color={item.type === 'video' ? 'secondary' : 'primary'}
                        sx={{ 
                          fontSize: '0.65rem',
                          height: 18,
                          '& .MuiChip-label': { px: 0.6 },
                          '& .MuiChip-icon': { fontSize: '0.75rem', ml: 0.5 }
                        }}
                    />
                      <Chip 
                        label={item.model} 
                        size="small" 
                        sx={{
                          backgroundColor: palette.grey[200],
                          color: palette.text.primary,
                          fontWeight: 500,
                          fontSize: '0.65rem',
                          height: 18,
                          '& .MuiChip-label': { px: 0.6 }
                        }}
                      />
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, ml: 1 }}>
                      <IconButton 
                        size="small" 
                        color="primary" 
                        onClick={() => {
                          const gcsUri = item.outputs[0]?.gcsUri
                          if (gcsUri) {
                            handleSaveToDrive(
                              gcsUri,
                              `${item.type}_${item.model}_${new Date(item.timestamp).toISOString().split('T')[0]}.${item.outputs[0]?.format || (item.type === 'video' ? 'mp4' : 'png')}`,
                              item.type,
                              item.outputs[0]?.format
                            )
                          }
                        }}
                        disabled={!item.outputs[0]?.gcsUri || loadingFileData}
                        sx={{ flexShrink: 0, p: 0.3 }}
                      >
                        <CloudUpload sx={{ fontSize: '0.9rem' }} />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(item.id)} sx={{ flexShrink: 0, p: 0.3 }}>
                        <Delete sx={{ fontSize: '0.9rem' }} />
                      </IconButton>
                    </Stack>
                  </Stack>

                  {item.prompt && (
                  <Typography
                    variant="body2"
                    sx={{
                        mb: 0.3,
                        mt: 0.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                        color: palette.grey[500],
                        fontSize: '0.7rem',
                        lineHeight: 1.3,
                    }}
                  >
                    {item.prompt}
                  </Typography>
                  )}

                  {/* Date only */}
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: palette.grey[500],
                      fontSize: '0.65rem',
                      mt: item.prompt ? 0.3 : 0.2,
                    }}
                  >
                      {new Date(item.timestamp).toLocaleString()}
                    </Typography>

                  <GenerationMetadataDisplay
                    metadata={{
                      ...item.performance,
                      parameters: item.parameters,
                    }}
                  />
                </CardContent>
              </Card>
            </Grid>
          )})}
        </Grid>

          {/* Loading indicator for current page */}
          {loadingUrls && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Typography variant="body2" sx={{ color: palette.primary.main }}>
                ⏳ Loading media for this page...
              </Typography>
            </Box>
          )}

          {/* Pagination Controls */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 4, gap: 2 }}>
            <Typography variant="body2" sx={{ color: palette.text.secondary }}>
              Page {currentPage} of {totalPages} ({filteredHistory.length} total)
            </Typography>
            
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loadingUrls}
              >
                Previous
              </Button>
              
              <Button
                variant="contained"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={!hasMore || loadingUrls}
              >
                {hasMore ? 'Next Page' : 'No More'}
              </Button>
            </Stack>
          </Box>
        </>
      )}

      {/* Fullscreen Video Player Dialog */}
      <Dialog
        open={!!fullscreenVideo}
        onClose={() => setFullscreenVideo(null)}
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
          onClick={() => setFullscreenVideo(null)}
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
          {fullscreenVideo && (
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {fullscreenVideo.metadata.type === 'video' ? (
                <video
                  src={fullscreenVideo.url}
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
                  src={fullscreenVideo.url}
                  alt={fullscreenVideo.metadata.prompt}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '80vh',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                  }}
                />
              )}
              
              {/* Video metadata */}
              <Box sx={{ mt: 2, px: 3, pb: 3, width: '100%', maxWidth: 800 }}>
                <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
                  {fullscreenVideo.metadata.prompt}
                </Typography>
                
                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
                  <Chip
                    label={fullscreenVideo.metadata.model}
                    size="small"
                    sx={{ bgcolor: palette.primary.main, color: 'white' }}
                  />
                  {fullscreenVideo.metadata.parameters?.duration && (
                    <Chip
                      label={`Duration: ${fullscreenVideo.metadata.parameters.duration}`}
                      size="small"
                      sx={{ bgcolor: palette.grey[700], color: 'white' }}
                    />
                  )}
                  {fullscreenVideo.metadata.parameters?.resolution && (
                    <Chip
                      label={fullscreenVideo.metadata.parameters.resolution}
                      size="small"
                      sx={{ bgcolor: palette.grey[700], color: 'white' }}
                    />
                  )}
                </Stack>
                
                <Typography variant="caption" sx={{ color: palette.grey[400] }}>
                  {new Date(fullscreenVideo.metadata.timestamp).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Google Drive Save Dialog */}
      {selectedFileForDrive && accessToken && (
        <GoogleDriveSaveDialog
          open={driveDialogOpen}
          onClose={handleCloseDriveDialog}
          accessToken={accessToken}
          fileName={selectedFileForDrive.fileName}
          fileData={selectedFileForDrive.fileData}
        />
      )}
    </Box>
  )
}
