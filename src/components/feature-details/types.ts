import type { Dispatch, SetStateAction } from 'react'
import type { Feature, FeatureStats } from '../../types'

export interface SavedCommand {
  id: string
  label: string
  command: string
}

export interface GitStatus {
  ahead: number
  behind: number
  branch: string
  isLocalOnly?: boolean
}

export interface GitOps {
  pulling: boolean
  pushing: boolean
  fetching: boolean
}

export interface WorktreeStatus {
  exists: boolean
  baseBranch: string
}

export interface ConflictInfo {
  projectName: string
  files: string[]
  workingDir: string
}

export interface FeatureDetailsContext {
  // Data
  feature: Feature | null
  stats: FeatureStats | null
  loading: boolean
  refreshing: boolean
  workspaceRoot: string
  featureFolderPath: string
  worktreeInfo: Record<string, string | null>
  gitStatuses: Record<string, GitStatus>
  gitOperations: Record<string, GitOps>
  projectWorktreeStatus: Record<string, WorktreeStatus>
  creatingWorktrees: Record<string, boolean>
  localFeatureBranches: Record<string, boolean>

  // Preferences
  preferredIDE: string
  projectIDEPreferences: Record<string, string>
  projectTerminalPreferences: Record<string, 'external' | 'integrated'>
  projectTerminalAppPreferences: Record<string, string>

  // Command modal state
  commandModalOpen: boolean
  command: string
  commandRunning: boolean
  commandOutput: string
  commandError: string | null
  selectedProject: string

  // Modal states
  gitModalOpen: boolean
  commitModalOpen: boolean
  mergeModalOpen: boolean
  prModalOpen: boolean
  commitMessage: string
  selectedProjectsForCommit: string[]
  selectedProjectsForMerge: string[]
  mergeTargetBranch: string
  mergeAvailableBranches: Record<string, string[]>

  // Conflict state
  conflictInfo: ConflictInfo | null

  // Actions
  loadFeatureDetails: (silent?: boolean) => Promise<void>
  handleUpdateStatus: (projectName: string, newStatus: string) => Promise<void>
  handleComplete: () => void
  handleDelete: () => void
  handleRefresh: () => Promise<void>
  handleSyncWorktrees: () => Promise<void>
  handleAddProjects: () => void
  handleCleanupExpired: () => void
  handleExtendExpiration: () => void
  handleCreateWorktree: (projectName: string) => Promise<void>
  handleRunCommand: () => void
  handleExecuteCommand: () => Promise<void>
  handleGitSync: () => void
  fetchGitStatus: (projectName: string, options?: { silent?: boolean }) => Promise<void>
  fetchAllGitStatuses: () => Promise<void>
  handleGitPull: (projectName: string, options?: { silent?: boolean }) => Promise<boolean | undefined>
  handleGitPush: (projectName: string, options?: { silent?: boolean }) => Promise<boolean | undefined>
  handleCleanupWorktrees: () => void
  handleCommitFeature: () => void
  handleMergeFeature: () => void
  handleExecuteCommit: () => Promise<void>
  handleExecuteMerge: () => Promise<void>
  handleTerminalOption: (projectName: string, option: 'external' | 'integrated') => void
  handleOpenInTerminal: (projectName: string, terminalApp?: string) => Promise<void>
  handleOpenInIDE: (projectName: string, ide?: string) => Promise<void>
  handleOpenInVSCode: (projectName: string) => Promise<void>
  handleRemoveWorktree: (projectName: string) => Promise<void>
  handlePullAll: () => Promise<void>
  handlePushAll: () => Promise<void>
  handleAbortMerge: () => Promise<void>
  handleMarkResolved: () => Promise<void>
  handleCreatePR: () => void

  // Setters
  setCommandModalOpen: (v: boolean) => void
  setCommand: (v: string) => void
  setSelectedProject: (v: string) => void
  setGitModalOpen: (v: boolean) => void
  setCommitModalOpen: (v: boolean) => void
  setMergeModalOpen: (v: boolean) => void
  setCommitMessage: (v: string) => void
  setSelectedProjectsForCommit: (v: string[]) => void
  setSelectedProjectsForMerge: (v: string[]) => void
  setMergeTargetBranch: Dispatch<SetStateAction<string>>
  setPrModalOpen: (v: boolean) => void
  setConflictInfo: (v: ConflictInfo | null) => void

  // Props passthrough
  featureName: string
  onBack: () => void
}

// Utility constants
export const IDE_NAMES: Record<string, string> = {
  vscode: 'VS Code',
  cursor: 'Cursor',
  rider: 'Rider',
  webstorm: 'WebStorm',
  intellij: 'IntelliJ IDEA',
  'code-insiders': 'VS Code Insiders',
}

export const TERMINAL_NAMES: Record<string, string> = {
  terminal: 'Terminal',
  iterm2: 'iTerm2',
  warp: 'Warp',
  alacritty: 'Alacritty',
  kitty: 'Kitty',
  hyper: 'Hyper',
}

export const COMMON_COMMANDS = [
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

// ── Error Messages ─────────────────────────────────────────────────

export enum Err {
  // Feature operations
  LoadFailed = 'Could not load feature',
  StatusUpdateFailed = 'Could not update status',
  CompleteFailed = 'Could not complete feature',
  DeleteFailed = 'Could not delete feature',
  RefreshFailed = 'Could not refresh',
  SyncFailed = 'Could not sync worktrees',
  CleanupFailed = 'Cleanup failed',
  ExpirationFailed = 'Could not update expiration',

  // Worktree operations
  WorktreeCreateFailed = 'Could not create worktree',
  WorktreeRemoveFailed = 'Could not remove worktree',
  WorktreeNotFound = 'No worktree for this project',

  // Command execution
  CommandFailed = 'Command failed',
  CommandEmpty = 'Enter a command first',

  // Git status & fetch
  Offline = 'Offline — cannot reach remote',
  StatusFailed = 'Could not get git status',

  // Git pull errors
  PullConflict = 'Merge conflicts — resolve before continuing',
  PullNoRemote = 'No remote branch yet — push first',
  PullDirty = 'Uncommitted changes — commit or stash first',
  PullAuthFailed = 'Auth failed — check your git credentials',
  PullFailed = 'Pull failed',

  // Git push errors
  PushAuthFailed = 'Push auth failed — check your git credentials',
  PushFailed = 'Push failed',

  // Batch operations
  CommitFailed = 'Commit failed',
  MergeFailed = 'Merge failed',
  PullAllFailed = 'Pull all failed',

  // Conflict resolution
  AbortFailed = 'Could not abort merge',
  ResolveFailed = 'Could not stage resolved files',

  // IDE / Terminal
  TerminalFailed = 'Could not open terminal',
  IDEFailed = 'Could not open IDE',

  // Validation
  SelectProject = 'Select at least one project',
  EnterCommitMsg = 'Enter a commit message',
  SelectDate = 'Select an expiration date',
}

/** Format an error enum with optional project name and detail */
export function errMsg(err: Err, project?: string, detail?: string): string {
  const prefix = project ? `${project}: ` : ''
  const suffix = detail ? ` — ${detail.substring(0, 80)}` : ''
  return `${prefix}${err}${suffix}`
}

/** Classify a git error string into an Err enum value */
export function classifyGitError(errorMsg: string, operation: 'pull' | 'push'): Err {
  if (operation === 'pull') {
    if (errorMsg.includes('CONFLICT') || errorMsg.includes('Automatic merge failed')) return Err.PullConflict
    if (errorMsg.includes('no tracking information') || errorMsg.includes('Please specify which branch'))
      return Err.PullNoRemote
    if (errorMsg.includes('uncommitted changes') || errorMsg.includes('would be overwritten')) return Err.PullDirty
    if (
      errorMsg.includes('Authentication failed') ||
      errorMsg.includes('Access denied') ||
      errorMsg.includes('HTTP Basic')
    )
      return Err.PullAuthFailed
    return Err.PullFailed
  }
  if (
    errorMsg.includes('Authentication failed') ||
    errorMsg.includes('Access denied') ||
    errorMsg.includes('HTTP Basic')
  )
    return Err.PushAuthFailed
  return Err.PushFailed
}

export function isLongRunningCommand(cmd: string): boolean {
  const longRunning = ['pull', 'push', 'clone', 'install', 'build', 'test', 'deploy']
  return longRunning.some((term) => cmd.toLowerCase().includes(term))
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'success'
    case 'in_progress':
      return 'processing'
    case 'pending':
      return 'default'
    default:
      return 'default'
  }
}
