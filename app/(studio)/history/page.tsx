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
} from '@mui/material'
import { Delete, Image as ImageIcon, VideoLibrary, AccessTime, Token } from '@mui/icons-material'

import theme from '../../theme'
import { loadGenerationHistory, deleteGenerationSession, GenerationMetadata } from '../../api/generation-metadata'
import LoadingAnimation from '../../ui/ux-components/LoadingAnimation'
import GenerationMetadataDisplay from '../../ui/ux-components/GenerationMetadataDisplay'

const { palette } = theme

export default function HistoryPage() {
  const [history, setHistory] = useState<GenerationMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setIsLoading(true)
    setError(null)

    const result = await loadGenerationHistory()

    if (result.success && result.data) {
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

  const filteredHistory = history.filter((item) => {
    if (filter === 'all') return true
    return item.type === filter
  })

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
    const minutes = Math.floor(ms / 60000)
    const seconds = ((ms % 60000) / 1000).toFixed(0)
    return `${minutes}m ${seconds}s`
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <LoadingAnimation message="Loading history..." type="circular" size="large" />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 5, maxWidth: 1600, margin: '0 auto' }}>
      <Typography variant="h3" sx={{ mb: 3, fontWeight: 600, color: palette.primary.main }}>
        Generation History
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={filter} onChange={(_, newValue) => setFilter(newValue)}>
          <Tab label="All" value="all" />
          <Tab label="Images" value="image" icon={<ImageIcon />} iconPosition="start" />
          <Tab label="Videos" value="video" icon={<VideoLibrary />} iconPosition="start" />
        </Tabs>
      </Box>

      {filteredHistory.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" sx={{ color: palette.text.disabled }}>
            No generation history found
          </Typography>
          <Typography variant="body2" sx={{ color: palette.text.disabled, mt: 1 }}>
            Your generated images and videos will appear here
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredHistory.map((item) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                {item.outputs[0] && (
                  <CardMedia
                    component={item.type === 'video' ? 'video' : 'img'}
                    height="200"
                    image={item.outputs[0].url}
                    alt={item.prompt}
                    sx={{ objectFit: 'cover', backgroundColor: palette.grey[200] }}
                    {...(item.type === 'video' ? { controls: false, muted: true } : {})}
                  />
                )}

                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Chip
                      label={item.type}
                      size="small"
                      icon={item.type === 'video' ? <VideoLibrary /> : <ImageIcon />}
                      color={item.type === 'video' ? 'secondary' : 'primary'}
                    />
                    <Chip label={item.model} size="small" variant="outlined" />
                  </Stack>

                  <Typography
                    variant="body2"
                    sx={{
                      mb: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      minHeight: 40,
                    }}
                  >
                    {item.prompt}
                  </Typography>

                  <Stack spacing={1} sx={{ mt: 'auto' }}>
                    {item.performance.executionTimeMs && (
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <AccessTime sx={{ fontSize: '1rem', color: palette.text.disabled }} />
                        <Typography variant="caption" sx={{ color: palette.text.secondary }}>
                          {formatTime(item.performance.executionTimeMs)}
                        </Typography>
                      </Stack>
                    )}

                    {item.performance.totalTokens && (
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Token sx={{ fontSize: '1rem', color: palette.text.disabled }} />
                        <Typography variant="caption" sx={{ color: palette.text.secondary }}>
                          {item.performance.totalTokens.toLocaleString()} tokens
                        </Typography>
                      </Stack>
                    )}

                    <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </Typography>
                  </Stack>

                  <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                    <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}>
                      <Delete />
                    </IconButton>
                  </Stack>

                  <GenerationMetadataDisplay
                    metadata={{
                      ...item.performance,
                      parameters: item.parameters,
                    }}
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}
