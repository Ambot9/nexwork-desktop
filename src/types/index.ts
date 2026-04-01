export interface Feature {
  name: string
  projects: ProjectStatus[]
  createdAt: string
  updatedAt: string
  featureFolderPath?: string
  startedAt?: string
  completedAt?: string
  expiresAt?: string
  ownerAccountId?: string
  pluginRefs?: Record<
    string,
    {
      tracked?: boolean
      externalId?: string
      lastSyncAt?: string
      lastSyncStatus?: 'success' | 'failed'
      lastSyncEvent?: 'feature.created' | 'feature.completed' | 'project.status.updated' | 'feature.scope.updated'
      lastSyncError?: string
      [key: string]: any
    }
  >
  stats?: {
    totalCommits?: number
    filesChanged?: number
    linesAdded?: number
    linesDeleted?: number
  }
}

export interface ProjectStatus {
  name: string
  status: 'pending' | 'in_progress' | 'completed'
  branch: string
  worktreePath: string
  baseBranch?: string
  lastUpdated?: string
}

export interface Config {
  workspaceRoot: string
  projects: Array<{
    name: string
    path: string
  }>
  features: Feature[]
  userConfig?: UserConfig
}

export interface UserConfig {
  searchPaths?: string[]
  exclude?: string[]
  defaultTemplate?: string
  /**
   * Optional map of project -> required project dependencies.
   * Example: { coloris: ['core'] }
   */
  projectDependencies?: Record<string, string[]>
  /**
   * Optional list of project names that Nexwork should manage in this workspace.
   * If omitted or empty, all discovered projects are considered managed.
   */
  managedProjects?: string[]
  ai?: {
    enabled: boolean
    provider: 'claude' | 'openai' | 'ollama'
    apiKey: string
    model: string
  }
}

export interface Template {
  name: string
  content: string
  isCustom: boolean
}

export interface FeatureStats {
  timeTracking: {
    created: string
    started?: string
    completed?: string
    elapsed: string
  }
  projectStatus: {
    total: number
    completed: number
    inProgress: number
    pending: number
    progress: number
  }
  gitStats: {
    commits: number
    filesChanged: number
    linesAdded: number
    linesDeleted: number
    netChange: number
  }
  projectDetails: Array<{
    name: string
    status: string
    worktreePath?: string
    lastUpdated: string
  }>
}

export interface GitStats {
  commits: number
  filesChanged: number
  linesAdded: number
  linesDeleted: number
}

export interface CreateFeatureDTO {
  name: string
  id?: string
  projects: string[]
  template?: string
  selectedBranches?: Record<string, string>
  expiresAt?: string
  pluginData?: Record<string, any>
}

export interface UpdateFeatureDTO {
  name?: string
  projects?: ProjectStatus[]
}

export interface ActivityRecord {
  id: string
  type: 'create' | 'update' | 'delete' | 'complete' | 'push' | 'pull'
  featureName: string
  projectName?: string
  timestamp: string
  details: string
}
