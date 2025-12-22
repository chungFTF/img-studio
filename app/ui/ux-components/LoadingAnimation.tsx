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

import { Box, CircularProgress, Typography, LinearProgress, Stack } from '@mui/material'
import { AutoAwesome, CloudUpload, Download, VideoLibrary, Image as ImageIcon } from '@mui/icons-material'
import theme from '../../theme'

const { palette } = theme

interface LoadingAnimationProps {
  message?: string
  type?: 'circular' | 'linear' | 'skeleton'
  icon?: 'default' | 'upload' | 'download' | 'video' | 'image' | 'generate'
  size?: 'small' | 'medium' | 'large'
  progress?: number // 0-100 for linear progress
}

export function LoadingAnimation({
  message = 'Loading...',
  type = 'circular',
  icon = 'default',
  size = 'medium',
  progress,
}: LoadingAnimationProps) {
  const sizeMap = {
    small: { spinner: 24, icon: 30, text: '0.9rem' },
    medium: { spinner: 40, icon: 50, text: '1.1rem' },
    large: { spinner: 60, icon: 70, text: '1.3rem' },
  }

  const IconComponent = {
    default: AutoAwesome,
    upload: CloudUpload,
    download: Download,
    video: VideoLibrary,
    image: ImageIcon,
    generate: AutoAwesome,
  }[icon]

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 3,
      }}
    >
      {type === 'circular' && (
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress
            size={sizeMap[size].spinner}
            thickness={4}
            sx={{
              color: palette.primary.main,
              animationDuration: '1.5s',
            }}
          />
          {icon !== 'default' && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <IconComponent
                sx={{
                  fontSize: sizeMap[size].icon,
                  color: palette.primary.light,
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 0.5, transform: 'scale(1)' },
                    '50%': { opacity: 1, transform: 'scale(1.1)' },
                  },
                }}
              />
            </Box>
          )}
        </Box>
      )}

      {type === 'linear' && (
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <LinearProgress
            variant={progress !== undefined ? 'determinate' : 'indeterminate'}
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: palette.primary.light,
              '& .MuiLinearProgress-bar': {
                backgroundColor: palette.primary.main,
                borderRadius: 4,
              },
            }}
          />
          {progress !== undefined && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                textAlign: 'center',
                mt: 1,
                color: palette.text.secondary,
              }}
            >
              {Math.round(progress)}%
            </Typography>
          )}
        </Box>
      )}

      {message && (
        <Typography
          variant="body1"
          sx={{
            color: palette.text.secondary,
            fontSize: sizeMap[size].text,
            fontWeight: 500,
            textAlign: 'center',
            animation: 'fadeIn 0.5s ease-in',
            '@keyframes fadeIn': {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  )
}

// Video generation specific loading with polling status
export function VideoGenerationLoading({
  sampleCount,
  pollingAttempts,
}: {
  sampleCount: number
  pollingAttempts?: number
}) {
  const estimatedMinutes = Math.ceil((sampleCount * 1.5) / 60) // Rough estimate
  
  return (
    <Stack spacing={3} alignItems="center" sx={{ p: 4 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          size={80}
          thickness={4}
          sx={{
            color: palette.primary.main,
            animationDuration: '2s',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <VideoLibrary
            sx={{
              fontSize: 50,
              color: palette.primary.light,
              animation: 'spin 3s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          />
        </Box>
      </Box>

      <Typography variant="h6" sx={{ color: palette.primary.main, fontWeight: 600 }}>
        Generating {sampleCount} video{sampleCount > 1 ? 's' : ''}...
      </Typography>

      <Typography variant="body2" sx={{ color: palette.text.secondary, textAlign: 'center', maxWidth: 400 }}>
        This may take approximately {estimatedMinutes} minute{estimatedMinutes > 1 ? 's' : ''}. Please don't close this
        window.
      </Typography>

      {pollingAttempts !== undefined && pollingAttempts > 0 && (
        <Typography variant="caption" sx={{ color: palette.text.disabled }}>
          Checking status... (attempt {pollingAttempts})
        </Typography>
      )}

      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <LinearProgress
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: palette.primary.light,
            '& .MuiLinearProgress-bar': {
              backgroundColor: palette.primary.main,
              borderRadius: 3,
            },
          }}
        />
      </Box>
    </Stack>
  )
}

// Image generation loading
export function ImageGenerationLoading({ sampleCount }: { sampleCount: number }) {
  return (
    <Stack spacing={2} alignItems="center" sx={{ p: 3 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          size={60}
          thickness={5}
          sx={{
            color: palette.primary.main,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <ImageIcon
            sx={{
              fontSize: 40,
              color: palette.primary.light,
              animation: 'pulse 1.5s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 0.5 },
                '50%': { opacity: 1 },
              },
            }}
          />
        </Box>
      </Box>

      <Typography variant="body1" sx={{ color: palette.primary.main, fontWeight: 500 }}>
        Generating {sampleCount} image{sampleCount > 1 ? 's' : ''}...
      </Typography>
    </Stack>
  )
}

export default LoadingAnimation
