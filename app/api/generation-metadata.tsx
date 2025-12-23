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

import { promises as fs } from 'fs'
import path from 'path'

// Interface for generation metadata
export interface GenerationMetadata {
  id: string
  timestamp: string
  type: 'image' | 'video'
  model: string
  prompt: string
  negativePrompt?: string
  parameters: Record<string, any>
  outputs: {
    url: string
    gcsUri: string
    format: string
    width?: number
    height?: number
    duration?: number
  }[]
  performance: {
    tokensUsed?: number
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    executionTimeMs?: number
    startTime?: string
    endTime?: string
  }
  cost?: {
    estimatedCost?: number
    currency?: string
  }
}

// Get the history directory path
function getHistoryDir() {
  // Use user's home directory for local storage
  const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp'
  return path.join(homeDir, '.imgstudio', 'history')
}

// Ensure history directory exists
async function ensureHistoryDir() {
  const historyDir = getHistoryDir()
  try {
    await fs.mkdir(historyDir, { recursive: true })
    return historyDir
  } catch (error) {
    console.error('Failed to create history directory:', error)
    throw error
  }
}

// Save generation metadata to local file system
export async function saveGenerationMetadata(metadata: GenerationMetadata): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const historyDir = await ensureHistoryDir()
    
    // Create a folder for this generation session
    const sessionDir = path.join(historyDir, metadata.id)
    await fs.mkdir(sessionDir, { recursive: true })
    
    // Save metadata JSON
    const metadataPath = path.join(sessionDir, 'metadata.json')
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
    
    return { success: true, path: sessionDir }
  } catch (error) {
    console.error('Failed to save generation metadata:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Save media file (image or video) to local file system
export async function saveMediaToLocal(
  sessionId: string,
  base64Data: string,
  filename: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const historyDir = await ensureHistoryDir()
    const sessionDir = path.join(historyDir, sessionId)
    await fs.mkdir(sessionDir, { recursive: true })
    
    const mediaPath = path.join(sessionDir, filename)
    
    // Remove data URL prefix if present
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
    const buffer = Buffer.from(base64Content, 'base64')
    
    await fs.writeFile(mediaPath, buffer as any)
    
    return { success: true, path: mediaPath }
  } catch (error) {
    console.error('Failed to save media file:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Load all generation history (limited to most recent 30)
export async function loadGenerationHistory(): Promise<{ success: boolean; data?: GenerationMetadata[]; error?: string }> {
  try {
    const historyDir = getHistoryDir()
    
    // Check if directory exists
    try {
      await fs.access(historyDir)
    } catch {
      // Directory doesn't exist yet
      return { success: true, data: [] }
    }
    
    const sessions = await fs.readdir(historyDir)
    
    // Get session folder stats to sort by modification time
    const sessionStats: Array<{ sessionId: string; mtime: Date }> = []
    
    for (const sessionId of sessions) {
      try {
        const sessionPath = path.join(historyDir, sessionId)
        const stats = await fs.stat(sessionPath)
        sessionStats.push({ sessionId, mtime: stats.mtime })
      } catch (error) {
        console.warn(`Failed to stat session ${sessionId}:`, error)
      }
    }
    
    // Sort by modification time (newest first) and take only the first 30
    sessionStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    const recentSessions = sessionStats.slice(0, 30)
    
    const metadataList: GenerationMetadata[] = []
    
    // Only read metadata for the 30 most recent sessions
    for (const { sessionId } of recentSessions) {
      const metadataPath = path.join(historyDir, sessionId, 'metadata.json')
      try {
        const content = await fs.readFile(metadataPath, 'utf-8')
        const metadata = JSON.parse(content) as GenerationMetadata
        metadataList.push(metadata)
      } catch (error) {
        console.warn(`Failed to load metadata for session ${sessionId}:`, error)
      }
    }
    
    // Sort by timestamp (newest first)
    metadataList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    console.log(`📋 Loaded ${metadataList.length} most recent records (out of ${sessions.length} total sessions)`)
    
    return { success: true, data: metadataList }
  } catch (error) {
    console.error('Failed to load generation history:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Load media file from local storage
export async function loadMediaFromLocal(
  sessionId: string,
  filename: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const historyDir = getHistoryDir()
    const mediaPath = path.join(historyDir, sessionId, filename)
    
    const buffer = await fs.readFile(mediaPath)
    const base64Data = buffer.toString('base64')
    
    // Determine MIME type from filename
    const ext = path.extname(filename).toLowerCase()
    let mimeType = 'application/octet-stream'
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
    else if (ext === '.png') mimeType = 'image/png'
    else if (ext === '.webp') mimeType = 'image/webp'
    else if (ext === '.mp4') mimeType = 'video/mp4'
    
    const dataUrl = `data:${mimeType};base64,${base64Data}`
    
    return { success: true, data: dataUrl }
  } catch (error) {
    console.error('Failed to load media file:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Delete a generation session
export async function deleteGenerationSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const historyDir = getHistoryDir()
    const sessionDir = path.join(historyDir, sessionId)
    
    await fs.rm(sessionDir, { recursive: true, force: true })
    
    return { success: true }
  } catch (error) {
    console.error('Failed to delete generation session:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Clear all generation history
export async function clearAllHistory(): Promise<{ success: boolean; error?: string }> {
  try {
    const historyDir = getHistoryDir()
    
    // Check if directory exists
    try {
      await fs.access(historyDir)
    } catch {
      // Directory doesn't exist, nothing to clear
      return { success: true }
    }
    
    // Remove the entire history directory
    await fs.rm(historyDir, { recursive: true, force: true })
    
    // Recreate the directory
    await fs.mkdir(historyDir, { recursive: true })
    
    return { success: true }
  } catch (error) {
    console.error('Failed to clear all history:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
