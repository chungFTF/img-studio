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

import React from 'react'
import { Box, IconButton, Stack, Typography } from '@mui/material'
import theme from '../../theme'
import ImageDropzone from './ImageDropzone'
import { ReferenceImageI } from '@/app/api/generate-video-utils'
import { FormInputTextLine } from '../ux-components/InputTextLine'
import { Clear } from '@mui/icons-material'
const { palette } = theme

export const VideoReferenceBox = ({
  imageKey,
  currentReferenceImage,
  onNewErrorMsg,
  control,
  setValue,
  removeReferenceImage,
  refPosition,
  refCount,
}: {
  imageKey: string
  currentReferenceImage: ReferenceImageI
  onNewErrorMsg: (msg: string) => void
  control: any
  setValue: any
  removeReferenceImage: (imageKey: string) => void
  refPosition: number
  refCount: number
}) => {
  const noImageSet =
    currentReferenceImage.base64Image === '' ||
    currentReferenceImage.base64Image === null ||
    currentReferenceImage.base64Image === undefined
  const noLabelSet =
    currentReferenceImage.label === '' ||
    currentReferenceImage.label === null ||
    currentReferenceImage.label === undefined
  const isNewRef = noImageSet && noLabelSet

  return (
    <Stack
      key={imageKey + refPosition + '_stack'}
      direction="row"
      spacing={2.5}
      justifyContent="flex-start"
      alignItems="flex-start"
      sx={{ pt: 1, pl: 1, width: '100%' }}
    >
      <IconButton
        onClick={() => removeReferenceImage(imageKey)}
        disabled={isNewRef && refCount === 1}
        disableRipple
        sx={{
          border: 0,
          boxShadow: 0,
          p: 0,
          '&:hover': {
            color: palette.primary.main,
            backgroundColor: 'transparent',
            border: 0,
            boxShadow: 0,
          },
        }}
      >
        <Clear sx={{ fontSize: '1.3rem' }} />
      </IconButton>
      <ImageDropzone
        key={imageKey + refPosition + '_dropzone'}
        setImage={(base64Image: string) => setValue(`referenceImages.${refPosition}.base64Image`, base64Image)}
        image={currentReferenceImage.base64Image}
        onNewErrorMsg={onNewErrorMsg}
        size={{ width: '5vw', height: '5vw' }}
        maxSize={{ width: 70, height: 70 }}
        object={`referenceImages.${refPosition}`}
        setValue={setValue}
      />
      <Box sx={{ width: '50%' }}>
        <Typography
          variant="caption"
          sx={{
            color: palette.text.primary,
            fontSize: '0.85rem',
            fontWeight: 500,
            pb: 0.5,
            display: 'block',
          }}
        >
          Label (for your reference only)
        </Typography>
        <FormInputTextLine
          key={imageKey + refPosition + '_label'}
          control={control}
          label={'e.g. woman, pink_dress, sunglasses'}
          name={`referenceImages.${refPosition}.label`}
          value={currentReferenceImage.label}
          required={false}
        />
        <Typography
          variant="caption"
          sx={{
            color: palette.text.secondary,
            fontSize: '0.75rem',
            fontWeight: 400,
            pt: 0.5,
            display: 'block',
          }}
        >
          Use natural language in your prompt to reference this image: "a woman with dark hair", "wearing a pink dress", etc.
        </Typography>
      </Box>
    </Stack>
  )
}
