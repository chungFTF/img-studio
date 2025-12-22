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

import { Box, Chip, Stack, Typography, Divider, Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
import { AccessTime, Token, Settings, ExpandMore } from '@mui/icons-material'
import theme from '../../theme'

const { palette } = theme

interface GenerationMetadataDisplayProps {
  metadata?: {
    tokensUsed?: number
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    executionTimeMs?: number
    startTime?: string
    endTime?: string
    parameters?: Record<string, any>
    estimatedCost?: number
    perImageTokens?: Array<{
      imageIndex: number
      promptTokens: number
      candidatesTokens: number
      totalTokens: number
    }>
  }
  compact?: boolean
}

export function GenerationMetadataDisplay({ metadata, compact = false }: GenerationMetadataDisplayProps) {
  if (!metadata) return null

  const formatTime = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
    const minutes = Math.floor(ms / 60000)
    const seconds = ((ms % 60000) / 1000).toFixed(0)
    return `${minutes}m ${seconds}s`
  }

  const formatTokens = (tokens?: number) => {
    if (!tokens) return 'N/A'
    return tokens.toLocaleString()
  }

  const estimateCost = (tokens?: number, estimatedCost?: number) => {
    // If we have an actual estimated cost from the API, use it
    if (estimatedCost !== undefined) return estimatedCost.toFixed(4)
    
    if (!tokens) return null
    // Rough estimate: $0.002 per 1K tokens for Imagen, $0.01 per 1K tokens for Veo
    const costPer1k = 0.002 // Average estimate
    const cost = (tokens / 1000) * costPer1k
    return cost.toFixed(4)
  }

  if (compact) {
    const cost = estimateCost(metadata.totalTokens, metadata.estimatedCost)
    
    // Don't render anything if we have no data to show
    const hasData = metadata.executionTimeMs || metadata.totalTokens || cost
    if (!hasData) return null
    
    return (
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {metadata.executionTimeMs && (
          <Chip
            icon={<AccessTime sx={{ fontSize: '1rem' }} />}
            label={formatTime(metadata.executionTimeMs)}
            size="small"
            sx={{
              backgroundColor: palette.primary.light,
              color: palette.text.primary,
              fontWeight: 500,
            }}
          />
        )}
        {metadata.totalTokens && metadata.totalTokens > 0 && (
          <Chip
            icon={<Token sx={{ fontSize: '1rem' }} />}
            label={`${formatTokens(metadata.totalTokens)} tokens`}
            size="small"
            sx={{
              backgroundColor: palette.secondary.light,
              color: palette.text.primary,
              fontWeight: 500,
            }}
          />
        )}
        {cost && parseFloat(cost) > 0 && (
          <Chip
            label={`~$${cost}`}
            size="small"
            sx={{
              backgroundColor: palette.success.light,
              color: palette.text.primary,
              fontWeight: 600,
            }}
          />
        )}
      </Stack>
    )
  }

  return (
    <Accordion
      sx={{
        backgroundColor: 'transparent',
        boxShadow: 'none',
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMore />}
        sx={{
          px: 0,
          minHeight: 'auto',
          '&.Mui-expanded': { minHeight: 'auto' },
          '& .MuiAccordionSummary-content': { my: 1 },
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, color: palette.primary.main }}>
          Generation Details
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, py: 1 }}>
        <Stack spacing={2}>
          {/* Execution Time */}
          {metadata.executionTimeMs && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <AccessTime sx={{ fontSize: '1.2rem', color: palette.primary.main }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Execution Time
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: palette.text.secondary, pl: 3.5 }}>
                {formatTime(metadata.executionTimeMs)}
              </Typography>
              {metadata.startTime && metadata.endTime && (
                <Typography variant="caption" sx={{ color: palette.text.disabled, pl: 3.5 }}>
                  {new Date(metadata.startTime).toLocaleTimeString()} → {new Date(metadata.endTime).toLocaleTimeString()}
                </Typography>
              )}
            </Box>
          )}

          {/* Token Usage - only show if we have actual token data */}
          {metadata.totalTokens && metadata.totalTokens > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Token sx={{ fontSize: '1.2rem', color: palette.secondary.main }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Token Usage
                </Typography>
              </Stack>
              <Stack spacing={0.5} sx={{ pl: 3.5 }}>
                <Typography variant="body2" sx={{ color: palette.text.secondary }}>
                  Total: <strong>{formatTokens(metadata.totalTokens)}</strong> tokens
                </Typography>
                {metadata.inputTokens && metadata.inputTokens > 0 && (
                  <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                    Input: {formatTokens(metadata.inputTokens)} tokens
                  </Typography>
                )}
                {metadata.outputTokens && metadata.outputTokens > 0 && (
                  <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                    Output: {formatTokens(metadata.outputTokens)} tokens
                  </Typography>
                )}
                
                {/* Per-image token breakdown */}
                {metadata.perImageTokens && metadata.perImageTokens.length > 0 && (
                  <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${palette.divider}` }}>
                    <Typography variant="caption" sx={{ color: palette.text.primary, fontWeight: 600, mb: 0.5, display: 'block' }}>
                      Per-Image Breakdown:
                    </Typography>
                    {metadata.perImageTokens.map((imageToken) => (
                      <Stack key={imageToken.imageIndex} direction="row" spacing={1} sx={{ py: 0.3 }}>
                        <Typography variant="caption" sx={{ color: palette.text.secondary, minWidth: 60 }}>
                          Image {imageToken.imageIndex}:
                        </Typography>
                        <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                          {formatTokens(imageToken.totalTokens)} tokens
                          {imageToken.promptTokens > 0 && imageToken.candidatesTokens > 0 && 
                            ` (${formatTokens(imageToken.promptTokens)} + ${formatTokens(imageToken.candidatesTokens)})`
                          }
                        </Typography>
                      </Stack>
                    ))}
                  </Box>
                )}
              </Stack>
            </Box>
          )}

          {/* Cost - only show if available */}
          {metadata.estimatedCost && metadata.estimatedCost > 0 && (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: palette.success.main }}>
                Estimated Cost
              </Typography>
              <Typography variant="body2" sx={{ color: palette.text.secondary, pl: 3.5 }}>
                ${metadata.estimatedCost.toFixed(4)} USD
              </Typography>
            </Box>
          )}

          {/* Parameters */}
          {metadata.parameters && Object.keys(metadata.parameters).length > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Settings sx={{ fontSize: '1.2rem', color: palette.info.main }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Parameters
                </Typography>
              </Stack>
              <Stack spacing={0.5} sx={{ pl: 3.5, maxHeight: 300, overflowY: 'auto' }}>
                {Object.entries(metadata.parameters)
                  .filter(([key, value]) => key !== 'prompt' && value && value !== '' && value !== 'undefined')
                  .map(([key, value]) => {
                    // Format key name to be more readable
                    const formattedKey = key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, (str) => str.toUpperCase())
                      .trim()
                    
                    return (
                      <Typography key={key} variant="caption" sx={{ color: palette.text.secondary }}>
                        <strong>{formattedKey}:</strong> {String(value)}
                      </Typography>
                    )
                  })}
                {metadata.parameters.prompt && (
                  <Box sx={{ mt: 1, p: 1, bgcolor: palette.grey[100], borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ color: palette.text.primary, fontWeight: 500 }}>
                      Prompt:
                    </Typography>
                    <Typography variant="caption" sx={{ color: palette.text.secondary, fontStyle: 'italic', display: 'block', mt: 0.5 }}>
                      "{metadata.parameters.prompt}"
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}

export default GenerationMetadataDisplay
