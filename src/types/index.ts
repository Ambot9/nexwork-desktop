export interface Feature {
  name: string
  projects: ProjectStatus[]
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  expiresAt?: string
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
}

export interface UpdateFeatureDTO {
  name?: string
  projects?: ProjectStatus[]
}
