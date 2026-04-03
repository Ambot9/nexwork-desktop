import { useState, useEffect } from 'react'
import {
  message,
  Modal,
  Space,
  Typography,
  DatePicker,
  Alert,
  Button,
  Select,
  Switch,
  Card,
  Tabs,
  Checkbox,
} from 'antd'
import dayjs from 'dayjs'
import type { Feature, FeatureStats } from '../types'
import type { PluginDescriptor } from '../plugins/types'
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
  DocsRepoSummary,
} from '../components/feature-details/types'
import { Err, errMsg, classifyGitError } from '../components/feature-details/types'

const { Text } = Typography
const MEMSTACK_STALE_THRESHOLD_MS = 5000

function getMemstackSyncState(
  feature?: Feature | null,
): 'not_tracked' | 'not_synced' | 'up_to_date' | 'out_of_date' | 'failed' {
  const ref = feature?.pluginRefs?.memstack

  if (!ref?.tracked) {
    return 'not_tracked'
  }

  if (ref.lastSyncStatus === 'failed') {
    return 'failed'
  }

  if (!ref.lastSyncAt) {
    return 'not_synced'
  }

  const updatedAt = feature?.updatedAt ? new Date(feature.updatedAt).getTime() : 0
  const lastSyncAt = new Date(ref.lastSyncAt).getTime()
  return updatedAt - lastSyncAt > MEMSTACK_STALE_THRESHOLD_MS ? 'out_of_date' : 'up_to_date'
}

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
  const [mergeTargetBranch, setMergeTargetBranch] = useState<string>('staging')
  const [mergeAvailableBranches, setMergeAvailableBranches] = useState<Record<string, string[]>>({})
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null)
  const [prModalOpen, setPrModalOpen] = useState(false)
  const [worktreeInfo, setWorktreeInfo] = useState<Record<string, string | null>>({})
  const [workspaceRoot, setWorkspaceRoot] = useState<string>('')
  const [featureFolderPath, setFeatureFolderPath] = useState<string>('')
  const [projectWorktreeStatus, setProjectWorktreeStatus] = useState<Record<string, WorktreeStatus>>({})
  const [creatingWorktrees, setCreatingWorktrees] = useState<Record<string, boolean>>({})
  const [localFeatureBranches, setLocalFeatureBranches] = useState<Record<string, boolean>>({})
  const [projectDependencies, setProjectDependencies] = useState<Record<string, string[]>>({})
  const [addingRequiredProjects, setAddingRequiredProjects] = useState(false)
  const [availableProjects, setAvailableProjects] = useState<string[]>([])
  const [addProjectsModalOpen, setAddProjectsModalOpen] = useState(false)
  const [addProjectsSubmitting, setAddProjectsSubmitting] = useState(false)
  const [addProjectSelections, setAddProjectSelections] = useState<string[]>([])
  const [addProjectBaseBranches, setAddProjectBaseBranches] = useState<Record<string, string>>({})
  const [addProjectPullFirst, setAddProjectPullFirst] = useState<Record<string, boolean>>({})
  const [addProjectsAvailableBranches, setAddProjectsAvailableBranches] = useState<Record<string, string[]>>({})
  const [plugins, setPlugins] = useState<PluginDescriptor[]>([])
  const [docsRepoSummary, setDocsRepoSummary] = useState<DocsRepoSummary>({
    mode: 'none',
    state: 'unknown',
    label: 'Docs repo not in use',
  })
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
      const [featureData, config, pluginData] = await Promise.all([
        window.nexworkAPI.features.getByName(featureName),
        window.nexworkAPI.config.load(),
        window.nexworkAPI.plugins.getAll().catch(() => []),
      ])
      setFeature(featureData)
      setStats(statsData)
      setPlugins(pluginData)
      setWorkspaceRoot(config.workspaceRoot)
      setProjectDependencies(config.userConfig?.projectDependencies || {})
      setAvailableProjects((config.projects || []).map((project: any) => project.name))
      if (featureData?.projects) {
        const newWorktreeInfo: Record<string, string | null> = {}
        featureData.projects.forEach((p: any) => {
          if (p.worktreePath) newWorktreeInfo[p.name] = p.worktreePath
        })
        setWorktreeInfo(newWorktreeInfo)
      }

      const memstackPlugin = pluginData.find((plugin: PluginDescriptor) => plugin.id === 'memstack' && plugin.enabled)
      const writeMode =
        typeof memstackPlugin?.config?.storageWriteMode === 'string' ? memstackPlugin.config.storageWriteMode : 'server'

      if (!memstackPlugin) {
        setDocsRepoSummary({
          mode: 'none',
          state: 'unknown',
          label: 'Docs repo not in use',
        })
      } else if (writeMode !== 'desktop') {
        setDocsRepoSummary({
          mode: 'server',
          state: memstackPlugin.status.state === 'ready' ? 'ready' : 'not_ready',
          label: memstackPlugin.status.state === 'ready' ? 'Server Sync ready' : 'Server Sync needs setup',
        })
      } else {
        try {
          const layout = await window.nexworkAPI.plugins.runAction('memstack', 'detectDocsLayout')
          if (layout.success && layout.result?.hasOldLayout) {
            setDocsRepoSummary({
              mode: 'desktop',
              state: 'needs_migration',
              label: 'Docs repo needs migration',
            })
          } else if (layout.success) {
            setDocsRepoSummary({
              mode: 'desktop',
              state: 'ready',
              label: 'Docs repo ready',
            })
          } else {
            setDocsRepoSummary({
              mode: 'desktop',
              state: 'not_ready',
              label: 'Docs repo needs setup',
            })
          }
        } catch {
          setDocsRepoSummary({
            mode: 'desktop',
            state: 'not_ready',
            label: 'Docs repo needs setup',
          })
        }
      }
    } catch (error) {
      console.error('Failed to load feature details:', error)
      if (!silent) message.error(Err.LoadFailed)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const getMissingRequiredProjects = () => {
    if (!feature) {
      return []
    }

    const selectedProjects = feature.projects.map((project) => project.name)
    const selectedSet = new Set(selectedProjects)
    const missingProjects = new Set<string>()
    const queue = [...selectedProjects]

    while (queue.length > 0) {
      const projectName = queue.shift()
      if (!projectName) continue
      ;(projectDependencies[projectName] || []).forEach((dependencyName) => {
        if (!selectedSet.has(dependencyName)) {
          missingProjects.add(dependencyName)
          selectedSet.add(dependencyName)
          queue.push(dependencyName)
        }
      })
    }

    return Array.from(missingProjects)
  }

  const resolveProjectsToAdd = (selectedProjects: string[]) => {
    if (!feature) {
      return []
    }

    const existingProjects = feature.projects.map((project) => project.name)
    const resolved = new Set<string>(existingProjects)
    const queue = [...selectedProjects]

    while (queue.length > 0) {
      const projectName = queue.shift()
      if (!projectName || resolved.has(projectName) || !availableProjects.includes(projectName)) {
        continue
      }

      resolved.add(projectName)

      for (const dependencyName of projectDependencies[projectName] || []) {
        if (!resolved.has(dependencyName) && availableProjects.includes(dependencyName)) {
          queue.push(dependencyName)
        }
      }
    }

    return Array.from(resolved).filter((projectName) => !existingProjects.includes(projectName))
  }

  const loadBranchesForProjects = async (projectNames: string[]) => {
    const config = await window.nexworkAPI.config.load()
    const branchOptions: Record<string, string[]> = {}
    const baseBranchDefaults: Record<string, string> = {}

    await Promise.all(
      projectNames.map(async (projectName) => {
        const project = config.projects.find((entry: any) => entry.name === projectName)
        if (!project) {
          branchOptions[projectName] = ['staging']
          baseBranchDefaults[projectName] = 'staging'
          return
        }

        const projectPath = `${config.workspaceRoot}/${project.path}`
        const [branchesResult, currentBranchResult] = await Promise.all([
          window.nexworkAPI.runCommand(
            'git branch -a | sed "s/remotes\\/origin\\///" | sed "s/^[* ]*//" | grep -v "HEAD" | sort -u',
            projectPath,
          ),
          window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', projectPath),
        ])

        const branches = branchesResult.success
          ? branchesResult.output
              .trim()
              .split('\n')
              .map((branch) => branch.trim())
              .filter(Boolean)
          : []

        const preferredBranches = branches.filter((branch) =>
          ['production', 'staging', 'demo', 'master', 'main', 'develop'].includes(branch.toLowerCase()),
        )
        const options = preferredBranches.length > 0 ? preferredBranches : branches
        const fallbackBranch = currentBranchResult.success ? currentBranchResult.output.trim() : 'staging'

        branchOptions[projectName] = Array.from(new Set(options.length > 0 ? options : [fallbackBranch]))
        baseBranchDefaults[projectName] = branchOptions[projectName].includes(fallbackBranch)
          ? fallbackBranch
          : branchOptions[projectName][0]
      }),
    )

    setMergeAvailableBranches(branchOptions)
    setAddProjectsAvailableBranches(branchOptions)
    setAddProjectBaseBranches((prev) => ({ ...baseBranchDefaults, ...prev }))
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
      const savedFeatureFolderPath = featureData.featureFolderPath?.trim()
      let detectedPath = ''

      if (savedFeatureFolderPath) {
        const savedPathResult = await window.nexworkAPI.runCommand(
          `test -d "${savedFeatureFolderPath}" && echo "exists" || echo "missing"`,
          config.workspaceRoot,
        )

        if (savedPathResult.success && savedPathResult.output.trim() === 'exists') {
          detectedPath = savedFeatureFolderPath
        }
      }

      if (!detectedPath) {
        const featureFolderName = featureData.name.replace(/_/g, '-')
        const featureFolderPattern = `${config.workspaceRoot}/features/*${featureFolderName}*`
        const folderResult = await window.nexworkAPI.runCommand(
          `ls -d ${featureFolderPattern} 2>/dev/null || echo ""`,
          config.workspaceRoot,
        )

        if (folderResult.success && folderResult.output.trim()) {
          detectedPath = folderResult.output.trim().split('\n')[0]
          if (detectedPath && detectedPath !== savedFeatureFolderPath) {
            try {
              await window.nexworkAPI.features.update(featureData.name, { featureFolderPath: detectedPath })
            } catch {
              // ignore path backfill errors
            }
          }
        }
      }

      if (detectedPath) {
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
      message.success(`${projectName} updated`)
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
    const memstackReady = plugins.some(
      (plugin) => plugin.id === 'memstack' && plugin.enabled && plugin.status.state === 'ready',
    )
    const memstackPlugin = plugins.find((plugin) => plugin.id === 'memstack' && plugin.enabled)
    const desktopSyncEnabled = memstackPlugin?.config?.storageWriteMode === 'desktop'
    let syncToMemstack = memstackReady && Boolean(feature?.pluginRefs?.memstack?.tracked)
    let desktopSyncBranch =
      typeof memstackPlugin?.config?.storageBranch === 'string' && memstackPlugin.config.storageBranch.trim()
        ? memstackPlugin.config.storageBranch.trim()
        : 'main'

    const openCompleteModal = (branchOptions: string[]) =>
      Modal.confirm({
        title: 'Complete feature?',
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
            {memstackReady && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  borderRadius: 12,
                }}
              >
                <div>
                  <Text strong>Sync to Feature Memory</Text>
                  <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                    Store the final completion state in MemStack when this feature is completed.
                  </Text>
                </div>
                <Checkbox
                  defaultChecked={syncToMemstack}
                  onChange={(checkedEvent: { target: { checked: boolean } }) => {
                    syncToMemstack = checkedEvent.target.checked
                  }}
                />
              </div>
            )}
            {memstackReady && desktopSyncEnabled && syncToMemstack && (
              <div>
                <Text strong style={{ fontSize: 12 }}>
                  Docs Branch
                </Text>
                <Select
                  style={{ width: '100%', marginTop: 4 }}
                  defaultValue={desktopSyncBranch}
                  options={branchOptions.map((branch) => ({ label: branch, value: branch }))}
                  onChange={(value) => {
                    desktopSyncBranch = value
                  }}
                />
                <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 6 }}>
                  Nexwork will switch to this branch, pull latest if needed, then commit the Feature Memory docs there.
                </Text>
              </div>
            )}
          </Space>
        ),
        okText: 'Complete Feature',
        okType: 'primary',
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            message.loading({ content: 'Completing feature...', key: 'complete-feature', duration: 0 })
            const result = await window.nexworkAPI.features.complete(featureName, true, {
              syncToMemstack,
              desktopSyncBranch,
            })
            message.success({
              content: result?.memstackMessage ? `Feature completed. ${result.memstackMessage}` : 'Feature completed',
              key: 'complete-feature',
              duration: 4,
            })
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

    if (memstackReady && desktopSyncEnabled && syncToMemstack) {
      window.nexworkAPI.plugins
        .runAction('memstack', 'listDesktopSyncBranches')
        .then((result) => {
          const branches =
            Array.isArray(result?.result?.branches) && result.result.branches.length > 0
              ? result.result.branches
              : [desktopSyncBranch]
          if (!branches.includes(desktopSyncBranch)) {
            desktopSyncBranch = branches[0]
          }
          openCompleteModal(branches)
        })
        .catch(() => openCompleteModal([desktopSyncBranch]))
      return
    }

    openCompleteModal([desktopSyncBranch])
  }

  const handleDelete = () => {
    if (!feature) return
    const worktreeCount = feature.projects.filter((p) => p.worktreePath).length
    const memstackSyncState = getMemstackSyncState(feature)

    Modal.confirm({
      title: 'Delete feature?',
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
          {memstackSyncState !== 'not_tracked' ? (
            memstackSyncState === 'up_to_date' ? (
              <Alert
                type="warning"
                showIcon
                message="Feature Memory may still exist"
                description="Deleting this feature removes the local Nexwork record only. Previously synced MemStack data may still exist in the storage repo or MemStack service."
              />
            ) : memstackSyncState === 'failed' ? (
              <Alert
                type="error"
                showIcon
                message="Feature Memory sync failed"
                description="The latest MemStack sync did not succeed. Shared memory may be incomplete or outdated if you delete this feature now."
              />
            ) : memstackSyncState === 'out_of_date' ? (
              <Alert
                type="warning"
                showIcon
                message="Feature Memory is out of date"
                description="Local feature changes appear newer than the last successful MemStack sync. Deleting now may remove context that has not been stored yet."
              />
            ) : (
              <Alert
                type="warning"
                showIcon
                message="Feature Memory may not be synced yet"
                description="This feature is tracked with Feature Memory, but no sync marker was found yet. If you delete it now, requirement or implementation context may be lost before it is stored."
              />
            )
          ) : (
            <Text type="danger">This cannot be undone.</Text>
          )}
        </Space>
      ),
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          message.loading({ content: 'Deleting feature...', key: 'delete-feature', duration: 0 })
          await window.nexworkAPI.features.delete(featureName)
          message.success({ content: 'Feature deleted', key: 'delete-feature', duration: 3 })
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
      message.success('Refreshed')
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
      message.success({ content: 'Worktrees synced', key: 'sync', duration: 3 })
    } catch {
      message.error({ content: Err.SyncFailed, key: 'sync', duration: 3 })
    }
  }

  const handleCleanupExpired = () => {
    if (!feature) return
    Modal.confirm({
      title: 'Clean up expired feature',
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
            This cannot be undone.
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
          message.success('Date updated')
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
          content: `${projectName}: Worktree ready. Push when ready.`,
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

  const handleAddRequiredProjects = async () => {
    if (!feature) return

    const missingProjects = getMissingRequiredProjects()
    if (missingProjects.length === 0) {
      return
    }

    try {
      setAddingRequiredProjects(true)
      const result = await window.nexworkAPI.features.addProjects(feature.name, missingProjects)
      const addedProjects = result?.addedProjects || []

      if (addedProjects.length > 0) {
        message.success(`Added: ${addedProjects.join(', ')}`)
      } else {
        message.info('Nothing to add')
      }

      await loadFeatureDetails(true)
      await checkFeatureWorkspace()
      await loadCurrentBranches()
    } catch (error: any) {
      message.error(error.message || 'Failed to add required projects')
    } finally {
      setAddingRequiredProjects(false)
    }
  }

  const handleAddProjects = () => {
    if (!feature) return

    const existingProjects = new Set(feature.projects.map((project) => project.name))
    const selectableProjects = availableProjects.filter((projectName) => !existingProjects.has(projectName))

    if (selectableProjects.length === 0) {
      message.info('No projects left to add')
      return
    }
    setAddProjectSelections([])
    setAddProjectBaseBranches({})
    setAddProjectPullFirst({})
    setAddProjectsAvailableBranches({})
    setAddProjectsModalOpen(true)
    loadBranchesForProjects(selectableProjects).catch((error) => {
      console.error('Failed to load branches for add-projects modal:', error)
    })
  }

  const handleConfirmAddProjects = async () => {
    if (!feature) return

    if (addProjectSelections.length === 0) {
      message.warning('Select at least one project')
      return
    }

    try {
      setAddProjectsSubmitting(true)

      const projectsToAdd = resolveProjectsToAdd(addProjectSelections)
      const requestPayload = projectsToAdd.map((projectName) => ({
        name: projectName,
        baseBranch: addProjectBaseBranches[projectName],
        pullFirst: !!addProjectPullFirst[projectName],
      }))

      const result = await window.nexworkAPI.features.addProjects(feature.name, requestPayload)
      const addedProjects = result?.addedProjects || []

      if (addedProjects.length > 0) {
        message.success(`Added projects: ${addedProjects.join(', ')}`)
      } else {
        message.info('Nothing changed')
      }

      setAddProjectsModalOpen(false)
      await loadFeatureDetails(true)
      await checkFeatureWorkspace()
      await loadCurrentBranches()
    } catch (error: any) {
      message.error(error.message || 'Failed to add projects')
    } finally {
      setAddProjectsSubmitting(false)
    }
  }

  const handleRemoveWorktree = async (projectName: string) => {
    try {
      const worktreePath = worktreeInfo[projectName]
      if (!worktreePath) {
        message.warning(Err.WorktreeNotFound)
        return
      }
      message.loading({ content: `Removing ${projectName}...`, key: `remove-${projectName}`, duration: 0 })

      const result = await window.nexworkAPI.projects.removeWorktree(featureName, projectName)
      if (!result?.success) {
        throw new Error(result?.error || Err.WorktreeRemoveFailed)
      }

      message.success({ content: `${projectName}: Removed`, key: `remove-${projectName}`, duration: 3 })
      setWorktreeInfo((prev) => ({ ...prev, [projectName]: null }))
      await loadFeatureDetails(true)
      await checkFeatureWorkspace()
      await fetchGitStatus(projectName, { silent: true })
    } catch (error: any) {
      message.error({
        content: errMsg(Err.WorktreeRemoveFailed, projectName, error.message),
        key: `remove-${projectName}`,
        duration: 5,
      })
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
        setCommandOutput(result.output || 'Done.')
        message.success('Done')
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
              content: `${projectName}: Remote unavailable`,
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
            content: isPermission ? `${projectName}: Remote unavailable` : `${projectName}: Failed to reach remote`,
            key: `pull-${projectName}`,
            duration: 3,
          })
        }
        return false
      }

      const result = await window.nexworkAPI.runCommand('git pull --no-edit', workingDir)
      if (result.success) {
        if (!silent) {
          message.success({ content: `${projectName}: Pulled`, key: `pull-${projectName}`, duration: 3 })
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
              content: `${projectName}: Creating remote branch...`,
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
            content: `${projectName}: Pushed`,
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
            content: `${projectName}: Worktree ready`,
            key: `worktree-${projectName}`,
            duration: 3,
          })
        }
        await checkFeatureWorkspace()
        return true
      } else {
        if (!silent) {
          message.error({
            content: `${projectName}: Could not create the worktree`,
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
      title: 'Clean up stale worktrees',
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
          message.warning(`${successCount} cleaned, ${failedCount} failed`, 5)
        } else {
          message.success(`${successCount} project(s) cleaned`, 3)
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
    loadBranchesForProjects(projectsWithWorktrees)
    setMergeTargetBranch(feature.projects.find((entry) => entry.worktreePath)?.baseBranch || 'staging')
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
          title: 'Commit finished with issues',
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
        message.success(`Committed ${successCount} project(s)`)
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
    if (!mergeTargetBranch) {
      message.warning('Select a target branch')
      return
    }
    try {
      message.loading({ content: 'Merging branches...', key: 'merge', duration: 0 })
      let successCount = 0
      let failedCount = 0
      const errors: string[] = []
      const config = await window.nexworkAPI.config.load()
      for (const projectName of selectedProjectsForMerge) {
        const project = feature?.projects.find((p) => p.name === projectName)
        const projectConfig = config.projects.find((p: any) => p.name === projectName)
        if (!project || !projectConfig) continue
        const mainRepoPath = `${config.workspaceRoot}/${projectConfig.path}`
        const targetBranch = mergeTargetBranch
        try {
          const dirtyResult = await window.nexworkAPI.runCommand('git status --porcelain', mainRepoPath)
          if (!dirtyResult.success) {
            throw new Error(dirtyResult.error || 'Failed to inspect repo status')
          }
          if (dirtyResult.output.trim()) {
            throw new Error('Main repo has uncommitted changes. Commit or stash them before merging.')
          }

          const fetchResult = await window.nexworkAPI.runCommand('git fetch origin --prune', mainRepoPath)
          if (!fetchResult.success) {
            throw new Error(fetchResult.error || 'Failed to fetch latest remote refs')
          }

          const localTargetExists = await window.nexworkAPI.runCommand(
            `git show-ref --verify --quiet refs/heads/${targetBranch}`,
            mainRepoPath,
          )
          const remoteTargetExists = await window.nexworkAPI.runCommand(
            `git show-ref --verify --quiet refs/remotes/origin/${targetBranch}`,
            mainRepoPath,
          )

          let checkoutResult
          if (localTargetExists.success) {
            checkoutResult = await window.nexworkAPI.runCommand(`git checkout ${targetBranch}`, mainRepoPath)
          } else if (remoteTargetExists.success) {
            checkoutResult = await window.nexworkAPI.runCommand(
              `git checkout -b ${targetBranch} --track origin/${targetBranch}`,
              mainRepoPath,
            )
          } else {
            checkoutResult = await window.nexworkAPI.runCommand(`git checkout -b ${targetBranch}`, mainRepoPath)
          }

          if (!checkoutResult.success) {
            throw new Error(checkoutResult.error || `Failed to checkout ${targetBranch}`)
          }

          if (remoteTargetExists.success) {
            const pullResult = await window.nexworkAPI.runCommand(
              `git pull --ff-only origin ${targetBranch}`,
              mainRepoPath,
            )
            if (!pullResult.success) {
              throw new Error(pullResult.error || `Failed to pull latest ${targetBranch}`)
            }
          }

          const mergeResult = await window.nexworkAPI.runCommand(`git merge ${project.branch}`, mainRepoPath)
          if (!mergeResult.success) {
            const mergeErr = mergeResult.error || ''
            if (
              mergeErr.includes('CONFLICT') ||
              mergeErr.includes('Automatic merge failed') ||
              mergeResult.output?.includes('CONFLICT')
            ) {
              const conflictResult = await window.nexworkAPI.git.getConflictFiles(mainRepoPath)
              setConflictInfo({
                projectName,
                files: conflictResult.success ? conflictResult.files : [],
                workingDir: mainRepoPath,
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
          title: 'Merge finished with issues',
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
        message.success(`Merged ${successCount} project(s)`)
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
      message.success(`${conflictInfo.projectName}: Merge stopped`)
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
      message.success(`${conflictInfo.projectName}: Conflicts staged`)
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
          content: `Creating ${projectsWithoutWorktrees.length} worktree(s)...`,
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
          content: `Checking ${projectsWithWorktrees.length} project(s)...`,
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
        message.error(`Pull failed: ${failedProjects.join(', ')}`, 5)
      } else if (createdCount > 0 && pulledCount === 0) {
        message.success(`${createdCount} worktree(s) ready. Push when ready.`, 5)
      } else if (localOnlyCount > 0) {
        if (summary) {
          message.success(`${summary}. ${localOnlyCount} local-only branch(es).`, 5)
        } else {
          message.success(`${localOnlyCount} local-only branch(es).`, 5)
        }
      } else {
        message.success('All projects pulled', 3)
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
        message.success('All projects pushed', 3)
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
        message.info(`Use the terminal below for ${projectName}`)
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
      if (terminalApp) {
        const newPreferences = { ...projectTerminalAppPreferences, [projectName]: terminalApp }
        setProjectTerminalAppPreferences(newPreferences)
        localStorage.setItem('projectTerminalAppPreferences', JSON.stringify(newPreferences))
      }
      const result = await window.nexworkAPI.openInTerminal(worktreePath, appToUse)
      if (result.success) message.success(`Opening ${projectName}`)
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
      if (ide) {
        const newPreferences = { ...projectIDEPreferences, [projectName]: ide }
        setProjectIDEPreferences(newPreferences)
        localStorage.setItem('projectIDEPreferences', JSON.stringify(newPreferences))
      }
      const result = await window.nexworkAPI.openInIDE(worktreePath, ideToUse)
      if (result.success) message.success(`Opening ${projectName}`)
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

  const missingRequiredProjects = getMissingRequiredProjects()

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
    docsRepoSummary,
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
    mergeTargetBranch,
    mergeAvailableBranches,
    conflictInfo,
    loadFeatureDetails,
    handleUpdateStatus,
    handleComplete,
    handleDelete,
    handleRefresh,
    handleSyncWorktrees,
    handleAddProjects,
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
    setMergeTargetBranch,
    setPrModalOpen,
    setConflictInfo,
    featureName,
    onBack,
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '8px 0 32px', overflowX: 'hidden' }}>
      <FeatureHeader ctx={ctx} />
      {missingRequiredProjects.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="This feature is missing required project dependencies"
          description={
            <Space direction="vertical" size="small">
              <Text>
                Add these project(s) so setup and worktree creation do not fail later:{' '}
                {missingRequiredProjects.join(', ')}
              </Text>
              <Button type="primary" loading={addingRequiredProjects} onClick={handleAddRequiredProjects}>
                Add Required Projects
              </Button>
            </Space>
          }
        />
      )}
      <FeatureActions ctx={ctx} />
      <RunCommandModal ctx={ctx} />
      <CommitModal ctx={ctx} />
      <MergeModal ctx={ctx} />
      <PRModal ctx={ctx} />
      <ConflictViewer ctx={ctx} />
      <FeatureStatsRow ctx={ctx} />
      <Modal
        title="Add Projects"
        open={addProjectsModalOpen}
        onCancel={() => setAddProjectsModalOpen(false)}
        onOk={handleConfirmAddProjects}
        okText="Add Projects"
        confirmLoading={addProjectsSubmitting}
        width={720}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Text>Select more projects for this feature.</Text>
          <Text type="secondary">
            For each added project, choose the base branch to branch from. If needed, pull that branch before the
            feature branch is created.
          </Text>

          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Select projects to add"
            value={addProjectSelections}
            options={availableProjects
              .filter((projectName) => !feature.projects.some((project) => project.name === projectName))
              .map((projectName) => ({ value: projectName, label: projectName }))}
            onChange={(value) => setAddProjectSelections(value)}
          />

          {resolveProjectsToAdd(addProjectSelections).length > addProjectSelections.length && (
            <Alert
              type="info"
              showIcon
              message="Required dependencies will also be added"
              description={resolveProjectsToAdd(addProjectSelections)
                .filter((projectName) => !addProjectSelections.includes(projectName))
                .join(', ')}
            />
          )}

          {resolveProjectsToAdd(addProjectSelections).map((projectName) => (
            <Card key={projectName} size="small">
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Text strong>{projectName}</Text>
                <Space align="center" wrap>
                  <Text type="secondary">Base branch</Text>
                  <Select
                    value={addProjectBaseBranches[projectName]}
                    style={{ minWidth: 180 }}
                    options={(addProjectsAvailableBranches[projectName] || ['staging']).map((branch) => ({
                      value: branch,
                      label: branch,
                    }))}
                    onChange={(value) =>
                      setAddProjectBaseBranches((prev) => ({
                        ...prev,
                        [projectName]: value,
                      }))
                    }
                  />
                </Space>
                <Space align="center">
                  <Switch
                    checked={!!addProjectPullFirst[projectName]}
                    onChange={(checked) =>
                      setAddProjectPullFirst((prev) => ({
                        ...prev,
                        [projectName]: checked,
                      }))
                    }
                  />
                  <Text type="secondary">
                    Pull {addProjectBaseBranches[projectName] || 'base branch'} before adding
                  </Text>
                </Space>
              </Space>
            </Card>
          ))}
        </Space>
      </Modal>

      <div style={{ marginBottom: 16 }}>
        <FeatureWorkspace ctx={ctx} />
      </div>

      {feature && (
        <div style={{ marginBottom: 16 }}>
          <Tabs
            defaultActiveKey="changes"
            items={[
              {
                key: 'changes',
                label: 'Changes',
                children: <ChangesViewer featureName={featureName} projects={feature.projects} />,
              },
              {
                key: 'timeline',
                label: 'Commit Timeline',
                children: <CommitTimeline featureName={featureName} projects={feature.projects} />,
              },
            ]}
          />
        </div>
      )}

      {workspaceRoot && (
        <div data-terminal-section style={{ marginTop: 8 }}>
          <IntegratedTerminal feature={feature} workspaceRoot={workspaceRoot} />
        </div>
      )}

      <GitSyncModal ctx={ctx} />
    </div>
  )
}
