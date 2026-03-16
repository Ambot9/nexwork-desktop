import { memstackPlugin } from './builtins/memstack'
import type { MainPlugin } from './types'

const plugins: MainPlugin[] = [memstackPlugin]

export function getRegisteredPlugins(): MainPlugin[] {
  return plugins
}

export function getRegisteredPlugin(pluginId: string): MainPlugin | undefined {
  return plugins.find((plugin) => plugin.id === pluginId)
}
