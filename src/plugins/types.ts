export interface PluginSettingField {
  key: string
  label: string
  type: 'text' | 'url' | 'password'
  placeholder?: string
}

export interface PluginStatus {
  state: 'disabled' | 'not_configured' | 'ready' | 'error'
  message?: string
}

export interface PluginDescriptor {
  id: string
  name: string
  description: string
  enabled: boolean
  enabledByDefault: boolean
  featureCreateStep: boolean
  featureDetailsPanel: boolean
  settingsSchema: PluginSettingField[]
  config: Record<string, any>
  status: PluginStatus
}
