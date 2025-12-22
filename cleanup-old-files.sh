#!/bin/bash

# Script to clean up old files in GCS bucket, keeping only the latest 15 files

# Set your bucket name (replace with your actual bucket name)
BUCKET_NAME="poc-55-genai-imgstudio-output"

# Get your user ID folder (usually in format: local-dev-user or your email)
# You may need to adjust this based on your actual folder structure
USER_FOLDER="local-dev-user"

echo "🔍 Listing all files in gs://${BUCKET_NAME}/${USER_FOLDER}..."

# List all files with their creation time, sorted by newest first
gcloud storage ls -l -r \
  "gs://${BUCKET_NAME}/${USER_FOLDER}/generated-videos/**" \
  "gs://${BUCKET_NAME}/${USER_FOLDER}/generated-images/**" \
  2>/dev/null | \
  grep -E "gs://" | \
  awk '{
    # Extract timestamp and filename
    if ($2 ~ /T/) {
      # Format: size  timestamp  gs://...
      print $2, $3
    }
  }' | \
  sort -r | \
  awk '{print $2}' > /tmp/all_files.txt

TOTAL_FILES=$(wc -l < /tmp/all_files.txt | tr -d ' ')

echo "📊 Total files found: $TOTAL_FILES"

if [ "$TOTAL_FILES" -eq 0 ]; then
  echo "ℹ️  No files found in this folder"
  rm -f /tmp/all_files.txt
  exit 0
fi

if [ "$TOTAL_FILES" -le 15 ]; then
  echo "✅ You have $TOTAL_FILES files, which is <= 15. No cleanup needed!"
  rm -f /tmp/all_files.txt
  exit 0
fi

# Get files to delete (everything after the first 15)
tail -n +16 /tmp/all_files.txt > /tmp/files_to_delete.txt

FILES_TO_DELETE=$(wc -l < /tmp/files_to_delete.txt | tr -d ' ')

echo "🗑️  Files to delete: $FILES_TO_DELETE"
echo ""
echo "📋 Files to keep (newest 15):"
head -n 15 /tmp/all_files.txt | nl -w2 -s'. '
echo ""
echo "🗑️  Files to DELETE:"
cat /tmp/files_to_delete.txt | nl -w2 -s'. '
echo ""
echo "⚠️  WARNING: This will delete $FILES_TO_DELETE files!"
echo ""
read -p "Do you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Cancelled."
  rm -f /tmp/all_files.txt /tmp/files_to_delete.txt
  exit 0
fi

echo "🗑️  Deleting old files..."

# Delete files
DELETED=0
while IFS= read -r file; do
  echo "Deleting: $file"
  if gcloud storage rm "$file" 2>/dev/null; then
    ((DELETED++))
  fi
done < /tmp/files_to_delete.txt

echo ""
echo "✅ Cleanup complete!"
echo "📊 Kept: 15 files"
echo "🗑️  Deleted: $DELETED files"

# Cleanup temp files
rm -f /tmp/all_files.txt /tmp/files_to_delete.txt
