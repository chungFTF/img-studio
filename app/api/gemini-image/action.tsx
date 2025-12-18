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

'use server'

import { appContextDataI } from '../../context/app-context'
import { ImageI, RatioToPixel, GenerateImageFormI, imageGenerationUtils } from '../generate-image-utils'
import { uploadBase64Image, getSignedURL } from '../cloud-storage/action'
const { GoogleAuth } = require('google-auth-library')

function generateUniqueFolderId() {
  let number = Math.floor(Math.random() * 9) + 1
  for (let i = 0; i < 12; i++) number = number * 10 + Math.floor(Math.random() * 10)
  return number
}

function cleanResult(inputString: string) {
  return inputString.toString().replaceAll('\n', '').replaceAll(/\//g, '').replaceAll('*', '')
}

// Gemini Native Image Generation using responseModalities
// Now accepts the full GenerateImageFormI to include style attributes
export async function generateImageWithGemini(
  formData: GenerateImageFormI,
  appContext: appContextDataI | null
): Promise<ImageI[] | { error: string }> {
  // 1 - Authenticate to Google Cloud
  let client
  try {
    const auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    })
    client = await auth.getClient()
  } catch (error) {
    console.error('Authentication Error:', error)
    return { error: 'Unable to authenticate your account to access Gemini image generation.' }
  }

  // 2 - Validate App Context
  if (!appContext?.gcsURI || !appContext?.userID) {
    return { error: 'Application context is missing required information.' }
  }

  const projectId = process.env.NEXT_PUBLIC_PROJECT_ID
  const modelVersion = formData.modelVersion || 'gemini-2.0-flash-exp'
  
  // Determine the correct location and endpoint
  // gemini-3-pro-image-preview requires global endpoint (not regional)
  const isGlobalEndpointRequired = modelVersion === 'gemini-3-pro-image-preview'
  const location = isGlobalEndpointRequired ? 'global' : 'us-central1'
  
  // Build the correct API endpoint
  const baseUrl = isGlobalEndpointRequired 
    ? 'https://aiplatform.googleapis.com'
    : `https://${location}-aiplatform.googleapis.com`
  
  const geminiAPIUrl = `${baseUrl}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelVersion}:generateContent`

  // 3 - Build request with responseModalities for image generation
  const sampleCount = parseInt(formData.sampleCount) || 1
  const generatedImages: ImageI[] = []
  const generationGcsURI = `${appContext.gcsURI}/${appContext.userID}/generated-images`
  const bucketName = generationGcsURI.replace('gs://', '').split('/')[0]
  const uniqueFolderId = generateUniqueFolderId()
  const folderName = generationGcsURI.split(bucketName + '/')[1] + '/' + uniqueFolderId

  // Build prompt with style attributes (same as Imagen)
  let fullPrompt = formData.prompt

  // Add the photo/art/digital style to the prompt
  if (formData.style && formData.secondary_style) {
    fullPrompt = `A ${formData.secondary_style} ${formData.style} of ${fullPrompt}`
  }

  // Add additional parameters (light, perspective, colors, etc.)
  let parameters = ''
  imageGenerationUtils.fullPromptFields.forEach((additionalField) => {
    const fieldValue = formData[additionalField as keyof GenerateImageFormI]
    if (fieldValue && typeof fieldValue === 'string' && fieldValue !== '') {
      parameters += ` ${fieldValue} ${String(additionalField).replaceAll('_', ' ')}, `
    }
  })
  if (parameters !== '') fullPrompt = `${fullPrompt}, ${parameters}`

  // Add quality modifiers based on use_case
  let quality_modifiers = ''
  if (formData.use_case === 'Food, insects, plants (still life)')
    quality_modifiers = ', High detail, precise focusing, controlled lighting'
  if (formData.use_case === 'Sports, wildlife (motion)')
    quality_modifiers = ', Fast shutter speed, movement tracking'
  if (formData.use_case === 'Astronomical, landscape (wide-angle)')
    quality_modifiers = ', Long exposure times, sharp focus, long exposure, smooth water or clouds'
  
  fullPrompt = fullPrompt + quality_modifiers

  // Add general quality modifiers for sharper images
  fullPrompt = `${fullPrompt}. High resolution, high quality, detailed, sharp focus, crisp details`
  
  if (formData.negativePrompt) {
    fullPrompt = `${fullPrompt}. Avoid: ${formData.negativePrompt}`
  }

  // Check if using new image models (aspect ratio handled in API config)
  const isNewImageModel = formData.modelVersion === 'gemini-2.5-flash-image' || formData.modelVersion === 'gemini-3-pro-image-preview'
  
  // Add aspect ratio instruction to prompt only for old API
  if (!isNewImageModel && formData.aspectRatio && formData.aspectRatio !== '1:1') {
    fullPrompt = `${fullPrompt}. Generate in ${formData.aspectRatio} aspect ratio.`
  }

  // Gemini image generation: allow up to 2 images with delay between requests
  const maxGeminiSamples = 2
  const actualSampleCount = Math.min(parseInt(formData.sampleCount) || 1, maxGeminiSamples)

  // Generate images sequentially with delay to avoid rate limiting
  for (let i = 0; i < actualSampleCount; i++) {
    // Add delay between requests (except for the first one)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2000)) // 2 second delay
    }
    // Use different API format for new Gemini image models
    const isNewImageModel = modelVersion === 'gemini-2.5-flash-image' || modelVersion === 'gemini-3-pro-image-preview'
    
    const reqData: any = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: fullPrompt,
            },
          ],
        },
      ],
    }

    if (isNewImageModel) {
      // New image_config API for gemini-2.5-flash-image and gemini-3-pro-image-preview
      reqData.generationConfig = {
        temperature: 1.0,
      }
      
      const imageConfig: any = {
        aspect_ratio: formData.aspectRatio || '1:1',
      }
      
      // gemini-3-pro-image-preview supports image_size parameter
      if (modelVersion === 'gemini-3-pro-image-preview') {
        imageConfig.image_size = '2K' // Can be '2K' or '4K'
      }
      
      reqData.generationConfig.image_config = imageConfig
    } else {
      // Old responseModalities API for gemini-2.0-flash-exp
      reqData.generationConfig = {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 1.0,
      }
    }

    const opts = {
      url: geminiAPIUrl,
      method: 'POST',
      data: reqData,
    }

    try {
      const res = await client.request(opts)

      if (!res.data?.candidates?.[0]?.content?.parts) {
        console.error('No valid response from Gemini:', res.data)
        continue
      }

      const parts = res.data.candidates[0].content.parts

      // Find the image part in the response
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          const base64Image = part.inlineData.data
          const mimeType = part.inlineData.mimeType
          const format = mimeType.replace('image/', '').toUpperCase()
          const fileName = `sample_${i}.${format.toLowerCase()}`
          const fullObjectName = `${folderName}/${fileName}`

          // Upload to GCS
          const uploadResult = await uploadBase64Image(base64Image, bucketName, fullObjectName)

          if (!uploadResult.success) {
            console.error('Failed to upload image:', uploadResult.error)
            continue
          }

          const imageGcsUri = uploadResult.fileUrl || ''

          // Get signed URL
          const signedURL = await getSignedURL(imageGcsUri)

          if (typeof signedURL === 'object' && 'error' in signedURL) {
            console.error('Failed to get signed URL:', signedURL.error)
            continue
          }

          const usedRatio = RatioToPixel.find((item) => item.ratio === formData.aspectRatio) || RatioToPixel[0]

          const today = new Date()
          const formattedDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

          const imageResult: ImageI = {
            src: signedURL as string,
            gcsUri: imageGcsUri,
            format: format,
            prompt: formData.prompt,
            altText: `Gemini generated image ${i}`,
            key: `${uniqueFolderId}_${i}`,
            width: usedRatio.width,
            height: usedRatio.height,
            ratio: formData.aspectRatio,
            date: formattedDate,
            author: appContext.userID || '',
            modelVersion: modelVersion,
            mode: 'Generated',
          }

          generatedImages.push(imageResult)
          break // Only take the first image from each response
        }
      }
    } catch (error: any) {
      console.error(`Error generating image ${i}:`, error.response?.data || error.message || error)

      // Check for specific error types
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.error?.message || 'Bad request'
        if (errorMessage.includes('not supported') || errorMessage.includes('IMAGE')) {
          return {
            error: `Gemini image generation is not available for model ${modelVersion}. Please check if the model supports image generation.`,
          }
        }
        return { error: `Request error: ${errorMessage}` }
      }

      if (error.response?.status === 429) {
        return { error: 'Rate limit exceeded. Please try again later.' }
      }
    }
  }

  if (generatedImages.length === 0) {
    return { error: 'No images were generated. Please try a different prompt.' }
  }

  return generatedImages
}

// Gemini Image Editing - uses text instructions instead of masks
export interface GeminiEditFormI {
  prompt: string
  modelVersion: string
  sampleCount: string
  inputImage: string // base64 encoded image
  negativePrompt?: string
}

export async function editImageWithGemini(
  formData: GeminiEditFormI,
  appContext: appContextDataI | null
): Promise<ImageI[] | { error: string }> {
  // 1 - Authenticate to Google Cloud
  let client
  try {
    const auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    })
    client = await auth.getClient()
  } catch (error) {
    console.error('Authentication Error:', error)
    return { error: 'Unable to authenticate your account.' }
  }

  // 2 - Validate App Context
  if (!appContext?.gcsURI || !appContext?.userID) {
    return { error: 'Application context is missing required information.' }
  }

  const projectId = process.env.NEXT_PUBLIC_PROJECT_ID
  const modelVersion = formData.modelVersion || 'gemini-2.0-flash-exp'
  
  // Determine the correct location and endpoint
  // gemini-3-pro-image-preview requires global endpoint (not regional)
  const isGlobalEndpointRequired = modelVersion === 'gemini-3-pro-image-preview'
  const location = isGlobalEndpointRequired ? 'global' : 'us-central1'
  
  // Build the correct API endpoint
  const baseUrl = isGlobalEndpointRequired 
    ? 'https://aiplatform.googleapis.com'
    : `https://${location}-aiplatform.googleapis.com`
  
  const geminiAPIUrl = `${baseUrl}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelVersion}:generateContent`

  // 3 - Prepare the image data
  const editGcsURI = `${appContext.gcsURI}/${appContext.userID}/edited-images`
  const bucketName = editGcsURI.replace('gs://', '').split('/')[0]
  const uniqueFolderId = generateUniqueFolderId()
  const folderName = editGcsURI.split(bucketName + '/')[1] + '/' + uniqueFolderId

  // Clean base64 image
  const base64Image = formData.inputImage.startsWith('data:')
    ? formData.inputImage.split(',')[1]
    : formData.inputImage

  // Determine mime type from base64 or default to png
  let mimeType = 'image/png'
  if (formData.inputImage.startsWith('data:image/')) {
    mimeType = formData.inputImage.split(';')[0].split(':')[1]
  }

  // Build edit prompt with quality enhancement
  let editPrompt = `Edit this image: ${formData.prompt}. Maintain high resolution, sharp focus, and crisp details in the edited result.`
  if (formData.negativePrompt) {
    editPrompt = `${editPrompt} Avoid: ${formData.negativePrompt}`
  }

  // 4 - Build request
  const reqData = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: editPrompt,
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      temperature: 1.0,
    },
  }

  const opts = {
    url: geminiAPIUrl,
    method: 'POST',
    data: reqData,
  }

  const generatedImages: ImageI[] = []

  try {
    const res = await client.request(opts)

    if (!res.data?.candidates?.[0]?.content?.parts) {
      console.error('No valid response from Gemini:', res.data)
      return { error: 'No valid response from Gemini.' }
    }

    const parts = res.data.candidates[0].content.parts

    // Find the image part in the response
    let imageIndex = 0
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        const responseBase64 = part.inlineData.data
        const responseMimeType = part.inlineData.mimeType
        const format = responseMimeType.replace('image/', '').toUpperCase()
        const fileName = `sample_${imageIndex}.${format.toLowerCase()}`
        const fullObjectName = `${folderName}/${fileName}`

        // Upload to GCS
        const uploadResult = await uploadBase64Image(responseBase64, bucketName, fullObjectName)

        if (!uploadResult.success) {
          console.error('Failed to upload image:', uploadResult.error)
          continue
        }

        const imageGcsUri = uploadResult.fileUrl || ''

        // Get signed URL
        const signedURL = await getSignedURL(imageGcsUri)

        if (typeof signedURL === 'object' && 'error' in signedURL) {
          console.error('Failed to get signed URL:', signedURL.error)
          continue
        }

        const today = new Date()
        const formattedDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

        const imageResult: ImageI = {
          src: signedURL as string,
          gcsUri: imageGcsUri,
          format: format,
          prompt: formData.prompt,
          altText: `Gemini edited image ${imageIndex}`,
          key: `${uniqueFolderId}_${imageIndex}`,
          width: 1024, // Gemini typically outputs around 1024px
          height: 1024,
          ratio: '1:1', // Gemini maintains original ratio
          date: formattedDate,
          author: appContext.userID || '',
          modelVersion: modelVersion,
          mode: 'Edited',
        }

        generatedImages.push(imageResult)
        imageIndex++
      }
    }
  } catch (error: any) {
    console.error('Error editing image:', error.response?.data || error.message || error)

    if (error.response?.status === 429) {
      return { error: 'Rate limit exceeded. Please try again later.' }
    }

    return { error: `Error editing image: ${error.message || 'Unknown error'}` }
  }

  if (generatedImages.length === 0) {
    return { error: 'No edited images were generated. Please try a different prompt.' }
  }

  return generatedImages
}

