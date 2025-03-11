#!/bin/bash
# pre-deploy.sh

CHANNELS_DIR="./channels"
DISK_DIR="/data/channels"

echo "Attempting to save channels before deploy..."
if [ -d "$CHANNELS_DIR" ]; then
  mkdir -p "$DISK_DIR"
  cp -r "$CHANNELS_DIR"/* "$DISK_DIR"
  echo "Channels saved to disk (if accessible)."
else
  echo "Channels directory not found in pre-deploy context."
fi