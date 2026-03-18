import { useState, useEffect } from 'react'
import { message, Modal, Space, Typography, DatePicker, Alert } from 'antd'
import dayjs from 'dayjs'
import type { Feature, FeatureStats } from '../types'
import { IntegratedTerminal } from '../components/IntegratedTerminal'
import ChangesViewer from '../components/ChangesViewer'
import CommitTimeline from '../components/CommitTimeline'
import {
  FeatureHeader,
  FeatureActions,
  FeatureStatsRow,
  RunCommandModal,
  CommitModal,
  MergeModal,
  FeatureWorkspace,
  WorktreesList,
  GitSyncModal,
  ConflictViewer,
  PRModal,
} from '../components/feature-details'
import type {
  FeatureDetailsContext,
  GitStatus,
  GitOps,
  WorktreeStatus,
  ConflictInfo,
} from '../components/feature-details/types'
import { Err, errMsg, classifyGitError } from '../components/feature-details/types'

const { Text } = Typography

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
  const [gitOperations, setGitOperations] = useState<Record<string, GitOps>>({})
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitStatus>>({})
  const [gitModalOpen, setGitModalOpen] = useState(false)
  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [selectedProjectsForCommit, setSelectedProjectsForCommit] = useState<string[]>([])
  const [selectedProjectsForMerge, setSelectedProjectsForMerge] = useState<string[]>([])
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null)
  const [prModalOpen, setPrModalOpen] = useState(false)
  const [worktreeInfo, setWorktreeInfo] = useState<Record<string, string | null>>({})
  const [workspaceRoot, setWorkspaceRoot] = useState<string>('')
  const [featureFolderPath, setFeatureFolderPath] = useState<string>('')
  const [projectWorktreeStatus, setProjectWorktreeStatus] = useState<Record<string, WorktreeStatus>>({})
  const [creatingWorktrees, setCreatingWorktrees] = useState<Record<string, boolean>>({})
  const [localFeatureBranches, setLocalFeatureBranches] = useState<Record<string, boolean>>({})
  const [preferredIDE] = useState<string>(() => {
    return localStorage.getItem('preferredIDE') || 'vscode'
  })
  const [projectIDEPreferences, setProjectIDEPreferences] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('projectIDEPreferences')
    return saved ? JSON.parse(saved) : {}
  })
  const [projectTerminalPreferences, setProjectTerminalPreferences] = useState<
    Record<string, 'external' | 'integrated'>
  >(() => {
    const saved = localStorage.getItem('projectTerminalPreferences')
    return saved ? JSON.parse(saved) : {}
  })
  const [projectTerminalAppPreferences, setProjectTerminalAppPreferences] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('projectTerminalAppPreferences')
    return saved ? JSON.parse(saved) : {}
  })

  // ── Data Loading ───────────────────────────────────────────────────

  useEffect(() => {
    loadFeatureDetails(false)
    checkFeatureWorkspace()
    const interval = setInterval(() => {
      loadFeatureDetails(true)
      checkFeatureWorkspace()
    }, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureName])

  useEffect(() => {
    if (gitModalOpen && feature) {
      loadCurrentBranches()
      const interval = setInterval(() => loadCurrentBranches(), 3000)
      return () => clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gitModalOpen, feature])

  const loadFeatureDetails = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const statsData = await window.nexworkAPI.stats.getFeatureStats(featureName)
      const [featureData, config] = await Promise.all([
        window.nexworkAPI.features.getByName(featureName),
        window.nexworkAPI.config.load(),
      ])
      setFeature(featureData)
      setStats(statsData)
      setWorkspaceRoot(config.workspaceRoot)
      if (featureData?.projects) {
        const newWorktreeInfo: Record<string, string | null> = {}
        featureData.projects.forEach((p: any) => {
          if (p.worktreePath) newWorktreeInfo[p.name] = p.worktreePath
        })
        setWorktreeInfo(newWorktreeInfo)
      }
    } catch (error) {
      console.error('Failed to load feature details:', error)
      if (!silent) message.error(Err.LoadFailed)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const loadCurrentBranches = async () => {
    if (!feature) return
    try {
      const config = await window.nexworkAPI.config.load()
      const branchPromises = feature.projects.map(async (project) => {
        try {
          const projectConfig = config.projects.find((p: any) => p.name === project.name)
          if (!projectConfig) return { name: project.name, branch: 'unknown', featureBranchExists: false }
          const mainRepoPath = `${config.workspaceRoot}/${projectConfig.path}`
          let workingDir: string
          if (project.worktreePath && worktreeInfo[project.name]) {
            workingDir = worktreeInfo[project.name]!
          } else if (project.worktreePath) {
            workingDir = project.worktreePath
          } else {
            workingDir = mainRepoPath
          }
          const branchResult = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', workingDir)
          const branch = branchResult.success ? branchResult.output.trim() : 'unknown'
          const featureBranchCheck = await window.nexworkAPI.runCommand(
            `git rev-parse --verify ${project.branch}`,
            mainRepoPath,
          )
          return { name: project.name, branch, featureBranchExists: featureBranchCheck.success }
        } catch {
          return { name: project.name, branch: 'unknown', featureBranchExists: false }
        }
      })
      const results = await Promise.all(branchPromises)
      const newStatuses: Record<string, GitStatus> = {}
      const featureBranches: Record<string, boolean> = {}
      results.forEach(({ name, branch, featureBranchExists }) => {
        const existing = gitStatuses[name]
        newStatuses[name] = { ahead: existing?.ahead ?? 0, behind: existing?.behind ?? 0, branch }
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
        window.nexworkAPI.config.load(),
      ])
      const featureFolderName = featureData.name.replace(/_/g, '-')
      const featureFolderPattern = `${config.workspaceRoot}/features/*${featureFolderName}*`
      const folderResult = await window.nexworkAPI.runCommand(
        `ls -d ${featureFolderPattern} 2>/dev/null || echo ""`,
        config.workspaceRoot,
      )
      if (folderResult.success && folderResult.output.trim()) {
        const detectedPath = folderResult.output.trim().split('\n')[0]
        setFeatureFolderPath(detectedPath)
        const status: Record<string, WorktreeStatus> = {}
        for (const project of featureData.projects) {
          const projectPath = project.worktreePath || worktreeInfo[project.name] || `${detectedPath}/${project.name}`
          const checkResult = await window.nexworkAPI.runCommand(
            `test -d "${projectPath}" && echo "exists" || echo "missing"`,
            config.workspaceRoot,
          )
          const exists = checkResult.output.trim() === 'exists'
          let baseBranch = project.baseBranch || 'unknown'
          if (exists && !project.baseBranch) {
            const projectConfig = config.projects.find((p: any) => p.name === project.name)
            if (projectConfig) {
              const mainRepoPath = `${config.workspaceRoot}/${projectConfig.path}`
              const branchesResult = await window.nexworkAPI.runCommand(
                `git branch -r | grep -E 'origin/(production|staging|demo|master|main)' | sed 's/origin\\///' | tr -d ' '`,
                mainRepoPath,
              )
              if (branchesResult.success && branchesResult.output.trim()) {
                const branches = branchesResult.output.trim().split('\n')
                for (const branch of branches) {
                  const mergeBaseResult = await window.nexworkAPI.runCommand(
                    `cd "${projectPath}" && git merge-base HEAD origin/${branch} 2>/dev/null || echo ""`,
                    config.workspaceRoot,
                  )
                  const headResult = await window.nexworkAPI.runCommand(
                    `cd "${projectPath}" && git rev-parse HEAD`,
                    config.workspaceRoot,
                  )
                  if (mergeBaseResult.success && headResult.success) {
                    if (mergeBaseResult.output.trim() === headResult.output.trim()) {
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

        // Backfill missing base branches from detected status
        const updatedProjects = featureData.projects.map((project: any) => {
          const detectedBase = status[project.name]?.baseBranch
          const missingBase =
            !project.baseBranch || project.baseBranch === 'current' || project.baseBranch === 'unknown'
          if (missingBase && detectedBase && detectedBase !== 'unknown') {
            return { ...project, baseBranch: detectedBase }
          }
          return project
        })

        const changed = updatedProjects.some((project: any, index: number) => {
          return project.baseBranch !== featureData.projects[index].baseBranch
        })

        if (changed) {
          try {
            await window.nexworkAPI.features.update(featureData.name, { projects: updatedProjects })
          } catch {
            // ignore backfill errors
          }
        }
      } else {
        setFeatureFolderPath('')
        setProjectWorktreeStatus({})
      }
    } catch (error) {
      console.error('Failed to check feature workspace:', error)
    }
  }

  // ── Feature Actions ────────────────────────────────────────────────

  const handleUpdateStatus = async (projectName: string, newStatus: string) => {
    try {
      await window.nexworkAPI.projects.updateStatus(featureName, projectName, newStatus)
      message.success(`Updated ${projectName} status to ${newStatus}`)
      loadFeatureDetails()
    } catch {
      message.error(Err.StatusUpdateFailed)
    }
  }

  const handleComplete = () => {
    if (!feature) return
    const worktreeCount = feature.projects.filter((p) => p.worktreePath).length
    const inProgressCount = feature.projects.filter((p) => p.status === 'in_progress').length
    const completedCount = feature.projects.filter((p) => p.status === 'completed').length
    Modal.confirm({
      title: 'Complete Feature?',
      content: (
        <Space direction="vertical">
          <Text>This will mark the following as completed:</Text>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>
              Feature: <strong>{feature.name}</strong>
            </li>
            <li>
              <strong>{feature.projects.length}</strong> project(s): {feature.projects.map((p) => p.name).join(', ')}
            </li>
            <li>
              All project statuses will be set to <strong>"Completed"</strong>
            </li>
            {worktreeCount > 0 && (
              <li>
                <strong>{worktreeCount}</strong> worktree folder(s) will remain (you can delete them later)
              </li>
            )}
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
            <Text type="success">All projects are already marked as completed</Text>
          )}
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            You can still access this feature later. This just marks it as finished.
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
          message.success({ content: 'Feature completed successfully!', key: 'complete-feature', duration: 3 })
          onBack()
        } catch (error: any) {
          message.error({
            content: errMsg(Err.CompleteFailed, undefined, error.message),
            key: 'complete-feature',
            duration: 5,
          })
        }
      },
    })
  }

  const handleDelete = () => {
    if (!feature) return
    const worktreeCount = feature.projects.filter((p) => p.worktreePath).length
    Modal.confirm({
      title: 'Delete Feature?',
      content: (
        <Space direction="vertical">
          <Text>This will permanently delete:</Text>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>
              Feature configuration: <strong>{feature.name}</strong>
            </li>
            {worktreeCount > 0 && (
              <li>
                <strong>{worktreeCount}</strong> worktree folder(s)
              </li>
            )}
            <li>
              Git branches: <strong>{feature.projects[0]?.branch}</strong> from {feature.projects.length} project(s)
            </li>
            <li>Feature tracking folder and all files</li>
          </ul>
          <Text type="danger">This action cannot be undone!</Text>
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
          message.error({
            content: errMsg(Err.DeleteFailed, undefined, error.message),
            key: 'delete-feature',
            duration: 5,
          })
        }
      },
    })
  }

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      await loadFeatureDetails()
      message.success('Feature details refreshed!')
    } catch {
      message.error(Err.RefreshFailed)
    } finally {
      setRefreshing(false)
    }
  }

  const handleSyncWorktrees = async () => {
    try {
      message.loading({ content: 'Syncing worktree paths...', key: 'sync' })
      await window.nexworkAPI.stats.syncWorktrees(featureName)
      await loadFeatureDetails()
      message.success({ content: 'Worktree paths synced successfully!', key: 'sync', duration: 3 })
    } catch {
      message.error({ content: Err.SyncFailed, key: 'sync', duration: 3 })
    }
  }

  const handleCleanupExpired = () => {
    if (!feature) return
    Modal.confirm({
      title: 'Clean Up Expired Feature',
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>This will permanently delete:</Text>
          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
            <li>All worktrees for this feature</li>
            <li>Feature branches in all projects</li>
            <li>Feature tracking folder</li>
            <li>Feature from the config</li>
          </ul>
          <Text type="danger" strong>
            This action cannot be undone!
          </Text>
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
          setTimeout(() => onBack(), 500)
        } catch (error: any) {
          message.error({ content: errMsg(Err.CleanupFailed, undefined, error.message), key: 'cleanup', duration: 5 })
          return Promise.reject()
        }
      },
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
            disabledDate={(current) => current && current.valueOf() < dayjs().valueOf()}
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
          message.warning(Err.SelectDate)
          return Promise.reject()
        }
        try {
          await window.nexworkAPI.features.update(featureName, { expiresAt: newExpirationDate.toISOString() })
          message.success('Expiration date updated successfully!')
          await loadFeatureDetails(true)
        } catch (error: any) {
          message.error(errMsg(Err.ExpirationFailed, undefined, error.message))
          return Promise.reject()
        }
      },
    })
  }

  // ── Worktree Operations ────────────────────────────────────────────

  const handleCreateWorktree = async (projectName: string) => {
    try {
      setCreatingWorktrees((prev) => ({ ...prev, [projectName]: true }))
      const featureProject = feature?.projects.find((p) => p.name === projectName)
      if (!featureProject) throw new Error(`Project ${projectName} not found in feature`)
      const config = await window.nexworkAPI.config.load()
      const project = config.projects.find((p: any) => p.name === projectName)
      if (!project) throw new Error(`Project ${projectName} not found in config`)
      const projectPath = `${config.workspaceRoot}/${project.path}`
      const branchResult = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', projectPath)
      const currentBranch = branchResult.success ? branchResult.output.trim() : ''
      const baseBranch = featureProject.baseBranch || 'staging'
      const mainBranches = ['production', 'staging', 'demo', 'master', 'main', 'develop']
      if (!mainBranches.includes(currentBranch)) {
        message.loading({
          content: `${projectName}: Switching main repo back to ${baseBranch}...`,
          key: `worktree-${projectName}`,
          duration: 0,
        })
        const switchResult = await window.nexworkAPI.runCommand(`git checkout ${baseBranch}`, projectPath)
        if (!switchResult.success) throw new Error(`Failed to switch to ${baseBranch}: ${switchResult.error}`)
      }
      message.loading({
        content: `Creating worktree for ${projectName}...`,
        key: `worktree-${projectName}`,
        duration: 0,
      })
      const result = await window.nexworkAPI.projects.createWorktree(featureName, projectName)
      if (result.success) {
        if (feature) {
          const updatedProjects = feature.projects.map((p) =>
            p.name === projectName ? { ...p, worktreePath: result.path } : p,
          )
          setFeature({ ...feature, projects: updatedProjects })
          setWorktreeInfo((prev) => ({ ...prev, [projectName]: result.path }))
        }
        message.success({
          content: `${projectName}: Worktree created! Branch is local only - Push when ready.`,
          key: `worktree-${projectName}`,
          duration: 3,
        })
        fetchGitStatus(projectName)
        checkFeatureWorkspace()
      } else {
        throw new Error(result.error || 'Failed to create worktree')
      }
    } catch (error: any) {
      message.error({
        content: errMsg(Err.WorktreeCreateFailed, projectName, error.message),
        key: `worktree-${projectName}`,
        duration: 5,
      })
    } finally {
      setCreatingWorktrees((prev) => ({ ...prev, [projectName]: false }))
    }
  }

  const handleRemoveWorktree = async (projectName: string) => {
    try {
      const worktreePath = worktreeInfo[projectName]
      if (!worktreePath) {
        message.warning(Err.WorktreeNotFound)
        return
      }
      const config = await window.nexworkAPI.config.load()
      const project = config.projects.find((p: any) => p.name === projectName)
      if (!project) return
      const workingDir = `${config.workspaceRoot}/${project.path}`
      message.loading({ content: `Removing worktree for ${projectName}...`, key: `remove-${projectName}`, duration: 0 })
      const result = await window.nexworkAPI.runCommand(`git worktree remove "${worktreePath}"`, workingDir)
      if (result.success) {
        message.success({ content: `${projectName}: Worktree removed`, key: `remove-${projectName}`, duration: 3 })
        setWorktreeInfo((prev) => ({ ...prev, [projectName]: null }))
        await fetchGitStatus(projectName)
      } else {
        message.error({
          content: errMsg(Err.WorktreeRemoveFailed, projectName, result.error ?? undefined),
          key: `remove-${projectName}`,
          duration: 5,
        })
      }
    } catch (error: any) {
      message.error(errMsg(Err.WorktreeRemoveFailed, undefined, error.message))
    }
  }

  // ── Command Execution ──────────────────────────────────────────────

  const handleRunCommand = () => {
    setCommandModalOpen(true)
    setCommand('')
    setCommandOutput('')
    setCommandError(null)
    setSelectedProject('workspace')
  }

  const handleExecuteCommand = async () => {
    if (!command.trim()) {
      message.warning(Err.CommandEmpty)
      return
    }
    try {
      setCommandRunning(true)
      setCommandOutput('')
      setCommandError(null)
      let workingDir: string | undefined
      if (selectedProject !== 'workspace') {
        const featureProject = feature?.projects.find((p) => p.name === selectedProject)
        if (worktreeInfo[selectedProject]) {
          workingDir = worktreeInfo[selectedProject]!
        } else if (featureProject?.worktreePath) {
          workingDir = featureProject.worktreePath
          setWorktreeInfo((prev) => ({ ...prev, [selectedProject]: featureProject.worktreePath }))
        } else {
          const config = await window.nexworkAPI.config.load()
          const project = config.projects.find((p: any) => p.name === selectedProject)
          if (project) workingDir = `${config.workspaceRoot}/${project.path}`
        }
      }
      const result = await window.nexworkAPI.runCommand(command, workingDir)
      if (result.success) {
        setCommandOutput(result.output || 'Command completed successfully (no output)')
        message.success('Command executed successfully')
      } else {
        setCommandError(result.error || Err.CommandFailed)
        setCommandOutput(result.output)
        message.error(Err.CommandFailed)
      }
    } catch (error: any) {
      setCommandError(error.message || Err.CommandFailed)
      message.error(Err.CommandFailed)
    } finally {
      setCommandRunning(false)
    }
  }

  // ── Git Operations ─────────────────────────────────────────────────

  const handleGitSync = () => setGitModalOpen(true)

  const fetchAllGitStatuses = async () => {
    if (!feature) return
    for (const project of feature.projects) {
      await fetchGitStatus(project.name)
    }
  }

  const fetchGitStatus = async (projectName: string, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    try {
      setGitOperations((prev) => ({ ...prev, [projectName]: { ...prev[projectName], fetching: true } }))
      const config = await window.nexworkAPI.config.load()
      const project = config.projects.find((p: any) => p.name === projectName)
      if (!project) return
      let workingDir: string
      const featureProject = feature?.projects.find((p) => p.name === projectName)
      if (featureProject?.worktreePath && worktreeInfo[projectName]) {
        workingDir = worktreeInfo[projectName]!
      } else if (featureProject?.worktreePath) {
        workingDir = featureProject.worktreePath
        setWorktreeInfo((prev) => ({ ...prev, [projectName]: featureProject.worktreePath }))
      } else {
        workingDir = `${config.workspaceRoot}/${project.path}`
        if (feature) {
          const worktreeResult = await window.nexworkAPI.runCommand('git worktree list', workingDir)
          if (worktreeResult.success && featureProject) {
            const worktreeLine = worktreeResult.output
              .split('\n')
              .find((line: string) => line.includes(featureProject.branch))
            if (worktreeLine) {
              const worktreePath = worktreeLine.split(/\s+/)[0]
              setWorktreeInfo((prev) => ({ ...prev, [projectName]: worktreePath }))
              workingDir = worktreePath
            }
          }
        }
      }
      const branchResult = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', workingDir)
      const branch = branchResult.success ? branchResult.output.trim() : 'unknown'
      if (!silent) {
        message.loading({ content: `Fetching ${projectName}...`, key: projectName, duration: 0 })
      }
      const fetchResult = await window.nexworkAPI.runCommand('git fetch', workingDir)
      if (!fetchResult.success) {
        const errorText = (fetchResult.error || '').toLowerCase()
        const isPermission =
          errorText.includes('permission') ||
          errorText.includes('not found') ||
          errorText.includes('could not read from remote repository')
        if (!silent) {
          if (isPermission) {
            message.error({
              content: `${projectName}: Remote unavailable (not found or no permission)`,
              key: projectName,
              duration: 3,
            })
          } else {
            message.error({ content: errMsg(Err.Offline, projectName), key: projectName, duration: 3 })
          }
        }
        setGitStatuses((prev) => ({ ...prev, [projectName]: { ahead: -1, behind: -1, branch } }))
        return
      }
      if (!silent) {
        message.destroy(projectName)
      }
      const trackingCheck = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref @{u}', workingDir)
      if (trackingCheck.success) {
        const statusResult = await window.nexworkAPI.runCommand(
          `git rev-list --left-right --count HEAD...origin/${branch}`,
          workingDir,
        )
        let ahead = 0
        let behind = 0
        if (statusResult.success) {
          const parts = statusResult.output.trim().split(/\s+/)
          ahead = parseInt(parts[0]) || 0
          behind = parseInt(parts[1]) || 0
        }
        setGitStatuses((prev) => ({ ...prev, [projectName]: { ahead, behind, branch, isLocalOnly: false } }))
      } else {
        setGitStatuses((prev) => ({
          ...prev,
          [projectName]: { ahead: -99, behind: -99, branch, isLocalOnly: true },
        }))
      }
    } catch {
      if (!silent) {
        message.error(errMsg(Err.StatusFailed, projectName))
      }
    } finally {
      setGitOperations((prev) => ({ ...prev, [projectName]: { ...prev[projectName], fetching: false } }))
    }
  }

  const handleGitPull = async (projectName: string, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    try {
      setGitOperations((prev) => ({ ...prev, [projectName]: { ...prev[projectName], pulling: true } }))
      let workingDir: string
      if (worktreeInfo[projectName]) {
        workingDir = worktreeInfo[projectName]!
        if (!silent) {
          message.loading({
            content: `${projectName}: Pulling in worktree...`,
            key: `pull-${projectName}`,
            duration: 0,
          })
        }
      } else {
        const config = await window.nexworkAPI.config.load()
        const project = config.projects.find((p: any) => p.name === projectName)
        if (!project) return
        workingDir = `${config.workspaceRoot}/${project.path}`
        if (!silent) {
          message.loading({ content: `${projectName}: Pulling...`, key: `pull-${projectName}`, duration: 0 })
        }
      }
      const remoteCheck = await window.nexworkAPI.runCommand('git ls-remote --exit-code origin', workingDir)
      if (!remoteCheck.success) {
        const errorText = (remoteCheck.error || '').toLowerCase()
        const isPermission =
          errorText.includes('permission') ||
          errorText.includes('not found') ||
          errorText.includes('could not read from remote repository')
        if (!silent) {
          message.error({
            content: isPermission
              ? `${projectName}: Remote unavailable (not found or no permission)`
              : `${projectName}: Failed to reach remote`,
            key: `pull-${projectName}`,
            duration: 3,
          })
        }
        return false
      }

      const result = await window.nexworkAPI.runCommand('git pull --no-edit', workingDir)
      if (result.success) {
        if (!silent) {
          message.success({ content: `${projectName}: Pulled successfully`, key: `pull-${projectName}`, duration: 3 })
        }
        await fetchGitStatus(projectName, { silent })
      } else {
        const errorMsg = result.error || ''
        const fullError = `${errorMsg} ${result.output || ''}`
        const errType = classifyGitError(fullError, 'pull')

        if (errType === Err.PullConflict) {
          if (!silent) {
            message.warning({ content: errMsg(Err.PullConflict, projectName), key: `pull-${projectName}`, duration: 3 })
          }
          const conflictResult = await window.nexworkAPI.git.getConflictFiles(workingDir)
          setConflictInfo({
            projectName,
            files: conflictResult.success ? conflictResult.files : [],
            workingDir,
          })
        } else if (errType === Err.PullNoRemote) {
          if (!silent) {
            message.warning({ content: errMsg(Err.PullNoRemote, projectName), key: `pull-${projectName}`, duration: 5 })
          }
        } else if (errType === Err.PullAuthFailed) {
          if (!silent) {
            message.error({
              content: errMsg(Err.PullAuthFailed, projectName),
              key: `pull-${projectName}`,
              duration: 10,
            })
          }
        } else if (errType === Err.PullDirty) {
          if (!silent) {
            message.error({ content: errMsg(Err.PullDirty, projectName), key: `pull-${projectName}`, duration: 5 })
          }
        } else {
          if (!silent) {
            message.error({
              content: errMsg(Err.PullFailed, projectName, errorMsg),
              key: `pull-${projectName}`,
              duration: 5,
            })
          }
        }
        return true
      }

      return false
    } catch (error: any) {
      if (!silent) {
        message.error(errMsg(Err.PullFailed, projectName, error.message))
      }
      return false
    } finally {
      setGitOperations((prev) => ({ ...prev, [projectName]: { ...prev[projectName], pulling: false } }))
    }
  }

  const handleGitPush = async (projectName: string, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    try {
      setGitOperations((prev) => ({ ...prev, [projectName]: { ...prev[projectName], pushing: true } }))
      let workingDir: string
      if (worktreeInfo[projectName]) {
        workingDir = worktreeInfo[projectName]!
        if (!silent) {
          message.loading({
            content: `${projectName}: Pushing from worktree...`,
            key: `push-${projectName}`,
            duration: 0,
          })
        }
      } else {
        const config = await window.nexworkAPI.config.load()
        const project = config.projects.find((p: any) => p.name === projectName)
        if (!project) return
        workingDir = `${config.workspaceRoot}/${project.path}`
        if (!silent) {
          message.loading({ content: `${projectName}: Pushing...`, key: `push-${projectName}`, duration: 0 })
        }
      }
      let result = await window.nexworkAPI.runCommand('git push', workingDir)
      if (
        !result.success &&
        (result.error?.includes('has no upstream branch') ||
          result.error?.includes('cannot be resolved to branch') ||
          result.error?.includes('does not have an upstream branch'))
      ) {
        const branchResult = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', workingDir)
        const currentBranch = branchResult.success ? branchResult.output.trim() : ''
        if (currentBranch) {
          if (!silent) {
            message.info({
              content: `${projectName}: Creating remote branch and pushing...`,
              key: `push-${projectName}`,
              duration: 0,
            })
          }
          result = await window.nexworkAPI.runCommand(
            `git push origin HEAD:refs/heads/${currentBranch} && git branch --set-upstream-to=origin/${currentBranch}`,
            workingDir,
          )
        }
      }
      if (result.success) {
        if (!silent) {
          message.success({
            content: `${projectName}: Pushed to remote!`,
            key: `push-${projectName}`,
            duration: 3,
          })
        }
        await fetchGitStatus(projectName, { silent })
        if (!worktreeInfo[projectName]) await createProjectWorktree(projectName, { silent })
        return true
      } else {
        const errorMsg = result.error || ''
        const pushErr = classifyGitError(errorMsg, 'push')
        if (!silent) {
          message.error({
            content: errMsg(pushErr, projectName, pushErr === Err.PushFailed ? errorMsg : undefined),
            key: `push-${projectName}`,
            duration: pushErr === Err.PushAuthFailed ? 10 : 5,
          })
        }
      }
      return false
    } catch (error: any) {
      if (!silent) {
        message.error(errMsg(Err.PushFailed, projectName, error.message))
      }
      return false
    } finally {
      setGitOperations((prev) => ({ ...prev, [projectName]: { ...prev[projectName], pushing: false } }))
    }
  }

  const createProjectWorktree = async (projectName: string, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    try {
      if (!feature) return
      const config = await window.nexworkAPI.config.load()
      const featureProject = feature.projects.find((p) => p.name === projectName)
      const projectConfig = config.projects.find((p: any) => p.name === projectName)
      if (!featureProject || !projectConfig) return
      const featureFolderName = feature.name.replace(/_/g, '-')
      const featureFolderPattern = `${config.workspaceRoot}/features/*${featureFolderName}*`
      const folderResult = await window.nexworkAPI.runCommand(
        `ls -d ${featureFolderPattern} 2>/dev/null || echo ""`,
        config.workspaceRoot,
      )
      if (!folderResult.success || !folderResult.output.trim()) return false
      const folderPath = folderResult.output.trim().split('\n')[0]
      const worktreePath = `${folderPath}/${projectName}`
      const checkResult = await window.nexworkAPI.runCommand(
        `test -d "${worktreePath}" && echo "exists" || echo "missing"`,
        config.workspaceRoot,
      )
      if (checkResult.output.trim() === 'exists') return true
      if (!silent) {
        message.loading({
          content: `${projectName}: Creating worktree...`,
          key: `worktree-${projectName}`,
          duration: 0,
        })
      }
      const mainRepoPath = `${config.workspaceRoot}/${projectConfig.path}`
      const targetBranch = featureProject.branch
      const currentBranchResult = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', mainRepoPath)
      if (currentBranchResult.success && currentBranchResult.output.trim() === targetBranch) {
        await window.nexworkAPI.runCommand('git checkout staging 2>/dev/null || git checkout production', mainRepoPath)
      }
      const createResult = await window.nexworkAPI.runCommand(
        `git worktree add "${worktreePath}" ${targetBranch}`,
        mainRepoPath,
      )
      if (createResult.success) {
        if (!silent) {
          message.success({
            content: `${projectName}: Worktree created successfully!`,
            key: `worktree-${projectName}`,
            duration: 3,
          })
        }
        await checkFeatureWorkspace()
        return true
      } else {
        if (!silent) {
          message.error({
            content: `${projectName}: Failed to create worktree - ${createResult.error?.substring(0, 100)}`,
            key: `worktree-${projectName}`,
            duration: 5,
          })
        }
        return false
      }
    } catch (error: any) {
      if (!silent) {
        message.error(errMsg(Err.WorktreeCreateFailed, projectName, error.message))
      }
      return false
    }
  }

  const handleCleanupWorktrees = () => {
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
            const result = await window.nexworkAPI.runCommand('git worktree prune -v', projectPath)
            if (result.success) successCount++
            else failedCount++
          } catch {
            failedCount++
          }
        }
        message.destroy('cleanup-worktrees')
        if (failedCount > 0) {
          message.warning(`Cleanup completed: ${successCount} succeeded, ${failedCount} failed`, 5)
        } else {
          message.success(`All projects cleaned up! ${successCount} project(s) processed`, 3)
        }
        await loadFeatureDetails(true)
      },
    })
  }

  // ── Batch Git Operations ───────────────────────────────────────────

  const handleCommitFeature = () => {
    if (!feature) return
    const projectsWithWorktrees = feature.projects.filter((p) => p.worktreePath).map((p) => p.name)
    setSelectedProjectsForCommit(projectsWithWorktrees)
    setCommitMessage('')
    setCommitModalOpen(true)
  }

  const handleMergeFeature = () => {
    if (!feature) return
    const projectsWithWorktrees = feature.projects.filter((p) => p.worktreePath).map((p) => p.name)
    setSelectedProjectsForMerge(projectsWithWorktrees)
    setMergeModalOpen(true)
  }

  const handleExecuteCommit = async () => {
    if (!selectedProjectsForCommit.length) {
      message.warning(Err.SelectProject)
      return
    }
    if (!commitMessage.trim()) {
      message.warning(Err.EnterCommitMsg)
      return
    }
    try {
      message.loading({ content: 'Committing changes...', key: 'commit', duration: 0 })
      let successCount = 0
      let failedCount = 0
      const errors: string[] = []
      for (const projectName of selectedProjectsForCommit) {
        const project = feature?.projects.find((p) => p.name === projectName)
        if (!project?.worktreePath) continue
        try {
          await window.nexworkAPI.runCommand('git add .', project.worktreePath)
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
              <p>{successCount} project(s) committed successfully</p>
              <p>{failedCount} project(s) failed:</p>
              <ul>
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          ),
        })
      } else {
        message.success(`Committed changes in ${successCount} project(s)!`)
      }
      setCommitModalOpen(false)
      await loadFeatureDetails(true)
    } catch (error: any) {
      message.error({ content: errMsg(Err.CommitFailed, undefined, error.message), key: 'commit' })
    }
  }

  const handleExecuteMerge = async () => {
    if (!selectedProjectsForMerge.length) {
      message.warning(Err.SelectProject)
      return
    }
    try {
      message.loading({ content: 'Merging branches...', key: 'merge', duration: 0 })
      let successCount = 0
      let failedCount = 0
      const errors: string[] = []
      for (const projectName of selectedProjectsForMerge) {
        const project = feature?.projects.find((p) => p.name === projectName)
        if (!project?.worktreePath) continue
        const baseBranch = project.baseBranch || 'staging'
        try {
          await window.nexworkAPI.runCommand(`git checkout ${baseBranch}`, project.worktreePath)
          await window.nexworkAPI.runCommand(`git pull origin ${baseBranch}`, project.worktreePath)
          const mergeResult = await window.nexworkAPI.runCommand(`git merge ${project.branch}`, project.worktreePath)
          if (!mergeResult.success) {
            const mergeErr = mergeResult.error || ''
            if (
              mergeErr.includes('CONFLICT') ||
              mergeErr.includes('Automatic merge failed') ||
              mergeResult.output?.includes('CONFLICT')
            ) {
              const conflictResult = await window.nexworkAPI.git.getConflictFiles(project.worktreePath)
              setConflictInfo({
                projectName,
                files: conflictResult.success ? conflictResult.files : [],
                workingDir: project.worktreePath,
              })
              failedCount++
              errors.push(`${projectName}: Merge conflicts detected`)
            } else {
              failedCount++
              errors.push(`${projectName}: ${mergeErr}`)
            }
          } else {
            successCount++
          }
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
              <p>{successCount} project(s) merged successfully</p>
              <p>{failedCount} project(s) failed:</p>
              <ul>
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          ),
        })
      } else {
        message.success(`Merged ${successCount} project(s) successfully!`)
      }
      setMergeModalOpen(false)
      await loadFeatureDetails(true)
    } catch (error: any) {
      message.error({ content: errMsg(Err.MergeFailed, undefined, error.message), key: 'merge' })
    }
  }

  const handleAbortMerge = async () => {
    if (!conflictInfo) return
    try {
      await window.nexworkAPI.runCommand('git merge --abort', conflictInfo.workingDir)
      message.success(`${conflictInfo.projectName}: Merge aborted`)
      setConflictInfo(null)
      await fetchAllGitStatuses()
    } catch (error: any) {
      message.error(errMsg(Err.AbortFailed, undefined, error.message))
    }
  }

  const handleMarkResolved = async () => {
    if (!conflictInfo) return
    try {
      await window.nexworkAPI.runCommand('git add .', conflictInfo.workingDir)
      message.success(`${conflictInfo.projectName}: Conflicts marked as resolved. Use the Commit modal to commit.`)
      setConflictInfo(null)
      await fetchAllGitStatuses()
    } catch (error: any) {
      message.error(errMsg(Err.ResolveFailed, undefined, error.message))
    }
  }

  const handleCreatePR = () => {
    setPrModalOpen(true)
  }

  const handlePullAll = async () => {
    if (!feature) return
    try {
      const projectsWithWorktrees: string[] = []
      const projectsWithoutWorktrees: string[] = []
      const failedProjects: string[] = []
      feature.projects.forEach((p) => {
        if (p.worktreePath || worktreeInfo[p.name]) projectsWithWorktrees.push(p.name)
        else projectsWithoutWorktrees.push(p.name)
      })
      let createdCount = 0
      let pulledCount = 0
      let failedCount = 0
      if (projectsWithoutWorktrees.length > 0) {
        message.loading({
          content: `Creating worktrees for ${projectsWithoutWorktrees.length} project(s)...`,
          key: 'pull-all',
          duration: 0,
        })
        for (const pn of projectsWithoutWorktrees) {
          try {
            const created = await createProjectWorktree(pn, { silent: true })
            if (created) {
              createdCount++
              projectsWithWorktrees.push(pn)
            } else {
              failedCount++
              failedProjects.push(pn)
            }
          } catch {
            failedCount++
            failedProjects.push(pn)
          }
        }
      }
      if (projectsWithWorktrees.length > 0) {
        message.loading({
          content: `Checking remote tracking for ${projectsWithWorktrees.length} project(s)...`,
          key: 'pull-all',
          duration: 0,
        })
        const pullPromises = projectsWithWorktrees.map(async (pn) => {
          try {
            let workingDir: string
            if (worktreeInfo[pn]) {
              workingDir = worktreeInfo[pn]!
            } else {
              const config = await window.nexworkAPI.config.load()
              const project = config.projects.find((p: any) => p.name === pn)
              if (!project) return
              workingDir = `${config.workspaceRoot}/${project.path}`
            }
            const trackingCheck = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref @{u}', workingDir)
            if (trackingCheck.success) {
              const pulled = await handleGitPull(pn, { silent: true })
              if (pulled) {
                pulledCount++
              } else {
                failedCount++
                failedProjects.push(pn)
              }
            }
          } catch {
            failedCount++
            failedProjects.push(pn)
          }
        })
        await Promise.all(pullPromises)
      }
      message.destroy('pull-all')
      const parts = []
      if (createdCount > 0) parts.push(`${createdCount} worktree(s) created`)
      if (pulledCount > 0) parts.push(`${pulledCount} project(s) pulled`)
      if (failedCount > 0) parts.push(`${failedCount} failed`)
      const summary = parts.join(', ')
      const localOnlyCount = projectsWithWorktrees.length - pulledCount - failedCount
      if (failedCount > 0) {
        message.error(`Failed to pull: ${failedProjects.join(', ')}`, 5)
      } else if (createdCount > 0 && pulledCount === 0) {
        message.success(`${createdCount} worktree(s) created! Branches are local only - push when ready.`, 5)
      } else if (localOnlyCount > 0) {
        if (summary) {
          message.success(`${summary}. ${localOnlyCount} branch(es) are local only - push when ready.`, 5)
        } else {
          message.success(`${localOnlyCount} branch(es) are local only - push when ready.`, 5)
        }
      } else {
        message.success('Successfully pulled all projects.', 3)
      }
    } catch (error: any) {
      message.error(errMsg(Err.PullAllFailed, undefined, error.message))
    }
  }

  const handlePushAll = async () => {
    if (!feature) return
    try {
      message.loading({ content: `Pushing ${feature.projects.length} project(s)...`, key: 'push-all', duration: 0 })
      const failedProjects: string[] = []

      await Promise.all(
        feature.projects.map(async (p) => {
          const pushed = await handleGitPush(p.name, { silent: true })
          if (!pushed) {
            failedProjects.push(p.name)
          }
        }),
      )

      message.destroy('push-all')
      if (failedProjects.length > 0) {
        message.error(`Failed to push: ${failedProjects.join(', ')}`, 5)
      } else {
        message.success('Successfully pushed all projects.', 3)
      }
    } catch (error: any) {
      message.destroy('push-all')
      message.error(errMsg(Err.PushFailed, undefined, error.message))
    }
  }

  // ── IDE / Terminal ─────────────────────────────────────────────────

  const handleTerminalOption = (projectName: string, option: 'external' | 'integrated') => {
    const newPreferences = { ...projectTerminalPreferences, [projectName]: option }
    setProjectTerminalPreferences(newPreferences)
    localStorage.setItem('projectTerminalPreferences', JSON.stringify(newPreferences))
    if (option === 'integrated') {
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
        message.warning(Err.WorktreeNotFound)
        return
      }
      const appToUse = terminalApp || projectTerminalAppPreferences[projectName] || 'terminal'
      const terminalNames: Record<string, string> = {
        terminal: 'Terminal',
        iterm2: 'iTerm2',
        warp: 'Warp',
        alacritty: 'Alacritty',
        kitty: 'Kitty',
        hyper: 'Hyper',
      }
      if (terminalApp) {
        const newPreferences = { ...projectTerminalAppPreferences, [projectName]: terminalApp }
        setProjectTerminalAppPreferences(newPreferences)
        localStorage.setItem('projectTerminalAppPreferences', JSON.stringify(newPreferences))
      }
      const result = await window.nexworkAPI.openInTerminal(worktreePath, appToUse)
      if (result.success) message.success(`Opening ${projectName} in ${terminalNames[appToUse]}`)
      else message.error(errMsg(Err.TerminalFailed, projectName, result.error))
    } catch (error: any) {
      message.error(errMsg(Err.TerminalFailed, projectName, error.message))
    }
  }

  const handleOpenInIDE = async (projectName: string, ide?: string) => {
    try {
      const worktreePath = worktreeInfo[projectName]
      if (!worktreePath) {
        message.warning(Err.WorktreeNotFound)
        return
      }
      const ideToUse = ide || projectIDEPreferences[projectName] || preferredIDE
      const ideNames: Record<string, string> = {
        vscode: 'VS Code',
        cursor: 'Cursor',
        rider: 'Rider',
        webstorm: 'WebStorm',
        intellij: 'IntelliJ IDEA',
        'code-insiders': 'VS Code Insiders',
      }
      if (ide) {
        const newPreferences = { ...projectIDEPreferences, [projectName]: ide }
        setProjectIDEPreferences(newPreferences)
        localStorage.setItem('projectIDEPreferences', JSON.stringify(newPreferences))
      }
      const result = await window.nexworkAPI.openInIDE(worktreePath, ideToUse)
      if (result.success) message.success(`Opening ${projectName} in ${ideNames[ideToUse]}`)
      else message.error(errMsg(Err.IDEFailed, projectName, result.error))
    } catch (error: any) {
      message.error(errMsg(Err.IDEFailed, projectName, error.message))
    }
  }

  const handleOpenInVSCode = async (projectName: string) => {
    await handleOpenInIDE(projectName, 'vscode')
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (loading || !feature || !stats) {
    return <div>Loading...</div>
  }

  const ctx: FeatureDetailsContext = {
    feature,
    stats,
    loading,
    refreshing,
    workspaceRoot,
    featureFolderPath,
    worktreeInfo,
    gitStatuses,
    gitOperations,
    projectWorktreeStatus,
    creatingWorktrees,
    localFeatureBranches,
    preferredIDE,
    projectIDEPreferences,
    projectTerminalPreferences,
    projectTerminalAppPreferences,
    commandModalOpen,
    command,
    commandRunning,
    commandOutput,
    commandError,
    selectedProject,
    gitModalOpen,
    commitModalOpen,
    mergeModalOpen,
    prModalOpen,
    commitMessage,
    selectedProjectsForCommit,
    selectedProjectsForMerge,
    conflictInfo,
    loadFeatureDetails,
    handleUpdateStatus,
    handleComplete,
    handleDelete,
    handleRefresh,
    handleSyncWorktrees,
    handleCleanupExpired,
    handleExtendExpiration,
    handleCreateWorktree,
    handleRunCommand,
    handleExecuteCommand,
    handleGitSync,
    fetchGitStatus,
    fetchAllGitStatuses,
    handleGitPull,
    handleGitPush,
    handleCleanupWorktrees,
    handleCommitFeature,
    handleMergeFeature,
    handleExecuteCommit,
    handleExecuteMerge,
    handleTerminalOption,
    handleOpenInTerminal,
    handleOpenInIDE,
    handleOpenInVSCode,
    handleRemoveWorktree,
    handlePullAll,
    handlePushAll,
    handleAbortMerge,
    handleMarkResolved,
    handleCreatePR,
    setCommandModalOpen,
    setCommand,
    setSelectedProject,
    setGitModalOpen,
    setCommitModalOpen,
    setMergeModalOpen,
    setCommitMessage,
    setSelectedProjectsForCommit,
    setSelectedProjectsForMerge,
    setPrModalOpen,
    setConflictInfo,
    featureName,
    onBack,
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '8px 0 32px', overflowX: 'hidden' }}>
      <FeatureHeader ctx={ctx} />
      <FeatureActions ctx={ctx} />
      <RunCommandModal ctx={ctx} />
      <CommitModal ctx={ctx} />
      <MergeModal ctx={ctx} />
      <PRModal ctx={ctx} />
      <ConflictViewer ctx={ctx} />
      <FeatureStatsRow ctx={ctx} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 16,
          alignItems: 'start',
          marginBottom: 16,
        }}
      >
        <FeatureWorkspace ctx={ctx} />
        <WorktreesList ctx={ctx} />
      </div>

      {feature && <ChangesViewer featureName={featureName} projects={feature.projects} />}

      {feature && <CommitTimeline featureName={featureName} projects={feature.projects} />}

      {workspaceRoot && (
        <div data-terminal-section style={{ marginTop: 8 }}>
          <IntegratedTerminal feature={feature} workspaceRoot={workspaceRoot} />
        </div>
      )}

      <GitSyncModal ctx={ctx} />
    </div>
  )
}
