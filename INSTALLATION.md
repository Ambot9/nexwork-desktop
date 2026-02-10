# Nexwork Desktop - Installation Guide

## macOS Installation

### Step 1: Download
Download the latest release from [GitHub Releases](https://github.com/Ambot9/nexwork-desktop/releases/latest)

Choose either:
- `Nexwork_X.X.X_macOS.dmg` - Disk image installer (recommended)
- `Nexwork_X.X.X_macOS.zip` - Zip archive

### Step 2: Install
1. Open the `.dmg` file
2. Drag **Nexwork** to the **Applications** folder
3. Eject the DMG

### Step 3: First Launch

When you first open Nexwork, macOS may show this warning:

> **"Nexwork" is damaged and can't be opened. You should move it to the Trash.**

**This is normal!** The app is not damaged - macOS shows this because the app is not code-signed with an Apple Developer certificate.

### Fix the "Damaged" Warning

Choose one of these methods:

#### Method 1: Terminal Command (Recommended)
1. Open **Terminal** (Applications → Utilities → Terminal)
2. Run this command:
   ```bash
   xattr -cr /Applications/Nexwork.app
   ```
3. Close Terminal
4. Open Nexwork from Applications - it will work now! ✅

#### Method 2: Right-Click Method
1. Go to **Applications** folder
2. **Right-click** (or Control+click) on **Nexwork.app**
3. Select **"Open"** from the menu
4. Click **"Open"** in the security dialog
5. The app will launch ✅

#### Method 3: System Settings
1. Try to open Nexwork (you'll get the warning)
2. Go to **System Settings** → **Privacy & Security**
3. Scroll down to **Security** section
4. Click **"Open Anyway"** next to the Nexwork warning
5. Confirm when prompted ✅

### Why Does This Happen?

Nexwork is currently an **unsigned application**. To avoid this warning entirely, the app would need to be:
- Code signed with an Apple Developer certificate ($99/year)
- Notarized by Apple (sent to Apple for security scanning)

We're working on implementing this for future releases. For now, the `xattr` command is safe and only needs to be run once.

---

## Windows Installation

### Step 1: Download
Download `Nexwork_X.X.X_Windows.exe` from [GitHub Releases](https://github.com/Ambot9/nexwork-desktop/releases/latest)

### Step 2: Install
1. Run the `.exe` installer
2. Choose installation directory (default: `C:\Program Files\Nexwork`)
3. Select options:
   - ✅ Create desktop shortcut
   - ✅ Add to Start Menu
4. Click **Install**

### Step 3: Launch
- Double-click desktop shortcut, or
- Find in Start Menu → Nexwork

### Windows Defender Warning

You may see: **"Windows protected your PC"**

This is normal for unsigned applications. Click:
1. **"More info"**
2. **"Run anyway"**

---

## Linux Installation

### Step 1: Download
Download `Nexwork_X.X.X_Linux.AppImage` from [GitHub Releases](https://github.com/Ambot9/nexwork-desktop/releases/latest)

### Step 2: Make Executable
```bash
chmod +x Nexwork_*.AppImage
```

### Step 3: Run
```bash
./Nexwork_*.AppImage
```

### Optional: Desktop Integration
To add Nexwork to your application menu:

```bash
# Extract the AppImage
./Nexwork_*.AppImage --appimage-extract

# Move to /opt
sudo mv squashfs-root /opt/nexwork

# Create desktop entry
cat > ~/.local/share/applications/nexwork.desktop <<EOF
[Desktop Entry]
Name=Nexwork
Exec=/opt/nexwork/nexwork
Icon=/opt/nexwork/nexwork.png
Type=Application
Categories=Development;
EOF
```

---

## Troubleshooting

### macOS: "App is damaged" persists
- Make sure you ran `xattr -cr` on the correct path: `/Applications/Nexwork.app`
- Try running with `sudo`: `sudo xattr -cr /Applications/Nexwork.app`
- Restart your Mac

### Windows: Installer won't run
- Right-click → "Run as administrator"
- Temporarily disable antivirus
- Check Windows Defender exclusions

### Linux: AppImage won't execute
- Ensure FUSE is installed: `sudo apt install fuse libfuse2` (Ubuntu/Debian)
- Try running with `--no-sandbox` flag

### App crashes on launch
1. Check system requirements:
   - macOS 10.13+ (High Sierra or later)
   - Windows 10+ (64-bit)
   - Linux with GTK 3.0+
2. Try deleting app data:
   - macOS: `~/Library/Application Support/Nexwork`
   - Windows: `%APPDATA%\Nexwork`
   - Linux: `~/.config/Nexwork`

### Still having issues?
Open an issue on [GitHub Issues](https://github.com/Ambot9/nexwork-desktop/issues) with:
- Your operating system and version
- Error messages or screenshots
- Steps to reproduce

---

## Verifying the Download

### Checksums
Each release includes SHA256 checksums. To verify:

```bash
# macOS/Linux
shasum -a 256 Nexwork_*.dmg

# Compare with checksums.txt from release
```

### File Sizes (Approximate)
- macOS DMG: ~100 MB
- macOS ZIP: ~95 MB
- Windows EXE: ~85 MB
- Linux AppImage: ~90 MB

---

## Next Steps

Once installed:
1. **Read the Quick Start Guide**: Help → Quick Start (in app)
2. **Watch Tutorial Video**: [YouTube](https://youtube.com) *(coming soon)*
3. **Check Documentation**: [nexwork.dev/docs](https://nexwork.dev/docs) *(coming soon)*
4. **Join Community**: [Discord](https://discord.gg) *(coming soon)*

---

## Uninstalling

### macOS
1. Quit Nexwork
2. Move `/Applications/Nexwork.app` to Trash
3. Remove app data (optional):
   ```bash
   rm -rf ~/Library/Application\ Support/Nexwork
   rm -rf ~/Library/Preferences/com.nexwork.desktop.plist
   rm -rf ~/Library/Logs/Nexwork
   ```

### Windows
1. Settings → Apps → Nexwork → Uninstall
2. Or run `C:\Program Files\Nexwork\Uninstall.exe`
3. Remove app data (optional):
   - Delete `%APPDATA%\Nexwork`

### Linux
1. Delete the AppImage file
2. Remove desktop integration (if added):
   ```bash
   rm ~/.local/share/applications/nexwork.desktop
   sudo rm -rf /opt/nexwork
   ```
3. Remove app data (optional):
   ```bash
   rm -rf ~/.config/Nexwork
   ```

---

**Need help?** [Open an issue](https://github.com/Ambot9/nexwork-desktop/issues) or email support@nexwork.dev *(coming soon)*
