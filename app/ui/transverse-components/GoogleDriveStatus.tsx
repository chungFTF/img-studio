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
import { Box, Button, Chip, Typography, Stack, Tooltip } from '@mui/material'
import { CloudUpload, CloudOff, CloudDone } from '@mui/icons-material'
import { useGoogleDrive } from '@/app/context/google-drive-context'
import theme from '../../theme'

const { palette } = theme

export default function GoogleDriveStatus() {
  const { isConnected, connectDrive, disconnectDrive, isLoading, isReady, error } = useGoogleDrive()

  if (isLoading) {
    return (
      <Box sx={{ p: 2, borderTop: `1px solid ${palette.divider}` }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CloudUpload sx={{ color: palette.grey[400], fontSize: '1.2rem' }} />
          <Typography variant="caption" sx={{ color: palette.text.secondary }}>
            Loading Google Drive...
          </Typography>
        </Stack>
      </Box>
    )
  }

  if (error && !isReady) {
    return (
      <Box sx={{ p: 2, borderTop: `1px solid ${palette.divider}` }}>
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CloudOff sx={{ color: palette.error.main, fontSize: '1.2rem' }} />
            <Typography variant="caption" sx={{ color: palette.error.main }}>
              Drive Unavailable
            </Typography>
          </Stack>
          <Tooltip title={error}>
            <Typography variant="caption" sx={{ color: palette.text.secondary, fontSize: '0.65rem' }}>
              {error.substring(0, 50)}...
            </Typography>
          </Tooltip>
        </Stack>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 2, borderTop: `1px solid ${palette.divider}` }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {isConnected ? (
            <>
              <CloudDone sx={{ color: palette.success.main, fontSize: '1.2rem' }} />
              <Typography variant="caption" sx={{ color: palette.text.secondary }}>
                Drive Connected
              </Typography>
            </>
          ) : (
            <>
              <CloudOff sx={{ color: palette.grey[400], fontSize: '1.2rem' }} />
              <Typography variant="caption" sx={{ color: palette.text.secondary }}>
                Drive Disconnected
              </Typography>
            </>
          )}
        </Stack>
        
        {isConnected ? (
          <Tooltip title="Disconnect Google Drive">
            <Button
              size="small"
              variant="outlined"
              onClick={disconnectDrive}
              sx={{ fontSize: '0.7rem', py: 0.5, px: 1, minWidth: 'auto' }}
            >
              Disconnect
            </Button>
          </Tooltip>
        ) : (
          <Tooltip title={!isReady ? "Google Drive services are loading..." : "Connect to save files to Google Drive"}>
            <span>
              <Button
                size="small"
                variant="contained"
                startIcon={<CloudUpload />}
                onClick={connectDrive}
                disabled={!isReady}
                sx={{ fontSize: '0.7rem', py: 0.5, px: 1 }}
              >
                Connect
              </Button>
            </span>
          </Tooltip>
        )}
      </Stack>
      {error && isConnected && (
        <Typography variant="caption" sx={{ color: palette.warning.main, fontSize: '0.65rem', mt: 0.5, display: 'block' }}>
          {error}
        </Typography>
      )}
    </Box>
  )
}
