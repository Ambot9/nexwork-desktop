# Build & Distribution Guide for Nexwork Desktop

## 📦 Building for Distribution

### Prerequisites

1. **Node.js & npm** installed
2. **All dependencies** installed: `npm install`
3. **Logo file** in place: `public/Nexwork Background Removed.png`

### Quick Build Commands

```bash
# Build for macOS (creates DMG and ZIP)
npm run build:mac

# Build for Windows (creates installer and portable)
npm run build:win

# Build for Linux (creates AppImage and DEB)
npm run build:linux

# Build for all platforms (requires all SDKs)
npm run build:all
```

---

## 🍎 macOS Distribution

### Build Files Created

After running `npm run build:mac`, you'll find in `release/1.0.0/`:

```
Nexwork_1.0.0_macOS.dmg           # Installer (recommended)
Nexwork_1.0.0_macOS-x64.zip       # Portable (Intel Macs)
Nexwork_1.0.0_macOS-arm64.zip     # Portable (Apple Silicon)
```

### Installation Methods

**Method 1: DMG Installer (Recommended)**
1. Download `Nexwork_1.0.0_macOS.dmg`
2. Double-click to mount
3. Drag Nexwork to Applications folder
4. Eject DMG
5. Open Nexwork from Applications

**Method 2: ZIP (Portable)**
1. Download the ZIP file for your Mac type:
   - Intel Mac: `Nexwork_1.0.0_macOS-x64.zip`
   - Apple Silicon (M1/M2): `Nexwork_1.0.0_macOS-arm64.zip`
2. Extract the ZIP
3. Move `Nexwork.app` to Applications
4. Open Nexwork

### Code Signing (Optional but Recommended)

For distribution outside the Mac App Store:

```bash
# Sign the app
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" release/1.0.0/mac/Nexwork.app

# Notarize with Apple (required for macOS 10.15+)
xcrun notarytool submit release/1.0.0/Nexwork_1.0.0_macOS.dmg --apple-id your@email.com --team-id TEAMID --wait
```

---

## 🪟 Windows Distribution

### Build Files Created

After running `npm run build:win`, you'll find:

```
Nexwork_1.0.0_Windows.exe         # Installer (recommended)
Nexwork_1.0.0_Windows.exe.blockmap
Nexwork_1.0.0_Windows_portable.exe # Portable version
```

### Installation Methods

**Method 1: Installer (Recommended)**
1. Download `Nexwork_1.0.0_Windows.exe`
2. Double-click to run
3. Follow installation wizard
4. Choose installation location
5. Launch Nexwork

**Method 2: Portable**
1. Download `Nexwork_1.0.0_Windows_portable.exe`
2. Run directly (no installation needed)
3. Can be run from USB drive

### Code Signing (Optional)

```bash
# Sign with your certificate
signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com /td sha256 /fd sha256 Nexwork_1.0.0_Windows.exe
```

---

## 🐧 Linux Distribution

### Build Files Created

After running `npm run build:linux`:

```
Nexwork_1.0.0_Linux.AppImage      # Universal (recommended)
Nexwork_1.0.0_Linux.deb           # Debian/Ubuntu
```

### Installation Methods

**Method 1: AppImage (Universal - Recommended)**
1. Download `Nexwork_1.0.0_Linux.AppImage`
2. Make executable: `chmod +x Nexwork_1.0.0_Linux.AppImage`
3. Run: `./Nexwork_1.0.0_Linux.AppImage`

**Method 2: DEB Package (Debian/Ubuntu)**
1. Download `Nexwork_1.0.0_Linux.deb`
2. Install: `sudo dpkg -i Nexwork_1.0.0_Linux.deb`
3. Or double-click in file manager
4. Run from applications menu

---

## 🌐 Distribution Options

### Option 1: GitHub Releases (Free)

**Steps:**
1. Create a GitHub repository
2. Build the app: `npm run build:all`
3. Go to GitHub → Releases → Create new release
4. Tag version: `v1.0.0`
5. Upload files from `release/1.0.0/`:
   - `Nexwork_1.0.0_macOS.dmg`
   - `Nexwork_1.0.0_Windows.exe`
   - `Nexwork_1.0.0_Linux.AppImage`
6. Publish release

**Users can then:**
- Go to your GitHub releases page
- Download the installer for their platform
- Install and use

**Auto-Update Setup:**
```json
// In package.json, already configured:
"publish": {
  "provider": "github",
  "owner": "your-github-username",
  "repo": "nexwork-desktop"
}
```

### Option 2: Your Own Website

**Steps:**
1. Build: `npm run build:all`
2. Upload files to your web server
3. Create download page with links:

```html
<a href="downloads/Nexwork_1.0.0_macOS.dmg">Download for macOS</a>
<a href="downloads/Nexwork_1.0.0_Windows.exe">Download for Windows</a>
<a href="downloads/Nexwork_1.0.0_Linux.AppImage">Download for Linux</a>
```

### Option 3: App Stores (Advanced)

**Mac App Store:**
- Requires Apple Developer Account ($99/year)
- Additional configuration needed
- Review process (1-2 weeks)

**Microsoft Store:**
- Requires Microsoft Developer Account ($19 one-time)
- Additional configuration needed
- Review process (1-2 days)

**Snap Store (Linux):**
- Free
- Additional configuration needed

---

## 📝 Creating a Download Page

Here's a simple HTML template:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Download Nexwork</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    .download-btn { display: inline-block; padding: 15px 30px; margin: 10px; background: #1890ff; color: white; text-decoration: none; border-radius: 5px; }
    .download-btn:hover { background: #096dd9; }
  </style>
</head>
<body>
  <h1>Download Nexwork</h1>
  <p>Multi-repository feature management made easy.</p>
  
  <h2>Latest Version: 1.0.0</h2>
  
  <div>
    <a href="release/1.0.0/Nexwork_1.0.0_macOS.dmg" class="download-btn">
      🍎 Download for macOS
    </a>
    <small>macOS 10.15 or later (Intel & Apple Silicon)</small>
  </div>
  
  <div>
    <a href="release/1.0.0/Nexwork_1.0.0_Windows.exe" class="download-btn">
      🪟 Download for Windows
    </a>
    <small>Windows 10 or later (64-bit)</small>
  </div>
  
  <div>
    <a href="release/1.0.0/Nexwork_1.0.0_Linux.AppImage" class="download-btn">
      🐧 Download for Linux
    </a>
    <small>Universal AppImage (all distributions)</small>
  </div>
  
  <h3>System Requirements</h3>
  <ul>
    <li>macOS 10.15+ / Windows 10+ / Linux (any modern distro)</li>
    <li>4GB RAM minimum</li>
    <li>Git installed</li>
  </ul>
</body>
</html>
```

---

## 🔄 Auto-Updates

Nexwork supports automatic updates via `electron-updater`.

### Setup Auto-Update Server

**Using GitHub Releases (Easiest):**
1. Already configured in `package.json`
2. App will check GitHub releases for updates
3. Users get notified when updates available
4. One-click update installation

**Code Already Included:**
The app checks for updates on startup (in `electron/main/index.ts`).

---

## 📊 File Sizes (Approximate)

| Platform | Installer Size | Installed Size |
|----------|---------------|----------------|
| macOS DMG | ~150 MB | ~250 MB |
| Windows Installer | ~120 MB | ~200 MB |
| Linux AppImage | ~130 MB | ~220 MB |

---

## 🐛 Troubleshooting Builds

### "Cannot find module 'electron-builder'"
```bash
npm install -D electron-builder
```

### "Icon file not found"
Make sure `build/icon.png` exists:
```bash
cp "public/Nexwork Background Removed.png" build/icon.png
```

### "Rebuild native modules error"
```bash
npm run postinstall
```

### Build fails on Windows
Need to install Windows Build Tools:
```bash
npm install --global windows-build-tools
```

---

## ✅ Pre-Release Checklist

Before distributing:

- [ ] Test on actual macOS/Windows/Linux machines
- [ ] Verify app launches correctly
- [ ] Check all features work
- [ ] Test with different workspace paths
- [ ] Verify auto-update mechanism
- [ ] Test installation process
- [ ] Check app icon appears correctly
- [ ] Verify menu bar name is "Nexwork"
- [ ] Test uninstallation
- [ ] Review SECURITY.md is included
- [ ] Update version in package.json
- [ ] Create release notes

---

## 📱 First Build - Quick Start

```bash
# 1. Ensure logo is in place
ls "public/Nexwork Background Removed.png"

# 2. Copy to build folder
mkdir -p build
cp "public/Nexwork Background Removed.png" build/icon.png

# 3. Build for your platform
npm run build:mac     # On macOS
# OR
npm run build:win     # On Windows
# OR
npm run build:linux   # On Linux

# 4. Find installers in:
ls release/1.0.0/
```

---

## 🚀 Distribution Timeline

1. **Week 1:** Build and test locally
2. **Week 2:** Beta test with trusted users
3. **Week 3:** Fix bugs, gather feedback
4. **Week 4:** Public release on GitHub
5. **Ongoing:** Respond to issues, release updates

---

## 📞 Support

For build issues:
- Check this guide
- Review error messages
- Check Electron Builder docs: https://www.electron.build
- Open GitHub issue

Good luck with your release! 🎉
