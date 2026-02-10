import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'
import * as pty from 'node-pty'
import { updateTrayMenu } from './tray'
import { notifyFeatureCreated, notifyFeatureCompleted, notifyProjectStatusChanged } from './notifications'
import { promisify } from 'util'
import { exec } from 'child_process'
import {
  validateWorkspacePath,
  sanitizeFeatureName,
  validateBranchName,
  isPathInWorkspace,
  sanitizeCommand,
  validateProjectName,
  featureOperationLimiter,
  gitOperationLimiter,
  terminalLimiter
} from './security'

// Import Nexwork CLI components - using require for CommonJS modules
const { ConfigManager } = require('multi-repo-orchestrator/dist/core/config-manager.js')
const { WorktreeManager } = require('multi-repo-orchestrator/dist/core/worktree-manager.js')
const { TemplateManager } = require('multi-repo-orchestrator/dist/core/template-manager.js')

// Helper for async exec
const execAsync = promisify(exec)

// Global workspace root
let currentWorkspaceRoot: string = path.join(os.homedir(), 'Documents/Techbodia')

// Helper to get ConfigManager instance
function getConfigManager(): ConfigManager {
  return new ConfigManager(currentWorkspaceRoot)
}

// Helper to update tray with current features
function updateTrayWithFeatures() {
  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (!mainWindow) return

  try {
    const configManager = getConfigManager()
    const features = configManager.getAllFeatures()
    
    const total = features.length
    const inProgress = features.filter(f => 
      f.projects.some(p => p.status === 'in_progress')
    ).length
    const completed = features.filter(f =>
      f.projects.every(p => p.status === 'completed')
    ).length

    updateTrayMenu(mainWindow, total, inProgress, completed)
  } catch (error) {
    console.error('Failed to update tray:', error)
  }
}

// Helper to sync config worktreePaths with actual git worktrees
async function syncWorktreePaths(featureName: string): Promise<void> {
  console.log('🔄 Syncing worktree paths for feature:', featureName)
  
  try {
    const configManager = getConfigManager()
    const config = configManager.loadConfig()
    const feature = config.features?.find((f: any) => f.name === featureName)
    
    if (!feature) {
      console.log('❌ Feature not found:', featureName)
      return
    }
    
    const projectLocations = config.projectLocations || {}
    let configUpdated = false
    
    // For each project in the feature
    for (const project of feature.projects) {
      console.log(`  🔍 Checking project: ${project.name}`)
      console.log(`     Current worktreePath: ${project.worktreePath || '(empty)'}`)
      console.log(`     Branch: ${project.branch}`)
      
      const projectPath = projectLocations[project.name]
      if (!projectPath) {
        console.log(`  ⚠️ No project location for ${project.name}`)
        continue
      }
      
      // Get the main repo path
      const mainRepoPath = path.join(currentWorkspaceRoot, projectPath)
      console.log(`     Main repo: ${mainRepoPath}`)
      
      try {
        // Get all worktrees from git
        const { stdout } = await execAsync('git worktree list --porcelain', { cwd: mainRepoPath })
        
        // Parse worktree list to find this feature's worktree
        const lines = stdout.split('\n')
        let currentWorktreePath = ''
        let currentBranch = ''
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          
          if (line.startsWith('worktree ')) {
            currentWorktreePath = line.substring(9).trim()
          } else if (line.startsWith('branch ')) {
            currentBranch = line.substring(7).trim()
            
            // Check if this branch matches our feature branch
            if (currentBranch === `refs/heads/${project.branch}`) {
              // Found the worktree for this project!
              console.log(`     ✅ Found matching worktree: ${currentWorktreePath}`)
              
              // Update if path is different (including empty -> filled)
              if (currentWorktreePath && currentWorktreePath !== project.worktreePath) {
                console.log(`     📝 Updating worktreePath from "${project.worktreePath || '(empty)'}" to "${currentWorktreePath}"`)
                project.worktreePath = currentWorktreePath
                configUpdated = true
              } else if (currentWorktreePath && currentWorktreePath === project.worktreePath) {
                console.log(`     ℹ️ Worktree path already correct`)
              }
            }
          }
        }
        
        if (!project.worktreePath) {
          console.log(`  ⚠️ No worktree found for ${project.name} on branch ${project.branch}`)
        }
      } catch (error: any) {
        console.error(`  ❌ Error checking worktrees for ${project.name}:`, error.message)
      }
    }
    
    // Save config if updated
    if (configUpdated) {
      const configPath = path.join(currentWorkspaceRoot, '.multi-repo-config.json')
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
      console.log('✅ Config updated with synced worktree paths')
    } else {
      console.log('✅ No config updates needed')
    }
  } catch (error: any) {
    console.error('❌ Error syncing worktree paths:', error.message)
  }
}

export function registerIpcHandlers() {
  // System
  ipcMain.handle('system:selectFolder', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Workspace Root',
        message: 'Choose the root directory containing your repositories'
      })
      
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      
      return result.filePaths[0]
    } catch (error: any) {
      console.error('Failed to open folder dialog:', error)
      throw new Error(`Failed to open folder dialog: ${error.message}`)
    }
  })

  ipcMain.handle('system:openInTerminal', async (_, folderPath: string, terminalApp: string = 'terminal') => {
    try {
      const { exec } = require('child_process')
      
      // Terminal app configurations: [app name for macOS]
      const terminalConfigs: {[key: string]: {appName: string, command?: string}} = {
        'terminal': { appName: 'Terminal' },
        'iterm2': { appName: 'iTerm' },
        'warp': { appName: 'Warp' },
        'alacritty': { appName: 'Alacritty' },
        'kitty': { appName: 'kitty' },
        'hyper': { appName: 'Hyper' }
      }
      
      const config = terminalConfigs[terminalApp] || terminalConfigs['terminal']
      
      console.log(`Opening ${folderPath} in ${config.appName}`)
      
      return new Promise((resolve) => {
        // macOS: Open Terminal app at specific path
        exec(`open -a "${config.appName}" "${folderPath}"`, (error: any) => {
          if (error) {
            console.error(`Failed to open ${config.appName}:`, error)
            resolve({ 
              success: false, 
              error: `${config.appName} not found. Please ensure the app is installed.`
            })
          } else {
            resolve({ success: true })
          }
        })
      })
    } catch (error: any) {
      console.error('Failed to open terminal:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('system:openInVSCode', async (_, folderPath: string) => {
    try {
      const { exec } = require('child_process')
      
      // Try to open in VS Code
      exec(`code "${folderPath}"`, (error: any, stdout: string, stderr: string) => {
        if (error) {
          // If 'code' command not found, try opening with system default
          exec(`open -a "Visual Studio Code" "${folderPath}"`, (err2: any) => {
            if (err2) {
              console.error('Failed to open VS Code:', err2)
              throw new Error('VS Code not found. Please install code command: Cmd+Shift+P > "Shell Command: Install code command"')
            }
          })
        }
      })
      
      return { success: true }
    } catch (error: any) {
      console.error('Failed to open VS Code:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('system:openInIDE', async (_, folderPath: string, ide: string) => {
    try {
      const { exec } = require('child_process')
      
      // IDE configurations: [command, app name for macOS]
      const ideConfigs: {[key: string]: {command: string, appName: string}} = {
        'vscode': { command: 'code', appName: 'Visual Studio Code' },
        'cursor': { command: 'cursor', appName: 'Cursor' },
        'rider': { command: 'rider', appName: 'Rider' },
        'webstorm': { command: 'webstorm', appName: 'WebStorm' },
        'intellij': { command: 'idea', appName: 'IntelliJ IDEA' },
        'code-insiders': { command: 'code-insiders', appName: 'Visual Studio Code - Insiders' }
      }
      
      const config = ideConfigs[ide]
      if (!config) {
        return { success: false, error: `Unknown IDE: ${ide}` }
      }
      
      console.log(`Opening ${folderPath} in ${config.appName}`)
      
      return new Promise((resolve) => {
        // Try CLI command first
        exec(`${config.command} "${folderPath}"`, (error: any) => {
          if (error) {
            console.log(`CLI command '${config.command}' failed, trying macOS app launcher...`)
            // If CLI command not found, try macOS app launcher
            exec(`open -a "${config.appName}" "${folderPath}"`, (err2: any) => {
              if (err2) {
                console.error(`Failed to open ${config.appName}:`, err2)
                resolve({ 
                  success: false, 
                  error: `${config.appName} not found. Please install the CLI command or ensure the app is installed.`
                })
              } else {
                resolve({ success: true })
              }
            })
          } else {
            resolve({ success: true })
          }
        })
      })
    } catch (error: any) {
      console.error('Failed to open IDE:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('system:runCommand', async (_, command: string, workingDir?: string) => {
    return new Promise((resolve) => {
      const { exec } = require('child_process')
      const cwd = workingDir || currentWorkspaceRoot
      
      
      // Inherit environment variables and add git optimizations
      const env = {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0', // Disable git credential prompts
        GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=10', // SSH timeout
        GIT_ASKPASS: 'echo', // Prevent password prompts
      }
      
      // Use async exec with longer timeout
      const child = exec(command, {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 300000, // 5 minute timeout (for slow networks)
        shell: '/bin/bash', // Use bash shell
        env, // Use modified environment
      }, (error: any, stdout: string, stderr: string) => {
        if (error) {
          console.error('Command failed:', error.message)
          
          // Provide better error messages
          let errorMsg = stderr || error.message
          
          if (error.killed || error.signal === 'SIGTERM') {
            errorMsg = 'Command timed out (exceeded 2 minutes)'
          } else if (error.code) {
            errorMsg = `Command exited with code ${error.code}\n${stderr || error.message}`
          }
          
          resolve({
            success: false,
            output: stdout || '',
            error: errorMsg
          })
        } else {
          resolve({
            success: true,
            output: stdout || 'Command completed successfully (no output)',
            error: null
          })
        }
      })
      
      // Handle timeout separately
      setTimeout(() => {
        if (!child.killed) {
          child.kill()
          resolve({
            success: false,
            output: '',
            error: 'Command exceeded 2 minute timeout and was terminated'
          })
        }
      }, 125000) // 2 minutes + 5 seconds grace period
    })
  })

  // Features
  ipcMain.handle('features:getAll', async () => {
    try {
      const configManager = getConfigManager()
      const features = configManager.getAllFeatures()
      updateTrayWithFeatures()
      return features
    } catch (error: any) {
      console.error('Failed to get features:', error)
      return []
    }
  })

  ipcMain.handle('features:getByName', async (_, name: string) => {
    try {
      const configManager = getConfigManager()
      return configManager.getFeature(name)
    } catch (error: any) {
      console.error('Failed to get feature:', error)
      return null
    }
  })

  ipcMain.handle('features:create', async (_, data: any) => {
    try {
      console.log('Creating feature with data:', JSON.stringify(data, null, 2))
      
      // Validate data
      if (!data.name) {
        throw new Error('Feature name is required')
      }
      if (!data.projects || !Array.isArray(data.projects) || data.projects.length === 0) {
        throw new Error('At least one project must be selected')
      }
      
      const configManager = getConfigManager()
      const templateManager = new TemplateManager(currentWorkspaceRoot)
      
      console.log('Creating feature:', data.name)
      console.log('Projects to include:', data.projects)
      
      // Validate feature name is unique
      const existingFeatures = configManager.getAllFeatures()
      if (existingFeatures.some(f => f.name === data.name)) {
        throw new Error(`Feature "${data.name}" already exists`)
      }
      
      // Create project statuses using feature name for branches
      // Use selected branch as base, or fall back to current branch
      const projectStatuses = data.projects.map((projectName: string) => {
        const baseBranch = data.selectedBranches?.[projectName] || 'current'
        return {
          name: projectName,
          status: 'pending' as const,
          branch: `feature/${data.name}`,
          baseBranch: baseBranch, // Store which branch this feature is created from
          worktreePath: '',
          lastUpdated: new Date().toISOString()
        }
      })
      
      // Create feature object (no ID, just name)
      const newFeature = {
        name: data.name,
        projects: projectStatuses,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(data.expiresAt && { expiresAt: data.expiresAt })
      }
      
      // Add feature to config
      configManager.addFeature(newFeature)
      
      // Create feature folder
      const today = new Date()
      const dateStr = today.toISOString().split('T')[0]
      const featureFolderName = `${dateStr}-${data.name.replace(/[^a-zA-Z0-9]/g, '-')}`
      const featuresDir = path.join(currentWorkspaceRoot, 'features')
      const featureTrackingDir = path.join(featuresDir, featureFolderName)
      
      const fs = require('fs')
      if (!fs.existsSync(featuresDir)) {
        fs.mkdirSync(featuresDir, { recursive: true })
      }
      fs.mkdirSync(featureTrackingDir, { recursive: true })
      
      // Generate README from template
      const templateName = data.template || 'default'
      const readmePath = path.join(featureTrackingDir, 'README.md')
      templateManager.generateReadme(templateName, newFeature, readmePath)
      
      // Create local feature branches for all selected projects
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)
      
      console.log('Creating local feature branches...')
      console.log('Project statuses:', JSON.stringify(projectStatuses, null, 2))
      
      for (const projectStatus of projectStatuses) {
        try {
          const projectConfig = configManager.getConfig().projects.find((p: any) => p.name === projectStatus.name)
          if (!projectConfig) {
            console.log(`⚠ Project config not found for ${projectStatus.name}`)
            continue
          }
          
          const projectPath = path.join(currentWorkspaceRoot, projectConfig.path)
          const featureBranch = projectStatus.branch
          const baseBranch = projectStatus.baseBranch
          
          console.log(`[${projectStatus.name}] Project path: ${projectPath}`)
          console.log(`[${projectStatus.name}] Feature branch: ${featureBranch}`)
          console.log(`[${projectStatus.name}] Base branch: ${baseBranch}`)
          
          // Check if branch already exists
          const checkBranch = await execAsync(`git rev-parse --verify ${featureBranch}`, { cwd: projectPath }).catch(() => null)
          
          if (!checkBranch) {
            // Create local branch from selected base branch
            console.log(`[${projectStatus.name}] Creating ${featureBranch} from ${baseBranch}...`)
            const result = await execAsync(`git branch ${featureBranch} ${baseBranch}`, { cwd: projectPath })
            console.log(`✓ Created ${featureBranch} in ${projectStatus.name}`)
            if (result.stderr) {
              console.log(`[${projectStatus.name}] stderr: ${result.stderr}`)
            }
          } else {
            console.log(`[${projectStatus.name}] Branch ${featureBranch} already exists - skipping`)
          }
        } catch (error: any) {
          console.error(`❌ Failed to create branch for ${projectStatus.name}:`, error.message)
          if (error.stderr) {
            console.error(`[${projectStatus.name}] Git error: ${error.stderr}`)
          }
          // Don't fail the entire feature creation if one branch fails
        }
      }
      
      updateTrayWithFeatures()
      notifyFeatureCreated(newFeature.name)
      
      return newFeature
    } catch (error: any) {
      console.error('Failed to create feature:', error)
      throw new Error(`Failed to create feature: ${error.message}`)
    }
  })

  ipcMain.handle('features:update', async (_, id: string, data: any) => {
    try {
      const configManager = getConfigManager()
      configManager.updateFeature(id, data)
      updateTrayWithFeatures()
      return configManager.getFeature(id)
    } catch (error: any) {
      console.error('Failed to update feature:', error)
      throw new Error(`Failed to update feature: ${error.message}`)
    }
  })

  ipcMain.handle('features:delete', async (_, name: string) => {
    try {
      const configManager = getConfigManager()
      const feature = configManager.getFeature(name)
      
      if (!feature) {
        throw new Error(`Feature ${name} not found`)
      }
      
      // Clean up each project's worktree and branch
      for (const project of feature.projects) {
        try {
          const projectPath = configManager.getProjectPath(project.name)
          const worktreeManager = new WorktreeManager(projectPath)
          
          // Remove worktree if it exists
          if (project.worktreePath && fs.existsSync(project.worktreePath)) {
            console.log(`Removing worktree for ${project.name}: ${project.worktreePath}`)
            await worktreeManager.removeWorktree(project.worktreePath)
          }
          
          // Delete the feature branch
          if (project.branch) {
            console.log(`Deleting branch for ${project.name}: ${project.branch}`)
            await worktreeManager.deleteFeatureBranch(project.branch)
          }
        } catch (error: any) {
          console.error(`Failed to cleanup ${project.name}:`, error.message)
          // Continue with other projects even if one fails
        }
      }
      
      // Delete feature tracking folder
      try {
        const featureDate = new Date(feature.createdAt).toISOString().split('T')[0]
        const featureFolderName = `${featureDate}-${name.replace(/[^a-zA-Z0-9]/g, '-')}`
        const featureFolder = path.join(currentWorkspaceRoot, 'features', featureFolderName)
        
        if (fs.existsSync(featureFolder)) {
          console.log(`Deleting feature folder: ${featureFolder}`)
          fs.rmSync(featureFolder, { recursive: true, force: true })
        }
      } catch (error: any) {
        console.error(`Failed to delete feature folder:`, error.message)
      }
      
      // Finally, remove from config
      configManager.deleteFeature(name)
      updateTrayWithFeatures()
      
      console.log(`✅ Feature ${name} deleted successfully`)
    } catch (error: any) {
      console.error('Failed to delete feature:', error)
      throw new Error(`Failed to delete feature: ${error.message}`)
    }
  })

  ipcMain.handle('features:complete', async (_, name: string, _cleanup: boolean) => {
    try {
      const configManager = getConfigManager()
      const feature = configManager.getFeature(name)
      
      if (feature) {
        // Mark all projects as completed
        feature.projects.forEach(project => {
          configManager.updateProjectStatus(name, project.name, 'completed')
        })
        
        updateTrayWithFeatures()
        notifyFeatureCompleted(feature.name)
      }
    } catch (error: any) {
      console.error('Failed to complete feature:', error)
      throw new Error(`Failed to complete feature: ${error.message}`)
    }
  })

  // Clean up expired feature (delete worktrees, branches, and folder)
  ipcMain.handle('features:cleanupExpired', async (_, name: string) => {
    try {
      console.log(`🗑️ Cleaning up expired feature: ${name}`)
      const configManager = getConfigManager()
      const feature = configManager.getFeature(name)
      
      if (!feature) {
        throw new Error(`Feature ${name} not found`)
      }
      
      // Clean up each project's worktree and branch
      for (const project of feature.projects) {
        try {
          const projectPath = configManager.getProjectPath(project.name)
          const worktreeManager = new WorktreeManager(projectPath)
          
          // Remove worktree if it exists
          if (project.worktreePath && fs.existsSync(project.worktreePath)) {
            console.log(`  📁 Removing worktree for ${project.name}: ${project.worktreePath}`)
            await worktreeManager.removeWorktree(project.worktreePath)
          }
          
          // Delete the feature branch
          if (project.branch) {
            console.log(`  🌿 Deleting branch for ${project.name}: ${project.branch}`)
            await worktreeManager.deleteFeatureBranch(project.branch)
          }
        } catch (error: any) {
          console.error(`  ❌ Failed to cleanup ${project.name}:`, error.message)
          // Continue with other projects even if one fails
        }
      }
      
      // Delete feature tracking folder
      try {
        const featureDate = new Date(feature.createdAt).toISOString().split('T')[0]
        const featureFolderName = `${featureDate}-${name.replace(/[^a-zA-Z0-9]/g, '-')}`
        const featureFolder = path.join(currentWorkspaceRoot, 'features', featureFolderName)
        
        if (fs.existsSync(featureFolder)) {
          console.log(`  🗂️ Deleting feature folder: ${featureFolder}`)
          fs.rmSync(featureFolder, { recursive: true, force: true })
        }
      } catch (error: any) {
        console.error(`  ❌ Failed to delete feature folder:`, error.message)
      }
      
      // Finally, remove from config
      configManager.deleteFeature(name)
      updateTrayWithFeatures()
      
      console.log(`✅ Expired feature ${name} cleaned up successfully`)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to cleanup expired feature:', error)
      throw new Error(`Failed to cleanup expired feature: ${error.message}`)
    }
  })

  // Projects
  ipcMain.handle('projects:updateStatus', async (_, featureName: string, projectName: string, status: string) => {
    try {
      const configManager = getConfigManager()
      configManager.updateProjectStatus(featureName, projectName, status as 'pending' | 'in_progress' | 'completed')
      
      const feature = configManager.getFeature(featureName)
      if (feature) {
        updateTrayWithFeatures()
        notifyProjectStatusChanged(feature.name, projectName, status)
      }
    } catch (error: any) {
      console.error('Failed to update project status:', error)
      throw new Error(`Failed to update project status: ${error.message}`)
    }
  })

  ipcMain.handle('projects:createWorktree', async (_, featureName: string, projectName: string) => {
    try {
      const configManager = getConfigManager()
      const feature = configManager.getFeature(featureName)
      
      if (!feature) {
        throw new Error(`Feature ${featureName} not found`)
      }
      
      // Get project path
      const projectPath = configManager.getProjectPath(projectName)
      const worktreeManager = new WorktreeManager(projectPath)
      
      // Create feature tracking directory
      const today = new Date(feature.createdAt)
      const dateStr = today.toISOString().split('T')[0]
      const featureFolderName = `${dateStr}-${featureName.replace(/[^a-zA-Z0-9]/g, '-')}`
      const featureTrackingDir = path.join(currentWorkspaceRoot, 'features', featureFolderName)
      
      // Create feature folder if it doesn't exist
      if (!fs.existsSync(featureTrackingDir)) {
        fs.mkdirSync(featureTrackingDir, { recursive: true })
      }
      
      // Create worktree
      const result = await worktreeManager.createWorktree(featureName, projectName, featureTrackingDir)
      
      // Update project status with worktree path
      const updatedProjects = feature.projects.map(p => 
        p.name === projectName 
          ? { ...p, worktreePath: result.path }
          : p
      )
      
      configManager.updateFeature(featureName, { projects: updatedProjects })
      
      return { success: true, path: result.path, sourceBranch: result.sourceBranch }
    } catch (error: any) {
      console.error('Failed to create worktree:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projects:removeWorktree', async (_, featureId: string, projectName: string) => {
    try {
      // TODO: Implement worktree removal
      console.log('Removing worktree:', featureId, projectName)
    } catch (error: any) {
      console.error('Failed to remove worktree:', error)
      throw new Error(`Failed to remove worktree: ${error.message}`)
    }
  })

  // Templates
  ipcMain.handle('templates:getAll', async () => {
    try {
      const templateManager = new TemplateManager(currentWorkspaceRoot)
      return templateManager.getAvailableTemplates()
    } catch (error: any) {
      console.error('Failed to get templates:', error)
      return ['default', 'jira']
    }
  })

  ipcMain.handle('templates:getCustom', async () => {
    try {
      const templateManager = new TemplateManager(currentWorkspaceRoot)
      return templateManager.listCustomTemplates(currentWorkspaceRoot)
    } catch (error: any) {
      console.error('Failed to get custom templates:', error)
      return []
    }
  })

  ipcMain.handle('templates:create', async (_, name: string, content: string) => {
    try {
      const templateManager = new TemplateManager(currentWorkspaceRoot)
      templateManager.createCustomTemplate(currentWorkspaceRoot, name, content)
    } catch (error: any) {
      console.error('Failed to create template:', error)
      throw new Error(`Failed to create template: ${error.message}`)
    }
  })

  ipcMain.handle('templates:delete', async (_, name: string) => {
    try {
      // TODO: Implement template deletion
      console.log('Deleting template:', name)
    } catch (error: any) {
      console.error('Failed to delete template:', error)
      throw new Error(`Failed to delete template: ${error.message}`)
    }
  })

  ipcMain.handle('templates:preview', async (_, _template: string, data: any) => {
    try {
      // Generate preview
      return `# ${data.name}\n\n**ID:** ${data.id}\n\n## Projects\n${data.projects.map((p: any) => `- ${p}`).join('\n')}`
    } catch (error: any) {
      console.error('Failed to preview template:', error)
      return ''
    }
  })

  // Config
  ipcMain.handle('config:load', async () => {
    try {
      const configManager = getConfigManager()
      const config = configManager.loadConfig()
      
      // Convert projectLocations object to projects array for the UI
      const projects = Object.keys(config.projectLocations || {}).map(name => ({
        name,
        path: config.projectLocations[name]
      }))
      
      return {
        ...config,
        projects
      }
    } catch (error: any) {
      console.error('Failed to load config:', error)
      // Return default config
      return {
        workspaceRoot: currentWorkspaceRoot,
        projects: [],
        features: [],
        userConfig: {
          defaultTemplate: 'default'
        }
      }
    }
  })

  ipcMain.handle('config:save', async (_, config: any) => {
    try {
      const configManager = getConfigManager()
      
      // Check if config exists, if not, initialize it
      const configPath = path.join(currentWorkspaceRoot, '.multi-repo-config.json')
      if (!fs.existsSync(configPath)) {
        console.log('Config not found, initializing...')
        await configManager.initialize()
      }
      
      // Update user config
      const currentConfig = configManager.loadConfig()
      currentConfig.userConfig = config.userConfig
      
      // Save to file
      fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8')
      
      console.log('Config saved successfully')
    } catch (error: any) {
      console.error('Failed to save config:', error)
      throw new Error(`Failed to save config: ${error.message}`)
    }
  })

  ipcMain.handle('config:setWorkspace', async (_, workspacePath: string) => {
    try {
      // Security: Validate workspace path
      if (!validateWorkspacePath(workspacePath)) {
        throw new Error('Invalid or unsafe workspace path')
      }

      currentWorkspaceRoot = workspacePath
      console.log('Workspace set to:', currentWorkspaceRoot)
    } catch (error: any) {
      console.error('Failed to set workspace:', error)
      throw new Error(`Failed to set workspace: ${error.message}`)
    }
  })

  // Stats
  ipcMain.handle('stats:getFeatureStats', async (_, featureName: string) => {
    console.log('⭐ stats:getFeatureStats called for:', featureName)
    try {
      // First, sync worktree paths with actual git worktrees
      await syncWorktreePaths(featureName)
      
      const configManager = getConfigManager()
      const feature = configManager.getFeature(featureName)
      
      if (!feature) {
        console.log('❌ Feature not found:', featureName)
        return null
      }
      
      console.log('✅ Feature found:', feature.name)

      const completed = feature.projects.filter(p => p.status === 'completed').length
      const inProgress = feature.projects.filter(p => p.status === 'in_progress').length
      const pending = feature.projects.filter(p => p.status === 'pending').length

      // Calculate elapsed time
      const created = new Date(feature.createdAt)
      const now = new Date()
      const elapsedMs = now.getTime() - created.getTime()
      const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24))
      const hours = Math.floor((elapsedMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60))
      const elapsed = `${days}d ${hours}h ${minutes}m`

      // Calculate real-time git stats from worktrees
      console.log('🔍 Calculating git stats for feature:', featureName)
      
      let totalCommits = 0
      let totalFilesChanged = 0
      let totalLinesAdded = 0
      let totalLinesDeleted = 0
      
      // Store per-project stats
      const projectStats: any = {}
      
      const fs = require('fs')
      const projectsWithWorktrees = feature.projects.filter((p: any) => 
        p.worktreePath && fs.existsSync(p.worktreePath)
      )
      
      console.log(`📁 Found ${projectsWithWorktrees.length} projects with worktrees`)
      projectsWithWorktrees.forEach((p: any) => {
        console.log(`  - ${p.name}: ${p.worktreePath}`)
      })
      
      for (const project of projectsWithWorktrees) {
        console.log(`\n📊 Processing ${project.name}...`)
        
        // Initialize stats for this project
        projectStats[project.name] = {
          commits: 0,
          filesChanged: 0,
          linesAdded: 0,
          linesDeleted: 0,
          netChange: 0,
          currentBranch: '',
          baseBranch: ''
        }
        
        try {
          // Get diff stats comparing current branch to base
          // Use the base branch that was stored when the feature was created
          const baseBranch = project.baseBranch || 'staging' // default to staging if not set
          
          // Get the current branch in worktree
          const branchResult = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: project.worktreePath })
          const currentBranch = branchResult.stdout.trim()
          console.log(`  Current branch: ${currentBranch}`)
          console.log(`  Base branch: origin/${baseBranch}`)
          
          projectStats[project.name].currentBranch = currentBranch
          projectStats[project.name].baseBranch = baseBranch
          
          try {
            // Get diff stats including ALL changes:
            // 1. Committed changes: git diff baseBranch...currentBranch --shortstat
            // 2. Working directory changes: git diff HEAD --shortstat
            
            // First, get committed changes between branches
            const branchDiffCommand = `git diff origin/${baseBranch}...${currentBranch} --shortstat`
            console.log(`  Running (branch diff): ${branchDiffCommand}`)
            
            const branchDiffResult = await execAsync(branchDiffCommand, { cwd: project.worktreePath })
            const branchDiffStats = branchDiffResult.stdout.trim()
            console.log(`  Branch diff output: "${branchDiffStats}"`)
            
            // Then, get working directory changes (unstaged + staged)
            const workingDiffCommand = `git diff HEAD --shortstat`
            console.log(`  Running (working dir diff): ${workingDiffCommand}`)
            
            const workingDiffResult = await execAsync(workingDiffCommand, { cwd: project.worktreePath })
            const workingDiffStats = workingDiffResult.stdout.trim()
            console.log(`  Working dir diff output: "${workingDiffStats}"`)
            
            // Parse and combine both diffs
            const parseDiff = (diffStats: string) => {
              const filesMatch = diffStats.match(/(\d+) files? changed/)
              const addMatch = diffStats.match(/(\d+) insertions?\(\+\)/)
              const delMatch = diffStats.match(/(\d+) deletions?\(-\)/)
              
              return {
                files: filesMatch ? parseInt(filesMatch[1]) : 0,
                added: addMatch ? parseInt(addMatch[1]) : 0,
                deleted: delMatch ? parseInt(delMatch[1]) : 0
              }
            }
            
            const branchChanges = parseDiff(branchDiffStats)
            const workingChanges = parseDiff(workingDiffStats)
            
            // Combine the stats (working dir changes take precedence as they're more current)
            const files = Math.max(branchChanges.files, workingChanges.files)
            const added = Math.max(branchChanges.added, workingChanges.added)
            const deleted = Math.max(branchChanges.deleted, workingChanges.deleted)
            
            // Store per-project stats
            projectStats[project.name].filesChanged = files
            projectStats[project.name].linesAdded = added
            projectStats[project.name].linesDeleted = deleted
            projectStats[project.name].netChange = added - deleted
            
            if (files > 0) {
              console.log(`  ✅ Files changed: ${files}`)
              totalFilesChanged += files
            }
            if (added > 0) {
              console.log(`  ✅ Lines added: ${added}`)
              totalLinesAdded += added
            }
            if (deleted > 0) {
              console.log(`  ✅ Lines deleted: ${deleted}`)
              totalLinesDeleted += deleted
            }
            
            if (files === 0 && added === 0 && deleted === 0) {
              console.log(`  ⚠️ No changes detected`)
            }
          } catch (error: any) {
            // Branch might not have diverged yet or diff failed
            console.log(`  ❌ Diff failed: ${error.message}`)
          }
          
          // Count commits on feature branch (commits ahead of base)
          try {
            const commitCommand = `git rev-list --count origin/${baseBranch}..${currentBranch}`
            console.log(`  Running: ${commitCommand}`)
            
            const commitResult = await execAsync(commitCommand, { cwd: project.worktreePath })
            const commits = parseInt(commitResult.stdout.trim())
            console.log(`  ✅ Commits ahead: ${commits}`)
            
            // Store per-project commits
            projectStats[project.name].commits = commits
            totalCommits += commits
          } catch (error: any) {
            console.log(`  ❌ Commit count failed: ${error.message}`)
          }
        } catch (error: any) {
          console.error(`❌ Failed to get stats for ${project.name}:`, error.message)
        }
      }
      
      console.log(`\n📈 Final Stats:`)
      console.log(`  Commits: ${totalCommits}`)
      console.log(`  Files Changed: ${totalFilesChanged}`)
      console.log(`  Lines Added: ${totalLinesAdded}`)
      console.log(`  Lines Deleted: ${totalLinesDeleted}`)
      console.log(`  Net Change: ${totalLinesAdded - totalLinesDeleted}`)
      
      return {
        timeTracking: {
          created: feature.createdAt,
          started: feature.startedAt,
          completed: feature.completedAt,
          elapsed
        },
        projectStatus: {
          total: feature.projects.length,
          completed,
          inProgress,
          pending,
          progress: Math.round((completed / feature.projects.length) * 100)
        },
        gitStats: {
          commits: totalCommits,
          filesChanged: totalFilesChanged,
          linesAdded: totalLinesAdded,
          linesDeleted: totalLinesDeleted,
          netChange: totalLinesAdded - totalLinesDeleted
        },
        projectDetails: await Promise.all(feature.projects.map(async (p: any) => {
          const stats = projectStats[p.name] || {
            commits: 0,
            filesChanged: 0,
            linesAdded: 0,
            linesDeleted: 0,
            netChange: 0,
            currentBranch: '',
            baseBranch: p.baseBranch || 'staging'
          }
          
          // Check if main repo has uncommitted changes
          let mainRepoHasChanges = false
          let mainRepoChangedFiles: string[] = []
          
          try {
            const projectPath = configManager.getProjectPath(p.name)
            if (fs.existsSync(projectPath)) {
              const mainRepoStatus = await execAsync('git status --short', { cwd: projectPath })
              const changedFiles = mainRepoStatus.stdout.trim().split('\n').filter(line => line)
              mainRepoHasChanges = changedFiles.length > 0
              mainRepoChangedFiles = changedFiles.map(line => line.substring(3)) // Remove status prefix
            }
          } catch (error) {
            // Ignore errors
          }
          
          return {
            name: p.name,
            status: p.status,
            worktreePath: p.worktreePath,
            lastUpdated: p.lastUpdated || feature.updatedAt,
            baseBranch: p.baseBranch,
            gitStats: stats,
            mainRepoHasChanges,
            mainRepoChangedFiles
          }
        }))
      }
    } catch (error: any) {
      console.error('Failed to get feature stats:', error)
      return null
    }
  })

  ipcMain.handle('stats:getGitStats', async (_, _featureId: string, _projectName: string) => {
    try {
      // TODO: Implement real git stats collection
      return {
        commits: 0,
        filesChanged: 0,
        linesAdded: 0,
        linesDeleted: 0
      }
    } catch (error: any) {
      console.error('Failed to get git stats:', error)
      return {
        commits: 0,
        filesChanged: 0,
        linesAdded: 0,
        linesDeleted: 0
      }
    }
  })

  // Sync worktree paths with actual git worktrees
  ipcMain.handle('stats:syncWorktrees', async (_, featureName: string) => {
    try {
      console.log('🔄 Manual sync requested for feature:', featureName)
      await syncWorktreePaths(featureName)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to sync worktrees:', error)
      return { success: false, error: error.message }
    }
  })

  // Get detailed file diffs for a project
  ipcMain.handle('stats:getProjectDiff', async (_, featureName: string, projectName: string, ignoreWhitespace: boolean = false) => {
    try {
      const wsFlag = ignoreWhitespace ? ' (ignoring whitespace)' : ''
      console.log(`📝 Getting diff for project: ${projectName} in feature: ${featureName}${wsFlag}`)
      
      const configManager = getConfigManager()
      const feature = configManager.getFeature(featureName)
      
      if (!feature) {
        console.log('❌ Feature not found:', featureName)
        return null
      }
      
      const project = feature.projects.find((p: any) => p.name === projectName)
      if (!project || !project.worktreePath) {
        console.log('❌ Project not found or no worktree:', projectName)
        return null
      }
      
      const fs = require('fs')
      if (!fs.existsSync(project.worktreePath)) {
        console.log('❌ Worktree path does not exist:', project.worktreePath)
        return null
      }
      
      const baseBranch = project.baseBranch || 'staging'
      
      // Add whitespace ignore flag if requested
      const whitespaceFlag = ignoreWhitespace ? ' --ignore-all-space' : ''
      
      // Collect all changed files from two sources:
      // 1. Committed changes: origin/baseBranch...HEAD
      // 2. Working directory changes: HEAD (unstaged + staged)
      
      const fileMap = new Map<string, { status: string, diff: string, source: string }>()
      
      // 1. Get committed changes (branch diff)
      try {
        const branchFilesResult = await execAsync(
          `git diff origin/${baseBranch}...HEAD --name-status${whitespaceFlag}`,
          { cwd: project.worktreePath }
        )
        
        const branchFileLines = branchFilesResult.stdout.trim().split('\n').filter(line => line)
        
        for (const line of branchFileLines) {
          const [status, ...pathParts] = line.split('\t')
          const filePath = pathParts.join('\t')
          
          if (!filePath) continue
          
          // Get the diff for this specific file
          let diff = ''
          try {
            const diffResult = await execAsync(
              `git diff origin/${baseBranch}...HEAD${whitespaceFlag} -- "${filePath}"`,
              { cwd: project.worktreePath }
            )
            diff = diffResult.stdout
          } catch (error) {
            console.error(`Failed to get branch diff for ${filePath}:`, error)
          }
          
          fileMap.set(filePath, { status, diff, source: 'committed' })
        }
        
        console.log(`Found ${branchFileLines.length} committed changes`)
      } catch (error) {
        console.log('No committed changes found')
      }
      
      // 2. Get working directory changes (unstaged + staged)
      try {
        const workingFilesResult = await execAsync(
          `git diff HEAD --name-status${whitespaceFlag}`,
          { cwd: project.worktreePath }
        )
        
        const workingFileLines = workingFilesResult.stdout.trim().split('\n').filter(line => line)
        
        for (const line of workingFileLines) {
          const [status, ...pathParts] = line.split('\t')
          const filePath = pathParts.join('\t')
          
          if (!filePath) continue
          
          // Get the diff for this specific file
          let diff = ''
          try {
            const diffResult = await execAsync(
              `git diff HEAD${whitespaceFlag} -- "${filePath}"`,
              { cwd: project.worktreePath }
            )
            diff = diffResult.stdout
          } catch (error) {
            console.error(`Failed to get working diff for ${filePath}:`, error)
          }
          
          // Working directory changes override committed changes (more current)
          fileMap.set(filePath, { status, diff, source: 'working' })
        }
        
        console.log(`Found ${workingFileLines.length} working directory changes`)
      } catch (error) {
        console.log('No working directory changes found')
      }
      
      // Convert map to array
      const files: any[] = Array.from(fileMap.entries()).map(([path, data]) => ({
        path,
        status: data.status, // M (modified), A (added), D (deleted)
        diff: data.diff,
        source: data.source // 'committed' or 'working'
      }))
      
      console.log(`✅ Found ${files.length} total changed files in ${projectName}`)
      
      return {
        projectName,
        baseBranch,
        files
      }
    } catch (error: any) {
      console.error('Failed to get project diff:', error)
      return null
    }
  })

  // Terminal/PTY handlers
  const terminals = new Map<number, pty.IPty>()

  ipcMain.handle('terminal:create', async (event, { cols, rows, cwd }) => {
    try {
      const fs = require('fs')
      
      // Verify cwd exists
      if (!fs.existsSync(cwd)) {
        console.error(`Working directory does not exist: ${cwd}, using home directory`)
        cwd = os.homedir()
      }
      
      // Use zsh for macOS (default since Catalina), bash for others
      const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh'
      
      console.log(`Creating terminal:`)
      console.log(`  Shell: ${shell}`)
      console.log(`  CWD: ${cwd}`)
      console.log(`  Size: ${cols}x${rows}`)
      
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: cwd,
        env: process.env as any
      })

      const pid = ptyProcess.pid

      terminals.set(pid, ptyProcess)

      // Send data from PTY to renderer
      ptyProcess.onData((data) => {
        event.sender.send('terminal:data', pid, data)
      })

      // Handle PTY exit
      ptyProcess.onExit(({ exitCode }) => {
        event.sender.send('terminal:exit', pid, exitCode)
        terminals.delete(pid)
      })


      return { pid, success: true }
    } catch (error: any) {
      console.error('Failed to create terminal:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('terminal:write', async (_, pid: number, data: string) => {
    try {
      const terminal = terminals.get(pid)
      if (terminal) {
        terminal.write(data)
        return { success: true }
      }
      return { success: false, error: 'Terminal not found' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('terminal:resize', async (_, pid: number, cols: number, rows: number) => {
    try {
      const terminal = terminals.get(pid)
      if (terminal) {
        terminal.resize(cols, rows)
        return { success: true }
      }
      return { success: false, error: 'Terminal not found' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('terminal:kill', async (_, pid: number) => {
    try {
      const terminal = terminals.get(pid)
      if (terminal) {
        terminal.kill()
        terminals.delete(pid)
        return { success: true }
      }
      return { success: false, error: 'Terminal not found' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // System: Auto-launch handlers
  ipcMain.handle('system:setAutoLaunch', async (_, enabled: boolean) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: false
      })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('system:getAutoLaunch', async () => {
    try {
      const settings = app.getLoginItemSettings()
      return { success: true, enabled: settings.openAtLogin }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ==================== STORAGE & SETTINGS ====================
  
  ipcMain.handle('settings:get', async (_, key: string) => {
    try {
      const { storage } = await import('./storage')
      const value = storage.getSetting(key as any)
      return { success: true, value }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('settings:set', async (_, key: string, value: any) => {
    try {
      const { storage } = await import('./storage')
      storage.setSetting(key as any, value)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('settings:getAll', async () => {
    try {
      const { storage } = await import('./storage')
      const settings = storage.getAllSettings()
      return { success: true, settings }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Feature history storage
  ipcMain.handle('features:saveHistory', async (_, feature: any) => {
    try {
      const { storage } = await import('./storage')
      const result = storage.saveFeature(feature)
      return { success: true, id: result.id }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('features:getHistory', async (_, status?: string) => {
    try {
      const { storage } = await import('./storage')
      const features = storage.getAllFeatures(status as any)
      return { success: true, features }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('features:updateStatus', async (_, id: string, status: string) => {
    try {
      const { storage } = await import('./storage')
      storage.updateFeatureStatus(id, status as any)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Activity logging
  ipcMain.handle('activity:log', async (_, activity: any) => {
    try {
      const { storage } = await import('./storage')
      const result = storage.logActivity(activity)
      return { success: true, id: result.id }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('activity:getRecent', async (_, hours: number = 24) => {
    try {
      const { storage } = await import('./storage')
      const activities = storage.getRecentActivity(hours)
      return { success: true, activities }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Statistics
  ipcMain.handle('stats:get', async () => {
    try {
      const { storage } = await import('./storage')
      const stats = storage.getStats()
      return { success: true, stats }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  console.log('✅ IPC handlers registered with real Nexwork CLI')
}
