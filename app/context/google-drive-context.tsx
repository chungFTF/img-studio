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

import React, { createContext, useContext, useState, useEffect } from 'react'

interface GoogleDriveContextType {
  accessToken: string | null
  isConnected: boolean
  isLoading: boolean
  isReady: boolean
  error: string | null
  connectDrive: () => Promise<void>
  disconnectDrive: () => void
}

const GoogleDriveContext = createContext<GoogleDriveContextType>({
  accessToken: null,
  isConnected: false,
  isLoading: false,
  isReady: false,
  error: null,
  connectDrive: async () => {},
  disconnectDrive: () => {},
})

export const useGoogleDrive = () => useContext(GoogleDriveContext)

// Use full Drive scope to read existing folders and upload files
const SCOPES = 'https://www.googleapis.com/auth/drive'
const STORAGE_KEY = 'google_drive_token'
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

export function GoogleDriveProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenClient, setTokenClient] = useState<any>(null)

  useEffect(() => {
    // Load token from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const { token, expiry } = JSON.parse(stored)
          if (expiry > Date.now()) {
            setAccessToken(token)
          } else {
            localStorage.removeItem(STORAGE_KEY)
          }
        } catch (error) {
          console.error('Error parsing stored token:', error)
        }
      }
      setIsLoading(false)
    }

    // Load Google Identity Services
    const loadGIS = () => {
      if (typeof window === 'undefined') {
        setIsLoading(false)
        return
      }

      // Check if CLIENT_ID is set
      if (!CLIENT_ID) {
        console.warn('⚠️ NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google Drive integration disabled.')
        setError('Google Drive is not configured')
        setIsLoading(false)
        setIsReady(false)
        return
      }

      // Check if script is already loaded
      if (window.google?.accounts?.oauth2) {
        initializeClient()
        return
      }

      // Check if script tag already exists
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
      if (existingScript) {
        existingScript.addEventListener('load', initializeClient)
        return
      }

      // Load the script
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => {
        initializeClient()
      }
      script.onerror = () => {
        console.error('❌ Failed to load Google Identity Services')
        setError('Failed to load Google Drive services')
        setIsLoading(false)
        setIsReady(false)
      }
      document.body.appendChild(script)
    }

    const initializeClient = () => {
      try {
        if (window.google?.accounts?.oauth2) {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (response: any) => {
              if (response.error) {
                console.error('❌ OAuth error:', response.error)
                setError(response.error)
                return
              }
              
              if (response.access_token) {
                const expiry = Date.now() + (response.expires_in || 3600) * 1000
                setAccessToken(response.access_token)
                setError(null)
                localStorage.setItem(
                  STORAGE_KEY,
                  JSON.stringify({
                    token: response.access_token,
                    expiry,
                  })
                )
              }
            },
          })
          setTokenClient(client)
          setIsReady(true)
          setError(null)
        } else {
          throw new Error('Google Identity Services not available')
        }
      } catch (err: any) {
        console.error('❌ Error initializing Google client:', err)
        setError('Failed to initialize Google Drive')
        setIsReady(false)
      } finally {
        setIsLoading(false)
      }
    }

    loadGIS()
  }, [])

  const connectDrive = async () => {
    if (!CLIENT_ID) {
      setError('Google Drive is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID.')
      alert('Google Drive is not configured. Please contact the administrator.')
      return
    }

    if (!isReady || !tokenClient) {
      setError('Google Drive services are still loading. Please wait a moment and try again.')
      alert('Google Drive services are still loading. Please wait a moment and try again.')
      return
    }

    try {
      setError(null)
      tokenClient.requestAccessToken({
        prompt: 'consent',
        scope: SCOPES,
      })
    } catch (error: any) {
      console.error('Error connecting to Drive:', error)
      setError(error.message || 'Failed to connect')
      alert('Failed to connect to Google Drive: ' + error.message)
    }
  }

  const disconnectDrive = () => {
    setAccessToken(null)
    localStorage.removeItem(STORAGE_KEY)
    
    // Revoke token
    if (accessToken && window.google) {
      window.google.accounts.oauth2.revoke(accessToken, () => {})
    }
  }

  return (
    <GoogleDriveContext.Provider
      value={{
        accessToken,
        isConnected: !!accessToken,
        isLoading,
        isReady,
        error,
        connectDrive,
        disconnectDrive,
      }}
    >
      {children}
    </GoogleDriveContext.Provider>
  )
}

// Extend window interface for Google Identity Services
declare global {
  interface Window {
    google?: any
  }
}
