# Download Nexwork Desktop

## 🎯 Quick Download

### macOS
**Recommended:** [Download Nexwork for macOS (DMG)](https://github.com/your-username/nexwork-desktop/releases/latest/download/Nexwork_1.0.0_macOS.dmg)

- **Requirements:** macOS 10.15 (Catalina) or later
- **Size:** ~150 MB
- **Supports:** Intel Macs & Apple Silicon (M1/M2)

### Windows
**Recommended:** [Download Nexwork for Windows (Installer)](https://github.com/your-username/nexwork-desktop/releases/latest/download/Nexwork_1.0.0_Windows.exe)

- **Requirements:** Windows 10 or later (64-bit)
- **Size:** ~120 MB

### Linux
**Recommended:** [Download Nexwork for Linux (AppImage)](https://github.com/your-username/nexwork-desktop/releases/latest/download/Nexwork_1.0.0_Linux.AppImage)

- **Requirements:** Any modern Linux distribution
- **Size:** ~130 MB

---

## 📥 Installation Instructions

### macOS Installation

1. **Download** the DMG file
2. **Open** the downloaded DMG
3. **Drag** Nexwork icon to Applications folder
4. **Eject** the DMG
5. **Open** Nexwork from Applications

**First time opening:**
- Right-click Nexwork → Open (to bypass Gatekeeper)
- Or: System Preferences → Security & Privacy → Click "Open Anyway"

### Windows Installation

1. **Download** the installer (.exe)
2. **Run** the installer
3. **Follow** the installation wizard
4. **Choose** installation location (or use default)
5. **Launch** Nexwork from Start Menu or Desktop

**Windows SmartScreen warning:**
- Click "More info" → "Run anyway"

### Linux Installation (AppImage)

1. **Download** the AppImage
2. **Make it executable:**
   ```bash
   chmod +x Nexwork_1.0.0_Linux.AppImage
   ```
3. **Run** it:
   ```bash
   ./Nexwork_1.0.0_Linux.AppImage
   ```

**Or install with DEB (Debian/Ubuntu):**
```bash
sudo dpkg -i Nexwork_1.0.0_Linux.deb
```

---

## 🔄 Updates

Nexwork includes automatic update notifications:
- App checks for updates on startup
- You'll be notified when new version is available
- One-click update installation

---

## 🖥️ System Requirements

### Minimum Requirements
- **RAM:** 4 GB
- **Storage:** 300 MB free space
- **Git:** Git must be installed
- **Internet:** For git operations

### Recommended Requirements
- **RAM:** 8 GB or more
- **Storage:** 1 GB free space
- **SSD:** For better performance

---

## ❓ Troubleshooting

### macOS: "App is damaged and can't be opened"
```bash
xattr -cr /Applications/Nexwork.app
```

### Windows: "Windows protected your PC"
- Click "More info"
- Click "Run anyway"

### Linux: AppImage won't run
```bash
chmod +x Nexwork*.AppImage
sudo apt install libfuse2  # If needed
```

### Git not found
**macOS:**
```bash
xcode-select --install
```

**Windows:**
- Download from [git-scm.com](https://git-scm.com)

**Linux:**
```bash
sudo apt install git  # Debian/Ubuntu
sudo dnf install git  # Fedora
```

---

## 📚 Next Steps After Installation

1. **Launch Nexwork**
2. **Select workspace** - Choose folder containing your git repositories
3. **Create your first feature** - Click "Create Feature" button
4. **Explore settings** - Configure themes, notifications, etc.

---

## 🆘 Need Help?

- **Documentation:** [View docs](https://github.com/your-username/nexwork-desktop/wiki)
- **Issues:** [Report a bug](https://github.com/your-username/nexwork-desktop/issues)
- **Discussions:** [Ask questions](https://github.com/your-username/nexwork-desktop/discussions)

---

## 🔒 Security

Nexwork Desktop is safe and secure:
- ✅ No telemetry or tracking
- ✅ All data stays on your computer
- ✅ Open source - you can review the code
- ✅ Regular security updates

Read our [Security Guide](SECURITY.md) for more information.

---

## 📜 License

Nexwork Desktop is open source software licensed under the MIT License.

---

**Enjoy using Nexwork!** 🚀
