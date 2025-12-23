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
    const hasData = (metadata.executionTimeMs && metadata.executionTimeMs > 0) || 
                    (metadata.totalTokens && metadata.totalTokens > 0) || 
                    (cost && parseFloat(cost) > 0)
    if (!hasData) return null
    
    return (
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {(metadata.executionTimeMs && metadata.executionTimeMs > 0) ? (
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
        ) : null}
        {(metadata.totalTokens && metadata.totalTokens > 0) ? (
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
        ) : null}
        {(cost && parseFloat(cost) > 0) ? (
          <Chip
            label={`~$${cost}`}
            size="small"
            sx={{
              backgroundColor: palette.success.light,
              color: palette.text.primary,
              fontWeight: 600,
            }}
          />
        ) : null}
      </Stack>
    )
  }

  // Pre-calculate filtered parameters for use in rendering
  const filteredParams = metadata.parameters 
    ? Object.entries(metadata.parameters)
        .filter(([key, value]) => 
          key !== 'prompt' && 
          key !== 'imported' &&
          key !== 'originalPath' &&
          value !== null &&
          value !== undefined &&
          value !== '' && 
          value !== 'undefined'
          // Note: Keep 0 and false as they may be meaningful parameter values
        )
    : []
  const hasPrompt = metadata.parameters?.prompt
  const hasParameters = filteredParams.length > 0 || hasPrompt

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
          '& .MuiAccordionSummary-content': { my: 0 },
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, color: palette.primary.main }}>
          Generation Details
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, py: 0 }}>
        <Stack spacing={0.5}>
          {/* Execution Time */}
          {(metadata.executionTimeMs && metadata.executionTimeMs > 0) ? (
            <Box sx={{ mb: 0.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                {/* <AccessTime sx={{ fontSize: '1.2rem', color: palette.primary.main }} /> */}
                <Typography variant="body2" sx={{ fontWeight: 600, color: palette.grey[400] }}>
                  Execution Time
                </Typography>
              </Stack>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: palette.grey[500], 
                  pl: 3.5,
                  fontSize: '0.875rem',
                }}
              >
                {formatTime(metadata.executionTimeMs)}
              </Typography>
              {metadata.startTime && metadata.endTime && (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: palette.grey[400], 
                    pl: 3.5,
                    fontSize: '0.8rem',
                  }}
                >
                  {new Date(metadata.startTime).toLocaleTimeString()} → {new Date(metadata.endTime).toLocaleTimeString()}
                </Typography>
              )}
            </Box>
          ) : null}

          {/* Token Usage - only show if we have actual token data */}
          {(metadata.totalTokens && metadata.totalTokens > 0) ? (
            <Box sx={{ mb: 0.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>

                <Typography variant="body2" sx={{ fontWeight: 600, color: palette.grey[400] }}>
                  Token Usage
                </Typography>
              </Stack>
              <Stack spacing={0.25} sx={{ pl: 3.5 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: palette.grey[500],
                    fontSize: '0.875rem',
                  }}
                >
                  Total: <strong>{formatTokens(metadata.totalTokens)}</strong> tokens
                </Typography>
                {(metadata.inputTokens && metadata.inputTokens > 0) ? (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: palette.grey[400],
                      fontSize: '0.8rem',
                    }}
                  >
                    Input: {formatTokens(metadata.inputTokens)} tokens
                  </Typography>
                ) : null}
                {(metadata.outputTokens && metadata.outputTokens > 0) ? (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: palette.grey[400],
                      fontSize: '0.8rem',
                    }}
                  >
                    Output: {formatTokens(metadata.outputTokens)} tokens
                  </Typography>
                ) : null}
                
                {/* Per-image token breakdown */}
                {metadata.perImageTokens && metadata.perImageTokens.length > 0 && 
                  metadata.perImageTokens.some(token => token.totalTokens > 0) && (
                  <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${palette.divider}` }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: palette.grey[600], 
                        fontWeight: 600, 
                        mb: 0.5, 
                        display: 'block',
                        fontSize: '0.875rem',
                      }}
                    >
                      Per-Image Breakdown:
                    </Typography>
                    {metadata.perImageTokens
                      .filter(imageToken => imageToken.totalTokens > 0)
                      .map((imageToken) => (
                      <Stack key={imageToken.imageIndex} direction="row" spacing={1} sx={{ py: 0.3 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: palette.grey[500], 
                            minWidth: 60,
                            fontSize: '0.8rem',
                          }}
                        >
                          Image {imageToken.imageIndex}:
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: palette.grey[400],
                            fontSize: '0.8rem',
                          }}
                        >
                          {formatTokens(imageToken.totalTokens)} tokens
                          {(imageToken.promptTokens > 0 && imageToken.candidatesTokens > 0) && 
                            ` (${formatTokens(imageToken.promptTokens)} + ${formatTokens(imageToken.candidatesTokens)})`
                          }
                        </Typography>
                      </Stack>
                    ))}
                  </Box>
                )}
              </Stack>
            </Box>
          ) : null}

          {/* Cost - only show if available */}
          {(metadata.estimatedCost && metadata.estimatedCost > 0) ? (
            <Box sx={{ mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: palette.success.main }}>
                Estimated Cost
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: palette.grey[500], 
                  pl: 3.5,
                  fontSize: '0.875rem',
                }}
              >
                ${metadata.estimatedCost.toFixed(4)} USD
              </Typography>
            </Box>
          ) : null}

          {/* Parameters - only show if there are valid parameters after filtering */}
          {hasParameters && (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0, color: palette.grey[400] }}>
                Parameters
              </Typography>
              <Stack spacing={0} sx={{ pl: 3.5, maxHeight: 300, overflowY: 'auto' }}>
                {filteredParams.map(([key, value]) => {
                  // Format key name to be more readable
                  const formattedKey = key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, (str) => str.toUpperCase())
                    .trim()
                  
                  return (
                    <Typography 
                      key={key} 
                      variant="body2" 
                      sx={{ 
                        color: palette.grey[500],
                        fontSize: '0.875rem',
                      }}
                    >
                      <strong>{formattedKey}:</strong> {String(value)}
                    </Typography>
                  )
                })}
                {hasPrompt && (
                  <Box sx={{ mt: 1, p: 1, bgcolor: palette.grey[100], borderRadius: 1 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: palette.grey[600], 
                        fontWeight: 500,
                        fontSize: '0.875rem',
                      }}
                    >
                      Prompt:
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: palette.grey[500], 
                        fontStyle: 'italic', 
                        display: 'block', 
                        mt: 0.5,
                        fontSize: '0.875rem',
                      }}
                    >
                      "{metadata.parameters?.prompt}"
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
