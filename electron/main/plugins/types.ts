export interface PluginState {
  enabled: boolean
  config?: Record<string, any>
}

export interface PluginStatus {
  state: 'disabled' | 'not_configured' | 'ready' | 'error'
  message?: string
}

export interface PluginManifest {
  id: string
  name: string
  description: string
  enabledByDefault?: boolean
  featureCreateStep?: boolean
  featureDetailsPanel?: boolean
  settingsSchema?: Array<{
    key: string
    label: string
    type: 'text' | 'url' | 'password'
    placeholder?: string
  }>
}

export interface PluginActionContext {
  pluginId: string
  state: PluginState
}

export interface FeaturePluginRef {
  tracked?: boolean
  externalId?: string
  lastSyncAt?: string
  lastSyncStatus?: 'success' | 'failed'
  lastSyncEvent?: keyof PluginEventMap
  lastSyncError?: string
  [key: string]: any
}

export interface PluginEventMap {
  'feature.created': {
    feature: any
    pluginData?: Record<string, any>
    workspaceRoot: string
  }
  'feature.completed': {
    feature: any
    workspaceRoot: string
    syncToMemstack?: boolean
  }
  'feature.deleted': {
    featureName: string
    workspaceRoot: string
  }
  'project.status.updated': {
    feature: any
    featureName: string
    projectName: string
    status: string
    workspaceRoot: string
  }
  'feature.scope.updated': {
    feature: any
    featureName: string
    addedProjects: string[]
    workspaceRoot: string
  }
}

export interface PluginEventResult {
  pluginRef?: FeaturePluginRef
}

export interface MainPlugin extends PluginManifest {
  getStatus?: (state: PluginState) => Promise<PluginStatus> | PluginStatus
  runAction?: (action: string, payload: any, context: PluginActionContext) => Promise<any>
  onFeatureCreated?: (
    payload: PluginEventMap['feature.created'],
    context: PluginActionContext,
  ) => Promise<PluginEventResult | void>
  onFeatureCompleted?: (
    payload: PluginEventMap['feature.completed'],
    context: PluginActionContext,
  ) => Promise<PluginEventResult | void>
  onFeatureDeleted?: (payload: PluginEventMap['feature.deleted'], context: PluginActionContext) => Promise<void>
  onProjectStatusUpdated?: (
    payload: PluginEventMap['project.status.updated'],
    context: PluginActionContext,
  ) => Promise<PluginEventResult | void>
  onFeatureScopeUpdated?: (
    payload: PluginEventMap['feature.scope.updated'],
    context: PluginActionContext,
  ) => Promise<PluginEventResult | void>
}
