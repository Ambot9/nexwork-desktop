#!/bin/bash

# Nexwork macOS - Fix "Damaged App" Error
# This script removes the quarantine attribute from Nexwork.app

echo "🔧 Nexwork macOS Fix Script"
echo "============================"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is for macOS only"
    exit 1
fi

# Default app path
APP_PATH="/Applications/Nexwork.app"

# Check if app exists in Applications
if [ ! -d "$APP_PATH" ]; then
    echo "⚠️  Nexwork.app not found in /Applications"
    echo ""
    read -p "Enter the full path to Nexwork.app: " APP_PATH
    
    if [ ! -d "$APP_PATH" ]; then
        echo "❌ App not found at: $APP_PATH"
        exit 1
    fi
fi

echo "📍 Found Nexwork at: $APP_PATH"
echo ""

# Remove quarantine attribute
echo "🧹 Removing quarantine attribute..."
xattr -cr "$APP_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Success! Nexwork should now open without the 'damaged' warning."
    echo ""
    echo "You can now open Nexwork from your Applications folder."
else
    echo "❌ Failed to remove quarantine attribute."
    echo ""
    echo "Try running with sudo:"
    echo "  sudo bash fix-macos.sh"
fi

echo ""
echo "Need more help? Visit: https://github.com/Ambot9/nexwork-desktop"
