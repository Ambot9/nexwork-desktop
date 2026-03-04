# Nexwork Desktop

Beautiful desktop application for Nexwork - Multi-repository feature management made easy.

## 🚀 Features

- **Visual Dashboard**: See all your features at a glance with beautiful cards and progress bars
- **Feature Management**: Create, update, and complete features with intuitive dialogs
- **Template System**: Choose from built-in templates or create custom ones
- **Statistics**: Real-time git statistics, commit tracking, and progress monitoring
- **Workspace Health**: Scan repo sync status, dirty trees, and remote access issues
- **OAuth GitHub Login**: Device flow login without GitHub CLI requirements
- **System Tray**: Quick access to features from your system tray
- **Native Notifications**: Get notified when features are updated
- **Cross-Platform**: Works on macOS, Windows, and Linux

## 🛠️ Tech Stack

- **Electron 28**: Cross-platform desktop framework
- **React 18**: Modern UI framework
- **TypeScript**: Type-safe development
- **Ant Design**: Professional UI components
- **Vite**: Fast build tool with HMR
- **Zustand**: Lightweight state management

## 📦 Installation

### For Users (Download Release)

#### macOS Installation

1. **Download** the latest `.dmg` from [Releases](https://github.com/Ambot9/nexwork-desktop/releases)
2. **Open** the DMG file
3. **Drag** Nexwork to Applications folder
4. **First Launch**: You may see a "damaged" warning. This is normal for unsigned apps.

**Fix "Damaged" Warning:**

Open Terminal and run:
```bash
xattr -cr /Applications/Nexwork.app
```

Then launch Nexwork normally. This only needs to be done once.

**Alternative Method:**
- Right-click Nexwork.app → Select "Open" → Click "Open" in the dialog

#### Windows Installation

1. Download the `.exe` installer from [Releases](https://github.com/Ambot9/nexwork-desktop/releases)
2. Run the installer
3. Follow the installation wizard

#### Linux Installation

1. Download the `.AppImage` from [Releases](https://github.com/Ambot9/nexwork-desktop/releases)
2. Make it executable: `chmod +x Nexwork*.AppImage`
3. Run: `./Nexwork*.AppImage`

### For Developers

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Package for distribution
npm run dist
```

## 🏗️ Project Structure

```
nexwork-desktop/
├── electron/
│   ├── main/          # Electron main process
│   └── preload/       # Preload scripts (IPC bridge)
├── src/
│   ├── components/    # Reusable React components
│   ├── pages/         # Main application views
│   ├── store/         # State management
│   ├── hooks/         # Custom React hooks
│   ├── api/           # IPC communication
│   ├── styles/        # CSS styles
│   └── types/         # TypeScript types
├── public/            # Static assets
└── resources/         # App icons and resources
```

## 🎨 Screenshots

### Dashboard
![Dashboard](.github/screenshots/dashboard.png)

### Feature Creation
![Create Feature](.github/screenshots/create-feature.png)

### Feature Details
![Feature Details](.github/screenshots/feature-details.png)

## 🧪 Development

### Running Tests

```bash
npm test
```

### Debugging

The app automatically opens DevTools in development mode. You can also:

1. Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
2. Use VS Code's debugging configuration

### Hot Module Replacement

Vite provides instant HMR for the renderer process. Changes to the main process require a restart.

## 📝 Building

### Build for Current Platform

```bash
npm run build
```

### Build for Specific Platform

```bash
# macOS
npm run build -- --mac

# Windows
npm run build -- --win

# Linux
npm run build -- --linux
```

## 🚢 Distribution

Built apps are located in `release/` directory:

- **macOS**: `Nexwork_1.0.0.dmg`
- **Windows**: `Nexwork_1.0.0.exe`
- **Linux**: `Nexwork_1.0.0.AppImage`

## 🔐 Security

- Context isolation enabled
- Node integration disabled in renderer
- All IPC communication through contextBridge
- Input validation on all IPC handlers

## 🤝 Contributing

See [CONTRIBUTING.md](../multi-repo-orchestrator/CONTRIBUTING.md) for development guidelines.

## 📄 License

MIT License - see [LICENSE](../multi-repo-orchestrator/LICENSE) for details.

## 🔗 Related

- [Nexwork CLI](../multi-repo-orchestrator) - Command-line interface
- [Documentation](../multi-repo-orchestrator/README.md) - Full documentation

---

**Made with ❤️ for developers managing microservices**
