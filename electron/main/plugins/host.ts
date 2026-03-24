import { storage } from '../storage'
import { log } from '../log'
import { getRegisteredPlugin, getRegisteredPlugins } from './registry'
import type { MainPlugin, PluginEventMap, PluginEventResult, PluginState } from './types'

interface PluginStateResponse {
  id: string
  name: string
  description: string
  enabled: boolean
  enabledByDefault: boolean
  featureCreateStep: boolean
  featureDetailsPanel: boolean
  settingsSchema: MainPlugin['settingsSchema']
  config: Record<string, any>
  status: {
    state: 'disabled' | 'not_configured' | 'ready' | 'error'
    message?: string
  }
}

function getPluginState(plugin: MainPlugin): PluginState {
  const pluginSettings = storage.getSetting('plugins') || {}
  const state = pluginSettings[plugin.id]

  return {
    enabled: state?.enabled ?? !!plugin.enabledByDefault,
    config: state?.config || {},
  }
}

function savePluginState(pluginId: string, nextState: PluginState): void {
  const pluginSettings = storage.getSetting('plugins') || {}
  pluginSettings[pluginId] = {
    enabled: nextState.enabled,
    config: nextState.config || {},
  }
  storage.setSetting('plugins', pluginSettings)
}

async function buildPluginStateResponse(plugin: MainPlugin): Promise<PluginStateResponse> {
  const state = getPluginState(plugin)

  if (!state.enabled) {
    return {
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      enabled: false,
      enabledByDefault: !!plugin.enabledByDefault,
      featureCreateStep: !!plugin.featureCreateStep,
      featureDetailsPanel: !!plugin.featureDetailsPanel,
      settingsSchema: plugin.settingsSchema || [],
      config: state.config || {},
      status: {
        state: 'disabled',
        message: 'Plugin is disabled.',
      },
    }
  }

  try {
    const status = plugin.getStatus ? await plugin.getStatus(state) : { state: 'ready' as const }
    return {
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      enabled: state.enabled,
      enabledByDefault: !!plugin.enabledByDefault,
      featureCreateStep: !!plugin.featureCreateStep,
      featureDetailsPanel: !!plugin.featureDetailsPanel,
      settingsSchema: plugin.settingsSchema || [],
      config: state.config || {},
      status,
    }
  } catch (error: any) {
    return {
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      enabled: state.enabled,
      enabledByDefault: !!plugin.enabledByDefault,
      featureCreateStep: !!plugin.featureCreateStep,
      featureDetailsPanel: !!plugin.featureDetailsPanel,
      settingsSchema: plugin.settingsSchema || [],
      config: state.config || {},
      status: {
        state: 'error',
        message: error.message || 'Plugin status check failed.',
      },
    }
  }
}

export async function listPlugins(): Promise<PluginStateResponse[]> {
  return Promise.all(getRegisteredPlugins().map((plugin) => buildPluginStateResponse(plugin)))
}

export function setPluginEnabled(pluginId: string, enabled: boolean): PluginState {
  const plugin = getRegisteredPlugin(pluginId)
  if (!plugin) {
    throw new Error(`Unknown plugin: ${pluginId}`)
  }

  const state = getPluginState(plugin)
  const nextState = {
    ...state,
    enabled,
  }
  savePluginState(pluginId, nextState)
  return nextState
}

export function updatePluginConfig(pluginId: string, config: Record<string, any>): PluginState {
  const plugin = getRegisteredPlugin(pluginId)
  if (!plugin) {
    throw new Error(`Unknown plugin: ${pluginId}`)
  }

  const state = getPluginState(plugin)
  const nextState = {
    ...state,
    config: {
      ...(state.config || {}),
      ...config,
    },
  }
  savePluginState(pluginId, nextState)
  return nextState
}

export async function runPluginAction(pluginId: string, action: string, payload: any): Promise<any> {
  const plugin = getRegisteredPlugin(pluginId)
  if (!plugin) {
    throw new Error(`Unknown plugin: ${pluginId}`)
  }

  if (!plugin.runAction) {
    throw new Error(`Plugin does not implement actions: ${pluginId}`)
  }

  const state = getPluginState(plugin)
  return plugin.runAction(action, payload, { pluginId, state })
}

export async function dispatchPluginEvent<K extends keyof PluginEventMap>(
  eventName: K,
  payload: PluginEventMap[K],
): Promise<Array<{ pluginId: string; result?: PluginEventResult }>> {
  const results: Array<{ pluginId: string; result?: PluginEventResult }> = []

  for (const plugin of getRegisteredPlugins()) {
    const state = getPluginState(plugin)

    if (!state.enabled) {
      continue
    }

    try {
      let result: PluginEventResult | undefined

      if (eventName === 'feature.created' && plugin.onFeatureCreated) {
        result =
          (await plugin.onFeatureCreated(payload as PluginEventMap['feature.created'], {
            pluginId: plugin.id,
            state,
          })) || undefined
      } else if (eventName === 'feature.completed' && plugin.onFeatureCompleted) {
        result =
          (await plugin.onFeatureCompleted(payload as PluginEventMap['feature.completed'], {
            pluginId: plugin.id,
            state,
          })) || undefined
      } else if (eventName === 'feature.deleted' && plugin.onFeatureDeleted) {
        await plugin.onFeatureDeleted(payload as PluginEventMap['feature.deleted'], { pluginId: plugin.id, state })
      } else if (eventName === 'project.status.updated' && plugin.onProjectStatusUpdated) {
        result =
          (await plugin.onProjectStatusUpdated(payload as PluginEventMap['project.status.updated'], {
            pluginId: plugin.id,
            state,
          })) || undefined
      } else if (eventName === 'feature.scope.updated' && plugin.onFeatureScopeUpdated) {
        result =
          (await plugin.onFeatureScopeUpdated(payload as PluginEventMap['feature.scope.updated'], {
            pluginId: plugin.id,
            state,
          })) || undefined
      }

      results.push({ pluginId: plugin.id, result })
    } catch (error: any) {
      log.warn(`Plugin event failed for ${plugin.id} on ${eventName}:`, error.message || error)
    }
  }

  return results
}
