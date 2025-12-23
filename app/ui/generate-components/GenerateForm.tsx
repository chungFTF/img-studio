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

import { SubmitHandler, useForm } from 'react-hook-form'

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import {
  ArrowDownward as ArrowDownwardIcon,
  ArrowRight,
  Autorenew,
  Close as CloseIcon,
  Lightbulb,
  Mms,
  Send as SendIcon,
  WatchLater as WatchLaterIcon,
} from '@mui/icons-material'

import { CustomizedAccordion, CustomizedAccordionSummary } from '../ux-components/Accordion-SX'
import { CustomizedAvatarButton, CustomizedIconButton, CustomizedSendButton } from '../ux-components/Button-SX'
import FormInputChipGroup from '../ux-components/InputChipGroup'
import FormInputDropdown from '../ux-components/InputDropdown'
import { FormInputText } from '../ux-components/InputText'
import { GeminiSwitch } from '../ux-components/GeminiButton'
import CustomTooltip from '../ux-components/Tooltip'

import GenerateSettings from './GenerateSettings'
import ImageToPromptModal from './ImageToPromptModal'
import { ReferenceBox } from './ReferenceBox'
import { VideoReferenceBox } from './VideoReferenceBox'
import { ImageCacheStorage } from '../transverse-components/ImageCacheStorage'

import theme from '../../theme'
const { palette } = theme

import { useAppContext } from '../../context/app-context'
import { generateImage } from '../../api/imagen/action'
import { generateImageWithGemini } from '../../api/gemini-image/action'
import {
  chipGroupFieldsI,
  GenerateImageFormFields,
  GenerateImageFormI,
  ImageGenerationFieldsI,
  ImageI,
  maxReferences,
  ReferenceObjectDefaults,
  ReferenceObjectInit,
  selectFieldsI,
} from '../../api/generate-image-utils'
import { EditImageFormFields } from '@/app/api/edit-utils'
import {
  GenerateVideoFormFields,
  GenerateVideoFormI,
  InterpolImageDefaults,
  InterpolImageI,
  OperationMetadataI,
  tempVeo3specificSettings,
  VideoGenerationFieldsI,
  videoGenerationUtils,
  ReferenceImageDefaults,
  ReferenceImageI,
  maxReferenceImages,
} from '@/app/api/generate-video-utils'
import { generateVideo } from '@/app/api/veo/action'
import { getOrientation, VideoInterpolBox } from './VideoInterpolBox'
import { getAspectRatio } from '../edit-components/EditImageDropzone'
import { AudioSwitch } from '../ux-components/AudioButton'

export default function GenerateForm({
  generationType,
  isLoading,
  onRequestSent,
  errorMsg,
  onNewErrorMsg,
  generationFields,
  randomPrompts,
  onImageGeneration,
  onVideoPollingStart,
  initialPrompt,
  initialITVimage,
  promptIndication,
}: {
  generationType: 'Image' | 'Video'
  isLoading: boolean
  onRequestSent: (loading: boolean, count: number) => void
  errorMsg: string
  onNewErrorMsg: (newErrorMsg: string) => void
  generationFields: ImageGenerationFieldsI | VideoGenerationFieldsI
  randomPrompts: string[]
  onImageGeneration?: (newImages: ImageI[]) => void
  onVideoPollingStart?: (operationName: string, metadata: OperationMetadataI) => void
  initialPrompt?: string
  initialITVimage?: InterpolImageI
  promptIndication?: string
}) {
  // --- Component Setup ---
  const {
    handleSubmit,
    resetField,
    control,
    setValue,
    getValues,
    watch,
    formState: { touchedFields },
  } = useForm<GenerateVideoFormI | GenerateImageFormI>({
    defaultValues: generationFields.defaultValues,
  })
  const { appContext } = useAppContext()

  // --- State Management ---
  // Manages the expanded state of the accordions.
  const [expanded, setExpanded] = React.useState<string | false>('attributes')
  // Manages whether to use Gemini for prompt rewriting.
  const [isGeminiRewrite, setIsGeminiRewrite] = useState(true)
  // Manages the visibility of the image-to-prompt modal.
  const [imageToPromptOpen, setImageToPromptOpen] = useState(false)
  // Manages the orientation of the image-to-video input boxes.
  const [orientation, setOrientation] = useState('horizontal')

  // --- Watched Form Values ---
  const currentPrompt = watch('prompt')
  const referenceObjects = watch('referenceObjects')
  const referenceImages = watch('referenceImages')
  const isVideoWithAudio = watch('isVideoWithAudio')
  const interpolImageFirst = watch('interpolImageFirst')
  const interpolImageFirstBase64 = watch('interpolImageFirst.base64Image') // Watch nested field for cache
  const interpolImageLast = watch('interpolImageLast')
  const selectedRatio = watch('aspectRatio')
  const firstImageRatio = watch('interpolImageFirst.ratio')
  const lastImageRatio = watch('interpolImageLast.ratio')
  const currentModel = watch('modelVersion')
  const currentPrimaryStyle = watch('style')
  const currentSecondaryStyle = watch('secondary_style')
  const videoMode = watch('videoMode') // Track video generation mode

  // --- LocalStorage keys for caching (separated by generation type) ---
  const STORAGE_KEY_PREFIX = generationType === 'Video' ? 'veo' : 'imagen'
  const STORAGE_KEY_REFERENCE_IMAGES = `${STORAGE_KEY_PREFIX}_reference_images_cache`
  const STORAGE_KEY_INTERPOL_FIRST = `${STORAGE_KEY_PREFIX}_interpol_first_cache`
  const STORAGE_KEY_PROMPT = `${STORAGE_KEY_PREFIX}_prompt_cache`
  const STORAGE_KEY_REFERENCE_OBJECTS = `${STORAGE_KEY_PREFIX}_reference_objects_cache`

  // --- Derived and Memoized Values ---
  // Determines if the form has any valid reference objects.
  const hasReferences = React.useMemo(
    () => Array.isArray(referenceObjects) && referenceObjects.some((obj) => obj.base64Image !== ''),
    [referenceObjects]
  )

  // Dynamically selects the model version options based on generation type and references.
  const modelOptionField: selectFieldsI = React.useMemo(() => {
    if (generationType === 'Video') {
      return GenerateVideoFormFields.modelVersion
    }
    return hasReferences ? EditImageFormFields.modelVersion : GenerateImageFormFields.modelVersion
  }, [generationType, hasReferences])

  // Adjust sampleCount options based on model type
  // Gemini: fixed at 2, Imagen: fixed at 4
  const adjustedSettings = React.useMemo(() => {
    const isGemini = currentModel?.includes('gemini')
    if (generationFields.settings.sampleCount) {
      return {
        ...generationFields.settings,
        sampleCount: {
          ...generationFields.settings.sampleCount,
          options: isGemini ? ['2'] : ['4'], // Fixed options based on model
        },
      }
    }
    return generationFields.settings
  }, [currentModel, generationFields.settings])

  // Determines if the prompt is optional for video generation (e.g., for image-to-video).
  const optionalVeoPrompt =
    (interpolImageFirst && interpolImageFirst.base64Image !== '') ||
    (interpolImageFirst &&
      interpolImageFirst.base64Image !== '' &&
      interpolImageLast &&
      interpolImageLast.base64Image !== '')

  // Determines if the current model supports audio generation.
  const isAudioAvailable = currentModel.includes('veo-3.0') || currentModel.includes('veo-3.1')
  // Determines if only image-to-video is available for the current model.
  const isOnlyITVavailable =
    ((currentModel.includes('veo-3.0') && !currentModel.includes('fast')) ||
      (currentModel.includes('veo-3.1') && !currentModel.includes('fast'))) &&
    process.env.NEXT_PUBLIC_VEO_ITV_ENABLED === 'true'
  // Determines if advanced features are available for the current model.
  const isAdvancedFeaturesAvailable =
    currentModel.includes('veo-2.0') && process.env.NEXT_PUBLIC_VEO_ADVANCED_ENABLED === 'true'
  // Determines if reference images are available for Veo 3.1.
  const isReferenceImagesAvailable = currentModel.includes('veo-3.1') && !currentModel.includes('fast')

  // Determines the available secondary styles based on the selected primary style.
  const subImgStyleField = React.useMemo(() => {
    const { styleOptions, subStyleOptions } = generationFields
    const selectedStyle = styleOptions.options.find((o) => o.value === currentPrimaryStyle)
    const subId = selectedStyle ? selectedStyle.subID : styleOptions.defaultSub
    return subStyleOptions.options.find((o) => o.subID === subId) || subStyleOptions.options[0]
  }, [currentPrimaryStyle, generationFields])

  // --- Side Effects ---
  // Load cached data from localStorage on component mount or when switching tabs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Load prompt cache
        if (!initialPrompt) {
          const cachedPrompt = localStorage.getItem(STORAGE_KEY_PROMPT)
          if (cachedPrompt) {
            setValue('prompt', cachedPrompt)
          }
        }

        if (generationType === 'Video') {
          // Load reference images cache for Video
          const currentRefImages = getValues('referenceImages') as ReferenceImageI[]
          const currentHasImages = currentRefImages && currentRefImages.length > 0 && currentRefImages.some((img) => img.base64Image !== '')
          
          if (!currentHasImages && !initialPrompt) {
            const cachedRefImages = localStorage.getItem(STORAGE_KEY_REFERENCE_IMAGES)
            if (cachedRefImages) {
              const parsedImages = JSON.parse(cachedRefImages) as ReferenceImageI[]
              if (Array.isArray(parsedImages) && parsedImages.length > 0) {
                const validImages = parsedImages.filter((img) => img.base64Image !== '')
                if (validImages.length > 0) {
                  setValue('referenceImages', parsedImages)
                }
              }
            }
          }

          // Load interpolation first image cache
          const cachedInterpolFirst = localStorage.getItem(STORAGE_KEY_INTERPOL_FIRST)
          
          if (cachedInterpolFirst && !initialITVimage) {
            try {
              const parsedImage = JSON.parse(cachedInterpolFirst) as InterpolImageI
              if (parsedImage && parsedImage.base64Image) {
                const currentInterpolFirst = getValues('interpolImageFirst') as InterpolImageI
                
                // Only load if current form doesn't have an image
                if (!currentInterpolFirst || currentInterpolFirst.base64Image === '') {
                  setValue('interpolImageFirst', parsedImage)
                }
              }
            } catch (error) {
              console.error('Error parsing cached ITV image:', error)
            }
          }
        } else if (generationType === 'Image') {
          // Load reference objects cache for Image
          const currentRefObjects = getValues('referenceObjects') as any[]
          const currentHasObjects = currentRefObjects && currentRefObjects.length > 0 && currentRefObjects.some((obj) => obj.base64Image !== '')
          
          if (!currentHasObjects && !initialPrompt) {
            const cachedRefObjects = localStorage.getItem(STORAGE_KEY_REFERENCE_OBJECTS)
            if (cachedRefObjects) {
              const parsedObjects = JSON.parse(cachedRefObjects)
              if (Array.isArray(parsedObjects) && parsedObjects.length > 0) {
                const validObjects = parsedObjects.filter((obj: any) => obj.base64Image !== '')
                if (validObjects.length > 0) {
                  setValue('referenceObjects', parsedObjects)
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading cached data:', error)
      }
    }
  }, [generationType, setValue, getValues, STORAGE_KEY_PROMPT, STORAGE_KEY_REFERENCE_IMAGES, STORAGE_KEY_INTERPOL_FIRST, STORAGE_KEY_REFERENCE_OBJECTS, initialPrompt]) // Run when generation type changes or component mounts

  // Manages accordion expansion based on initial image-to-video image.
  useEffect(() => {
    if (generationType === 'Video') {
      if (initialITVimage && initialITVimage.base64Image !== '') setExpanded('interpolation')
      else setExpanded(false) // Don't force any accordion, let user control
    } else if (generationType === 'Image') {
      if (initialITVimage) setExpanded('references')
      else setExpanded(false) // Don't force any accordion, let user control
    }
  }, [initialITVimage, generationType])

  // Save prompt to localStorage when it changes (for both Image and Video)
  useEffect(() => {
    if (typeof window !== 'undefined' && currentPrompt && currentPrompt.trim() !== '') {
      try {
        localStorage.setItem(STORAGE_KEY_PROMPT, currentPrompt)
      } catch (error) {
        console.error('Error saving prompt to cache:', error)
      }
    }
  }, [currentPrompt, generationType, STORAGE_KEY_PROMPT])

  // Save reference images to localStorage when they change (Video)
  useEffect(() => {
    if (!referenceImages) return
    
    if (generationType === 'Video' && typeof window !== 'undefined' && referenceImages.length > 0) {
      try {
        const hasValidImages = referenceImages.some((img) => img.base64Image && img.base64Image !== '')
        if (hasValidImages) {
          localStorage.setItem(STORAGE_KEY_REFERENCE_IMAGES, JSON.stringify(referenceImages))
        }
      } catch (error) {
        console.error('Error saving reference images to cache:', error)
        // If localStorage is full, try to clear old data
        try {
          localStorage.removeItem(STORAGE_KEY_REFERENCE_IMAGES)
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(referenceImages), generationType, STORAGE_KEY_REFERENCE_IMAGES])

  // Save reference objects to localStorage when they change (Image)
  useEffect(() => {
    if (!referenceObjects) return
    
    if (generationType === 'Image' && typeof window !== 'undefined' && referenceObjects && referenceObjects.length > 0) {
      try {
        const hasValidObjects = referenceObjects.some((obj) => obj.base64Image && obj.base64Image !== '')
        if (hasValidObjects) {
          localStorage.setItem(STORAGE_KEY_REFERENCE_OBJECTS, JSON.stringify(referenceObjects))
        }
      } catch (error) {
        console.error('Error saving reference objects to cache:', error)
        try {
          localStorage.removeItem(STORAGE_KEY_REFERENCE_OBJECTS)
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(referenceObjects), generationType, STORAGE_KEY_REFERENCE_OBJECTS])

  // Save interpolation first image to localStorage when it changes
  useEffect(() => {
    if (
      generationType === 'Video' &&
      typeof window !== 'undefined' &&
      interpolImageFirstBase64 &&
      interpolImageFirstBase64 !== ''
    ) {
      try {
        // Save the entire object including base64Image
        const dataToSave = {
          ...interpolImageFirst,
          base64Image: interpolImageFirstBase64
        }
        localStorage.setItem(STORAGE_KEY_INTERPOL_FIRST, JSON.stringify(dataToSave))
      } catch (error) {
        console.error('Error saving interpolation image to cache:', error)
        // If localStorage is full, try to clear old data
        try {
          localStorage.removeItem(STORAGE_KEY_INTERPOL_FIRST)
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }, [interpolImageFirstBase64, generationType, STORAGE_KEY_INTERPOL_FIRST, interpolImageFirst])

  // Sets the model version to the default for the selected options.
  useEffect(() => {
    if (getValues('modelVersion') !== modelOptionField.default) {
      setValue('modelVersion', modelOptionField.default)
    }
  }, [modelOptionField, setValue, getValues])

  // Automatically sets the aspect ratio from the input image if not manually set.
  useEffect(() => {
    if (touchedFields.aspectRatio) return

    const imageRatioString = firstImageRatio || lastImageRatio

    if (imageRatioString) {
      const imageOrientation = getOrientation(imageRatioString)
      const suggestedRatio = imageOrientation === 'horizontal' ? '16:9' : '9:16'

      setValue('aspectRatio', suggestedRatio)
    }
  }, [firstImageRatio, lastImageRatio, touchedFields.aspectRatio, setValue])

  // Updates the UI orientation whenever the aspect ratio changes.
  useEffect(() => {
    if (selectedRatio) setOrientation(getOrientation(selectedRatio))
  }, [selectedRatio])

  // Resets fields based on the selected model's capabilities.
  useEffect(() => {
    if (!isAdvancedFeaturesAvailable) {
      setValue('cameraPreset', '')
      setValue('interpolImageLast', { ...InterpolImageDefaults, purpose: 'last' })

      if (!isOnlyITVavailable) setValue('interpolImageFirst', { ...InterpolImageDefaults, purpose: 'first' })
    }

    if (currentModel.includes('veo-2.0')) setValue('resolution', '720p')
    else if (currentModel.includes('veo-3.0') || currentModel.includes('veo-3.1')) setValue('resolution', '1080p')

    // Set fixed sample count based on model type
    if (currentModel.includes('gemini')) {
      setValue('sampleCount', '2') // Gemini always generates 2 images
    } else if (currentModel.includes('imagen')) {
      setValue('sampleCount', '4') // Imagen always generates 4 images
    }
  }, [currentModel, isAdvancedFeaturesAvailable, isOnlyITVavailable, setValue])

  // Populates the prompt field from the library's initial prompt.
  useEffect(() => {
    if (initialPrompt) setValue('prompt', initialPrompt)
  }, [initialPrompt, setValue])

  // Populates the image-to-video field from the library's initial image.
  useEffect(() => {
    if (initialITVimage) setValue('interpolImageFirst', initialITVimage)
  }, [initialITVimage, setValue])

  // Resets secondary style if it becomes invalid when primary style changes.
  useEffect(() => {
    if (subImgStyleField && currentSecondaryStyle && !subImgStyleField.options.includes(currentSecondaryStyle)) {
      setValue('secondary_style', '')
    }
  }, [currentSecondaryStyle, subImgStyleField, setValue])

  // --- Event Handlers and Helper Functions ---
  // Handles accordion expansion changes.
  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false)
  }

  // Handles the Gemini rewrite switch change.
  const handleGeminiRewrite = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsGeminiRewrite(event.target.checked)
  }

  // Handles the video audio switch change.
  const handleVideoAudioCheck = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue('isVideoWithAudio', event.target.checked)
  }

  // Removes a reference object from the form.
  const removeReferenceObject = (objectKey: string) => {
    const removeReference = referenceObjects.find((obj) => obj.objectKey === objectKey)
    if (!removeReference) return

    let updatedReferenceObjects = [...referenceObjects]

    if (removeReference.isAdditionalImage) {
      updatedReferenceObjects = referenceObjects.filter((obj) => obj.objectKey !== objectKey)
    } else {
      updatedReferenceObjects = referenceObjects.filter((obj) => obj.refId !== removeReference.refId)
      updatedReferenceObjects = updatedReferenceObjects.map((obj) => {
        if (obj.refId > removeReference.refId) return { ...obj, refId: obj.refId - 1 }
        return obj
      })
    }

    if (updatedReferenceObjects.length === 0) setValue('referenceObjects', ReferenceObjectInit)
    else setValue('referenceObjects', updatedReferenceObjects)
  }

  // Adds a new reference object to the form.
  const addNewRefObject = () => {
    if (referenceObjects.length >= maxReferences) return

    let highestId = referenceObjects[0].refId
    for (let i = 1; i < referenceObjects.length; i++)
      if (referenceObjects[i].refId > highestId) highestId = referenceObjects[i].refId

    const updatedReferenceObjects = [
      ...referenceObjects,
      {
        ...ReferenceObjectDefaults,
        isAdditionalImage: false,
        objectKey: Math.random().toString(36).substring(2, 15),
        refId: highestId + 1,
      },
    ]

    setValue('referenceObjects', updatedReferenceObjects)
  }

  // Adds an additional reference object image to the form.
  const addAdditionalRefObject = (objectKey: string) => {
    if (referenceObjects.length >= maxReferences) return

    const associatedObjectIndex = referenceObjects.findIndex((obj) => obj.objectKey === objectKey)
    const associatedObject = referenceObjects.find((obj) => obj.objectKey === objectKey)
    if (!associatedObject) return

    const updatedReferenceObjects = [
      ...referenceObjects.slice(0, associatedObjectIndex + 1),
      {
        ...associatedObject,
        isAdditionalImage: true,
        base64Image: '',
        objectKey: Math.random().toString(36).substring(2, 15),
      },
      ...referenceObjects.slice(associatedObjectIndex + 1),
    ]

    setValue('referenceObjects', updatedReferenceObjects)
  }

  // Removes a reference image from the form (for video generation).
  const removeReferenceImage = (imageKey: string) => {
    const updatedReferenceImages = referenceImages.filter((img) => img.imageKey !== imageKey)
    if (updatedReferenceImages.length === 0) {
      setValue('referenceImages', [])
      // Clear cache when all images are removed
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(STORAGE_KEY_REFERENCE_IMAGES)
        } catch (error) {
          console.error('Error clearing cache:', error)
        }
      }
    } else {
      setValue('referenceImages', updatedReferenceImages)
    }
  }

  // Adds a new reference image to the form (for video generation).
  const addNewReferenceImage = () => {
    if (referenceImages.length >= maxReferenceImages) return

    const updatedReferenceImages = [
      ...referenceImages,
      {
        ...ReferenceImageDefaults,
        imageKey: Math.random().toString(36).substring(2, 15),
      },
    ]

    setValue('referenceImages', updatedReferenceImages)
  }

  // Transforms a "Publisher Model not found" error message into a user-friendly message.
  interface ModelOption {
    value: string
    label: string
    indication?: string
    type?: string
  }
  function manageModelNotFoundError(errorMessage: string, modelOptions: ModelOption[]): string {
    const modelNotFoundRegex =
      /Publisher Model `projects\/[^/]+\/locations\/[^/]+\/publishers\/google\/models\/([^`]+)` not found\./
    const match = errorMessage.match(modelNotFoundRegex)

    if (match && match[1]) {
      const modelValue = match[1]
      const correspondingModel = modelOptions.find((model) => model.value === modelValue)

      const modelLabel = correspondingModel ? correspondingModel.label : modelValue

      return `You don't have access to the model '${modelLabel}', please select another one in the top dropdown menu for now, and reach out to your IT Admin to request access to '${modelLabel}'.`
    }

    return errorMessage
  }

  // Provides a random prompt from the list of random prompts.
  const getRandomPrompt = () => {
    return randomPrompts[Math.floor(Math.random() * randomPrompts.length)]
  }

  // Resets the form to its default state.
  const onReset = () => {
    generationFields.resetableFields.forEach((field) =>
      resetField(field as keyof GenerateImageFormI | keyof GenerateVideoFormI)
    )

    if (generationType === 'Video') {
      setValue('interpolImageFirst', generationFields.defaultValues.interpolImageFirst)
      setValue('interpolImageLast', generationFields.defaultValues.interpolImageLast)
      setValue('referenceImages', [])
      
      // Clear localStorage cache
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(STORAGE_KEY_REFERENCE_IMAGES)
          localStorage.removeItem(STORAGE_KEY_INTERPOL_FIRST)
        } catch (error) {
          console.error('Error clearing cache:', error)
        }
      }
    }

    setOrientation('horizontal')
    onNewErrorMsg('')
  }

  // --- Form Submission Handlers ---
  // Handles image generation submission.
  const onImageSubmit: SubmitHandler<GenerateImageFormI> = async (formData) => {
    onRequestSent(true, parseInt(formData.sampleCount))

    try {
      // Check if using Gemini model for image generation
      const isGeminiModel = formData.modelVersion.includes('gemini')

      if (isGeminiModel) {
        // Use Gemini native image generation with full form data (including style attributes)
        const newGeneratedImages = await generateImageWithGemini(formData, appContext)

        if (typeof newGeneratedImages === 'object' && 'error' in newGeneratedImages) {
          let errorMsg = newGeneratedImages['error'].replaceAll('Error: ', '')
          errorMsg = manageModelNotFoundError(errorMsg, generationFields.model.options as ModelOption[])
          throw Error(errorMsg)
        } else {
          onImageGeneration && onImageGeneration(newGeneratedImages)
        }
      } else {
        // Use Imagen for image generation
        const areAllRefValid = formData['referenceObjects'].every(
          (reference) =>
            reference.base64Image !== '' &&
            reference.description !== '' &&
            reference.refId !== null &&
            reference.referenceType !== ''
        )
        if (hasReferences && !areAllRefValid)
          throw Error('Incomplete reference(s) information provided, either image type or description missing.')

        if (hasReferences && areAllRefValid) setIsGeminiRewrite(false)

        const newGeneratedImages = await generateImage(formData, areAllRefValid, isGeminiRewrite, appContext)

        if (newGeneratedImages !== undefined && typeof newGeneratedImages === 'object' && 'error' in newGeneratedImages) {
          let errorMsg = newGeneratedImages['error'].replaceAll('Error: ', '')
          errorMsg = manageModelNotFoundError(errorMsg, generationFields.model.options as ModelOption[])
          throw Error(errorMsg)
        } else {
          newGeneratedImages.map((image) => {
            if ('warning' in image) onNewErrorMsg(image['warning'] as string)
          })

          onImageGeneration && onImageGeneration(newGeneratedImages)
        }
      }
    } catch (error: any) {
      onNewErrorMsg(error.toString())
    }
  }

  // Handles video generation submission.
  const onVideoSubmit: SubmitHandler<GenerateVideoFormI> = async (formData) => {
    onRequestSent(true, parseInt(formData.sampleCount))

    const startTime = new Date().toISOString()
    const startMs = Date.now()

    try {
      // Validate based on video mode
      if (formData.videoMode === 'image-to-video') {
        if (!formData.interpolImageFirst || formData.interpolImageFirst.base64Image === '') {
          throw Error('Image-to-Video mode requires a base image. Please upload an image.')
        }
      } else if (formData.videoMode === 'reference-image') {
        const hasValidReferenceImage = formData.referenceImages && 
          formData.referenceImages.length > 0 && 
          formData.referenceImages.some(img => img.base64Image !== '')
        if (!hasValidReferenceImage) {
          throw Error('Reference Image mode requires at least one reference image. Please upload a reference image.')
        }
      }
      
      if (formData.interpolImageLast && formData.interpolImageLast.base64Image !== '' && formData.cameraPreset !== '')
        throw Error(
          `You can't have both a last frame and a camera preset selected. Please leverage only one of the two feature at once.`
        )

      const result = await generateVideo(formData, appContext)

      if ('error' in result) {
        let errorMsg = result.error.replace('Error: ', '')
        errorMsg = manageModelNotFoundError(errorMsg, generationFields.model.options as ModelOption[])

        throw new Error(errorMsg)
      } else if ('operationName' in result && 'prompt' in result)
        onVideoPollingStart && onVideoPollingStart(result.operationName, { 
          formData: formData, 
          prompt: result.prompt,
          startTime,
          startMs
        })
      else throw new Error('Failed to initiate video generation: Invalid response from server.')
    } catch (error: any) {
      onNewErrorMsg(error.toString().replace('Error: ', ''))
    }
  }

  // Main submission handler that delegates to the appropriate generation handler.
  const onSubmit: SubmitHandler<GenerateImageFormI | GenerateVideoFormI> = async (formData) => {
    if (generationType === 'Image') await onImageSubmit(formData as GenerateImageFormI)
    else if (generationType === 'Video') await onVideoSubmit(formData as GenerateVideoFormI)
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Box sx={{ pb: 4 }}>
          <Box sx={{ pb: 5 }}>
            <Stack direction="row" spacing={2} justifyContent="flex-start" alignItems="center">
              <Typography variant="h1" color={palette.text.secondary} sx={{ fontSize: '1.8rem' }}>
                {'Generate with'}
              </Typography>
              <FormInputDropdown
                name="modelVersion"
                label=""
                control={control}
                field={modelOptionField}
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
                      onRequestSent(false, 0)
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

          {/* Video Mode Selector - Only for Video generation */}
          {generationType === 'Video' && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: palette.text.secondary }}>
                Generation Mode
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant={videoMode === 'text-only' ? 'contained' : 'outlined'}
                  onClick={() => setValue('videoMode', 'text-only')}
                  sx={{ flex: 1, fontSize: '0.85rem' }}
                >
                  📝 Text-to-Video
                </Button>
                <Button
                  variant={videoMode === 'image-to-video' ? 'contained' : 'outlined'}
                  onClick={() => setValue('videoMode', 'image-to-video')}
                  sx={{ flex: 1, fontSize: '0.85rem' }}
                >
                  🖼️ Image-to-Video
                </Button>
                <Button
                  variant={videoMode === 'reference-image' ? 'contained' : 'outlined'}
                  onClick={() => setValue('videoMode', 'reference-image')}
                  sx={{ flex: 1, fontSize: '0.85rem' }}
                >
                  🎨 Reference Image
                </Button>
              </Stack>
            </Box>
          )}

          <FormInputText
            name="prompt"
            control={control}
            label={`${optionalVeoPrompt ? '(Optional)' : ''} Prompt - What would you like to generate?`}
            required={!optionalVeoPrompt}
            rows={7}
            promptIndication={`${promptIndication}${
              isAudioAvailable ? ', audio (dialogue/ sound effects/ music/ ambiant sounds)' : ''
            }`}
          />

          <Stack justifyContent="flex-end" direction="row" gap={0} pb={3}>
            <CustomTooltip title="Get prompt ideas" size="small">
              <IconButton
                onClick={() => setValue('prompt', getRandomPrompt())}
                aria-label="Random prompt"
                disableRipple
                sx={{ px: 0.5 }}
              >
                <Avatar sx={CustomizedAvatarButton}>
                  <Lightbulb sx={CustomizedIconButton} />
                </Avatar>
              </IconButton>
            </CustomTooltip>
            <CustomTooltip title="Image to prompt generator" size="small">
              <IconButton
                onClick={() => setImageToPromptOpen(true)}
                aria-label="Prompt Generator"
                disableRipple
                sx={{ px: 0.5 }}
              >
                <Avatar sx={CustomizedAvatarButton}>
                  <Mms sx={CustomizedIconButton} />
                </Avatar>
              </IconButton>
            </CustomTooltip>
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
            <GenerateSettings
              control={control}
              setValue={setValue}
              generalSettingsFields={
                currentModel.includes('veo-3.0') || currentModel.includes('veo-3.1')
                  ? tempVeo3specificSettings
                  : adjustedSettings
              }
              advancedSettingsFields={generationFields.advancedSettings}
            />
            {isAudioAvailable && (
              <CustomTooltip title="Add audio to your video" size="small">
                <AudioSwitch checked={isVideoWithAudio} onChange={handleVideoAudioCheck} />
              </CustomTooltip>
            )}
            {currentModel.includes('imagen') && !hasReferences && !currentModel.includes('gemini') && (
              <CustomTooltip title="Have Gemini enhance your prompt" size="small">
                <GeminiSwitch checked={isGeminiRewrite} onChange={handleGeminiRewrite} />
              </CustomTooltip>
            )}
            <Button
              type="submit"
              variant="contained"
              disabled={isLoading}
              endIcon={isLoading ? <WatchLaterIcon /> : <SendIcon />}
              sx={CustomizedSendButton}
            >
              {'Generate'}
            </Button>
          </Stack>
          {generationType === 'Image' && process.env.NEXT_PUBLIC_EDIT_ENABLED === 'true' && !currentModel.includes('gemini') && (
            <Accordion
              disableGutters
              expanded={expanded === 'references'}
              onChange={handleChange('references')}
              sx={CustomizedAccordion}
            >
              <AccordionSummary
                expandIcon={<ArrowDownwardIcon sx={{ color: palette.primary.main }} />}
                aria-controls="panel1-content"
                id="panel1-header"
                sx={CustomizedAccordionSummary}
              >
                <Typography display="inline" variant="body1" sx={{ fontWeight: 500 }}>
                  {'Subject & Style reference(s)'}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 1, height: 'auto' }}>
                <Stack
                  direction="column"
                  flexWrap="wrap"
                  justifyContent="flex-start"
                  alignItems="flex-start"
                  spacing={1}
                  sx={{ pt: 0, pb: 1 }}
                >
                  {referenceObjects.map((referenceObject, index) => {
                    return (
                      <ReferenceBox
                        key={referenceObject.objectKey + index + '_box'}
                        objectKey={referenceObject.objectKey}
                        currentReferenceObject={referenceObject}
                        onNewErrorMsg={onNewErrorMsg}
                        control={control}
                        setValue={setValue}
                        removeReferenceObject={removeReferenceObject}
                        addAdditionalRefObject={addAdditionalRefObject}
                        refPosition={index}
                        refCount={referenceObjects.length}
                      />
                    )
                  })}
                </Stack>
                {referenceObjects.length < maxReferences && (
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
                    <Button
                      variant="contained"
                      onClick={() => addNewRefObject()}
                      disabled={referenceObjects.length >= maxReferences}
                      sx={{ ...CustomizedSendButton, ...{ fontSize: '0.8rem', px: 0 } }}
                    >
                      {'Add'}
                    </Button>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          )}
          {generationType === 'Video' && videoMode === 'image-to-video' && (isOnlyITVavailable || isAdvancedFeaturesAvailable) && (
            <Accordion
              disableGutters
              expanded={expanded === 'interpolation'}
              onChange={handleChange('interpolation')}
              sx={CustomizedAccordion}
            >
              <AccordionSummary
                expandIcon={<ArrowDownwardIcon sx={{ color: palette.primary.main }} />}
                aria-controls="panel1-content"
                id="panel1-header"
                sx={CustomizedAccordionSummary}
              >
                <Typography display="inline" variant="body1" sx={{ fontWeight: 500 }}>
                  {isAdvancedFeaturesAvailable ? 'Image(s) to video & Camera presets' : 'Image to video'}
                </Typography>
              </AccordionSummary>
              {
                // Advanced features (interpolation, camera preset) are only available for Veo 2 for now!
                isAdvancedFeaturesAvailable && (
                  <AccordionDetails sx={{ pt: 0, pb: 1, height: 'auto' }}>
                    <Typography
                      variant="body2"
                      sx={{ color: palette.text.secondary, fontSize: '0.85rem', pb: 1, fontWeight: 400 }}
                    >
                      <strong>Image-to-Video:</strong> Convert a static image into video. The image becomes the first or last frame, and the video animates from that starting point. This feature turns your image into motion.
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: palette.info.main, fontSize: '0.8rem', pb: 1, fontWeight: 400 }}
                    >
                      ℹ️ Use this when you have a specific starting/ending frame. For style/character consistency across the video, use Reference Images (Veo 3.1 only) instead.
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: palette.success.main, fontSize: '0.75rem', pb: 2, fontWeight: 400 }}
                    >
                      💾 Your uploaded image is automatically saved in browser storage.
                    </Typography>
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      justifyContent="flex-start"
                      alignItems="flex-start"
                      spacing={0.5}
                      sx={{ pt: 1, pb: 1 }}
                    >
                      <VideoInterpolBox
                        label="Base image"
                        sublabel={'(or first frame)'}
                        objectKey="interpolImageFirst"
                        onNewErrorMsg={onNewErrorMsg}
                        setValue={setValue}
                        interpolImage={interpolImageFirst}
                        orientation={orientation}
                      />

                      <ArrowRight color={interpolImageLast.base64Image === '' ? 'secondary' : 'primary'} />
                      <VideoInterpolBox
                        label="Last frame"
                        sublabel="(optional)"
                        objectKey="interpolImageLast"
                        onNewErrorMsg={onNewErrorMsg}
                        setValue={setValue}
                        interpolImage={interpolImageLast}
                        orientation={orientation}
                      />
                    </Stack>

                    {/* Image Cache Storage - for quick selection of base image */}
                    {videoMode === 'image-to-video' && (
                      <Box sx={{ mt: 2, mb: 2 }}>
                        <ImageCacheStorage 
                          onImageSelect={(base64Image) => {
                            // Set as ITV image with all required properties
                            const img = new window.Image()
                            img.onload = () => {
                              setValue('interpolImageFirst', {
                                base64Image,
                                ratio: getAspectRatio(img.width, img.height),
                                format: 'image/png',
                                purpose: 'first' as const,
                                width: img.width,
                                height: img.height,
                              })
                            }
                            img.src = base64Image
                          }}
                        />
                      </Box>
                    )}

                    <Box sx={{ py: 2 }}>
                      <FormInputChipGroup
                        name="cameraPreset"
                        label={videoGenerationUtils.cameraPreset.label ?? ''}
                        control={control}
                        setValue={setValue}
                        width="450px"
                        field={videoGenerationUtils.cameraPreset as chipGroupFieldsI}
                        required={false}
                      />
                    </Box>
                  </AccordionDetails>
                )
              }
              {
                // Advanced features (interpolation, camera preset) are only available for Veo 2 for now!
                isOnlyITVavailable && (
                  <AccordionDetails sx={{ pt: 0, pb: 1, height: 'auto' }}>
                    <Typography
                      variant="body2"
                      sx={{ color: palette.text.secondary, fontSize: '0.85rem', pb: 1, fontWeight: 400 }}
                    >
                      <strong>Image-to-Video:</strong> Convert a static image into video. The image becomes the first frame, and the video animates from that starting point. This feature turns your image into motion.
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: palette.info.main, fontSize: '0.8rem', pb: 1, fontWeight: 400 }}
                    >
                      ℹ️ Use this when you have a specific starting frame. For style/character consistency across the video, use Reference Images (Veo 3.1 only) instead.
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: palette.success.main, fontSize: '0.75rem', pb: 2, fontWeight: 400 }}
                    >
                      💾 Your uploaded image is automatically saved in browser storage.
                    </Typography>
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      justifyContent="flex-start"
                      alignItems="flex-start"
                      spacing={0.5}
                      sx={{ pt: 1, pb: 1 }}
                    >
                      <VideoInterpolBox
                        label="Base image"
                        sublabel={'(input)'}
                        objectKey="interpolImageFirst"
                        onNewErrorMsg={onNewErrorMsg}
                        setValue={setValue}
                        interpolImage={interpolImageFirst}
                        orientation={orientation}
                      />
                      <Typography
                        color={palette.warning.main}
                        sx={{ fontSize: '0.85rem', fontWeight: 400, pt: 2, width: '70%' }}
                      >
                        {
                          'Note: Veo 3 does not support Image Interpolation and Camera Presets. Switch to Veo 2 to use them!'
                        }
                      </Typography>
                    </Stack>

                    {/* Image Cache Storage - for quick selection of base image */}
                    {videoMode === 'image-to-video' && (
                      <Box sx={{ mt: 2, mb: 2 }}>
                        <ImageCacheStorage 
                          onImageSelect={(base64Image) => {
                            // Set as ITV image with all required properties
                            const img = new window.Image()
                            img.onload = () => {
                              setValue('interpolImageFirst', {
                                base64Image,
                                ratio: getAspectRatio(img.width, img.height),
                                format: 'image/png',
                                purpose: 'first' as const,
                                width: img.width,
                                height: img.height,
                              })
                            }
                            img.src = base64Image
                          }}
                        />
                      </Box>
                    )}
                  </AccordionDetails>
                )
              }
            </Accordion>
          )}
          {generationType === 'Video' && videoMode === 'reference-image' && isReferenceImagesAvailable && (
            <Accordion
              disableGutters
              expanded={expanded === 'referenceImages'}
              onChange={handleChange('referenceImages')}
              sx={CustomizedAccordion}
            >
              <AccordionSummary
                expandIcon={<ArrowDownwardIcon sx={{ color: palette.primary.main }} />}
                aria-controls="panel-reference-images-content"
                id="panel-reference-images-header"
                sx={CustomizedAccordionSummary}
              >
                <Typography display="inline" variant="body1" sx={{ fontWeight: 500 }}>
                  {'Reference images (up to 3)'}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 1, height: 'auto' }}>
                <Typography
                  variant="body2"
                  sx={{ color: palette.text.secondary, fontSize: '0.85rem', pb: 1, fontWeight: 400 }}
                >
                  <strong>Reference Images (Veo 3.1 only):</strong> Provide up to 3 reference images to guide video generation and maintain visual consistency of characters, products, or styles.
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: palette.warning.main, fontSize: '0.8rem', pb: 1, fontWeight: 400, fontStyle: 'italic' }}
                >
                  Note: These images guide the model through natural language descriptions in your prompt (e.g., "a woman with dark hair wearing a pink dress"), not through label tags. Labels are for your own reference to remember what to describe in the prompt.
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: palette.info.main, fontSize: '0.8rem', pb: 1, fontWeight: 400 }}
                >
                  ⚠️ Cannot be used together with Image-to-Video. Choose one: Use Reference Images for style/character consistency, or Image-to-Video to animate a specific static image.
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: palette.success.main, fontSize: '0.75rem', pb: 2, fontWeight: 400 }}
                >
                  💾 Your uploaded images are automatically saved in browser storage and will persist across page refreshes.
                </Typography>
                <Stack
                  direction="column"
                  flexWrap="wrap"
                  justifyContent="flex-start"
                  alignItems="flex-start"
                  spacing={1}
                  sx={{ pt: 0, pb: 1 }}
                >
                  {referenceImages.map((referenceImage, index) => {
                    return (
                      <VideoReferenceBox
                        key={referenceImage.imageKey + index + '_box'}
                        imageKey={referenceImage.imageKey}
                        currentReferenceImage={referenceImage}
                        onNewErrorMsg={onNewErrorMsg}
                        control={control}
                        setValue={setValue}
                        removeReferenceImage={removeReferenceImage}
                        refPosition={index}
                        refCount={referenceImages.length}
                      />
                    )
                  })}
                </Stack>

                {/* Image Cache Storage - for quick selection of reference images */}
                {videoMode === 'reference-image' && (
                  <Box sx={{ mt: 2, mb: 2 }}>
                    <ImageCacheStorage 
                      onImageSelect={(base64Image) => {
                        // Find first empty reference image slot
                        const emptyIndex = referenceImages.findIndex((img) => !img.base64Image || img.base64Image === '')
                        
                        if (emptyIndex !== -1) {
                          // Fill first empty slot
                          setValue(`referenceImages.${emptyIndex}.base64Image`, base64Image)
                        } else if (referenceImages.length < maxReferenceImages) {
                          // All slots filled but can add more, add new one
                          addNewReferenceImage()
                          // Wait a tick for the new image to be added to the form
                          setTimeout(() => {
                            setValue(`referenceImages.${referenceImages.length}.base64Image`, base64Image)
                          }, 0)
                        }
                      }}
                    />
                  </Box>
                )}

                {referenceImages.length < maxReferenceImages && (
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
                    <Button
                      variant="contained"
                      onClick={() => addNewReferenceImage()}
                      disabled={referenceImages.length >= maxReferenceImages}
                      sx={{ ...CustomizedSendButton, ...{ fontSize: '0.8rem', px: 0 } }}
                    >
                      {'Add reference image'}
                    </Button>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          )}
          <Accordion
            disableGutters
            defaultExpanded
            sx={CustomizedAccordion}
          >
            <AccordionSummary
              expandIcon={<ArrowDownwardIcon sx={{ color: palette.primary.main }} />}
              aria-controls="panel1-content"
              id="panel1-header"
              sx={CustomizedAccordionSummary}
            >
              <Typography display="inline" variant="body1" sx={{ fontWeight: 500 }}>
                {generationType + ' / prompt attributes'}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ py: 0 }}>
              <Stack
                direction="row"
                spacing={3}
                flexWrap="wrap"
                justifyContent="flex-start"
                alignItems="flex-start"
                sx={{ pt: 1, height: 100 }}
              >
                <FormInputDropdown
                  name="style"
                  label="Primary style"
                  control={control}
                  field={generationFields.styleOptions}
                  styleSize="small"
                  width="140px"
                  required={true}
                />
                <FormInputChipGroup
                  name="secondary_style"
                  label={subImgStyleField.label}
                  control={control}
                  setValue={setValue}
                  width="400px"
                  field={subImgStyleField}
                  required={false}
                />
              </Stack>
              <Stack direction="row" spacing={0} sx={{ pt: 2, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {Object.entries(generationFields.compositionOptions).map(function ([param, field]) {
                  return (
                    <Box key={param} py={1} width="50%">
                      <FormInputChipGroup
                        name={param}
                        label={field.label}
                        key={param}
                        control={control}
                        setValue={setValue}
                        width="250px"
                        field={field}
                        required={false}
                      />
                    </Box>
                  )
                })}
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Box>
      </form>

      <ImageToPromptModal
        open={imageToPromptOpen}
        setNewPrompt={(string) => setValue('prompt', string)}
        setImageToPromptOpen={setImageToPromptOpen}
        target={generationType}
      />
    </>
  )
}
