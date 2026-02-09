#!/bin/bash

# Nexwork Desktop - Release Preparation Script
# This script prepares the app for distribution

set -e

echo "🚀 Nexwork Desktop - Release Preparation"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if logo exists
echo -e "${BLUE}📦 Checking assets...${NC}"
if [ ! -f "public/Nexwork Background Removed.png" ]; then
    echo -e "${RED}❌ Error: Logo not found at 'public/Nexwork Background Removed.png'${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Logo found${NC}"

# Create build directory if it doesn't exist
mkdir -p build

# Copy icon to build folder
echo -e "${BLUE}🎨 Preparing icon...${NC}"
cp "public/Nexwork Background Removed.png" build/icon.png
echo -e "${GREEN}✅ Icon prepared${NC}"

# Check Node.js version
echo -e "${BLUE}🔍 Checking Node.js version...${NC}"
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js version: $NODE_VERSION${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📥 Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# Run security audit
echo -e "${BLUE}🔒 Running security audit...${NC}"
npm audit --audit-level=moderate || {
    echo -e "${YELLOW}⚠️  Security vulnerabilities found. Run 'npm audit fix' to fix them.${NC}"
}

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo ""
echo -e "${GREEN}📌 Current version: $VERSION${NC}"
echo ""

# Ask which platform to build for
echo "Which platform do you want to build for?"
echo "1) macOS (DMG + ZIP)"
echo "2) Windows (Installer + Portable)"
echo "3) Linux (AppImage + DEB)"
echo "4) All platforms"
echo "5) Skip build (preparation only)"
read -p "Enter choice (1-5): " CHOICE

case $CHOICE in
    1)
        echo -e "${BLUE}🍎 Building for macOS...${NC}"
        npm run build:mac
        ;;
    2)
        echo -e "${BLUE}🪟 Building for Windows...${NC}"
        npm run build:win
        ;;
    3)
        echo -e "${BLUE}🐧 Building for Linux...${NC}"
        npm run build:linux
        ;;
    4)
        echo -e "${BLUE}🌐 Building for all platforms...${NC}"
        npm run build:all
        ;;
    5)
        echo -e "${YELLOW}⏭️  Skipping build${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

# Show build output location
if [ $CHOICE -ne 5 ]; then
    echo ""
    echo -e "${GREEN}✅ Build complete!${NC}"
    echo ""
    echo -e "${BLUE}📦 Installers created in:${NC}"
    echo "   release/$VERSION/"
    echo ""
    ls -lh "release/$VERSION/" 2>/dev/null || echo "Build folder not found"
    echo ""
    echo -e "${GREEN}🎉 Ready for distribution!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Test the installer on a clean machine"
    echo "2. Upload to GitHub Releases"
    echo "3. Update download page"
    echo "4. Announce the release!"
fi

echo ""
echo -e "${GREEN}Done! ✨${NC}"
