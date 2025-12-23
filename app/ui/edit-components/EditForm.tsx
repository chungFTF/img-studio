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
import { useForm, SubmitHandler } from 'react-hook-form'
import { Typography, Button, Box, IconButton, Stack, Alert, Avatar, Icon } from '@mui/material'
import { Send as SendIcon, WatchLater as WatchLaterIcon, Close as CloseIcon, Autorenew } from '@mui/icons-material'

import { FormInputText } from '../ux-components/InputText'
import FormInputDropdown from '../ux-components/InputDropdown'

import { ImageI } from '../../api/generate-image-utils'

import theme from '../../theme'
import { buildImageListFromURI, editImage, upscaleImage } from '../../api/imagen/action'
import { editImageWithGemini } from '../../api/gemini-image/action'
import { CustomizedAvatarButton, CustomizedIconButton, CustomizedSendButton } from '../ux-components/Button-SX'
import CustomTooltip from '../ux-components/Tooltip'
import { appContextDataDefault, useAppContext } from '../../context/app-context'
import EditImageDropzone, { getAspectRatio } from './EditImageDropzone'
import {
  EditImageFormFields,
  EditImageFormI,
  editSettingsFields,
  formDataEditDefaults,
  maskTypes,
} from '../../api/edit-utils'
import FormInputEditSettings from './EditSettings'
import EditModeMenu from './EditModeMenu'
import SetMaskDialog from './SetMaskDialog'
import { downloadMediaFromGcs } from '../../api/cloud-storage/action'
import UpscaleDialog from './UpscaleDialog'
import { ImageCacheStorage } from '../transverse-components/ImageCacheStorage'
const { palette } = theme

const editModeField = EditImageFormFields.editMode
const editModeOptions = editModeField.options

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsArrayBuffer(file)
    reader.onload = () => {
      const encoded = Buffer.from(reader.result as ArrayBuffer).toString('base64')
      resolve(encoded)
    }
    reader.onerror = (error) => reject(error)
  })
}

export default function EditForm({
  isLoading,
  onRequestSent,
  onImageGeneration,
  errorMsg,
  onNewErrorMsg,
}: {
  isLoading: boolean
  onRequestSent: (valid: boolean, count: number, isUpscaledDLAvailable: boolean) => void
  onImageGeneration: (newImages: ImageI[]) => void
  errorMsg: string
  onNewErrorMsg: (newErrorMsg: string) => void
}) {
  const { handleSubmit, watch, control, setValue, getValues, reset } = useForm<EditImageFormI>({
    defaultValues: formDataEditDefaults,
  })
  const { appContext } = useAppContext()
  const { setAppContext } = useAppContext()

  const [imageToEdit, setImageToEdit] = useState<string | null>(null)
  const [maskImage, setMaskImage] = useState<string | null>(null)
  const [maskPreview, setMaskPreview] = useState<string | null>(null)
  const [outpaintedImage, setOutpaintedImage] = useState<string | null>(null)

  const [imageWidth, imageHeight, imageRatio] = watch(['width', 'height', 'ratio'])
  const currentModel = watch('modelVersion')
  const isGeminiModel = currentModel?.includes('gemini')
  const [maskSize, setMaskSize] = useState({ width: 0, height: 0 })

  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [originalWidth, setOriginalWidth] = useState<number | null>(null)
  const [originalHeight, setOriginalHeight] = useState<number | null>(null)

  const defaultEditMode = editModeOptions.find((option) => option.value === editModeField.default)
  const [selectedEditMode, setSelectedEditMode] = useState(defaultEditMode)
  const [openMaskDialog, setOpenMaskDialog] = useState(false)

  // Upscale case
  const isUpscaleMode = selectedEditMode?.value === 'UPSCALE'
  const [upscaleFactor, setUpscaleFactor] = useState<string>('')
  const [openUpscaleDialog, setOpenUpscaleDialog] = useState(false)

  const handleNewEditMode = (value: string) => {
    resetStates()
    setValue('editMode', value)

    const newEditMode = editModeOptions.find((option) => option.value === value)
    setSelectedEditMode(newEditMode)

    const defaultMaskDilation = newEditMode?.defaultMaskDilation.toString()
    const defaultBaseSteps = newEditMode?.defaultBaseSteps.toString()
    defaultMaskDilation && setValue('maskDilation', defaultMaskDilation)
    defaultBaseSteps && setValue('baseSteps', defaultBaseSteps)
  }

  useEffect(() => {
    if (imageWidth !== maskSize.width || imageHeight !== maskSize.height)
      setMaskSize({ width: imageWidth, height: imageHeight })
  }, [imageWidth, imageHeight])

  useEffect(() => {
    const fetchAndSetImage = async () => {
      handleNewEditMode(defaultEditMode?.value ?? '')
      if (appContext && appContext.imageToEdit) {
        try {
          const { data } = await downloadMediaFromGcs(appContext.imageToEdit)
          const newImage = `data:image/png;base64,${data}`
          data && setImageToEdit(newImage)
          setMaskImage(null)

          // Re-initialize parameter in context
          setAppContext((prevContext) => {
            if (prevContext) return { ...prevContext, imageToEdit: '' }
            else return { ...appContextDataDefault, imageToEdit: '' }
          })
        } catch (error) {
          console.error('Error fetching image:', error)
        }
      }
    }

    fetchAndSetImage()
  }, [appContext?.imageToEdit])

  const handleMaskDialogOpen = () => {
    if (selectedEditMode?.value === 'EDIT_MODE_OUTPAINT') {
      if (!outpaintedImage) {
        setOriginalImage(getValues('inputImage'))
        setOriginalWidth(getValues('width'))
        setOriginalHeight(getValues('height'))
      } else {
        if (originalImage && originalWidth && originalHeight) {
          setValue('width', originalWidth)
          setValue('height', originalHeight)
          setValue('inputImage', originalImage)
        }
      }
    }

    setMaskSize({ width: imageWidth, height: imageHeight })

    setMaskImage(null)
    setMaskPreview(null)
    setOpenMaskDialog(true)
  }
  const handleMaskDialogClose = () => {
    setOpenMaskDialog(false)
  }

  useEffect(() => {
    if (imageToEdit) {
      setValue('inputImage', imageToEdit)
    }
    if (outpaintedImage) setValue('inputImage', outpaintedImage)
    if (maskImage) setValue('inputMask', maskImage)
  }, [imageToEdit, maskImage, outpaintedImage])

  const onSubmit: SubmitHandler<EditImageFormI> = async (formData: EditImageFormI) => {
    onRequestSent(true, parseInt(formData.sampleCount), true)

    try {
      // For Gemini models, only image and prompt are required (no mask)
      if (formData.modelVersion.includes('gemini')) {
        if (formData['inputImage'] === '' || formData['prompt'] === '') {
          throw Error('Missing image or prompt')
        }

        const newEditedImage = await editImageWithGemini(
          {
            prompt: formData.prompt,
            modelVersion: formData.modelVersion,
            sampleCount: formData.sampleCount, // Now supports multiple images
            inputImage: formData.inputImage,
            negativePrompt: formData.negativePrompt,
            width: formData.width,
            height: formData.height,
          },
          appContext
        )

        if (newEditedImage !== undefined && typeof newEditedImage === 'object' && 'error' in newEditedImage) {
          const errorMsg = newEditedImage['error'].replaceAll('Error: ', '')
          throw Error(errorMsg)
        } else {
          newEditedImage.map((image) => {
            if ('warning' in image) onNewErrorMsg(image['warning'] as string)
          })
          onImageGeneration(newEditedImage)
        }
      } else {
        // For Imagen models, use the original mask-based editing
        if (
          formData['inputImage'] === '' ||
          (selectedEditMode?.mandatoryPrompt && formData['prompt'] === '') ||
          (selectedEditMode?.mandatoryMask && formData['inputMask'] === '')
        )
          throw Error('Missing either image, prompt or mask')

        const newEditedImage = await editImage(formData, appContext)

        if (newEditedImage !== undefined && typeof newEditedImage === 'object' && 'error' in newEditedImage) {
          const errorMsg = newEditedImage['error'].replaceAll('Error: ', '')
          throw Error(errorMsg)
        } else {
          newEditedImage.map((image) => {
            if ('warning' in image) onNewErrorMsg(image['warning'] as string)
          })

          onImageGeneration(newEditedImage)
        }
      }
    } catch (error: any) {
      onNewErrorMsg(error.toString())
    }
  }

  const onUpscaleSubmit: SubmitHandler<EditImageFormI> = async (formData: EditImageFormI) => {
    setOpenUpscaleDialog(false)
    onRequestSent(true, 1, false)
    try {
      let res
      if (upscaleFactor) {
        res = await upscaleImage({ base64: formData.inputImage }, upscaleFactor, appContext)
        if (typeof res === 'object' && 'error' in res && res.error) throw Error(res.error.replaceAll('Error: ', ''))

        const upscaledImage = await buildImageListFromURI({
          imagesInGCS: [{ gcsUri: res.newGcsUri, mimeType: res.mimeType }],
          aspectRatio: formData['ratio'],
          width: formData['width'] * parseInt(upscaleFactor.replace('x', ''), 10),
          height: formData['height'] * parseInt(upscaleFactor.replace('x', ''), 10),
          usedPrompt: '',
          userID: appContext?.userID ? appContext?.userID : '',
          modelVersion: formData['modelVersion'],
          mode: 'Upscaled',
        })

        onImageGeneration(upscaledImage)
      }
    } catch (error: any) {
      onNewErrorMsg(error.toString())
    }
  }

  const onReset = () => {
    setImageToEdit(null)
    resetStates()
    reset()
  }

  const resetStates = () => {
    setValue('prompt', '')
    setMaskImage(null)
    setMaskPreview(null)
    setOutpaintedImage(null)
    setMaskSize({ width: 0, height: 0 })
    onNewErrorMsg('')
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Box sx={{ pb: 5 }}>
          <Stack direction="row" spacing={2} justifyContent="flex-start" alignItems="center">
            <Typography variant="h1" color={palette.text.secondary} sx={{ fontSize: '1.8rem' }}>
              {'Edit with'}
            </Typography>
            <FormInputDropdown
              name="modelVersion"
              label=""
              control={control}
              field={EditImageFormFields.modelVersion as any}
              styleSize="big"
              width=""
              required={false}
            />
          </Stack>
        </Box>
        <>
          {errorMsg !== '' && (
            <Alert
              severity="error"
              action={
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={() => {
                    onNewErrorMsg('')
                  }}
                  sx={{ pt: 0.2 }}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              }
              sx={{ height: 'auto', mb: 2, fontSize: 16, fontWeight: 500, pt: 1, color: palette.text.secondary }}
            >
              {errorMsg}
            </Alert>
          )}
        </>

        {/* Hide edit mode menu for Gemini models - they use text-based editing */}
        {!isGeminiModel && (
          <EditModeMenu handleNewEditMode={handleNewEditMode} selectedEditMode={selectedEditMode} />
        )}
        
        {isGeminiModel && (
          <Box sx={{ pb: 2 }}>
            <Typography variant="body2" color={palette.text.secondary} sx={{ fontStyle: 'italic' }}>
              Gemini uses text-based editing. Describe the changes you want to make to the image.
            </Typography>
          </Box>
        )}

        <Box sx={{ pb: 4 }}>
          <EditImageDropzone
            setImageToEdit={setImageToEdit}
            imageToEdit={imageToEdit}
            setValue={setValue}
            setMaskSize={setMaskSize}
            maskSize={maskSize}
            setMaskImage={setMaskImage}
            maskImage={maskImage}
            maskPreview={maskPreview}
            isOutpaintingMode={selectedEditMode?.value === 'EDIT_MODE_OUTPAINT'}
            outpaintedImage={outpaintedImage}
            setErrorMsg={onNewErrorMsg}
          />
        </Box>

        {/* For Gemini: always show prompt input. For Imagen: show based on edit mode */}
        {(isGeminiModel || selectedEditMode?.promptIndication) && (
          <FormInputText
            name="prompt"
            control={control}
            label={isGeminiModel ? 'Describe how you want to edit the image' : (selectedEditMode?.promptIndication ?? '')}
            required={isGeminiModel || selectedEditMode?.mandatoryPrompt || false}
            rows={3}
          />
        )}

        {/* Image Cache Storage - placed right after prompt */}
        <Box sx={{ mt: 2, mb: 2 }}>
          <ImageCacheStorage 
            onImageSelect={(base64Image) => {
              setImageToEdit(base64Image)
              // Auto-extract image properties
              const img = new window.Image()
              img.onload = () => {
                setValue('width', img.width)
                setValue('height', img.height)
                setValue('ratio', getAspectRatio(img.width, img.height))
                setOriginalImage(base64Image)
                setOriginalWidth(img.width)
                setOriginalHeight(img.height)
              }
              img.src = base64Image
            }}
          />
        </Box>

        <Stack
          justifyContent={selectedEditMode?.promptIndication ? 'flex-end' : 'flex-start'}
          direction="row"
          gap={0}
          pb={3}
        >
          <CustomTooltip title="Reset all fields" size="small">
            <IconButton
              disabled={isLoading}
              onClick={() => onReset()}
              aria-label="Reset form"
              disableRipple
              sx={{ px: 0.5 }}
            >
              <Avatar sx={CustomizedAvatarButton}>
                <Autorenew sx={CustomizedIconButton} />
              </Avatar>
            </IconButton>
          </CustomTooltip>
          {!isUpscaleMode && !isGeminiModel && (
            <FormInputEditSettings control={control} setValue={setValue} editSettingsFields={editSettingsFields} />
          )}
          {/* Hide mask button for Gemini models */}
          {!isGeminiModel && selectedEditMode?.mandatoryMask && selectedEditMode?.maskType && (
            <Button
              variant="contained"
              onClick={handleMaskDialogOpen}
              disabled={imageToEdit === null || isLoading}
              endIcon={isLoading ? <WatchLaterIcon /> : <Icon>{selectedEditMode?.maskButtonIcon}</Icon>}
              sx={CustomizedSendButton}
            >
              {selectedEditMode?.maskButtonLabel}
            </Button>
          )}

          <Button
            type={isUpscaleMode ? 'button' : 'submit'}
            onClick={isUpscaleMode ? () => setOpenUpscaleDialog(true) : undefined}
            variant="contained"
            disabled={
              isGeminiModel
                ? imageToEdit === null || isLoading
                : (maskImage === null && selectedEditMode?.mandatoryMask) || imageToEdit === null || isLoading
            }
            endIcon={isLoading ? <WatchLaterIcon /> : <SendIcon />}
            sx={CustomizedSendButton}
          >
            {isUpscaleMode ? 'Upscale' : 'Edit'}
          </Button>
        </Stack>
      </form>

      {selectedEditMode?.maskType && (
        <SetMaskDialog
          handleMaskDialogClose={handleMaskDialogClose}
          availableMaskTypes={maskTypes.filter((maskType) => selectedEditMode?.maskType.includes(maskType.value))}
          open={openMaskDialog}
          selectedEditMode={selectedEditMode}
          maskImage={maskImage}
          setMaskImage={setMaskImage}
          maskPreview={maskPreview}
          setMaskPreview={setMaskPreview}
          setValue={setValue}
          imageToEdit={imageToEdit ?? ''}
          imageSize={{ width: originalWidth ?? imageWidth, height: originalHeight ?? imageHeight, ratio: imageRatio }}
          maskSize={maskSize}
          setMaskSize={setMaskSize}
          setOutpaintedImage={setOutpaintedImage}
          outpaintedImage={outpaintedImage ?? ''}
        />
      )}

      <UpscaleDialog
        open={openUpscaleDialog}
        closeUpscaleDialog={() => setOpenUpscaleDialog(false)}
        onUpscaleSubmit={handleSubmit(onUpscaleSubmit)}
        upscaleFactor={upscaleFactor}
        setUpscaleFactor={setUpscaleFactor}
        imageSize={{ width: originalWidth ?? imageWidth, height: originalHeight ?? imageHeight, ratio: imageRatio }}
      />
    </>
  )
}
