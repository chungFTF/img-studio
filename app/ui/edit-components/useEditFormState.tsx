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

import { useState, useCallback } from 'react'
import { useAppContext } from '../../context/app-context'

const EDIT_FORM_STATE_KEY = 'img-studio-edit-form-state'

export interface EditFormState {
  imageToEdit: string | null
  maskImage: string | null
  maskPreview: string | null
  outpaintedImage: string | null
  selectedEditMode: any
  maskSize: { width: number; height: number }
  originalImage: string | null
  originalWidth: number | null
  originalHeight: number | null
}

export function useEditFormState() {
  const { appContext, setAppContext } = useAppContext()

  // Initialize from context or localStorage
  const getInitialState = (): EditFormState => {
    // First try context
    if (appContext?.editPageState) {
      const contextState = appContext.editPageState
      if (
        contextState.imageToEdit ||
        contextState.maskImage ||
        contextState.selectedEditMode
      ) {
        return {
          imageToEdit: contextState.imageToEdit || null,
          maskImage: contextState.maskImage || null,
          maskPreview: contextState.maskPreview || null,
          outpaintedImage: contextState.outpaintedImage || null,
          selectedEditMode: contextState.selectedEditMode || null,
          maskSize: contextState.maskSize || { width: 0, height: 0 },
          originalImage: contextState.originalImage || null,
          originalWidth: contextState.originalWidth || null,
          originalHeight: contextState.originalHeight || null,
        }
      }
    }

    // Then try localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(EDIT_FORM_STATE_KEY)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Failed to parse saved edit form state:', e)
        }
      }
    }

    // Default state
    return {
      imageToEdit: null,
      maskImage: null,
      maskPreview: null,
      outpaintedImage: null,
      selectedEditMode: null,
      maskSize: { width: 0, height: 0 },
      originalImage: null,
      originalWidth: null,
      originalHeight: null,
    }
  }

  const [state, setState] = useState<EditFormState>(getInitialState)

  // Save state whenever it changes
  const saveState = useCallback((newState: Partial<EditFormState>) => {
    setState((prev) => {
      const updated = { ...prev, ...newState }

      // Save to context (full state including images)
      setAppContext((prevContext) => {
        if (!prevContext) return prevContext
        return {
          ...prevContext,
          editPageState: {
            editedImagesInGCS: prevContext.editPageState?.editedImagesInGCS || [],
            editedCount: prevContext.editPageState?.editedCount || 0,
            isUpscaledDLAvailable: prevContext.editPageState?.isUpscaledDLAvailable ?? true,
            ...prevContext.editPageState,
            ...updated,
          },
        }
      })

      // Save to localStorage (exclude large base64 images to avoid quota issues)
      if (typeof window !== 'undefined') {
        try {
          // Create a lightweight version without base64 images
          const lightState = {
            selectedEditMode: updated.selectedEditMode,
            maskSize: updated.maskSize,
            originalWidth: updated.originalWidth,
            originalHeight: updated.originalHeight,
            // Don't save base64 images - they're too large for localStorage
            // imageToEdit: null,
            // maskImage: null,
            // maskPreview: null,
            // outpaintedImage: null,
            // originalImage: null,
          }
          localStorage.setItem(EDIT_FORM_STATE_KEY, JSON.stringify(lightState))
        } catch (error) {
          // Handle QuotaExceededError gracefully
          if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, skipping state persistence')
            // Try to clear old data and retry with minimal state
            try {
              localStorage.removeItem(EDIT_FORM_STATE_KEY)
            } catch (clearError) {
              console.error('Failed to clear localStorage:', clearError)
            }
          } else {
            console.error('Error saving to localStorage:', error)
          }
        }
      }

      return updated
    })
  }, [setAppContext])

  // Clear state
  const clearState = useCallback(() => {
    const emptyState: EditFormState = {
      imageToEdit: null,
      maskImage: null,
      maskPreview: null,
      outpaintedImage: null,
      selectedEditMode: null,
      maskSize: { width: 0, height: 0 },
      originalImage: null,
      originalWidth: null,
      originalHeight: null,
    }
    setState(emptyState)

    // Clear from context
    setAppContext((prevContext) => {
      if (!prevContext) return prevContext
      return {
        ...prevContext,
        editPageState: {
          editedImagesInGCS: prevContext.editPageState?.editedImagesInGCS || [],
          editedCount: prevContext.editPageState?.editedCount || 0,
          isUpscaledDLAvailable: prevContext.editPageState?.isUpscaledDLAvailable ?? true,
          ...prevContext.editPageState,
          ...emptyState,
        },
      }
    })

    // Clear from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(EDIT_FORM_STATE_KEY)
    }
  }, [setAppContext])

  return {
    state,
    saveState,
    clearState,
  }
}

