import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'
import * as pty from 'node-pty'
import { updateTrayMenu } from './tray'
import { notifyFeatureCreated, notifyFeatureCompleted, notifyProjectStatusChanged } from './notifications'
import { promisify } from 'util'
import { exec } from 'child_process'
import { log } from './log'
import {
  validateWorkspacePath,
  sanitizeFeatureName,
  validateBranchName as _validateBranchName,
  isPathInWorkspace as _isPathInWorkspace,
  sanitizeCommand as _sanitizeCommand,
  validateProjectName as _validateProjectName,
  featureOperationLimiter as _featureOperationLimiter,
  gitOperationLimiter as _gitOperationLimiter,
  terminalLimiter as _terminalLimiter,
} from './security'

// Import Nexwork CLI components - using require for CommonJS modules
const { ConfigManager } = require('multi-repo-orchestrator/dist/core/config-manager.js')
const { WorktreeManager } = require('multi-repo-orchestrator/dist/core/worktree-manager.js')
const { TemplateManager } = require('multi-repo-orchestrator/dist/core/template-manager.js')

// Helper for async exec
const execAsync = promisify(exec)

// Global workspace root - empty by default for first-time setup
let currentWorkspaceRoot: string = ''

// Helper to ensure workspace is set before operations that need it
function requireWorkspace(): void {
  if (!currentWorkspaceRoot) {
    throw new Error('No workspace is set. Please select a workspace in Settings first.')
  }
}

// Helper to get ConfigManager instance
function getConfigManager(): InstanceType<typeof ConfigManager> {
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
    const inProgress = features.filter((f: any) => f.projects.some((p: any) => p.status === 'in_progress')).length
    const completed = features.filter((f: any) => f.projects.every((p: any) => p.status === 'completed')).length

    updateTrayMenu(mainWindow, total, inProgress, completed)
  } catch (error) {
    log.error('Failed to update tray:', error)
  }
}

// Helper to sync config worktreePaths with actual git worktrees
async function syncWorktreePaths(featureName: string): Promise<void> {
  log.info('🔄 Syncing worktree paths for feature:', featureName)

  try {
    const configManager = getConfigManager()
    const config = configManager.loadConfig()
    const feature = config.features?.find((f: any) => f.name === featureName)

    if (!feature) {
      log.info('❌ Feature not found:', featureName)
      return
    }

    const projectLocations = config.projectLocations || {}
    let configUpdated = false

    // For each project in the feature
    for (const project of feature.projects) {
      log.info(`  🔍 Checking project: ${project.name}`)
      log.info(`     Current worktreePath: ${project.worktreePath || '(empty)'}`)
      log.info(`     Branch: ${project.branch}`)

      const projectPath = projectLocations[project.name]
      if (!projectPath) {
        log.info(`  ⚠️ No project location for ${project.name}`)
        continue
      }

      // Get the main repo path
      const mainRepoPath = path.join(currentWorkspaceRoot, projectPath)
      log.info(`     Main repo: ${mainRepoPath}`)

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
              log.info(`     ✅ Found matching worktree: ${currentWorktreePath}`)

              // Update if path is different (including empty -> filled)
              if (currentWorktreePath && currentWorktreePath !== project.worktreePath) {
                log.info(
                  `     📝 Updating worktreePath from "${project.worktreePath || '(empty)'}" to "${currentWorktreePath}"`,
                )
                project.worktreePath = currentWorktreePath
                configUpdated = true
              } else if (currentWorktreePath && currentWorktreePath === project.worktreePath) {
                log.info(`     ℹ️ Worktree path already correct`)
              }
            }
          }
        }

        if (!project.worktreePath) {
          log.info(`  ⚠️ No worktree found for ${project.name} on branch ${project.branch}`)
        }
      } catch (error: any) {
        log.error(`  ❌ Error checking worktrees for ${project.name}:`, error.message)
      }
    }

    // Save config if updated
    if (configUpdated) {
      const configPath = path.join(currentWorkspaceRoot, '.multi-repo-config.json')
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
      log.info('✅ Config updated with synced worktree paths')
    } else {
      log.info('✅ No config updates needed')
    }
  } catch (error: any) {
    log.error('❌ Error syncing worktree paths:', error.message)
  }
}

export function registerIpcHandlers() {
  // System
  ipcMain.handle('system:selectFolder', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Workspace Root',
        message: 'Choose the root directory containing your repositories',
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      return result.filePaths[0]
    } catch (error: any) {
      log.error('Failed to open folder dialog:', error)
      throw new Error(`Failed to open folder dialog: ${error.message}`)
    }
  })

  ipcMain.handle('system:openInTerminal', async (_, folderPath: string, terminalApp: string = 'terminal') => {
    try {
      const { exec } = require('child_process')

      // Terminal app configurations: [app name for macOS]
      const terminalConfigs: { [key: string]: { appName: string; command?: string } } = {
        terminal: { appName: 'Terminal' },
        iterm2: { appName: 'iTerm' },
        warp: { appName: 'Warp' },
        alacritty: { appName: 'Alacritty' },
        kitty: { appName: 'kitty' },
        hyper: { appName: 'Hyper' },
      }

      const config = terminalConfigs[terminalApp] || terminalConfigs['terminal']

      log.info(`Opening ${folderPath} in ${config.appName}`)

      return new Promise((resolve) => {
        // macOS: Open Terminal app at specific path
        exec(`open -a "${config.appName}" "${folderPath}"`, (error: any) => {
          if (error) {
            log.error(`Failed to open ${config.appName}:`, error)
            resolve({
              success: false,
              error: `${config.appName} not found. Please ensure the app is installed.`,
            })
          } else {
            resolve({ success: true })
          }
        })
      })
    } catch (error: any) {
      log.error('Failed to open terminal:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('system:openInVSCode', async (_, folderPath: string) => {
    try {
      const { exec } = require('child_process')

      // Try to open in VS Code
      exec(`code "${folderPath}"`, (error: any, _stdout: string, _stderr: string) => {
        if (error) {
          // If 'code' command not found, try opening with system default
          exec(`open -a "Visual Studio Code" "${folderPath}"`, (err2: any) => {
            if (err2) {
              log.error('Failed to open VS Code:', err2)
              throw new Error(
                'VS Code not found. Please install code command: Cmd+Shift+P > "Shell Command: Install code command"',
              )
            }
          })
        }
      })

      return { success: true }
    } catch (error: any) {
      log.error('Failed to open VS Code:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('system:openInIDE', async (_, folderPath: string, ide: string) => {
    try {
      const { exec } = require('child_process')

      // IDE configurations: [command, app name for macOS]
      const ideConfigs: { [key: string]: { command: string; appName: string } } = {
        vscode: { command: 'code', appName: 'Visual Studio Code' },
        cursor: { command: 'cursor', appName: 'Cursor' },
        rider: { command: 'rider', appName: 'Rider' },
        webstorm: { command: 'webstorm', appName: 'WebStorm' },
        intellij: { command: 'idea', appName: 'IntelliJ IDEA' },
        'code-insiders': { command: 'code-insiders', appName: 'Visual Studio Code - Insiders' },
      }

      const config = ideConfigs[ide]
      if (!config) {
        return { success: false, error: `Unknown IDE: ${ide}` }
      }

      log.info(`Opening ${folderPath} in ${config.appName}`)

      return new Promise((resolve) => {
        // Try CLI command first
        exec(`${config.command} "${folderPath}"`, (error: any) => {
          if (error) {
            log.info(`CLI command '${config.command}' failed, trying macOS app launcher...`)
            // If CLI command not found, try macOS app launcher
            exec(`open -a "${config.appName}" "${folderPath}"`, (err2: any) => {
              if (err2) {
                log.error(`Failed to open ${config.appName}:`, err2)
                resolve({
                  success: false,
                  error: `${config.appName} not found. Please install the CLI command or ensure the app is installed.`,
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
      log.error('Failed to open IDE:', error)
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
      const _child = exec(
        command,
        {
          cwd,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          timeout: 300000, // 5 minute timeout (for slow networks)
          shell: '/bin/bash', // Use bash shell
          env, // Use modified environment
        },
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            log.error('Command failed:', error.message)

            // Provide better error messages
            let errorMsg = stderr || error.message

            if (error.killed || error.signal === 'SIGTERM') {
              errorMsg = 'Command timed out (exceeded 5 minutes)'
            } else if (error.code) {
              errorMsg = `Command exited with code ${error.code}\n${stderr || error.message}`
            }

            resolve({
              success: false,
              output: stdout || '',
              error: errorMsg,
            })
          } else {
            resolve({
              success: true,
              output: stdout || 'Command completed successfully (no output)',
              error: null,
            })
          }
        },
      )
    })
  })

  // Features
  ipcMain.handle('features:getAll', async () => {
    try {
      requireWorkspace()
      const configManager = getConfigManager()
      const features = configManager.getAllFeatures()
      updateTrayWithFeatures()
      return features
    } catch (error: any) {
      log.error('Failed to get features:', error)
      return []
    }
  })

  ipcMain.handle('features:getByName', async (_, name: string) => {
    try {
      requireWorkspace()
      const configManager = getConfigManager()
      return configManager.getFeature(name)
    } catch (error: any) {
      log.error('Failed to get feature:', error)
      return null
    }
  })

  ipcMain.handle('features:create', async (_, data: any) => {
    try {
      requireWorkspace()
      log.info('Creating feature with data:', JSON.stringify(data, null, 2))

      // Validate data
      if (!data.name) {
        throw new Error('Feature name is required')
      }
      if (!data.projects || !Array.isArray(data.projects) || data.projects.length === 0) {
        throw new Error('At least one project must be selected')
      }

      // Sanitize feature name for git branch compatibility
      const sanitizedFeatureName = sanitizeFeatureName(data.name)
      log.info('Sanitized feature name:', sanitizedFeatureName)

      // Use sanitized name for branch creation
      data.name = sanitizedFeatureName

      const configManager = getConfigManager()
      const templateManager = new TemplateManager(currentWorkspaceRoot)

      log.info('Creating feature:', data.name)
      log.info('Projects to include:', data.projects)

      // Validate feature name is unique
      const existingFeatures = configManager.getAllFeatures()
      if (existingFeatures.some((f: any) => f.name === data.name)) {
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
          lastUpdated: new Date().toISOString(),
        }
      })

      // Create feature object (no ID, just name)
      const newFeature = {
        name: data.name,
        projects: projectStatuses,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(data.expiresAt && { expiresAt: data.expiresAt }),
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

      log.info('Creating local feature branches...')
      log.info('Project statuses:', JSON.stringify(projectStatuses, null, 2))

      for (const projectStatus of projectStatuses) {
        try {
          const projectConfig = configManager.getConfig().projects.find((p: any) => p.name === projectStatus.name)
          if (!projectConfig) {
            log.info(`⚠ Project config not found for ${projectStatus.name}`)
            continue
          }

          const projectPath = path.join(currentWorkspaceRoot, projectConfig.path)
          const featureBranch = projectStatus.branch
          const baseBranch = projectStatus.baseBranch

          log.info(`[${projectStatus.name}] Project path: ${projectPath}`)
          log.info(`[${projectStatus.name}] Feature branch: ${featureBranch}`)
          log.info(`[${projectStatus.name}] Base branch: ${baseBranch}`)

          // Check if branch already exists
          const checkBranch = await execAsync(`git rev-parse --verify ${featureBranch}`, { cwd: projectPath }).catch(
            () => null,
          )

          if (!checkBranch) {
            // Create local branch from selected base branch
            log.info(`[${projectStatus.name}] Creating ${featureBranch} from ${baseBranch}...`)
            const result = await execAsync(`git branch ${featureBranch} ${baseBranch}`, { cwd: projectPath })
            log.info(`✓ Created ${featureBranch} in ${projectStatus.name}`)
            if (result.stderr) {
              log.info(`[${projectStatus.name}] stderr: ${result.stderr}`)
            }
          } else {
            log.info(`[${projectStatus.name}] Branch ${featureBranch} already exists - skipping`)
          }
        } catch (error: any) {
          log.error(`❌ Failed to create branch for ${projectStatus.name}:`, error.message)
          if (error.stderr) {
            log.error(`[${projectStatus.name}] Git error: ${error.stderr}`)
          }
          // Don't fail the entire feature creation if one branch fails
        }
      }

      updateTrayWithFeatures()
      notifyFeatureCreated(newFeature.name)

      return newFeature
    } catch (error: any) {
      log.error('Failed to create feature:', error)
      throw new Error(`Failed to create feature: ${error.message}`)
    }
  })

  ipcMain.handle('features:update', async (_, id: string, data: any) => {
    try {
      requireWorkspace()
      const configManager = getConfigManager()
      configManager.updateFeature(id, data)
      updateTrayWithFeatures()
      return configManager.getFeature(id)
    } catch (error: any) {
      log.error('Failed to update feature:', error)
      throw new Error(`Failed to update feature: ${error.message}`)
    }
  })

  ipcMain.handle('features:delete', async (_, name: string) => {
    try {
      requireWorkspace()
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
            log.info(`Removing worktree for ${project.name}: ${project.worktreePath}`)
            await worktreeManager.removeWorktree(project.worktreePath)
          }

          // Delete the feature branch
          if (project.branch) {
            log.info(`Deleting branch for ${project.name}: ${project.branch}`)
            await worktreeManager.deleteFeatureBranch(project.branch)
          }
        } catch (error: any) {
          log.error(`Failed to cleanup ${project.name}:`, error.message)
          // Continue with other projects even if one fails
        }
      }

      // Delete feature tracking folder
      try {
        const featureDate = new Date(feature.createdAt).toISOString().split('T')[0]
        const featureFolderName = `${featureDate}-${name.replace(/[^a-zA-Z0-9]/g, '-')}`
        const featureFolder = path.join(currentWorkspaceRoot, 'features', featureFolderName)

        if (fs.existsSync(featureFolder)) {
          log.info(`Deleting feature folder: ${featureFolder}`)
          fs.rmSync(featureFolder, { recursive: true, force: true })
        }
      } catch (error: any) {
        log.error(`Failed to delete feature folder:`, error.message)
      }

      // Finally, remove from config
      configManager.deleteFeature(name)
      updateTrayWithFeatures()

      log.info(`✅ Feature ${name} deleted successfully`)
    } catch (error: any) {
      log.error('Failed to delete feature:', error)
      throw new Error(`Failed to delete feature: ${error.message}`)
    }
  })

  ipcMain.handle('features:complete', async (_, name: string, _cleanup: boolean) => {
    try {
      requireWorkspace()
      const configManager = getConfigManager()
      const feature = configManager.getFeature(name)

      if (feature) {
        // Mark all projects as completed
        feature.projects.forEach((project: any) => {
          configManager.updateProjectStatus(name, project.name, 'completed')
        })

        updateTrayWithFeatures()
        notifyFeatureCompleted(feature.name)
      }
    } catch (error: any) {
      log.error('Failed to complete feature:', error)
      throw new Error(`Failed to complete feature: ${error.message}`)
    }
  })

  // Clean up expired feature (delete worktrees, branches, and folder)
  ipcMain.handle('features:cleanupExpired', async (_, name: string) => {
    try {
      requireWorkspace()
      log.info(`🗑️ Cleaning up expired feature: ${name}`)
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
            log.info(`  📁 Removing worktree for ${project.name}: ${project.worktreePath}`)
            await worktreeManager.removeWorktree(project.worktreePath)
          }

          // Delete the feature branch
          if (project.branch) {
            log.info(`  🌿 Deleting branch for ${project.name}: ${project.branch}`)
            await worktreeManager.deleteFeatureBranch(project.branch)
          }
        } catch (error: any) {
          log.error(`  ❌ Failed to cleanup ${project.name}:`, error.message)
          // Continue with other projects even if one fails
        }
      }

      // Delete feature tracking folder
      try {
        const featureDate = new Date(feature.createdAt).toISOString().split('T')[0]
        const featureFolderName = `${featureDate}-${name.replace(/[^a-zA-Z0-9]/g, '-')}`
        const featureFolder = path.join(currentWorkspaceRoot, 'features', featureFolderName)

        if (fs.existsSync(featureFolder)) {
          log.info(`  🗂️ Deleting feature folder: ${featureFolder}`)
          fs.rmSync(featureFolder, { recursive: true, force: true })
        }
      } catch (error: any) {
        log.error(`  ❌ Failed to delete feature folder:`, error.message)
      }

      // Finally, remove from config
      configManager.deleteFeature(name)
      updateTrayWithFeatures()

      log.info(`✅ Expired feature ${name} cleaned up successfully`)
      return { success: true }
    } catch (error: any) {
      log.error('Failed to cleanup expired feature:', error)
      throw new Error(`Failed to cleanup expired feature: ${error.message}`)
    }
  })

  // Projects
  ipcMain.handle('projects:updateStatus', async (_, featureName: string, projectName: string, status: string) => {
    try {
      requireWorkspace()
      const configManager = getConfigManager()
      configManager.updateProjectStatus(featureName, projectName, status as 'pending' | 'in_progress' | 'completed')

      const feature = configManager.getFeature(featureName)
      if (feature) {
        updateTrayWithFeatures()
        notifyProjectStatusChanged(feature.name, projectName, status)
      }
    } catch (error: any) {
      log.error('Failed to update project status:', error)
      throw new Error(`Failed to update project status: ${error.message}`)
    }
  })

  ipcMain.handle('projects:createWorktree', async (_, featureName: string, projectName: string) => {
    try {
      requireWorkspace()
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
      const updatedProjects = feature.projects.map((p: any) =>
        p.name === projectName ? { ...p, worktreePath: result.path } : p,
      )

      configManager.updateFeature(featureName, { projects: updatedProjects })

      return { success: true, path: result.path, sourceBranch: result.sourceBranch }
    } catch (error: any) {
      log.error('Failed to create worktree:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('projects:removeWorktree', async (_, featureName: string, projectName: string) => {
    try {
      const configManager = getConfigManager()
      const feature = configManager.getFeature(featureName)

      if (!feature) {
        throw new Error(`Feature ${featureName} not found`)
      }

      const project = feature.projects.find((p: any) => p.name === projectName)
      if (!project) {
        throw new Error(`Project ${projectName} not found in feature ${featureName}`)
      }

      if (project.worktreePath && fs.existsSync(project.worktreePath)) {
        const projectPath = configManager.getProjectPath(projectName)
        const worktreeManager = new WorktreeManager(projectPath)
        log.info(`Removing worktree for ${projectName}: ${project.worktreePath}`)
        await worktreeManager.removeWorktree(project.worktreePath)
      }

      // Clear worktree path in config
      const updatedProjects = feature.projects.map((p: any) =>
        p.name === projectName ? { ...p, worktreePath: '' } : p,
      )
      configManager.updateFeature(featureName, { projects: updatedProjects })

      return { success: true }
    } catch (error: any) {
      log.error('Failed to remove worktree:', error)
      throw new Error(`Failed to remove worktree: ${error.message}`)
    }
  })

  // Templates
  ipcMain.handle('templates:getAll', async () => {
    try {
      const templateManager = new TemplateManager(currentWorkspaceRoot)
      return templateManager.getAvailableTemplates()
    } catch (error: any) {
      log.error('Failed to get templates:', error)
      return ['default', 'jira']
    }
  })

  ipcMain.handle('templates:getCustom', async () => {
    try {
      const templateManager = new TemplateManager(currentWorkspaceRoot)
      return templateManager.listCustomTemplates(currentWorkspaceRoot)
    } catch (error: any) {
      log.error('Failed to get custom templates:', error)
      return []
    }
  })

  ipcMain.handle('templates:create', async (_, name: string, content: string) => {
    try {
      const templateManager = new TemplateManager(currentWorkspaceRoot)
      templateManager.createCustomTemplate(currentWorkspaceRoot, name, content)
    } catch (error: any) {
      log.error('Failed to create template:', error)
      throw new Error(`Failed to create template: ${error.message}`)
    }
  })

  ipcMain.handle('templates:delete', async (_, name: string) => {
    try {
      if (!currentWorkspaceRoot) {
        throw new Error('No workspace set')
      }

      const templatePath = path.join(currentWorkspaceRoot, '.nexwork-templates', `${name}.md`)
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template "${name}" not found`)
      }

      fs.unlinkSync(templatePath)
      log.info(`Deleted template: ${name}`)
    } catch (error: any) {
      log.error('Failed to delete template:', error)
      throw new Error(`Failed to delete template: ${error.message}`)
    }
  })

  ipcMain.handle('templates:preview', async (_, _template: string, data: any) => {
    try {
      // Generate preview
      return `# ${data.name}\n\n**ID:** ${data.id}\n\n## Projects\n${data.projects.map((p: any) => `- ${p}`).join('\n')}`
    } catch (error: any) {
      log.error('Failed to preview template:', error)
      return ''
    }
  })

  // Config
  ipcMain.handle('config:load', async () => {
    try {
      // Check if workspace is set
      if (!currentWorkspaceRoot) {
        return {
          workspaceRoot: '',
          projects: [],
          features: [],
          userConfig: {
            defaultTemplate: 'default',
          },
        }
      }

      const configManager = getConfigManager()
      const config = configManager.loadConfig()

      // Convert projectLocations object to projects array for frontend
      const projects = Object.entries(config.projectLocations || {}).map(([name, projectPath]) => ({
        name,
        path: projectPath,
      }))

      return {
        workspaceRoot: currentWorkspaceRoot,
        projects: projects,
        features: config.features || [],
        userConfig: config.userConfig || {
          defaultTemplate: 'default',
        },
      }
    } catch (error: any) {
      log.error('Failed to load config:', error)
      // Return empty config for first-time setup
      return {
        workspaceRoot: currentWorkspaceRoot || '',
        projects: [],
        features: [],
        userConfig: {
          defaultTemplate: 'default',
        },
      }
    }
  })

  ipcMain.handle('config:save', async (_, config: any) => {
    try {
      const configManager = getConfigManager()

      // Check if config exists, if not, initialize it
      const configPath = path.join(currentWorkspaceRoot, '.multi-repo-config.json')
      if (!fs.existsSync(configPath)) {
        log.info('Config not found, initializing...')
        await configManager.initialize()
      }

      // Update user config
      const currentConfig = configManager.loadConfig()
      currentConfig.userConfig = config.userConfig

      // Save to file
      fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8')

      log.info('Config saved successfully')
    } catch (error: any) {
      log.error('Failed to save config:', error)
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
      log.info('Workspace set to:', currentWorkspaceRoot)

      // Save to settings for persistence
      try {
        const { storage } = await import('./storage')
        storage.setSetting('lastWorkspace', workspacePath)
        log.info('💾 Workspace saved to settings')
      } catch (storageError) {
        log.warn('⚠️ Could not save workspace to settings:', storageError)
      }

      // Initialize config for new workspace and discover projects
      try {
        const configManager = getConfigManager()

        // Check if config exists, if not, initialize it
        const configPath = path.join(currentWorkspaceRoot, '.multi-repo-config.json')
        if (!fs.existsSync(configPath)) {
          log.info('Initializing config for new workspace...')
          await configManager.initialize()
        }

        log.info('Projects discovered for workspace:', currentWorkspaceRoot)
      } catch (initError) {
        log.warn('Could not initialize config:', initError)
        // Don't throw - workspace is still set, config can be created later
      }
    } catch (error: any) {
      log.error('Failed to set workspace:', error)
      throw new Error(`Failed to set workspace: ${error.message}`)
    }
  })

  // Stats
  ipcMain.handle('stats:getFeatureStats', async (_, featureName: string) => {
    log.info('⭐ stats:getFeatureStats called for:', featureName)
    try {
      // First, sync worktree paths with actual git worktrees
      await syncWorktreePaths(featureName)

      const configManager = getConfigManager()
      const feature = configManager.getFeature(featureName)

      if (!feature) {
        log.info('❌ Feature not found:', featureName)
        return null
      }

      log.info('✅ Feature found:', feature.name)

      const completed = feature.projects.filter((p: any) => p.status === 'completed').length
      const inProgress = feature.projects.filter((p: any) => p.status === 'in_progress').length
      const pending = feature.projects.filter((p: any) => p.status === 'pending').length

      // Calculate elapsed time
      const created = new Date(feature.createdAt)
      const now = new Date()
      const elapsedMs = now.getTime() - created.getTime()
      const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24))
      const hours = Math.floor((elapsedMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60))
      const elapsed = `${days}d ${hours}h ${minutes}m`

      // Calculate real-time git stats from worktrees
      log.info('🔍 Calculating git stats for feature:', featureName)

      let totalCommits = 0
      let totalFilesChanged = 0
      let totalLinesAdded = 0
      let totalLinesDeleted = 0

      // Store per-project stats
      const projectStats: any = {}

      const fs = require('fs')
      const projectsWithWorktrees = feature.projects.filter((p: any) => p.worktreePath && fs.existsSync(p.worktreePath))

      log.info(`📁 Found ${projectsWithWorktrees.length} projects with worktrees`)
      projectsWithWorktrees.forEach((p: any) => {
        log.info(`  - ${p.name}: ${p.worktreePath}`)
      })

      for (const project of projectsWithWorktrees) {
        log.info(`\n📊 Processing ${project.name}...`)

        // Initialize stats for this project
        projectStats[project.name] = {
          commits: 0,
          filesChanged: 0,
          linesAdded: 0,
          linesDeleted: 0,
          netChange: 0,
          currentBranch: '',
          baseBranch: '',
        }

        try {
          // Get diff stats comparing current branch to base
          // Use the base branch that was stored when the feature was created
          const baseBranch = project.baseBranch || 'staging' // default to staging if not set

          // Get the current branch in worktree
          const branchResult = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: project.worktreePath })
          const currentBranch = branchResult.stdout.trim()
          log.info(`  Current branch: ${currentBranch}`)
          log.info(`  Base branch: origin/${baseBranch}`)

          projectStats[project.name].currentBranch = currentBranch
          projectStats[project.name].baseBranch = baseBranch

          try {
            // Get diff stats including ALL changes:
            // 1. Committed changes: git diff baseBranch...currentBranch --shortstat
            // 2. Working directory changes: git diff HEAD --shortstat

            // First, get committed changes between branches
            const branchDiffCommand = `git diff origin/${baseBranch}...${currentBranch} --shortstat`
            log.info(`  Running (branch diff): ${branchDiffCommand}`)

            const branchDiffResult = await execAsync(branchDiffCommand, { cwd: project.worktreePath })
            const branchDiffStats = branchDiffResult.stdout.trim()
            log.info(`  Branch diff output: "${branchDiffStats}"`)

            // Then, get working directory changes (unstaged + staged)
            const workingDiffCommand = `git diff HEAD --shortstat`
            log.info(`  Running (working dir diff): ${workingDiffCommand}`)

            const workingDiffResult = await execAsync(workingDiffCommand, { cwd: project.worktreePath })
            const workingDiffStats = workingDiffResult.stdout.trim()
            log.info(`  Working dir diff output: "${workingDiffStats}"`)

            // Parse and combine both diffs
            const parseDiff = (diffStats: string) => {
              const filesMatch = diffStats.match(/(\d+) files? changed/)
              const addMatch = diffStats.match(/(\d+) insertions?\(\+\)/)
              const delMatch = diffStats.match(/(\d+) deletions?\(-\)/)

              return {
                files: filesMatch ? parseInt(filesMatch[1]) : 0,
                added: addMatch ? parseInt(addMatch[1]) : 0,
                deleted: delMatch ? parseInt(delMatch[1]) : 0,
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
              log.info(`  ✅ Files changed: ${files}`)
              totalFilesChanged += files
            }
            if (added > 0) {
              log.info(`  ✅ Lines added: ${added}`)
              totalLinesAdded += added
            }
            if (deleted > 0) {
              log.info(`  ✅ Lines deleted: ${deleted}`)
              totalLinesDeleted += deleted
            }

            if (files === 0 && added === 0 && deleted === 0) {
              log.info(`  ⚠️ No changes detected`)
            }
          } catch (error: any) {
            // Branch might not have diverged yet or diff failed
            log.info(`  ❌ Diff failed: ${error.message}`)
          }

          // Count commits on feature branch (commits ahead of base)
          try {
            const commitCommand = `git rev-list --count origin/${baseBranch}..${currentBranch}`
            log.info(`  Running: ${commitCommand}`)

            const commitResult = await execAsync(commitCommand, { cwd: project.worktreePath })
            const commits = parseInt(commitResult.stdout.trim())
            log.info(`  ✅ Commits ahead: ${commits}`)

            // Store per-project commits
            projectStats[project.name].commits = commits
            totalCommits += commits
          } catch (error: any) {
            log.info(`  ❌ Commit count failed: ${error.message}`)
          }
        } catch (error: any) {
          log.error(`❌ Failed to get stats for ${project.name}:`, error.message)
        }
      }

      log.info(`\n📈 Final Stats:`)
      log.info(`  Commits: ${totalCommits}`)
      log.info(`  Files Changed: ${totalFilesChanged}`)
      log.info(`  Lines Added: ${totalLinesAdded}`)
      log.info(`  Lines Deleted: ${totalLinesDeleted}`)
      log.info(`  Net Change: ${totalLinesAdded - totalLinesDeleted}`)

      return {
        timeTracking: {
          created: feature.createdAt,
          started: feature.startedAt,
          completed: feature.completedAt,
          elapsed,
        },
        projectStatus: {
          total: feature.projects.length,
          completed,
          inProgress,
          pending,
          progress: Math.round((completed / feature.projects.length) * 100),
        },
        gitStats: {
          commits: totalCommits,
          filesChanged: totalFilesChanged,
          linesAdded: totalLinesAdded,
          linesDeleted: totalLinesDeleted,
          netChange: totalLinesAdded - totalLinesDeleted,
        },
        projectDetails: await Promise.all(
          feature.projects.map(async (p: any) => {
            const stats = projectStats[p.name] || {
              commits: 0,
              filesChanged: 0,
              linesAdded: 0,
              linesDeleted: 0,
              netChange: 0,
              currentBranch: '',
              baseBranch: p.baseBranch || 'staging',
            }

            // Check if main repo has uncommitted changes
            let mainRepoHasChanges = false
            let mainRepoChangedFiles: string[] = []

            try {
              const projectPath = configManager.getProjectPath(p.name)
              if (fs.existsSync(projectPath)) {
                const mainRepoStatus = await execAsync('git status --short', { cwd: projectPath })
                const changedFiles = mainRepoStatus.stdout
                  .trim()
                  .split('\n')
                  .filter((line) => line)
                mainRepoHasChanges = changedFiles.length > 0
                mainRepoChangedFiles = changedFiles.map((line) => line.substring(3)) // Remove status prefix
              }
            } catch {
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
              mainRepoChangedFiles,
            }
          }),
        ),
      }
    } catch (error: any) {
      log.error('Failed to get feature stats:', error)
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
        linesDeleted: 0,
      }
    } catch (error: any) {
      log.error('Failed to get git stats:', error)
      return {
        commits: 0,
        filesChanged: 0,
        linesAdded: 0,
        linesDeleted: 0,
      }
    }
  })

  // Sync worktree paths with actual git worktrees
  ipcMain.handle('stats:syncWorktrees', async (_, featureName: string) => {
    try {
      log.info('🔄 Manual sync requested for feature:', featureName)
      await syncWorktreePaths(featureName)
      return { success: true }
    } catch (error: any) {
      log.error('Failed to sync worktrees:', error)
      return { success: false, error: error.message }
    }
  })

  // Get detailed file diffs for a project
  ipcMain.handle(
    'stats:getProjectDiff',
    async (_, featureName: string, projectName: string, ignoreWhitespace: boolean = false) => {
      try {
        const wsFlag = ignoreWhitespace ? ' (ignoring whitespace)' : ''
        log.info(`📝 Getting diff for project: ${projectName} in feature: ${featureName}${wsFlag}`)

        const configManager = getConfigManager()
        const feature = configManager.getFeature(featureName)

        if (!feature) {
          log.info('❌ Feature not found:', featureName)
          return null
        }

        const project = feature.projects.find((p: any) => p.name === projectName)
        if (!project || !project.worktreePath) {
          log.info('❌ Project not found or no worktree:', projectName)
          return null
        }

        const fs = require('fs')
        if (!fs.existsSync(project.worktreePath)) {
          log.info('❌ Worktree path does not exist:', project.worktreePath)
          return null
        }

        const baseBranch = project.baseBranch || 'staging'

        // Add whitespace ignore flag if requested
        const whitespaceFlag = ignoreWhitespace ? ' --ignore-all-space' : ''

        // Collect all changed files from two sources:
        // 1. Committed changes: origin/baseBranch...HEAD
        // 2. Working directory changes: HEAD (unstaged + staged)

        const fileMap = new Map<string, { status: string; diff: string; source: string }>()

        // 1. Get committed changes (branch diff)
        try {
          const branchFilesResult = await execAsync(
            `git diff origin/${baseBranch}...HEAD --name-status${whitespaceFlag}`,
            { cwd: project.worktreePath },
          )

          const branchFileLines = branchFilesResult.stdout
            .trim()
            .split('\n')
            .filter((line) => line)

          for (const line of branchFileLines) {
            const [status, ...pathParts] = line.split('\t')
            const filePath = pathParts.join('\t')

            if (!filePath) continue

            // Get the diff for this specific file
            let diff = ''
            try {
              const diffResult = await execAsync(
                `git diff origin/${baseBranch}...HEAD${whitespaceFlag} -- "${filePath}"`,
                { cwd: project.worktreePath },
              )
              diff = diffResult.stdout
            } catch (error) {
              log.error(`Failed to get branch diff for ${filePath}:`, error)
            }

            fileMap.set(filePath, { status, diff, source: 'committed' })
          }

          log.info(`Found ${branchFileLines.length} committed changes`)
        } catch {
          log.info('No committed changes found')
        }

        // 2. Get working directory changes (unstaged + staged)
        try {
          const workingFilesResult = await execAsync(`git diff HEAD --name-status${whitespaceFlag}`, {
            cwd: project.worktreePath,
          })

          const workingFileLines = workingFilesResult.stdout
            .trim()
            .split('\n')
            .filter((line) => line)

          for (const line of workingFileLines) {
            const [status, ...pathParts] = line.split('\t')
            const filePath = pathParts.join('\t')

            if (!filePath) continue

            // Get the diff for this specific file
            let diff = ''
            try {
              const diffResult = await execAsync(`git diff HEAD${whitespaceFlag} -- "${filePath}"`, {
                cwd: project.worktreePath,
              })
              diff = diffResult.stdout
            } catch (error) {
              log.error(`Failed to get working diff for ${filePath}:`, error)
            }

            // Working directory changes override committed changes (more current)
            fileMap.set(filePath, { status, diff, source: 'working' })
          }

          log.info(`Found ${workingFileLines.length} working directory changes`)
        } catch {
          log.info('No working directory changes found')
        }

        // Convert map to array
        const files: any[] = Array.from(fileMap.entries()).map(([path, data]) => ({
          path,
          status: data.status, // M (modified), A (added), D (deleted)
          diff: data.diff,
          source: data.source, // 'committed' or 'working'
        }))

        log.info(`✅ Found ${files.length} total changed files in ${projectName}`)

        return {
          projectName,
          baseBranch,
          files,
        }
      } catch (error: any) {
        log.error('Failed to get project diff:', error)
        return null
      }
    },
  )

  // Get commit history for a project branch
  ipcMain.handle('stats:getProjectCommits', async (_, featureName: string, projectName: string) => {
    try {
      log.info(`📜 Getting commits for project: ${projectName} in feature: ${featureName}`)

      const configManager = getConfigManager()
      const feature = configManager.getFeature(featureName)

      if (!feature) {
        log.info('❌ Feature not found:', featureName)
        return null
      }

      const project = feature.projects.find((p: any) => p.name === projectName)
      if (!project || !project.worktreePath) {
        log.info('❌ Project not found or no worktree:', projectName)
        return null
      }

      const fs = require('fs')
      if (!fs.existsSync(project.worktreePath)) {
        log.info('❌ Worktree path does not exist:', project.worktreePath)
        return null
      }

      const baseBranch = project.baseBranch || 'staging'

      let commits: any[] = []
      try {
        const result = await execAsync(
          `git log origin/${baseBranch}..HEAD --format='%H%x00%h%x00%s%x00%an%x00%aI%x00%P' --reverse`,
          { cwd: project.worktreePath },
        )

        const lines = result.stdout
          .trim()
          .split('\n')
          .filter((line: string) => line)
        commits = lines.map((line: string) => {
          const [fullHash, shortHash, subject, authorName, authorDate, parents] = line.split('\0')
          return {
            fullHash,
            shortHash,
            subject,
            authorName,
            authorDate,
            isMerge: parents ? parents.includes(' ') : false,
          }
        })
      } catch {
        log.info('No commits found (branch may not have diverged yet)')
      }

      log.info(`✅ Found ${commits.length} commits in ${projectName}`)

      return {
        projectName,
        baseBranch,
        commits,
      }
    } catch (error: any) {
      log.error('Failed to get project commits:', error)
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
        log.error(`Working directory does not exist: ${cwd}, using home directory`)
        cwd = os.homedir()
      }

      // Use zsh for macOS (default since Catalina), bash for others
      const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh'

      log.info(`Creating terminal:`)
      log.info(`  Shell: ${shell}`)
      log.info(`  CWD: ${cwd}`)
      log.info(`  Size: ${cols}x${rows}`)

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: cwd,
        env: process.env as any,
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
      log.error('Failed to create terminal:', error)
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
        openAsHidden: false,
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

  // Git conflict detection
  ipcMain.handle('git:getConflictFiles', async (_, workingDir: string) => {
    const { exec } = require('child_process')
    return new Promise((resolve) => {
      exec(
        'git diff --name-only --diff-filter=U',
        { cwd: workingDir, encoding: 'utf-8' },
        (error: any, stdout: string) => {
          if (error && !stdout) {
            resolve({ success: false, files: [] })
          } else {
            const files = stdout.trim().split('\n').filter(Boolean)
            resolve({ success: true, files })
          }
        },
      )
    })
  })

  // Pull Request creation via gh CLI
  ipcMain.handle('pr:checkGhCli', async () => {
    const { exec } = require('child_process')
    return new Promise((resolve) => {
      exec('gh auth status', { encoding: 'utf-8', timeout: 10000 }, (error: any, stdout: string, stderr: string) => {
        if (error) {
          const output = stderr || error.message || ''
          const isInstalled = !output.includes('command not found') && !output.includes('not recognized')
          resolve({ installed: isInstalled, authenticated: false })
        } else {
          resolve({ installed: true, authenticated: true })
        }
      })
    })
  })

  ipcMain.handle(
    'pr:create',
    async (
      _,
      projects: Array<{ projectName: string; workingDir: string; branch: string; baseBranch: string }>,
      options: { title: string; body: string; draft: boolean },
    ) => {
      const { exec } = require('child_process')
      const results: Array<{ projectName: string; prUrl?: string; error?: string }> = []

      for (const project of projects) {
        try {
          // Push first
          const pushResult: any = await new Promise((resolve) => {
            exec(
              `git push -u origin ${project.branch}`,
              {
                cwd: project.workingDir,
                encoding: 'utf-8',
                timeout: 60000,
                env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
              },
              (error: any, stdout: string, stderr: string) => {
                resolve({ success: !error, output: stdout, error: stderr || error?.message })
              },
            )
          })

          if (!pushResult.success && !pushResult.error?.includes('Everything up-to-date')) {
            results.push({ projectName: project.projectName, error: `Push failed: ${pushResult.error}` })
            continue
          }

          // Create PR
          const draftFlag = options.draft ? ' --draft' : ''
          const title = options.title.replace(/"/g, '\\"')
          const body = options.body.replace(/"/g, '\\"')
          const prResult: any = await new Promise((resolve) => {
            exec(
              `gh pr create --base "${project.baseBranch}" --head "${project.branch}" --title "${title}" --body "${body}"${draftFlag}`,
              {
                cwd: project.workingDir,
                encoding: 'utf-8',
                timeout: 30000,
              },
              (error: any, stdout: string, stderr: string) => {
                resolve({ success: !error, output: stdout, error: stderr || error?.message })
              },
            )
          })

          if (prResult.success) {
            const prUrl = prResult.output.trim().split('\n').pop() || ''
            results.push({ projectName: project.projectName, prUrl })
          } else {
            results.push({ projectName: project.projectName, error: prResult.error })
          }
        } catch (error: any) {
          results.push({ projectName: project.projectName, error: error.message })
        }
      }

      return { results }
    },
  )

  // ==================== GIT AUTH HANDLERS ====================

  ipcMain.handle('git:checkAuth', async () => {
    try {
      const { authStore } = await import('./auth-store')
      const { provider, user, avatar } = authStore.get()

      if (!provider || provider === '') {
        return { authenticated: false, provider: '', user: '', avatar: '' }
      }

      if (provider === 'local') {
        return { authenticated: true, provider: 'local', user: 'Local Mode', avatar: '' }
      }

      if (provider === 'github') {
        // Verify token is still valid
        try {
          await execAsync('gh auth status 2>&1', { timeout: 10000 })
          return { authenticated: true, provider: 'github', user, avatar }
        } catch {
          // Token expired or invalid — clear stored auth
          authStore.clear()
          return { authenticated: false, provider: '', user: '', avatar: '' }
        }
      }

      if (provider === 'gitlab') {
        return { authenticated: true, provider: 'gitlab', user, avatar }
      }

      return { authenticated: false, provider: '', user: '', avatar: '' }
    } catch (error: any) {
      log.error('git:checkAuth error:', error)
      return { authenticated: false, provider: '', user: '', avatar: '' }
    }
  })

  ipcMain.handle('git:githubLogin', async (event) => {
    const { authStore } = await import('./auth-store')

    // First check if already authenticated
    try {
      await execAsync('gh auth status', { timeout: 10000 })
      // Already authenticated — just grab user info
      try {
        const { stdout: userOut } = await execAsync('gh api user --jq ".login"', { timeout: 10000 })
        const { stdout: avatarOut } = await execAsync('gh api user --jq ".avatar_url"', { timeout: 10000 })
        const user = userOut.trim()
        const avatar = avatarOut.trim()
        authStore.set({ provider: 'github', user, avatar })
        return { success: true, user, avatar }
      } catch {
        authStore.set({ provider: 'github', user: 'GitHub User', avatar: '' })
        return { success: true, user: 'GitHub User', avatar: '' }
      }
    } catch {
      // Not authenticated — proceed with login flow
    }

    // Check if gh is installed
    try {
      await execAsync('which gh', { timeout: 5000 })
    } catch {
      return { success: false, error: 'GitHub CLI (gh) is not installed. Install it from https://cli.github.com' }
    }

    const { spawn } = require('child_process')

    return new Promise((resolve) => {
      const child = spawn('gh', ['auth', 'login', '--web', '-p', 'https', '-h', 'github.com'], {
        env: { ...process.env },
      })

      let output = ''
      let resolved = false

      const handleData = (data: Buffer) => {
        const text = data.toString()
        output += text

        // Extract and send one-time code to renderer
        const codeMatch = text.match(/one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i)
        if (codeMatch) {
          event.sender.send('git:authCode', codeMatch[1])
        }

        // Auto-press Enter when prompted to open browser
        if (text.includes('Press Enter') || text.includes('press Enter')) {
          child.stdin.write('\n')
        }
      }

      child.stdout.on('data', handleData)
      child.stderr.on('data', handleData)

      child.on('close', async (exitCode: number) => {
        if (resolved) return
        resolved = true

        if (exitCode === 0) {
          try {
            const { stdout: userOut } = await execAsync('gh api user --jq ".login"', { timeout: 10000 })
            const { stdout: avatarOut } = await execAsync('gh api user --jq ".avatar_url"', { timeout: 10000 })
            const user = userOut.trim()
            const avatar = avatarOut.trim()
            authStore.set({ provider: 'github', user, avatar })
            resolve({ success: true, user, avatar })
          } catch {
            authStore.set({ provider: 'github', user: 'GitHub User', avatar: '' })
            resolve({ success: true, user: 'GitHub User', avatar: '' })
          }
        } else {
          resolve({ success: false, error: 'Authentication failed or was cancelled' })
        }
      })

      child.on('error', (err: Error) => {
        if (resolved) return
        resolved = true
        resolve({ success: false, error: err.message })
      })

      // Timeout after 5 minutes
      setTimeout(() => {
        if (resolved) return
        resolved = true
        child.kill()
        resolve({ success: false, error: 'Authentication timed out' })
      }, 300000)
    })
  })

  ipcMain.handle('git:gitlabLogin', async (event) => {
    const { authStore } = await import('./auth-store')

    // First check if already authenticated via glab
    try {
      await execAsync('glab auth status', { timeout: 10000 })
      // Already authenticated — grab user info
      try {
        const { stdout: userOut } = await execAsync('glab api user --jq ".username"', { timeout: 10000 })
        const { stdout: avatarOut } = await execAsync('glab api user --jq ".avatar_url"', { timeout: 10000 })
        const user = userOut.trim()
        const avatar = avatarOut.trim()
        authStore.set({ provider: 'gitlab', user, avatar })
        return { success: true, user, avatar }
      } catch {
        // glab api may not support --jq, try raw
        try {
          const { stdout: rawOut } = await execAsync('glab api user', { timeout: 10000 })
          const data = JSON.parse(rawOut)
          const user = data.username || 'GitLab User'
          const avatar = data.avatar_url || ''
          authStore.set({ provider: 'gitlab', user, avatar })
          return { success: true, user, avatar }
        } catch {
          authStore.set({ provider: 'gitlab', user: 'GitLab User', avatar: '' })
          return { success: true, user: 'GitLab User', avatar: '' }
        }
      }
    } catch {
      // Not authenticated — proceed with login flow
    }

    // Check if glab is installed
    try {
      await execAsync('which glab', { timeout: 5000 })
    } catch {
      return { success: false, error: 'not_installed' }
    }

    const { spawn } = require('child_process')

    return new Promise((resolve) => {
      const child = spawn('glab', ['auth', 'login', '--web', '-h', 'gitlab.com'], {
        env: { ...process.env },
      })

      let output = ''
      let resolved = false

      const handleData = (data: Buffer) => {
        const text = data.toString()
        output += text

        // Extract and send one-time code to renderer
        const codeMatch =
          text.match(/one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i) || text.match(/code:\s*([A-Z0-9_-]{6,})/i)
        if (codeMatch) {
          event.sender.send('git:authCode', codeMatch[1])
        }

        // Auto-press Enter when prompted to open browser
        if (text.includes('Press Enter') || text.includes('press Enter')) {
          child.stdin.write('\n')
        }
      }

      child.stdout.on('data', handleData)
      child.stderr.on('data', handleData)

      child.on('close', async (exitCode: number) => {
        if (resolved) return
        resolved = true

        if (exitCode === 0) {
          try {
            const { stdout: rawOut } = await execAsync('glab api user', { timeout: 10000 })
            const data = JSON.parse(rawOut)
            const user = data.username || 'GitLab User'
            const avatar = data.avatar_url || ''
            authStore.set({ provider: 'gitlab', user, avatar })
            resolve({ success: true, user, avatar })
          } catch {
            authStore.set({ provider: 'gitlab', user: 'GitLab User', avatar: '' })
            resolve({ success: true, user: 'GitLab User', avatar: '' })
          }
        } else {
          resolve({ success: false, error: 'Authentication failed or was cancelled' })
        }
      })

      child.on('error', (err: Error) => {
        if (resolved) return
        resolved = true
        resolve({ success: false, error: err.message })
      })

      setTimeout(() => {
        if (resolved) return
        resolved = true
        child.kill()
        resolve({ success: false, error: 'Authentication timed out' })
      }, 300000)
    })
  })

  ipcMain.handle('git:logout', async () => {
    try {
      const { authStore } = await import('./auth-store')
      authStore.clear()
      return { success: true }
    } catch (error: any) {
      log.error('git:logout error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('git:saveAuth', async (_, data: { provider: string; user: string; avatar: string }) => {
    try {
      const { authStore } = await import('./auth-store')
      authStore.set(data)
      return { success: true }
    } catch (error: any) {
      log.error('git:saveAuth error:', error)
      return { success: false, error: error.message }
    }
  })

  log.info('✅ IPC handlers registered with real Nexwork CLI')
}

// Export for use in other modules
export { currentWorkspaceRoot }

// Helper function to set workspace on app startup (restores from settings)
export async function setWorkspaceOnStartup(workspacePath: string): Promise<void> {
  try {
    // Security: Validate workspace path
    if (!validateWorkspacePath(workspacePath)) {
      log.warn('⚠️ Invalid workspace path in settings:', workspacePath)
      return
    }

    currentWorkspaceRoot = workspacePath
    log.info('✅ Workspace restored on startup:', currentWorkspaceRoot)

    // Initialize config for the workspace
    try {
      const configManager = getConfigManager()

      // Check if config exists, if not initialize it
      const configPath = path.join(currentWorkspaceRoot, '.multi-repo-config.json')
      if (!fs.existsSync(configPath)) {
        log.info('📝 Initializing config for restored workspace...')
        await configManager.initialize()
      }

      log.info('✅ Projects loaded for workspace:', currentWorkspaceRoot)
    } catch (initError) {
      log.warn('⚠️ Could not initialize config on startup:', initError)
    }
  } catch (error: any) {
    log.error('❌ Failed to set workspace on startup:', error)
  }
}
