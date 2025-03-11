#!/bin/bash
# start.sh

CHANNELS_DIR="./channels"
DISK_DIR="/data/channels"

# Restore channels from disk if it exists
if [ -d "$DISK_DIR" ]; then
  echo "Restoring channels from persistent disk..."
  rm -rf "$CHANNELS_DIR"
  cp -r "$DISK_DIR" "$CHANNELS_DIR"
  echo "Channels restored."
else
  echo "No saved channels found on disk, using Git version."
fi

# Start the app (replace with your actual start command)
npm start