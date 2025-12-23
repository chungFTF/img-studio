#!/usr/bin/env node

/**
 * Google Drive Configuration Checker
 * Run this script to verify your Google Drive integration setup
 * Usage: node check-gdrive-config.js
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 Checking Google Drive Configuration...\n')

// Check for .env.local file
const envPath = path.join(__dirname, '.env.local')
const envExists = fs.existsSync(envPath)

if (!envExists) {
  console.log('❌ .env.local file not found')
  console.log('   Create a .env.local file in the project root with:')
  console.log('   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com\n')
  process.exit(1)
}

console.log('✅ .env.local file found')

// Read and parse .env.local
const envContent = fs.readFileSync(envPath, 'utf-8')
const lines = envContent.split('\n')
let clientId = null

for (const line of lines) {
  const trimmed = line.trim()
  if (trimmed.startsWith('NEXT_PUBLIC_GOOGLE_CLIENT_ID=')) {
    clientId = trimmed.split('=')[1]?.trim()
    break
  }
}

if (!clientId) {
  console.log('❌ NEXT_PUBLIC_GOOGLE_CLIENT_ID not found in .env.local')
  console.log('   Add this line to your .env.local:')
  console.log('   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com\n')
  process.exit(1)
}

console.log('✅ NEXT_PUBLIC_GOOGLE_CLIENT_ID is set')

// Validate Client ID format
const clientIdRegex = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/
if (!clientIdRegex.test(clientId)) {
  console.log('⚠️  Client ID format looks incorrect')
  console.log(`   Current value: ${clientId}`)
  console.log('   Expected format: 1234567890-abcdefg.apps.googleusercontent.com\n')
} else {
  console.log('✅ Client ID format is valid')
}

// Check if Google Drive context exists
const contextPath = path.join(__dirname, 'app/context/google-drive-context.tsx')
if (!fs.existsSync(contextPath)) {
  console.log('❌ Google Drive context file not found')
  console.log('   Expected: app/context/google-drive-context.tsx\n')
  process.exit(1)
}

console.log('✅ Google Drive context file exists')

// Check if GoogleDriveSaveDialog exists
const dialogPath = path.join(__dirname, 'app/ui/transverse-components/GoogleDriveSaveDialog.tsx')
if (!fs.existsSync(dialogPath)) {
  console.log('❌ GoogleDriveSaveDialog component not found')
  console.log('   Expected: app/ui/transverse-components/GoogleDriveSaveDialog.tsx\n')
  process.exit(1)
}

console.log('✅ GoogleDriveSaveDialog component exists')

// Check if Drive API actions exist
const apiPath = path.join(__dirname, 'app/api/google-drive/action.tsx')
if (!fs.existsSync(apiPath)) {
  console.log('❌ Google Drive API actions not found')
  console.log('   Expected: app/api/google-drive/action.tsx\n')
  process.exit(1)
}

console.log('✅ Google Drive API actions exist')

console.log('\n🎉 Configuration check passed!\n')
console.log('Next steps:')
console.log('1. Make sure you have enabled Google Drive API in Google Cloud Console')
console.log('2. Configure OAuth 2.0 Client ID with correct origins and redirect URIs')
console.log('3. Restart your dev server: npm run dev')
console.log('4. Test the connection by clicking "Connect Google Drive" in the app\n')
console.log('For detailed setup instructions, see: GOOGLE_DRIVE_SETUP.md\n')
