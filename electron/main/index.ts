import { app, BrowserWindow } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'os'
import { registerIpcHandlers } from './ipc-handlers'
import { createTray, destroyTray } from './tray'

const { ConfigManager } = require('multi-repo-orchestrator/dist/core/config-manager.js')
const { WorktreeManager } = require('multi-repo-orchestrator/dist/core/worktree-manager.js')
const fs = require('fs')

// Set app name for macOS menu bar (must be done before app.whenReady())
app.name = 'Nexwork'

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main
// │ │ └── preload
// │
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null
let autoCleanupInterval: NodeJS.Timeout | null = null

// Auto-cleanup service for expired features
function startAutoCleanupService() {
  // Check every hour
  const checkExpiredFeatures = async () => {
    try {
      // Import the current workspace from ipc-handlers
      // This will be empty until user sets it
      console.log('🔍 Checking for expired features...')
      
      // Get workspace from the global in ipc-handlers
      // We need to import it dynamically to get the current value
      const ipcHandlers = require('./ipc-handlers')
      const workspaceRoot = ipcHandlers.currentWorkspaceRoot
      
      if (!workspaceRoot) {
        console.log('⏭️ No workspace set yet, skipping cleanup')
        return
      }
      
      const configManager = new ConfigManager(workspaceRoot)
      const features = configManager.getAllFeatures()
      const now = new Date()
      
      for (const feature of features) {
        if (feature.expiresAt) {
          const expiresDate = new Date(feature.expiresAt)
          const isExpired = expiresDate < now
          
          if (isExpired) {
            const daysExpired = Math.floor((now.getTime() - expiresDate.getTime()) / (1000 * 60 * 60 * 24))
            console.log(`🗑️ Found expired feature: ${feature.name} (expired ${daysExpired} days ago)`)
            
            try {
              // Cleanup the expired feature
              for (const project of feature.projects) {
                try {
                  const projectPath = configManager.getProjectPath(project.name)
                  const worktreeManager = new WorktreeManager(projectPath)
                  
                  // Remove worktree
                  if (project.worktreePath && fs.existsSync(project.worktreePath)) {
                    console.log(`  📁 Removing worktree: ${project.worktreePath}`)
                    await worktreeManager.removeWorktree(project.worktreePath)
                  }
                  
                  // Delete branch
                  if (project.branch) {
                    console.log(`  🌿 Deleting branch: ${project.branch}`)
                    await worktreeManager.deleteFeatureBranch(project.branch)
                  }
                } catch (error: any) {
                  console.error(`  ❌ Failed to cleanup ${project.name}:`, error.message)
                }
              }
              
              // Delete feature folder
              try {
                const featureDate = new Date(feature.createdAt).toISOString().split('T')[0]
                const featureFolderName = `${featureDate}-${feature.name.replace(/[^a-zA-Z0-9]/g, '-')}`
                const featureFolder = path.join(workspaceRoot, 'features', featureFolderName)
                
                if (fs.existsSync(featureFolder)) {
                  console.log(`  🗂️ Deleting feature folder: ${featureFolder}`)
                  fs.rmSync(featureFolder, { recursive: true, force: true })
                }
              } catch (error: any) {
                console.error(`  ❌ Failed to delete feature folder:`, error.message)
              }
              
              // Remove from config
              configManager.deleteFeature(feature.name)
              
              console.log(`✅ Auto-cleaned expired feature: ${feature.name}`)
            } catch (error: any) {
              console.error(`❌ Failed to auto-cleanup ${feature.name}:`, error.message)
            }
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Error in auto-cleanup service:', error.message)
    }
  }
  
  // Run first check after 60 seconds to avoid slowing startup
  setTimeout(checkExpiredFeatures, 60000) // Wait 60 seconds after startup
  
  // Then check every hour
  autoCleanupInterval = setInterval(checkExpiredFeatures, 60 * 60 * 1000)
  
  console.log('✅ Auto-cleanup service started (first check in 60s, then hourly)')
}

function stopAutoCleanupService() {
  if (autoCleanupInterval) {
    clearInterval(autoCleanupInterval)
    autoCleanupInterval = null
    console.log('🛑 Auto-cleanup service stopped')
  }
}

function createWindow() {
  win = new BrowserWindow({
    title: 'Nexwork',
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    icon: process.env.VITE_PUBLIC ? path.join(process.env.VITE_PUBLIC, 'Nexwork Background Removed.png') : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1f1f1f',
    show: false, // Don't show until ready
  })

  // Security: Content Security Policy
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https:; " +
          "font-src 'self' data:; " +
          "connect-src 'self'; " +
          "media-src 'self' blob:;"
        ]
      }
    })
  })

  // Show window when ready to avoid flickering
  win.once('ready-to-show', () => {
    win?.show()
  })

  // Prevent window from closing, just hide it
  win.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault()
      win?.hide()
    }
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    console.log('✅ Renderer loaded successfully')
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Log any load errors
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Failed to load renderer:', errorCode, errorDescription)
  })

  if (VITE_DEV_SERVER_URL) {
    console.log('Loading dev server:', VITE_DEV_SERVER_URL)
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open DevTools in development
    win.webContents.openDevTools()
  } else {
    console.log('Loading production build from:', path.join(RENDERER_DIST, 'index.html'))
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  // Load saved settings and restore workspace
  try {
    const { storage } = await import('./storage')
    const lastWorkspace = storage.getSetting('lastWorkspace')
    
    if (lastWorkspace) {
      console.log('🔄 Restoring workspace from settings:', lastWorkspace)
      // Import and set the workspace
      const ipcHandlers = await import('./ipc-handlers')
      await ipcHandlers.setWorkspaceOnStartup(lastWorkspace)
    }
  } catch (error) {
    console.error('❌ Failed to restore workspace:', error)
  }
  
  registerIpcHandlers()
  createWindow()
  
  // Create system tray
  if (win) {
    createTray(win)
  }
  
  // Start auto-cleanup service for expired features
  startAutoCleanupService()
})

// Set quitting flag before quit
app.on('before-quit', () => {
  (app as any).isQuitting = true
  stopAutoCleanupService()
  destroyTray()
})
