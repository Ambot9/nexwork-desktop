import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron'
import path from 'path'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow) {
  // Create tray icon from the Nexwork logo (transparent version)
  const iconPath = process.env.VITE_PUBLIC 
    ? path.join(process.env.VITE_PUBLIC, 'Nexwork Background Removed.png')
    : path.join(__dirname, '../../public/Nexwork Background Removed.png')
  
  let icon: Electron.NativeImage
  try {
    const fullIcon = nativeImage.createFromPath(iconPath)
    // Resize to appropriate size for system tray (16x16 on macOS)
    icon = fullIcon.resize({ width: 22, height: 22 })
  } catch (error) {
    console.error('Failed to load tray icon:', error)
    icon = nativeImage.createEmpty()
  }
  
  tray = new Tray(icon)
  tray.setToolTip('Nexwork - Multi-Repository Manager')

  updateTrayMenu(mainWindow, 0, 0, 0)

  // Click to show/hide window
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  return tray
}

export function updateTrayMenu(
  mainWindow: BrowserWindow,
  totalFeatures: number = 0,
  inProgress: number = 0,
  completed: number = 0
) {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Nexwork',
      type: 'normal',
      enabled: false,
      icon: nativeImage.createEmpty()
    },
    { type: 'separator' },
    {
      label: `Features: ${totalFeatures}`,
      type: 'normal',
      enabled: false
    },
    {
      label: `In Progress: ${inProgress}`,
      type: 'normal',
      enabled: false
    },
    {
      label: `Completed: ${completed}`,
      type: 'normal',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Show Dashboard',
      type: 'normal',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: 'Create Feature',
      type: 'normal',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('open-create-dialog')
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      type: 'normal',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('open-settings')
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      type: 'normal',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // Update tray title (macOS only)
  if (process.platform === 'darwin' && inProgress > 0) {
    tray.setTitle(`${inProgress}`)
  }
}

export function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
