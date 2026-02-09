import { useState, useEffect } from 'react'
import { Card, Typography, Space, Button, Tag, Progress, Statistic, Row, Col, List, Badge, Divider, message, Modal, Input, Select, Alert, Spin, Tooltip, DatePicker, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import dayjs from 'dayjs'
import {
  ArrowLeft,
  GitBranch,
  Clock,
  CheckCircle2,
  Activity,
  FileCode,
  TrendingUp,
  Play,
  Trash2,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  GitPullRequest,
  GitCommit,
  GitMerge,
  Terminal,
  Code,
  FolderOpen,
  FolderPlus,
  AlertCircle,
  X,
  Calendar
} from 'lucide-react'
import type { Feature, FeatureStats } from '../types'
import { IntegratedTerminal } from '../components/IntegratedTerminal'
import ChangesViewer from '../components/ChangesViewer'

const { Title, Text } = Typography

interface FeatureDetailsProps {
  featureName: string
  onBack: () => void
}

export function FeatureDetails({ featureName, onBack }: FeatureDetailsProps) {
  const [feature, setFeature] = useState<Feature | null>(null)
  const [stats, setStats] = useState<FeatureStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [commandModalOpen, setCommandModalOpen] = useState(false)
  const [command, setCommand] = useState('')
  const [commandRunning, setCommandRunning] = useState(false)
  const [commandOutput, setCommandOutput] = useState<string>('')
  const [commandError, setCommandError] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('workspace')
  const [gitOperations, setGitOperations] = useState<{[key: string]: {pulling: boolean, pushing: boolean, fetching: boolean}}>({})
  const [gitStatuses, setGitStatuses] = useState<{[key: string]: {ahead: number, behind: number, branch: string, isLocalOnly?: boolean}}>({})
  const [gitModalOpen, setGitModalOpen] = useState(false)
  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [selectedProjectsForCommit, setSelectedProjectsForCommit] = useState<string[]>([])
  const [selectedProjectsForMerge, setSelectedProjectsForMerge] = useState<string[]>([])
  const [worktreeInfo, setWorktreeInfo] = useState<{[key: string]: string | null}>({})
  const [workspaceRoot, setWorkspaceRoot] = useState<string>('')
  const [featureFolderPath, setFeatureFolderPath] = useState<string>('')
  const [projectWorktreeStatus, setProjectWorktreeStatus] = useState<{[key: string]: {exists: boolean, baseBranch: string}}>({})
  const [creatingWorktrees, setCreatingWorktrees] = useState<{[key: string]: boolean}>({})
  const [localFeatureBranches, setLocalFeatureBranches] = useState<{[key: string]: boolean}>({})
  const [preferredIDE, setPreferredIDE] = useState<string>(() => {
    // Load from localStorage or default to VS Code
    return localStorage.getItem('preferredIDE') || 'vscode'
  })
  
  const [projectIDEPreferences, setProjectIDEPreferences] = useState<{[key: string]: string}>(() => {
    // Load per-project IDE preferences from localStorage
    const saved = localStorage.getItem('projectIDEPreferences')
    return saved ? JSON.parse(saved) : {}
  })

  const [projectTerminalPreferences, setProjectTerminalPreferences] = useState<{[key: string]: 'external' | 'integrated'}>(() => {
    // Load per-project terminal preferences from localStorage
    const saved = localStorage.getItem('projectTerminalPreferences')
    return saved ? JSON.parse(saved) : {}
  })

  const [projectTerminalAppPreferences, setProjectTerminalAppPreferences] = useState<{[key: string]: string}>(() => {
    // Load per-project terminal app preferences (warp, iterm2, etc.)
    const saved = localStorage.getItem('projectTerminalAppPreferences')
    return saved ? JSON.parse(saved) : {}
  })

  useEffect(() => {
    // Initial load with loading spinner
    loadFeatureDetails(false)
    checkFeatureWorkspace()
    
    // Auto-reload stats and workspace status every 5 seconds (silently, no spinner)
    const interval = setInterval(() => {
      loadFeatureDetails(true)  // true = silent reload
      checkFeatureWorkspace()
    }, 5000)
    
    // Cleanup interval when component unmounts or feature changes
    return () => clearInterval(interval)
  }, [featureName])

  // Auto-load current branches when Git Sync modal opens
  // And keep syncing every 3 seconds while modal is open
  useEffect(() => {
    if (gitModalOpen && feature) {
      // Load immediately when modal opens
      loadCurrentBranches()
      
      // Then poll every 3 seconds while modal is open
      const interval = setInterval(() => {
        loadCurrentBranches()
      }, 3000)
      
      // Cleanup interval when modal closes
      return () => clearInterval(interval)
    }
  }, [gitModalOpen, feature])

  const loadFeatureDetails = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
      }
      
      // First, get stats (which triggers worktree sync)
      const statsData = await window.nexworkAPI.stats.getFeatureStats(featureName)
      
      // Then get feature data (now with synced worktree paths) and config in parallel
      const [featureData, config] = await Promise.all([
        window.nexworkAPI.features.getByName(featureName),
        window.nexworkAPI.config.load()
      ])
      
      
      setFeature(featureData)
      setStats(statsData)
      setWorkspaceRoot(config.workspaceRoot)
      
      // Initialize worktreeInfo from feature data
      if (featureData?.projects) {
        const newWorktreeInfo: {[key: string]: string | null} = {}
        featureData.projects.forEach((p: any) => {
          if (p.worktreePath) {
            newWorktreeInfo[p.name] = p.worktreePath
          }
        })
        setWorktreeInfo(newWorktreeInfo)
      }
    } catch (error) {
      console.error('Failed to load feature details:', error)
      if (!silent) {
        message.error('Failed to load feature details')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  const loadCurrentBranches = async () => {
    if (!feature) return
    
    try {
      const config = await window.nexworkAPI.config.load()
      
      // Load current branch for each project in parallel (fast, local operation)
      const branchPromises = feature.projects.map(async (project) => {
        try {
          const projectConfig = config.projects.find((p: any) => p.name === project.name)
          if (!projectConfig) return { name: project.name, branch: 'unknown', featureBranchExists: false }
          
          const mainRepoPath = `${config.workspaceRoot}/${projectConfig.path}`
          
          // Determine working directory - worktree or main repo
          let workingDir: string
          if (project.worktreePath && worktreeInfo[project.name]) {
            workingDir = worktreeInfo[project.name]!
          } else if (project.worktreePath) {
            workingDir = project.worktreePath
          } else {
            workingDir = mainRepoPath
          }
          
          // Get current branch (fast, local operation)
          const branchResult = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', workingDir)
          const branch = branchResult.success ? branchResult.output.trim() : 'unknown'
          
          // Check if local feature branch exists (in main repo)
          const featureBranchCheck = await window.nexworkAPI.runCommand(
            `git rev-parse --verify ${project.branch}`,
            mainRepoPath
          )
          const featureBranchExists = featureBranchCheck.success
          
          return { name: project.name, branch, featureBranchExists }
        } catch (error) {
          console.error(`Failed to get branch for ${project.name}:`, error)
          return { name: project.name, branch: 'unknown', featureBranchExists: false }
        }
      })
      
      const results = await Promise.all(branchPromises)
      
      // Update gitStatuses with current branches (keep existing ahead/behind if available)
      const newStatuses: {[key: string]: {ahead: number, behind: number, branch: string}} = {}
      const featureBranches: {[key: string]: boolean} = {}
      
      results.forEach(({ name, branch, featureBranchExists }) => {
        const existing = gitStatuses[name]
        newStatuses[name] = {
          ahead: existing?.ahead ?? 0,
          behind: existing?.behind ?? 0,
          branch
        }
        featureBranches[name] = featureBranchExists
      })
      
      setGitStatuses(newStatuses)
      setLocalFeatureBranches(featureBranches)
    } catch (error) {
      console.error('Failed to load current branches:', error)
    }
  }

  const checkFeatureWorkspace = async () => {
    try {
      const [featureData, config] = await Promise.all([
        window.nexworkAPI.features.getByName(featureName),
        window.nexworkAPI.config.load()
      ])

      // Check if features folder exists
      const featureFolderName = featureData.name.replace(/_/g, '-')
      const featureFolderPattern = `${config.workspaceRoot}/features/*${featureFolderName}*`
      
      const folderResult = await window.nexworkAPI.runCommand(
        `ls -d ${featureFolderPattern} 2>/dev/null || echo ""`,
        config.workspaceRoot
      )

      if (folderResult.success && folderResult.output.trim()) {
        const detectedPath = folderResult.output.trim().split('\n')[0]
        setFeatureFolderPath(detectedPath)

        // Check which projects have worktrees in the feature folder
        const status: {[key: string]: {exists: boolean, baseBranch: string}} = {}
        
        for (const project of featureData.projects) {
          const projectPath = `${detectedPath}/${project.name}`
          const checkResult = await window.nexworkAPI.runCommand(
            `test -d "${projectPath}" && echo "exists" || echo "missing"`,
            config.workspaceRoot
          )
          
          const exists = checkResult.output.trim() === 'exists'
          let baseBranch = 'unknown'
          
          if (exists) {
            // Get the merge-base to find what branch this was created from
            const projectConfig = config.projects.find((p: any) => p.name === project.name)
            if (projectConfig) {
              const mainRepoPath = `${config.workspaceRoot}/${projectConfig.path}`
              
              // Check which main branches exist
              const branchesResult = await window.nexworkAPI.runCommand(
                `git branch -r | grep -E 'origin/(production|staging|demo|master|main)' | sed 's/origin\\///' | tr -d ' '`,
                mainRepoPath
              )
              
              if (branchesResult.success && branchesResult.output.trim()) {
                const branches = branchesResult.output.trim().split('\n')
                
                // Find which branch contains the base commit
                for (const branch of branches) {
                  const mergeBaseResult = await window.nexworkAPI.runCommand(
                    `cd "${projectPath}" && git merge-base HEAD origin/${branch} 2>/dev/null || echo ""`,
                    config.workspaceRoot
                  )
                  
                  const headResult = await window.nexworkAPI.runCommand(
                    `cd "${projectPath}" && git rev-parse HEAD`,
                    config.workspaceRoot
                  )
                  
                  if (mergeBaseResult.success && headResult.success) {
                    const mergeBase = mergeBaseResult.output.trim()
                    const head = headResult.output.trim()
                    
                    // If merge-base equals HEAD, this worktree was created from this branch
                    if (mergeBase === head) {
                      baseBranch = branch
                      break
                    }
                  }
                }
              }
            }
          }
          
          status[project.name] = { exists, baseBranch }
        }
        
        setProjectWorktreeStatus(status)
      } else {
        setFeatureFolderPath('')
        setProjectWorktreeStatus({})
      }
    } catch (error) {
      console.error('Failed to check feature workspace:', error)
    }
  }

  const handleUpdateStatus = async (projectName: string, newStatus: string) => {
    try {
      await window.nexworkAPI.projects.updateStatus(featureName, projectName, newStatus)
      message.success(`Updated ${projectName} status to ${newStatus}`)
      loadFeatureDetails()
    } catch (error) {
      console.error('Failed to update status:', error)
      message.error('Failed to update status')
    }
  }

  const handleComplete = async () => {
    if (!feature) return
    
    const worktreeCount = feature.projects.filter(p => p.worktreePath).length
    const inProgressCount = feature.projects.filter(p => p.status === 'in_progress').length
    const completedCount = feature.projects.filter(p => p.status === 'completed').length
    
    Modal.confirm({
      title: 'Complete Feature?',
      content: (
        <Space direction="vertical">
          <Text>This will mark the following as completed:</Text>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Feature: <strong>{feature.name}</strong></li>
            <li><strong>{feature.projects.length}</strong> project(s): {feature.projects.map(p => p.name).join(', ')}</li>
            <li>All project statuses will be set to <strong>"Completed"</strong></li>
            {worktreeCount > 0 && <li><strong>{worktreeCount}</strong> worktree folder(s) will remain (you can delete them later)</li>}
          </ul>
          {inProgressCount > 0 && (
            <Alert
              message={`${inProgressCount} project(s) are still in progress`}
              description="Are you sure you want to mark them as completed?"
              type="warning"
              showIcon
              style={{ marginTop: 8 }}
            />
          )}
          {completedCount === feature.projects.length && (
            <Text type="success">✓ All projects are already marked as completed</Text>
          )}
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            ℹ️ You can still access this feature later. This just marks it as finished.
          </Text>
        </Space>
      ),
      okText: 'Complete Feature',
      okType: 'primary',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          message.loading({ content: 'Completing feature...', key: 'complete-feature', duration: 0 })
          await window.nexworkAPI.features.complete(featureName, true)
          message.success({ 
            content: 'Feature completed successfully!', 
            key: 'complete-feature',
            duration: 3
          })
          onBack()
        } catch (error: any) {
          console.error('Failed to complete feature:', error)
          message.error({ 
            content: `Failed to complete feature: ${error.message}`, 
            key: 'complete-feature',
            duration: 5
          })
        }
      }
    })
  }

  const handleDelete = async () => {
    if (!feature) return
    
    const worktreeCount = feature.projects.filter(p => p.worktreePath).length
    
    Modal.confirm({
      title: 'Delete Feature?',
      content: (
        <Space direction="vertical">
          <Text>This will permanently delete:</Text>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Feature configuration: <strong>{feature.name}</strong></li>
            {worktreeCount > 0 && <li><strong>{worktreeCount}</strong> worktree folder(s)</li>}
            <li>Git branches: <strong>{feature.projects[0]?.branch}</strong> from {feature.projects.length} project(s)</li>
            <li>Feature tracking folder and all files</li>
          </ul>
          <Text type="danger">⚠️ This action cannot be undone!</Text>
        </Space>
      ),
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          message.loading({ content: 'Deleting feature...', key: 'delete-feature', duration: 0 })
          await window.nexworkAPI.features.delete(featureName)
          message.success({ content: 'Feature deleted successfully!', key: 'delete-feature', duration: 3 })
          onBack()
        } catch (error: any) {
          console.error('Failed to delete feature:', error)
          message.error({ content: `Failed to delete feature: ${error.message}`, key: 'delete-feature', duration: 5 })
        }
      }
    })
  }

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      await loadFeatureDetails()
      message.success('Feature details refreshed!')
    } catch (error) {
      console.error('Failed to refresh:', error)
      message.error('Failed to refresh feature details')
    } finally {
      setRefreshing(false)
    }
  }

  const handleSyncWorktrees = async () => {
    try {
      message.loading({ content: 'Syncing worktree paths...', key: 'sync' })
      
      await window.nexworkAPI.stats.syncWorktrees(featureName)
      
      // Reload feature details to show updated paths
      await loadFeatureDetails()
      
      message.success({ content: 'Worktree paths synced successfully!', key: 'sync', duration: 3 })
    } catch (error) {
      console.error('Failed to sync worktrees:', error)
      message.error({ content: 'Failed to sync worktree paths', key: 'sync', duration: 3 })
    }
  }

  const handleCleanupExpired = () => {
    if (!feature) return
    
    Modal.confirm({
      title: '🗑️ Clean Up Expired Feature',
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>This will permanently delete:</Text>
          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
            <li>All worktrees for this feature</li>
            <li>Feature branches in all projects</li>
            <li>Feature tracking folder</li>
            <li>Feature from the config</li>
          </ul>
          <Text type="danger" strong>⚠️ This action cannot be undone!</Text>
          <Text type="secondary">Are you sure you want to proceed?</Text>
        </Space>
      ),
      okText: 'Yes, Clean Up',
      cancelText: 'Cancel',
      okType: 'danger',
      onOk: async () => {
        try {
          message.loading({ content: 'Cleaning up expired feature...', key: 'cleanup' })
          
          await window.nexworkAPI.features.cleanupExpired(featureName)
          
          message.success({ content: 'Feature cleaned up successfully!', key: 'cleanup', duration: 3 })
          
          // Navigate back to dashboard
          setTimeout(() => {
            onBack()
          }, 500)
        } catch (error: any) {
          console.error('Failed to cleanup expired feature:', error)
          message.error({ content: `Failed to cleanup: ${error.message}`, key: 'cleanup', duration: 5 })
          return Promise.reject()
        }
      }
    })
  }

  const handleExtendExpiration = () => {
    if (!feature) return
    
    let newExpirationDate: any = null
    
    Modal.confirm({
      title: 'Extend Expiration Date',
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Select a new expiration date for this feature:</Text>
          <DatePicker
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
            placeholder="Select new expiration date"
            showToday
            defaultValue={feature.expiresAt ? dayjs(feature.expiresAt) : undefined}
            disabledDate={(current) => {
              // Don't allow dates in the past
              return current && current.valueOf() < dayjs().valueOf()
            }}
            onChange={(date) => {
              newExpirationDate = date
            }}
          />
          {feature.expiresAt && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Current expiration: {new Date(feature.expiresAt).toLocaleDateString()}
            </Text>
          )}
        </Space>
      ),
      okText: 'Update',
      cancelText: 'Cancel',
      onOk: async () => {
        if (!newExpirationDate) {
          message.warning('Please select a new expiration date')
          return Promise.reject()
        }
        
        try {
          const expiresAt = newExpirationDate.toISOString()
          await window.nexworkAPI.features.update(featureName, { expiresAt })
          message.success('Expiration date updated successfully!')
          await loadFeatureDetails(true)
        } catch (error: any) {
          console.error('Failed to update expiration:', error)
          message.error(`Failed to update expiration: ${error.message}`)
          return Promise.reject()
        }
      }
    })
  }

  const handleCreateWorktree = async (projectName: string) => {
    try {
      setCreatingWorktrees(prev => ({ ...prev, [projectName]: true }))
      
      const featureProject = feature?.projects.find(p => p.name === projectName)
      if (!featureProject) {
        throw new Error(`Project ${projectName} not found in feature`)
      }
      
      const config = await window.nexworkAPI.config.load()
      const project = config.projects.find((p: any) => p.name === projectName)
      if (!project) {
        throw new Error(`Project ${projectName} not found in config`)
      }
      
      const projectPath = `${config.workspaceRoot}/${project.path}`
      
      // Check current branch of main repo
      const branchResult = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', projectPath)
      const currentBranch = branchResult.success ? branchResult.output.trim() : ''
      
      // Always keep main repo on base branches, never on feature branches!
      const baseBranch = featureProject.baseBranch || 'staging'
      const mainBranches = ['production', 'staging', 'demo', 'master', 'main', 'develop']
      
      // If main repo is on a feature branch, switch it back to base branch first
      if (!mainBranches.includes(currentBranch)) {
        message.loading({ content: `${projectName}: Switching main repo back to ${baseBranch}...`, key: `worktree-${projectName}`, duration: 0 })
        
        // Check if the feature branch is locked by a worktree
        const worktreeListResult = await window.nexworkAPI.runCommand('git worktree list', projectPath)
        const isLockedByWorktree = worktreeListResult.success && worktreeListResult.output.includes(currentBranch)
        
        if (isLockedByWorktree) {
          // Branch is in a worktree, safe to switch main repo
          const switchResult = await window.nexworkAPI.runCommand(`git checkout ${baseBranch}`, projectPath)
          if (!switchResult.success) {
            throw new Error(`Failed to switch to ${baseBranch}: ${switchResult.error}`)
          }
        } else {
          // Branch is checked out in main repo, switch to base branch
          const switchResult = await window.nexworkAPI.runCommand(`git checkout ${baseBranch}`, projectPath)
          if (!switchResult.success) {
            throw new Error(`Failed to switch to ${baseBranch}: ${switchResult.error}`)
          }
        }
      }
      
      message.loading({ content: `Creating worktree for ${projectName}...`, key: `worktree-${projectName}`, duration: 0 })
      
      const result = await window.nexworkAPI.projects.createWorktree(featureName, projectName)
      
      if (result.success) {
        // Update local state immediately to show worktree path without full reload
        if (feature) {
          const updatedProjects = feature.projects.map(p =>
            p.name === projectName ? { ...p, worktreePath: result.path } : p
          )
          setFeature({ ...feature, projects: updatedProjects })
          setWorktreeInfo(prev => ({ ...prev, [projectName]: result.path }))
        }
        
        message.success({ 
          content: `${projectName}: Worktree created! Branch is local only - Push when ready.`,
          key: `worktree-${projectName}`,
          duration: 3
        })
        
        // Refresh git status to show the new local branch
        fetchGitStatus(projectName)
        
        // Silently update workspace info in background without showing loading
        checkFeatureWorkspace()
      } else {
        throw new Error(result.error || 'Failed to create worktree')
      }
    } catch (error: any) {
      console.error('Failed to create worktree:', error)
      message.error({ 
        content: `Failed to create worktree: ${error.message}`,
        key: `worktree-${projectName}`,
        duration: 5
      })
    } finally {
      setCreatingWorktrees(prev => ({ ...prev, [projectName]: false }))
    }
  }

  const handleRunCommand = () => {
    setCommandModalOpen(true)
    setCommand('')
    setCommandOutput('')
    setCommandError(null)
    setSelectedProject('workspace')
  }

  const handleExecuteCommand = async () => {
    if (!command.trim()) {
      message.warning('Please enter a command')
      return
    }

    try {
      setCommandRunning(true)
      setCommandOutput('')
      setCommandError(null)

      // Determine working directory
      let workingDir: string | undefined
      if (selectedProject !== 'workspace') {
        // Check if this project has a worktree for the feature
        // Priority: 1. worktreeInfo (already discovered), 2. feature.projects[].worktreePath (from config)
        const featureProject = feature?.projects.find(p => p.name === selectedProject)
        
        if (worktreeInfo[selectedProject]) {
          // Use worktree from discovered info
          workingDir = worktreeInfo[selectedProject]!
        } else if (featureProject?.worktreePath) {
          // Use worktree from feature config
          workingDir = featureProject.worktreePath
          // Also update cache
          setWorktreeInfo(prev => ({ ...prev, [selectedProject]: featureProject.worktreePath }))
        } else {
          // No worktree, use main repo
          const config = await window.nexworkAPI.config.load()
          const project = config.projects.find((p: any) => p.name === selectedProject)
          if (project) {
            workingDir = `${config.workspaceRoot}/${project.path}`
          }
        }
      }


      const result = await window.nexworkAPI.runCommand(command, workingDir)

      if (result.success) {
        setCommandOutput(result.output || 'Command completed successfully (no output)')
        message.success('Command executed successfully')
      } else {
        setCommandError(result.error || 'Command failed')
        setCommandOutput(result.output)
        message.error('Command failed')
      }
    } catch (error: any) {
      console.error('Failed to run command:', error)
      setCommandError(error.message || 'Failed to execute command')
      message.error('Failed to run command')
    } finally {
      setCommandRunning(false)
    }
  }

  const commonCommands = [
    { label: 'Git Status', value: 'git status', safe: true },
    { label: 'Git Pull', value: 'git pull --no-rebase --no-edit', safe: false },
    { label: 'Git Push', value: 'git push', safe: false },
    { label: 'Git Fetch', value: 'git fetch --prune', safe: true },
    { label: 'Git Log (5 commits)', value: 'git log -5 --oneline', safe: true },
    { label: 'Git Diff', value: 'git diff', safe: true },
    { label: 'Git Branch', value: 'git branch -a', safe: true },
    { label: 'Git Remote', value: 'git remote -v', safe: true },
    { label: 'List Files', value: 'ls -la', safe: true },
    { label: 'Show Path', value: 'pwd', safe: true },
  ]

  const isLongRunningCommand = (cmd: string) => {
    const longRunning = ['pull', 'push', 'clone', 'install', 'build', 'test', 'deploy']
    return longRunning.some(term => cmd.toLowerCase().includes(term))
  }

  const handleGitSync = () => {
    setGitModalOpen(true)
    // Don't auto-fetch on open to avoid hanging - user can click refresh
  }

  const fetchAllGitStatuses = async () => {
    if (!feature) return

    for (const project of feature.projects) {
      await fetchGitStatus(project.name)
    }
  }

  const fetchGitStatus = async (projectName: string) => {
    try {
      setGitOperations(prev => ({ ...prev, [projectName]: { ...prev[projectName], fetching: true } }))

      const config = await window.nexworkAPI.config.load()
      const project = config.projects.find((p: any) => p.name === projectName)
      if (!project) return

      // Determine working directory - use worktree if it exists
      let workingDir: string
      const featureProject = feature?.projects.find(p => p.name === projectName)
      
      if (featureProject?.worktreePath && worktreeInfo[projectName]) {
        // Use worktree path if it exists
        workingDir = worktreeInfo[projectName]!
      } else if (featureProject?.worktreePath) {
        // Worktree exists in config but not loaded yet
        workingDir = featureProject.worktreePath
        setWorktreeInfo(prev => ({ ...prev, [projectName]: featureProject.worktreePath }))
      } else {
        // No worktree, use main repository
        workingDir = `${config.workspaceRoot}/${project.path}`
        
        // Check if feature branch is in a worktree (and update state)
        if (feature) {
          const worktreeResult = await window.nexworkAPI.runCommand('git worktree list', workingDir)
          if (worktreeResult.success && featureProject) {
            const worktreeLine = worktreeResult.output.split('\n').find(line => 
              line.includes(featureProject.branch)
            )
            if (worktreeLine) {
              const worktreePath = worktreeLine.split(/\s+/)[0]
              setWorktreeInfo(prev => ({ ...prev, [projectName]: worktreePath }))
              workingDir = worktreePath // Use the worktree we just found
            }
          }
        }
      }

      // Get current branch (local operation, fast)
      const branchResult = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', workingDir)
      const branch = branchResult.success ? branchResult.output.trim() : 'unknown'

      // Try to fetch (5 minute timeout is handled by IPC layer)
      message.loading({ content: `Fetching ${projectName}...`, key: projectName, duration: 0 })
      const fetchResult = await window.nexworkAPI.runCommand('git fetch', workingDir)

      if (!fetchResult.success) {
        message.error({ 
          content: `${projectName}: Cannot reach server (offline)`, 
          key: projectName,
          duration: 3
        })
        setGitStatuses(prev => ({
          ...prev,
          [projectName]: { ahead: -1, behind: -1, branch } // -1 indicates offline
        }))
        return
      }

      message.destroy(projectName)

      // Check if branch has remote tracking
      const trackingCheck = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref @{u}', workingDir)
      const hasRemoteTracking = trackingCheck.success
      
      if (hasRemoteTracking) {
        // Get ahead/behind counts (local operation)
        const statusResult = await window.nexworkAPI.runCommand(
          `git rev-list --left-right --count HEAD...origin/${branch}`,
          workingDir
        )

        let ahead = 0
        let behind = 0

        if (statusResult.success) {
          const parts = statusResult.output.trim().split(/\s+/)
          ahead = parseInt(parts[0]) || 0
          behind = parseInt(parts[1]) || 0
        }

        setGitStatuses(prev => ({
          ...prev,
          [projectName]: { ahead, behind, branch, isLocalOnly: false }
        }))
      } else {
        // Local only - don't set ahead/behind at all
        setGitStatuses(prev => ({
          ...prev,
          [projectName]: { ahead: -99, behind: -99, branch, isLocalOnly: true }
        }))
      }
    } catch (error) {
      console.error(`Failed to get git status for ${projectName}:`, error)
      message.error(`${projectName}: Failed to get status`)
    } finally {
      setGitOperations(prev => ({ ...prev, [projectName]: { ...prev[projectName], fetching: false } }))
    }
  }

  const handleGitPull = async (projectName: string) => {
    try {
      setGitOperations(prev => ({ ...prev, [projectName]: { ...prev[projectName], pulling: true } }))

      // Determine working directory - use worktree if exists
      let workingDir: string
      if (worktreeInfo[projectName]) {
        workingDir = worktreeInfo[projectName]!
        message.loading({ content: `${projectName}: Pulling in worktree...`, key: `pull-${projectName}`, duration: 0 })
      } else {
        const config = await window.nexworkAPI.config.load()
        const project = config.projects.find((p: any) => p.name === projectName)
        if (!project) return
        
        workingDir = `${config.workspaceRoot}/${project.path}`
        message.loading({ content: `${projectName}: Pulling...`, key: `pull-${projectName}`, duration: 0 })
      }
      
      const result = await window.nexworkAPI.runCommand('git pull --no-edit', workingDir)

      if (result.success) {
        message.success({ 
          content: `${projectName}: Pulled successfully`, 
          key: `pull-${projectName}`,
          duration: 3
        })
        // Refresh status after successful pull
        await fetchGitStatus(projectName)
      } else {
        // Check for specific error types
        if (result.error?.includes('CONFLICT') || 
            result.error?.includes('Automatic merge failed') ||
            result.output?.includes('CONFLICT')) {
          // Merge conflict detected
          Modal.error({
            title: `${projectName}: Merge Conflict Detected`,
            content: (
              <div>
                <p>Pull failed due to merge conflicts. You need to resolve conflicts manually.</p>
                <p><strong>Options:</strong></p>
                <ul>
                  <li>Open in VS Code to resolve conflicts</li>
                  <li>Or open in terminal and run: <code>git status</code></li>
                  <li>After resolving, commit and try pulling again</li>
                </ul>
                <p style={{ marginTop: 16, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                  <code style={{ fontSize: 12 }}>{result.error?.substring(0, 200)}</code>
                </p>
              </div>
            ),
            width: 600
          })
        } else if (result.error?.includes('no tracking information') || 
                   result.error?.includes('Please specify which branch')) {
          message.warning({ 
            content: `${projectName}: No remote branch yet. Push first to create it on remote.`, 
            key: `pull-${projectName}`,
            duration: 5
          })
        } else if (result.error?.includes('uncommitted changes') ||
                   result.error?.includes('would be overwritten')) {
          message.error({ 
            content: `${projectName}: Pull failed - You have uncommitted changes. Commit or stash them first.`, 
            key: `pull-${projectName}`,
            duration: 5
          })
        } else {
          message.error({ 
            content: `${projectName}: Pull failed - ${result.error?.substring(0, 100)}`, 
            key: `pull-${projectName}`,
            duration: 5
          })
        }
      }
    } catch (error: any) {
      message.error(`${projectName}: Pull failed - ${error.message}`)
    } finally {
      setGitOperations(prev => ({ ...prev, [projectName]: { ...prev[projectName], pulling: false } }))
    }
  }

  const handleGitPush = async (projectName: string) => {
    try {
      setGitOperations(prev => ({ ...prev, [projectName]: { ...prev[projectName], pushing: true } }))

      // Determine working directory - use worktree if exists
      let workingDir: string
      if (worktreeInfo[projectName]) {
        workingDir = worktreeInfo[projectName]!
        message.loading({ content: `${projectName}: Pushing from worktree...`, key: `push-${projectName}`, duration: 0 })
      } else {
        const config = await window.nexworkAPI.config.load()
        const project = config.projects.find((p: any) => p.name === projectName)
        if (!project) return
        
        workingDir = `${config.workspaceRoot}/${project.path}`
        message.loading({ content: `${projectName}: Pushing...`, key: `push-${projectName}`, duration: 0 })
      }
      
      // Try normal push first, if it fails due to no upstream, set upstream
      let result = await window.nexworkAPI.runCommand('git push', workingDir)
      
      // If failed due to no upstream or unresolved branch, try with --set-upstream
      if (!result.success && (
        result.error?.includes('has no upstream branch') || 
        result.error?.includes('cannot be resolved to branch') ||
        result.error?.includes('does not have an upstream branch')
      )) {
        const branchResult = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', workingDir)
        const currentBranch = branchResult.success ? branchResult.output.trim() : ''
        
        if (currentBranch) {
          message.info({ 
            content: `${projectName}: Creating remote branch and pushing...`, 
            key: `push-${projectName}`,
            duration: 0
          })
          // Use HEAD:refs/heads/branch format which is more reliable
          result = await window.nexworkAPI.runCommand(
            `git push origin HEAD:refs/heads/${currentBranch} && git branch --set-upstream-to=origin/${currentBranch}`,
            workingDir
          )
        }
      }

      if (result.success) {
        message.success({ 
          content: `${projectName}: Pushed to remote! Now everyone can see your branch.`, 
          key: `push-${projectName}`,
          duration: 3
        })
        
        // Refresh git status to update ahead/behind counts
        await fetchGitStatus(projectName)
        
        // After successful push, check if worktree should be created in features folder
        if (!worktreeInfo[projectName]) {
          await createProjectWorktree(projectName)
        }
      } else {
        message.error({ 
          content: `${projectName}: Push failed - ${result.error?.substring(0, 100)}`, 
          key: `push-${projectName}`,
          duration: 5
        })
      }
    } catch (error: any) {
      message.error(`${projectName}: Push failed - ${error.message}`)
    } finally {
      setGitOperations(prev => ({ ...prev, [projectName]: { ...prev[projectName], pushing: false } }))
    }
  }

  const createProjectWorktree = async (projectName: string) => {
    try {
      if (!feature) return
      
      const config = await window.nexworkAPI.config.load()
      const featureProject = feature.projects.find(p => p.name === projectName)
      const projectConfig = config.projects.find((p: any) => p.name === projectName)
      
      if (!featureProject || !projectConfig) return
      
      // Check if features folder exists
      const featureName = feature.name.replace(/_/g, '-')
      const featureFolderPattern = `${config.workspaceRoot}/features/*${featureName}*`
      
      const folderResult = await window.nexworkAPI.runCommand(
        `ls -d ${featureFolderPattern} 2>/dev/null || echo ""`,
        config.workspaceRoot
      )
      
      if (!folderResult.success || !folderResult.output.trim()) {
        return
      }
      
      const featureFolderPath = folderResult.output.trim().split('\n')[0]
      const worktreePath = `${featureFolderPath}/${projectName}`
      
      // Check if worktree already exists
      const checkResult = await window.nexworkAPI.runCommand(
        `test -d "${worktreePath}" && echo "exists" || echo "missing"`,
        config.workspaceRoot
      )
      
      if (checkResult.output.trim() === 'exists') {
        return
      }
      
      // Create worktree
      message.loading({ content: `${projectName}: Creating worktree...`, key: `worktree-${projectName}`, duration: 0 })
      
      const mainRepoPath = `${config.workspaceRoot}/${projectConfig.path}`
      const targetBranch = featureProject.branch
      
      // First, ensure main repo is on a stable branch (not the feature branch)
      const currentBranchResult = await window.nexworkAPI.runCommand(
        'git rev-parse --abbrev-ref HEAD',
        mainRepoPath
      )
      
      if (currentBranchResult.success && currentBranchResult.output.trim() === targetBranch) {
        // Switch main repo to staging or production first
        await window.nexworkAPI.runCommand('git checkout staging 2>/dev/null || git checkout production', mainRepoPath)
      }
      
      // Create the worktree
      const createResult = await window.nexworkAPI.runCommand(
        `git worktree add "${worktreePath}" ${targetBranch}`,
        mainRepoPath
      )
      
      if (createResult.success) {
        message.success({ 
          content: `${projectName}: Worktree created successfully!`, 
          key: `worktree-${projectName}`,
          duration: 3
        })
        
        // Refresh workspace status
        await checkFeatureWorkspace()
      } else {
        message.error({ 
          content: `${projectName}: Failed to create worktree - ${createResult.error?.substring(0, 100)}`, 
          key: `worktree-${projectName}`,
          duration: 5
        })
      }
    } catch (error: any) {
      console.error('Failed to create worktree:', error)
      message.error(`${projectName}: Failed to create worktree - ${error.message}`)
    }
  }



  const handleCleanupWorktrees = async () => {
    if (!feature) return
    
    Modal.confirm({
      title: 'Cleanup Prunable Worktrees',
      content: 'This will run "git worktree prune" on all projects to remove stale worktree references. Continue?',
      okText: 'Yes, Cleanup',
      okType: 'primary',
      cancelText: 'Cancel',
      onOk: async () => {
        message.loading({ content: 'Cleaning up worktrees...', key: 'cleanup-worktrees', duration: 0 })
        
        let successCount = 0
        let failedCount = 0
        
        const config = await window.nexworkAPI.config.load()
        
        for (const project of feature.projects) {
          try {
            const projectConfig = config.projects.find((p: any) => p.name === project.name)
            if (!projectConfig) continue
            
            const projectPath = `${config.workspaceRoot}/${projectConfig.path}`
            
            // Run git worktree prune
            const result = await window.nexworkAPI.runCommand('git worktree prune -v', projectPath)
            
            if (result.success) {
              successCount++
              if (result.output.trim()) {
              }
            } else {
              failedCount++
              console.error(`[${project.name}] Failed to prune:`, result.error)
            }
          } catch (error: any) {
            failedCount++
            console.error(`Failed to cleanup worktrees for ${project.name}:`, error)
          }
        }
        
        message.destroy('cleanup-worktrees')
        
        if (failedCount > 0) {
          message.warning(`Cleanup completed: ${successCount} succeeded, ${failedCount} failed`, 5)
        } else {
          message.success(`All projects cleaned up! ${successCount} project(s) processed`, 3)
        }
        
        // Refresh to update worktree info
        await loadFeatureDetails(true)
      }
    })
  }

  const handleCommitFeature = () => {
    if (!feature) return
    
    // Pre-select all projects with worktrees
    const projectsWithWorktrees = feature.projects
      .filter(p => p.worktreePath)
      .map(p => p.name)
    
    setSelectedProjectsForCommit(projectsWithWorktrees)
    setCommitMessage('')
    setCommitModalOpen(true)
  }

  const handleMergeFeature = () => {
    if (!feature) return
    
    // Pre-select all projects with worktrees
    const projectsWithWorktrees = feature.projects
      .filter(p => p.worktreePath)
      .map(p => p.name)
    
    setSelectedProjectsForMerge(projectsWithWorktrees)
    setMergeModalOpen(true)
  }

  const handleExecuteCommit = async () => {
    if (!selectedProjectsForCommit.length) {
      message.warning('Please select at least one project to commit')
      return
    }

    if (!commitMessage.trim()) {
      message.warning('Please enter a commit message')
      return
    }

    try {
      message.loading({ content: 'Committing changes...', key: 'commit', duration: 0 })
      
      let successCount = 0
      let failedCount = 0
      const errors: string[] = []

      for (const projectName of selectedProjectsForCommit) {
        const project = feature?.projects.find(p => p.name === projectName)
        if (!project?.worktreePath) continue

        try {
          // Stage all changes
          await window.nexworkAPI.runCommand('git add .', project.worktreePath)
          
          // Commit
          await window.nexworkAPI.runCommand(`git commit -m "${commitMessage}"`, project.worktreePath)
          
          successCount++
        } catch (error: any) {
          failedCount++
          errors.push(`${projectName}: ${error.message}`)
        }
      }

      message.destroy('commit')
      
      if (failedCount > 0) {
        Modal.error({
          title: 'Commit Completed with Errors',
          content: (
            <div>
              <p>✅ {successCount} project(s) committed successfully</p>
              <p>❌ {failedCount} project(s) failed:</p>
              <ul>
                {errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )
        })
      } else {
        message.success(`✅ Committed changes in ${successCount} project(s)!`)
      }

      setCommitModalOpen(false)
      await loadFeatureDetails(true)
      
    } catch (error: any) {
      message.error({ content: `Failed to commit: ${error.message}`, key: 'commit' })
    }
  }

  const handleExecuteMerge = async () => {
    if (!selectedProjectsForMerge.length) {
      message.warning('Please select at least one project to merge')
      return
    }

    try {
      message.loading({ content: 'Merging branches...', key: 'merge', duration: 0 })
      
      let successCount = 0
      let failedCount = 0
      const errors: string[] = []

      for (const projectName of selectedProjectsForMerge) {
        const project = feature?.projects.find(p => p.name === projectName)
        if (!project?.worktreePath) continue

        const baseBranch = project.baseBranch || 'staging'

        try {
          // Checkout base branch
          await window.nexworkAPI.runCommand(`git checkout ${baseBranch}`, project.worktreePath)
          
          // Pull latest
          await window.nexworkAPI.runCommand(`git pull origin ${baseBranch}`, project.worktreePath)
          
          // Merge feature branch
          await window.nexworkAPI.runCommand(`git merge ${project.branch}`, project.worktreePath)
          
          successCount++
        } catch (error: any) {
          failedCount++
          errors.push(`${projectName}: ${error.message}`)
        }
      }

      message.destroy('merge')
      
      if (failedCount > 0) {
        Modal.error({
          title: 'Merge Completed with Errors',
          content: (
            <div>
              <p>✅ {successCount} project(s) merged successfully</p>
              <p>❌ {failedCount} project(s) failed:</p>
              <ul>
                {errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )
        })
      } else {
        message.success(`✅ Merged ${successCount} project(s) successfully!`)
      }

      setMergeModalOpen(false)
      await loadFeatureDetails(true)
      
    } catch (error: any) {
      message.error({ content: `Failed to merge: ${error.message}`, key: 'merge' })
    }
  }

  const handleTerminalOption = (projectName: string, option: 'external' | 'integrated') => {
    // Save preference type (external vs integrated) only
    const newPreferences = { ...projectTerminalPreferences, [projectName]: option }
    setProjectTerminalPreferences(newPreferences)
    localStorage.setItem('projectTerminalPreferences', JSON.stringify(newPreferences))

    // Don't open terminal here - let the dropdown menu item handle it
    if (option === 'integrated') {
      // Integrated - scroll to terminal section
      const terminalSection = document.querySelector('[data-terminal-section]')
      if (terminalSection) {
        terminalSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        message.info(`Use the Integrated Terminal section below for ${projectName}`)
      }
    }
  }

  const handleOpenInTerminal = async (projectName: string, terminalApp?: string) => {
    try {
      const worktreePath = worktreeInfo[projectName]
      if (!worktreePath) {
        message.warning('No worktree found for this project')
        return
      }

      // Use saved terminal app preference or passed app or default
      const appToUse = terminalApp || projectTerminalAppPreferences[projectName] || 'terminal'
      
      const terminalNames: {[key: string]: string} = {
        'terminal': 'Terminal',
        'iterm2': 'iTerm2',
        'warp': 'Warp',
        'alacritty': 'Alacritty',
        'kitty': 'Kitty',
        'hyper': 'Hyper'
      }

      // If app was explicitly selected, save it as preference
      if (terminalApp) {
        const newPreferences = { ...projectTerminalAppPreferences, [projectName]: terminalApp }
        setProjectTerminalAppPreferences(newPreferences)
        localStorage.setItem('projectTerminalAppPreferences', JSON.stringify(newPreferences))
      }

      const result = await window.nexworkAPI.openInTerminal(worktreePath, appToUse)
      if (result.success) {
        message.success(`Opening ${projectName} in ${terminalNames[appToUse]}`)
      } else {
        message.error(`Failed to open Terminal: ${result.error}`)
      }
    } catch (error: any) {
      message.error(`Failed to open Terminal: ${error.message}`)
    }
  }

  const handleOpenInIDE = async (projectName: string, ide?: string) => {
    try {
      const worktreePath = worktreeInfo[projectName]
      if (!worktreePath) {
        message.warning('No worktree found for this project')
        return
      }

      // Use per-project preference, or passed IDE, or global preference
      const ideToUse = ide || projectIDEPreferences[projectName] || preferredIDE
      
      const ideNames: {[key: string]: string} = {
        'vscode': 'VS Code',
        'cursor': 'Cursor',
        'rider': 'Rider',
        'webstorm': 'WebStorm',
        'intellij': 'IntelliJ IDEA',
        'code-insiders': 'VS Code Insiders'
      }

      // If IDE was explicitly selected (not default), save it as preference for this project
      if (ide) {
        const newPreferences = { ...projectIDEPreferences, [projectName]: ide }
        setProjectIDEPreferences(newPreferences)
        localStorage.setItem('projectIDEPreferences', JSON.stringify(newPreferences))
      }

      const result = await window.nexworkAPI.openInIDE(worktreePath, ideToUse)
      if (result.success) {
        const savedIDE = projectIDEPreferences[projectName]
        const suffix = savedIDE ? ` (Remembered: ${ideNames[savedIDE]})` : ''
        message.success(`Opening ${projectName} in ${ideNames[ideToUse]}${suffix}`)
      } else {
        message.error(`Failed to open ${ideNames[ideToUse] || ideToUse}: ${result.error}`)
      }
    } catch (error: any) {
      message.error(`Failed to open IDE: ${error.message}`)
    }
  }

  const handleOpenInVSCode = async (projectName: string) => {
    await handleOpenInIDE(projectName, 'vscode')
  }

  const handleRemoveWorktree = async (projectName: string) => {
    try {
      const worktreePath = worktreeInfo[projectName]
      if (!worktreePath) {
        message.warning('No worktree found for this project')
        return
      }

      const config = await window.nexworkAPI.config.load()
      const project = config.projects.find((p: any) => p.name === projectName)
      if (!project) return

      const workingDir = `${config.workspaceRoot}/${project.path}`

      message.loading({ content: `Removing worktree for ${projectName}...`, key: `remove-${projectName}`, duration: 0 })

      const result = await window.nexworkAPI.runCommand(`git worktree remove "${worktreePath}"`, workingDir)

      if (result.success) {
        message.success({ 
          content: `${projectName}: Worktree removed`, 
          key: `remove-${projectName}`,
          duration: 3
        })
        setWorktreeInfo(prev => ({ ...prev, [projectName]: null }))
        await fetchGitStatus(projectName)
      } else {
        message.error({ 
          content: `${projectName}: Failed to remove - ${result.error?.substring(0, 100)}`, 
          key: `remove-${projectName}`,
          duration: 5
        })
      }
    } catch (error: any) {
      message.error(`Failed to remove worktree: ${error.message}`)
    }
  }

  const handlePullAll = async () => {
    if (!feature) return
    
    try {
      // Separate projects into those with/without worktrees
      const projectsWithWorktrees: string[] = []
      const projectsWithoutWorktrees: string[] = []
      
      feature.projects.forEach(p => {
        if (p.worktreePath || worktreeInfo[p.name]) {
          projectsWithWorktrees.push(p.name)
        } else {
          projectsWithoutWorktrees.push(p.name)
        }
      })
      
      let createdCount = 0
      let pulledCount = 0
      let failedCount = 0
      
      // Step 1: Create worktrees for projects that don't have them
      if (projectsWithoutWorktrees.length > 0) {
        message.loading({ 
          content: `Creating worktrees for ${projectsWithoutWorktrees.length} project(s)...`, 
          key: 'pull-all',
          duration: 0 
        })
        
        for (const projectName of projectsWithoutWorktrees) {
          try {
            await handleCreateWorktree(projectName)
            createdCount++
            projectsWithWorktrees.push(projectName) // Add to pull list
          } catch (error) {
            console.error(`Failed to create worktree for ${projectName}:`, error)
            failedCount++
          }
        }
      }
      
      // Step 2: Pull all projects (including newly created worktrees)
      // But only if they have remote tracking
      if (projectsWithWorktrees.length > 0) {
        message.loading({ 
          content: `Checking remote tracking for ${projectsWithWorktrees.length} project(s)...`, 
          key: 'pull-all',
          duration: 0 
        })
        
        const pullPromises = projectsWithWorktrees.map(async (projectName) => {
          try {
            // Determine working directory
            let workingDir: string
            if (worktreeInfo[projectName]) {
              workingDir = worktreeInfo[projectName]!
            } else {
              const config = await window.nexworkAPI.config.load()
              const project = config.projects.find((p: any) => p.name === projectName)
              if (!project) return
              workingDir = `${config.workspaceRoot}/${project.path}`
            }
            
            // Check if branch has remote tracking
            const trackingCheck = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref @{u}', workingDir)
            
            if (trackingCheck.success) {
              // Has remote tracking, safe to pull
              await handleGitPull(projectName)
              pulledCount++
            } else {
              // No remote tracking yet - skip pull (branch is local only)
              // Don't count as failed - this is expected for new branches
            }
          } catch (error) {
            console.error(`Failed to process ${projectName}:`, error)
            failedCount++
          }
        })
        
        await Promise.all(pullPromises)
      }
      
      // Show summary
      message.destroy('pull-all')
      
      const parts = []
      if (createdCount > 0) parts.push(`${createdCount} worktree(s) created`)
      if (pulledCount > 0) parts.push(`${pulledCount} project(s) pulled`)
      if (failedCount > 0) parts.push(`${failedCount} failed`)
      
      const summary = parts.join(', ')
      
      // Calculate how many have no remote tracking (local only)
      const localOnlyCount = projectsWithWorktrees.length - pulledCount - failedCount
      
      if (failedCount > 0) {
        message.warning(`Completed: ${summary}`, 5)
      } else if (createdCount > 0 && pulledCount === 0) {
        // All new worktrees created but nothing pulled (all local only)
        message.success(`${createdCount} worktree(s) created! Branches are local only - push when ready.`, 5)
      } else if (localOnlyCount > 0) {
        // Some pulled, some local only
        message.success(`${summary}. ${localOnlyCount} branch(es) are local only - push when ready.`, 5)
      } else {
        message.success(`All done! ${summary}`, 3)
      }
      
      // Note: No need to reload - the 3-second auto-sync will pick up changes
    } catch (error: any) {
      message.error(`Pull all failed: ${error.message}`)
    }
  }

  const handlePushAll = async () => {
    if (!feature) return
    
    message.info('Pushing all projects...')
    const promises = feature.projects.map(p => handleGitPush(p.name))
    await Promise.all(promises)
    message.success('All projects pushed!')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'in_progress': return 'processing'
      case 'pending': return 'default'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={16} />
      case 'in_progress': return <Activity size={16} />
      case 'pending': return <Clock size={16} />
      default: return null
    }
  }

  if (loading || !feature || !stats) {
    return <div>Loading...</div>
  }

  const progress = Math.round((stats.projectStatus.completed / stats.projectStatus.total) * 100)

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeft size={16} />}
          onClick={onBack}
          style={{ marginBottom: 16 }}
        >
          Back to Dashboard
        </Button>
        
        <Space direction="vertical" style={{ width: '100%' }}>
          <Title level={2} style={{ margin: 0, wordBreak: 'break-word' }}>{feature.name}</Title>
          <Space wrap>
            <Text type="secondary">
              Created {new Date(feature.createdAt).toLocaleDateString()}
            </Text>
            {feature.startedAt && (
              <>
                <Text type="secondary">•</Text>
                <Text type="secondary">
                  Started {new Date(feature.startedAt).toLocaleDateString()}
                </Text>
              </>
            )}
            {feature.expiresAt && (() => {
              const expiresDate = new Date(feature.expiresAt)
              const now = new Date()
              const daysRemaining = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              const isExpired = daysRemaining < 0
              const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0
              
              return (
                <>
                  <Text type="secondary">•</Text>
                  <Text type={isExpired ? 'danger' : isExpiringSoon ? 'warning' : 'secondary'}>
                    {isExpired 
                      ? `⚠️ Expired ${Math.abs(daysRemaining)} day(s) ago`
                      : `⏱️ Expires in ${daysRemaining} day(s)`
                    }
                  </Text>
                </>
              )
            })()}
          </Space>
          {feature.expiresAt && (() => {
            const expiresDate = new Date(feature.expiresAt)
            const now = new Date()
            const daysRemaining = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            const isExpired = daysRemaining < 0
            const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0
            
            if (isExpired) {
              return (
                <Alert
                  message="Feature Expired"
                  description={
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text>{`This feature expired on ${expiresDate.toLocaleDateString()}. It's recommended to clean it up to keep your workspace organized.`}</Text>
                      <Button 
                        type="primary" 
                        danger 
                        size="small"
                        onClick={handleCleanupExpired}
                      >
                        Clean Up Now (Delete Worktrees & Branches)
                      </Button>
                    </Space>
                  }
                  type="error"
                  showIcon
                  closable
                  style={{ marginTop: 8 }}
                />
              )
            } else if (isExpiringSoon) {
              return (
                <Alert
                  message="Expiring Soon"
                  description={`This feature will expire on ${expiresDate.toLocaleDateString()} (${daysRemaining} day(s) remaining).`}
                  type="warning"
                  showIcon
                  closable
                  style={{ marginTop: 8 }}
                />
              )
            }
            return null
          })()}
        </Space>
      </div>

      {/* Actions */}
      <Space wrap style={{ marginBottom: 24 }}>
        <Button 
          type="primary" 
          icon={<GitPullRequest size={16} />}
          onClick={handleGitSync}
        >
          Git Sync
        </Button>
        <Button 
          icon={<RefreshCw size={16} />}
          onClick={handleRefresh}
          loading={refreshing}
        >
          Refresh
        </Button>
        <Tooltip title="Sync worktree paths with git (fixes 'No worktree found' errors)">
          <Button 
            icon={<FolderPlus size={16} />}
            onClick={handleSyncWorktrees}
          >
            Sync Worktrees
          </Button>
        </Tooltip>
        <Button 
          icon={<Play size={16} />}
          onClick={handleRunCommand}
        >
          Run Command
        </Button>
        <Button 
          icon={<GitCommit size={16} />}
          onClick={handleCommitFeature}
          type="default"
        >
          Commit
        </Button>
        <Button 
          icon={<GitMerge size={16} />}
          onClick={handleMergeFeature}
          type="default"
        >
          Merge
        </Button>
        <Button icon={<Calendar size={16} />} onClick={handleExtendExpiration}>
          {feature.expiresAt ? 'Extend Expiration' : 'Set Expiration'}
        </Button>
      </Space>

      {/* Run Command Modal */}
      <Modal
        title="Run Command"
        open={commandModalOpen}
        onCancel={() => setCommandModalOpen(false)}
        onOk={handleExecuteCommand}
        confirmLoading={commandRunning}
        okText="Run"
        width="90%"
        style={{ maxWidth: 700 }}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Typography.Text strong>Select Project:</Typography.Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={selectedProject}
              onChange={setSelectedProject}
              options={[
                { label: 'Workspace Root', value: 'workspace' },
                ...feature?.projects.map(p => {
                  const hasWorktree = worktreeInfo[p.name] || p.worktreePath
                  return {
                    label: hasWorktree ? `${p.name} (Worktree)` : p.name,
                    value: p.name
                  }
                }) || []
              ]}
            />
            {(() => {
              if (selectedProject === 'workspace') return null
              
              const featureProject = feature?.projects.find(p => p.name === selectedProject)
              const hasWorktree = worktreeInfo[selectedProject] || featureProject?.worktreePath
              const worktreePath = worktreeInfo[selectedProject] || featureProject?.worktreePath
              
              if (hasWorktree) {
                return (
                  <Typography.Text type="success" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                    📁 Will run in worktree: {worktreePath}
                  </Typography.Text>
                )
              } else {
                return (
                  <Typography.Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                    📁 Will run in main repo (no worktree for this feature yet)
                  </Typography.Text>
                )
              }
            })()}
          </div>

          <div>
            <Typography.Text strong>Command:</Typography.Text>
            <Input
              style={{ marginTop: 8 }}
              placeholder="e.g., git status, npm run build"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onPressEnter={handleExecuteCommand}
              disabled={commandRunning}
              autoFocus
            />
          </div>

          <div>
            <Typography.Text strong>Quick Commands:</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <Space wrap size="small">
                {commonCommands.map(cmd => (
                  <Button
                    key={cmd.value}
                    size="small"
                    onClick={() => setCommand(cmd.value)}
                    disabled={commandRunning}
                    type={!cmd.safe ? 'primary' : 'default'}
                    danger={!cmd.safe}
                  >
                    {cmd.label}
                  </Button>
                ))}
              </Space>
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
              Red buttons = long-running commands
            </Typography.Text>
          </div>

          {command && isLongRunningCommand(command) && !commandRunning && (
            <Alert
              message="Long-Running Command"
              description="This command may take some time to complete. The timeout is 2 minutes."
              type="warning"
              showIcon
            />
          )}

          {commandRunning && (
            <Alert
              message={
                <Space>
                  <Spin size="small" />
                  <span>Running command...</span>
                </Space>
              }
              description="Please wait. This may take up to 2 minutes."
              type="info"
              showIcon={false}
            />
          )}

          {commandError && (
            <Alert
              message="Command Failed"
              description={
                <pre style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  fontFamily: 'monospace',
                  fontSize: 12
                }}>
                  {commandError}
                </pre>
              }
              type="error"
              showIcon
            />
          )}

          {commandOutput && (
            <div>
              <Typography.Text strong>Output:</Typography.Text>
              <Card 
                size="small" 
                style={{ 
                  marginTop: 8,
                  backgroundColor: '#1e1e1e',
                  maxHeight: '300px',
                  overflow: 'auto'
                }}
              >
                <pre style={{ 
                  margin: 0, 
                  color: '#d4d4d4',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                  fontSize: 12,
                  lineHeight: 1.5
                }}>
                  {commandOutput}
                </pre>
              </Card>
            </div>
          )}
        </Space>
      </Modal>

      {/* Commit Feature Modal */}
      <Modal
        title={
          <Space>
            <GitCommit size={20} />
            <span>Commit Changes</span>
          </Space>
        }
        open={commitModalOpen}
        onCancel={() => setCommitModalOpen(false)}
        onOk={handleExecuteCommit}
        okText="Commit"
        okButtonProps={{ icon: <GitCommit size={16} /> }}
        width="90%"
        style={{ maxWidth: 600 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>Select Projects to Commit:</Text>
            <Select
              mode="multiple"
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select projects"
              value={selectedProjectsForCommit}
              onChange={setSelectedProjectsForCommit}
              options={feature?.projects
                .filter(p => p.worktreePath)
                .map(p => ({
                  label: p.name,
                  value: p.name
                })) || []}
            />
          </div>

          <div>
            <Text strong>Commit Message:</Text>
            <Input.TextArea
              rows={4}
              placeholder="Enter commit message (e.g., 'Add new feature functionality')"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>

          <Alert
            message="This will:"
            description={
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                <li>Stage all changes (<code>git add .</code>)</li>
                <li>Commit with your message</li>
                <li>Changes will be ready to push</li>
              </ul>
            }
            type="info"
            showIcon
          />
        </Space>
      </Modal>

      {/* Merge Feature Modal */}
      <Modal
        title={
          <Space>
            <GitMerge size={20} />
            <span>Merge Feature Branches</span>
          </Space>
        }
        open={mergeModalOpen}
        onCancel={() => setMergeModalOpen(false)}
        onOk={handleExecuteMerge}
        okText="Merge"
        okButtonProps={{ icon: <GitMerge size={16} />, danger: true }}
        okType="danger"
        width="90%"
        style={{ maxWidth: 600 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>Select Projects to Merge:</Text>
            <Select
              mode="multiple"
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select projects"
              value={selectedProjectsForMerge}
              onChange={setSelectedProjectsForMerge}
              options={feature?.projects
                .filter(p => p.worktreePath)
                .map(p => ({
                  label: `${p.name} (${p.branch} → ${p.baseBranch || 'staging'})`,
                  value: p.name
                })) || []}
            />
          </div>

          <Alert
            message="⚠️ Warning: This will merge feature branches"
            description={
              <div>
                <p>For each selected project, this will:</p>
                <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                  <li>Checkout the base branch (staging/demo/main)</li>
                  <li>Pull latest changes from remote</li>
                  <li>Merge the feature branch into base branch</li>
                </ul>
                <p style={{ marginTop: 8, fontWeight: 600 }}>
                  ⚠️ Make sure you've committed and pushed your changes first!
                </p>
              </div>
            }
            type="warning"
            showIcon
          />
        </Space>
      </Modal>

      {/* Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={12} lg={6}>
          <Card>
            <Statistic
              title="Progress"
              value={progress}
              suffix="%"
              prefix={<TrendingUp size={20} />}
            />
            <Progress percent={progress} showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={12} lg={6}>
          <Card>
            <Statistic
              title="Commits"
              value={stats.gitStats.commits}
              prefix={<GitBranch size={20} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={12} lg={6}>
          <Card>
            <Statistic
              title="Files Changed"
              value={stats.gitStats.filesChanged}
              prefix={<FileCode size={20} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={12} lg={6}>
          <Card>
            <Statistic
              title="Net Change"
              value={stats.gitStats.netChange}
              prefix={<TrendingUp size={20} />}
              valueStyle={{ color: stats.gitStats.netChange > 0 ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Feature Workspace Status */}
      {featureFolderPath && (
        <Card 
          title={
            <Space>
              <FolderOpen size={18} />
              <span>Feature Workspace</span>
              <Tag color="green">Active</Tag>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              message="Dedicated Feature Folder"
              description={
                <div>
                  <Text>This feature has a dedicated workspace folder where all worktrees are organized.</Text>
                  <br />
                  <Text code style={{ marginTop: 8, display: 'block' }}>{featureFolderPath}</Text>
                </div>
              }
              type="success"
              showIcon
            />
            
            <div>
              <Text strong>Project Worktrees:</Text>
              <List
                size="small"
                style={{ marginTop: 8 }}
                dataSource={feature.projects}
                renderItem={(project) => {
                  const status = projectWorktreeStatus[project.name]
                  const projectDetail = stats?.projectDetails?.find((p: any) => p.name === project.name)
                  const gitStats = projectDetail?.gitStats
                  
                  return (
                    <List.Item>
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Space>
                            {status?.exists ? (
                              <CheckCircle2 size={16} color="#52c41a" />
                            ) : (
                              <Clock size={16} color="#faad14" />
                            )}
                            <Text strong>{project.name}</Text>
                            {status?.exists ? (
                              <>
                                <Tag color="green">Worktree Created</Tag>
                                <Tag color="blue">Base: {status.baseBranch}</Tag>
                              </>
                            ) : (
                              <Tag color="orange">Not Created</Tag>
                            )}
                          </Space>
                        </Space>
                        
                        {/* Warning if main repo has uncommitted changes */}
                        {projectDetail?.mainRepoHasChanges && (
                          <Alert
                            message="⚠️ Uncommitted Changes in Main Repository"
                            description={
                              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                <Text>
                                  You have uncommitted changes in the main repository that should be in the worktree instead.
                                </Text>
                                <Text strong style={{ fontSize: 12 }}>
                                  Files: {projectDetail.mainRepoChangedFiles?.join(', ')}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  💡 Tip: Work in the worktree folder to keep changes isolated per feature.
                                </Text>
                              </Space>
                            }
                            type="warning"
                            showIcon
                            closable
                            style={{ marginLeft: 24, marginTop: 8 }}
                          />
                        )}
                        
                        {/* Per-project git stats */}
                        {status?.exists && gitStats && (
                          <Space size="small" style={{ paddingLeft: 24, fontSize: 12 }}>
                            <Text type="secondary">
                              📝 {gitStats.filesChanged} file{gitStats.filesChanged !== 1 ? 's' : ''} changed
                            </Text>
                            <Text type="secondary">•</Text>
                            <Text type="secondary">
                              ↑ {gitStats.commits} commit{gitStats.commits !== 1 ? 's' : ''}
                            </Text>
                            {(gitStats.linesAdded > 0 || gitStats.linesDeleted > 0) && (
                              <>
                                <Text type="secondary">•</Text>
                                <Text type="success">+{gitStats.linesAdded}</Text>
                                <Text type="danger">-{gitStats.linesDeleted}</Text>
                              </>
                            )}
                          </Space>
                        )}
                      </Space>
                    </List.Item>
                  )
                }}
              />
            </div>
          </Space>
        </Card>
      )}

      {/* Worktrees Section */}
      {Object.keys(worktreeInfo).filter(key => worktreeInfo[key]).length > 0 && (
        <Card 
          title={
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <FolderOpen size={18} />
                <span>Git Worktrees</span>
              </Space>
              <Dropdown
                menu={{
                  items: [
                    // Quick open with saved preference (if exists)
                    ...(projectTerminalAppPreferences['_root_'] ? [
                      {
                        key: 'quick-open-root',
                        label: `Open in ${projectTerminalAppPreferences['_root_'] === 'terminal' ? 'Terminal' : 
                                        projectTerminalAppPreferences['_root_'] === 'iterm2' ? 'iTerm2' :
                                        projectTerminalAppPreferences['_root_'] === 'warp' ? 'Warp' :
                                        projectTerminalAppPreferences['_root_'] === 'alacritty' ? 'Alacritty' :
                                        projectTerminalAppPreferences['_root_'] === 'kitty' ? 'Kitty' :
                                        projectTerminalAppPreferences['_root_'] === 'hyper' ? 'Hyper' : 'Terminal'}`,
                        icon: <FolderOpen size={14} />,
                        onClick: () => {
                          if (featureFolderPath) {
                            window.nexworkAPI.openInTerminal(featureFolderPath, projectTerminalAppPreferences['_root_'])
                            message.success('Opening feature root folder')
                          }
                        },
                        style: { fontWeight: 600, backgroundColor: '#f0f5ff' }
                      },
                      {
                        type: 'divider'
                      }
                    ] : []),
                    {
                      type: 'group',
                      label: 'Choose Terminal App',
                      children: [
                        {
                          key: 'terminal',
                          label: projectTerminalAppPreferences['_root_'] === 'terminal' ? '✓ Terminal' : 'Terminal',
                          onClick: () => {
                            if (featureFolderPath) {
                              const newPrefs = { ...projectTerminalAppPreferences, '_root_': 'terminal' }
                              setProjectTerminalAppPreferences(newPrefs)
                              localStorage.setItem('projectTerminalAppPreferences', JSON.stringify(newPrefs))
                              window.nexworkAPI.openInTerminal(featureFolderPath, 'terminal')
                              message.success('Opening feature root in Terminal')
                            }
                          }
                        },
                        {
                          key: 'iterm2',
                          label: projectTerminalAppPreferences['_root_'] === 'iterm2' ? '✓ iTerm2' : 'iTerm2',
                          onClick: () => {
                            if (featureFolderPath) {
                              const newPrefs = { ...projectTerminalAppPreferences, '_root_': 'iterm2' }
                              setProjectTerminalAppPreferences(newPrefs)
                              localStorage.setItem('projectTerminalAppPreferences', JSON.stringify(newPrefs))
                              window.nexworkAPI.openInTerminal(featureFolderPath, 'iterm2')
                              message.success('Opening feature root in iTerm2')
                            }
                          }
                        },
                        {
                          key: 'warp',
                          label: projectTerminalAppPreferences['_root_'] === 'warp' ? '✓ Warp' : 'Warp',
                          onClick: () => {
                            if (featureFolderPath) {
                              const newPrefs = { ...projectTerminalAppPreferences, '_root_': 'warp' }
                              setProjectTerminalAppPreferences(newPrefs)
                              localStorage.setItem('projectTerminalAppPreferences', JSON.stringify(newPrefs))
                              window.nexworkAPI.openInTerminal(featureFolderPath, 'warp')
                              message.success('Opening feature root in Warp')
                            }
                          }
                        },
                        {
                          key: 'alacritty',
                          label: projectTerminalAppPreferences['_root_'] === 'alacritty' ? '✓ Alacritty' : 'Alacritty',
                          onClick: () => {
                            if (featureFolderPath) {
                              const newPrefs = { ...projectTerminalAppPreferences, '_root_': 'alacritty' }
                              setProjectTerminalAppPreferences(newPrefs)
                              localStorage.setItem('projectTerminalAppPreferences', JSON.stringify(newPrefs))
                              window.nexworkAPI.openInTerminal(featureFolderPath, 'alacritty')
                              message.success('Opening feature root in Alacritty')
                            }
                          }
                        },
                        {
                          key: 'kitty',
                          label: projectTerminalAppPreferences['_root_'] === 'kitty' ? '✓ Kitty' : 'Kitty',
                          onClick: () => {
                            if (featureFolderPath) {
                              const newPrefs = { ...projectTerminalAppPreferences, '_root_': 'kitty' }
                              setProjectTerminalAppPreferences(newPrefs)
                              localStorage.setItem('projectTerminalAppPreferences', JSON.stringify(newPrefs))
                              window.nexworkAPI.openInTerminal(featureFolderPath, 'kitty')
                              message.success('Opening feature root in Kitty')
                            }
                          }
                        },
                        {
                          key: 'hyper',
                          label: projectTerminalAppPreferences['_root_'] === 'hyper' ? '✓ Hyper' : 'Hyper',
                          onClick: () => {
                            if (featureFolderPath) {
                              const newPrefs = { ...projectTerminalAppPreferences, '_root_': 'hyper' }
                              setProjectTerminalAppPreferences(newPrefs)
                              localStorage.setItem('projectTerminalAppPreferences', JSON.stringify(newPrefs))
                              window.nexworkAPI.openInTerminal(featureFolderPath, 'hyper')
                              message.success('Opening feature root in Hyper')
                            }
                          }
                        }
                      ]
                    }
                  ]
                }}
                trigger={['click']}
              >
                <Button
                  size="small"
                  icon={<FolderOpen size={14} />}
                >
                  {(() => {
                    const app = projectTerminalAppPreferences['_root_']
                    if (app === 'terminal') return 'Root (Terminal)'
                    if (app === 'iterm2') return 'Root (iTerm2)'
                    if (app === 'warp') return 'Root (Warp)'
                    if (app === 'alacritty') return 'Root (Alacritty)'
                    if (app === 'kitty') return 'Root (Kitty)'
                    if (app === 'hyper') return 'Root (Hyper)'
                    return 'Open Root'
                  })()} <ArrowDown size={10} style={{ marginLeft: 2 }} />
                </Button>
              </Dropdown>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Alert
            message="Worktree Detected"
            description="This feature has active git worktrees. You can work in these separate directories and use the buttons below to open them."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <List
            size="small"
            dataSource={Object.entries(worktreeInfo).filter(([_, path]) => path)}
            renderItem={([projectName, path]) => (
              <List.Item
                actions={[
                  <Dropdown
                    menu={{
                      items: [
                        // Quick open with saved preference (if exists)
                        ...(projectTerminalAppPreferences[projectName] ? [
                          {
                            key: 'quick-open',
                            label: `Open in ${projectTerminalAppPreferences[projectName] === 'terminal' ? 'Terminal' : 
                                            projectTerminalAppPreferences[projectName] === 'iterm2' ? 'iTerm2' :
                                            projectTerminalAppPreferences[projectName] === 'warp' ? 'Warp' :
                                            projectTerminalAppPreferences[projectName] === 'alacritty' ? 'Alacritty' :
                                            projectTerminalAppPreferences[projectName] === 'kitty' ? 'Kitty' :
                                            projectTerminalAppPreferences[projectName] === 'hyper' ? 'Hyper' : 'Terminal'}`,
                            icon: <Terminal size={14} />,
                            onClick: () => handleOpenInTerminal(projectName),
                            style: { fontWeight: 600, backgroundColor: '#f0f5ff' }
                          },
                          {
                            type: 'divider'
                          }
                        ] : []),
                        {
                          type: 'group',
                          label: 'Choose Terminal App',
                          children: [
                            {
                              key: 'terminal',
                              label: projectTerminalAppPreferences[projectName] === 'terminal' ? '✓ Terminal' : 'Terminal',
                              onClick: () => handleOpenInTerminal(projectName, 'terminal')
                            },
                            {
                              key: 'iterm2',
                              label: projectTerminalAppPreferences[projectName] === 'iterm2' ? '✓ iTerm2' : 'iTerm2',
                              onClick: () => handleOpenInTerminal(projectName, 'iterm2')
                            },
                            {
                              key: 'warp',
                              label: projectTerminalAppPreferences[projectName] === 'warp' ? '✓ Warp' : 'Warp',
                              onClick: () => handleOpenInTerminal(projectName, 'warp')
                            },
                            {
                              key: 'alacritty',
                              label: projectTerminalAppPreferences[projectName] === 'alacritty' ? '✓ Alacritty' : 'Alacritty',
                              onClick: () => handleOpenInTerminal(projectName, 'alacritty')
                            },
                            {
                              key: 'kitty',
                              label: projectTerminalAppPreferences[projectName] === 'kitty' ? '✓ Kitty' : 'Kitty',
                              onClick: () => handleOpenInTerminal(projectName, 'kitty')
                            },
                            {
                              key: 'hyper',
                              label: projectTerminalAppPreferences[projectName] === 'hyper' ? '✓ Hyper' : 'Hyper',
                              onClick: () => handleOpenInTerminal(projectName, 'hyper')
                            }
                          ]
                        },
                        {
                          type: 'divider'
                        },
                        {
                          key: 'integrated',
                          label: projectTerminalPreferences[projectName] === 'integrated' ? '✓ Integrated Terminal' : 'Integrated Terminal',
                          icon: <Terminal size={14} />,
                          onClick: () => handleTerminalOption(projectName, 'integrated')
                        }
                      ]
                    }}
                    trigger={['click']}
                  >
                    <Button 
                      icon={<Terminal size={14} />}
                      size="small"
                    >
                      {(() => {
                        if (projectTerminalPreferences[projectName] === 'integrated') return 'Integrated'
                        const app = projectTerminalAppPreferences[projectName]
                        if (app === 'terminal') return 'Terminal'
                        if (app === 'iterm2') return 'iTerm2'
                        if (app === 'warp') return 'Warp'
                        if (app === 'alacritty') return 'Alacritty'
                        if (app === 'kitty') return 'Kitty'
                        if (app === 'hyper') return 'Hyper'
                        return 'Terminal'
                      })()} <ArrowDown size={10} style={{ marginLeft: 2 }} />
                    </Button>
                  </Dropdown>,
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'vscode',
                          label: projectIDEPreferences[projectName] === 'vscode' ? '✓ VS Code' : 'VS Code',
                          onClick: () => handleOpenInIDE(projectName, 'vscode')
                        },
                        {
                          key: 'cursor',
                          label: projectIDEPreferences[projectName] === 'cursor' ? '✓ Cursor' : 'Cursor',
                          onClick: () => handleOpenInIDE(projectName, 'cursor')
                        },
                        {
                          key: 'rider',
                          label: projectIDEPreferences[projectName] === 'rider' ? '✓ Rider' : 'Rider',
                          onClick: () => handleOpenInIDE(projectName, 'rider')
                        },
                        {
                          key: 'webstorm',
                          label: projectIDEPreferences[projectName] === 'webstorm' ? '✓ WebStorm' : 'WebStorm',
                          onClick: () => handleOpenInIDE(projectName, 'webstorm')
                        },
                        {
                          key: 'intellij',
                          label: projectIDEPreferences[projectName] === 'intellij' ? '✓ IntelliJ IDEA' : 'IntelliJ IDEA',
                          onClick: () => handleOpenInIDE(projectName, 'intellij')
                        },
                        {
                          key: 'code-insiders',
                          label: projectIDEPreferences[projectName] === 'code-insiders' ? '✓ VS Code Insiders' : 'VS Code Insiders',
                          onClick: () => handleOpenInIDE(projectName, 'code-insiders')
                        }
                      ]
                    }}
                    trigger={['click']}
                  >
                    <Button 
                      icon={<Code size={14} />}
                      size="small"
                    >
                      {(() => {
                        const savedIDE = projectIDEPreferences[projectName]
                        if (savedIDE === 'vscode') return 'VS Code'
                        if (savedIDE === 'cursor') return 'Cursor'
                        if (savedIDE === 'rider') return 'Rider'
                        if (savedIDE === 'webstorm') return 'WebStorm'
                        if (savedIDE === 'intellij') return 'IntelliJ'
                        if (savedIDE === 'code-insiders') return 'Insiders'
                        return 'IDE'
                      })()} <ArrowDown size={10} style={{ marginLeft: 2 }} />
                    </Button>
                  </Dropdown>,
                  <Button 
                    icon={<X size={14} />}
                    onClick={() => handleRemoveWorktree(projectName)}
                    size="small"
                    danger
                  >
                    Remove
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<Badge status="success" />}
                  title={<Text strong>{projectName}</Text>}
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {path}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}



      {/* Changes Viewer */}
      {feature && (
        <ChangesViewer featureName={featureName} projects={feature.projects} />
      )}

      {/* Integrated Terminal */}
      {workspaceRoot && (
        <div data-terminal-section>
          <IntegratedTerminal feature={feature} workspaceRoot={workspaceRoot} />
        </div>
      )}

      {/* Git Sync Modal - GitKraken Style */}
      <Modal
        title={
          <Space>
            <GitPullRequest size={20} />
            <span>Git Sync - All Projects</span>
          </Space>
        }
        open={gitModalOpen}
        onCancel={() => setGitModalOpen(false)}
        width="90%"
        style={{ maxWidth: 800 }}
        footer={
          <Space>
            <Button onClick={() => setGitModalOpen(false)}>Close</Button>
            <Tooltip title="Remove stale worktree references (git worktree prune)">
              <Button 
                icon={<Trash2 size={16} />}
                onClick={handleCleanupWorktrees}
              >
                Cleanup Worktrees
              </Button>
            </Tooltip>
            <Tooltip title="Create worktrees (if needed) and pull all projects">
              <Button 
                type="primary" 
                icon={<ArrowDown size={16} />}
                onClick={handlePullAll}
              >
                Setup & Pull All
              </Button>
            </Tooltip>
            <Button 
              type="primary" 
              icon={<ArrowUp size={16} />}
              onClick={handlePushAll}
              danger
            >
              Push All
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <List
            dataSource={feature?.projects || []}
            renderItem={(project) => {
              const status = gitStatuses[project.name]
              const ops = gitOperations[project.name] || {}
              
              return (
                <List.Item
                  actions={[
                    !project.worktreePath && !worktreeInfo[project.name] ? (
                      <Tooltip title="Create worktree for this project">
                        <Button
                          icon={<FolderPlus size={14} />}
                          onClick={() => handleCreateWorktree(project.name)}
                          loading={creatingWorktrees[project.name]}
                          type="primary"
                        >
                          Create Worktree
                        </Button>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Pull changes from remote">
                        <Button
                          icon={<ArrowDown size={14} />}
                          loading={ops.pulling}
                          disabled={ops.pushing}
                          onClick={() => handleGitPull(project.name)}
                          type={status?.behind > 0 ? 'primary' : 'default'}
                        >
                          Pull {status?.behind > 0 && `(${status.behind})`}
                        </Button>
                      </Tooltip>
                    ),
                    project.worktreePath && (
                      <Tooltip title="Push changes to remote">
                        <Button
                          icon={<ArrowUp size={14} />}
                          loading={ops.pushing}
                          disabled={ops.pulling}
                          onClick={() => handleGitPush(project.name)}
                          type={status?.ahead > 0 ? 'primary' : 'default'}
                          danger={status?.ahead > 0}
                        >
                          Push {status?.ahead > 0 && `(${status.ahead})`}
                        </Button>
                      </Tooltip>
                    ),
                    project.worktreePath && (
                      <Tooltip title="Refresh status">
                        <Button
                          icon={<RefreshCw size={14} />}
                          loading={ops.fetching}
                          onClick={() => fetchGitStatus(project.name)}
                          size="small"
                        />
                      </Tooltip>
                    )
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge 
                        status={
                          status?.ahead > 0 && status?.behind > 0 ? 'warning' :
                          status?.ahead > 0 ? 'error' :
                          status?.behind > 0 ? 'processing' :
                          'success'
                        } 
                      />
                    }
                    title={
                      <Space>
                        <GitBranch size={16} />
                        <Text strong>{project.name}</Text>
                        
                        {/* Show current branch if on wrong branch */}
                        {status?.branch && status.branch !== project.branch && (
                          <Tooltip title={`Main repo currently checked out here`}>
                            <Tag color="default">{status.branch}</Tag>
                          </Tooltip>
                        )}
                        
                        {/* Show feature branch status */}
                        {localFeatureBranches[project.name] && status?.branch !== project.branch ? (
                          // Feature branch exists locally but not checked out
                          <Tooltip title={`Local branch exists and ready to create worktree`}>
                            <Tag color="green" icon={<CheckCircle2 size={12} />}>
                              {project.branch} (Local) ✓
                            </Tag>
                          </Tooltip>
                        ) : status?.branch === project.branch ? (
                          // Already on feature branch
                          <Tag color="blue">{project.branch}</Tag>
                        ) : (
                          // Feature branch doesn't exist yet
                          <Tooltip title={`Branch will be created when you click "Create Worktree"`}>
                            <Tag color="orange">{project.branch} (Not created)</Tag>
                          </Tooltip>
                        )}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size="small">
                        <Space size="large">
                          {status ? (
                            status.ahead === -1 ? (
                              // Offline - cannot reach server
                              <Text type="danger">
                                <AlertCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
                                Offline - Cannot reach server
                              </Text>
                            ) : status.isLocalOnly ? (
                              // Local only - no remote tracking, just show simple message
                              <Text type="warning">
                                <GitBranch size={12} style={{ display: 'inline', marginRight: 4 }} />
                                Local only - Push to create on remote
                              </Text>
                            ) : (
                              // Has remote tracking - show ahead/behind counts
                              <>
                                <Text type="secondary">
                                  <ArrowUp size={12} style={{ display: 'inline', marginRight: 4 }} />
                                  {status.ahead} ahead
                                </Text>
                                <Text type="secondary">
                                  <ArrowDown size={12} style={{ display: 'inline', marginRight: 4 }} />
                                  {status.behind} behind
                                </Text>
                                {status.ahead === 0 && status.behind === 0 && (
                                  <Text type="success">
                                    <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                                    Up to date
                                  </Text>
                                )}
                              </>
                            )
                          ) : (
                            <Text type="secondary">Click refresh to check status</Text>
                          )}
                        </Space>

                      </Space>
                    }
                  />
                </List.Item>
              )
            }}
          />
        </Space>
      </Modal>
    </div>
  )
}
