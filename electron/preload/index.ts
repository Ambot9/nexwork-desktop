import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('nexworkAPI', {
  // System
  ping: () => ipcRenderer.invoke('ping'),
  selectFolder: () => ipcRenderer.invoke('system:selectFolder'),
  runCommand: (command: string, workingDir?: string) => ipcRenderer.invoke('system:runCommand', command, workingDir),
  openInTerminal: (folderPath: string, terminalApp?: string) => ipcRenderer.invoke('system:openInTerminal', folderPath, terminalApp),
  openInVSCode: (folderPath: string) => ipcRenderer.invoke('system:openInVSCode', folderPath),
  openInIDE: (folderPath: string, ide: string) => ipcRenderer.invoke('system:openInIDE', folderPath, ide),
  
  system: {
    setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('system:setAutoLaunch', enabled),
    getAutoLaunch: () => ipcRenderer.invoke('system:getAutoLaunch'),
  },
  
  // Features
  features: {
    getAll: () => ipcRenderer.invoke('features:getAll'),
    getByName: (name: string) => ipcRenderer.invoke('features:getByName', name),
    create: (data: any) => ipcRenderer.invoke('features:create', data),
    update: (name: string, data: any) => ipcRenderer.invoke('features:update', name, data),
    delete: (name: string) => ipcRenderer.invoke('features:delete', name),
    complete: (name: string, cleanup: boolean) => ipcRenderer.invoke('features:complete', name, cleanup),
    cleanupExpired: (name: string) => ipcRenderer.invoke('features:cleanupExpired', name),
  },

  // Projects
  projects: {
    updateStatus: (featureName: string, projectName: string, status: string) => 
      ipcRenderer.invoke('projects:updateStatus', featureName, projectName, status),
    createWorktree: (featureName: string, projectName: string) => 
      ipcRenderer.invoke('projects:createWorktree', featureName, projectName),
    removeWorktree: (featureName: string, projectName: string) => 
      ipcRenderer.invoke('projects:removeWorktree', featureName, projectName),
  },

  // Templates
  templates: {
    getAll: () => ipcRenderer.invoke('templates:getAll'),
    getCustom: () => ipcRenderer.invoke('templates:getCustom'),
    create: (name: string, content: string) => ipcRenderer.invoke('templates:create', name, content),
    delete: (name: string) => ipcRenderer.invoke('templates:delete', name),
    preview: (template: string, data: any) => ipcRenderer.invoke('templates:preview', template, data),
  },

  // Config
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (config: any) => ipcRenderer.invoke('config:save', config),
    setWorkspace: (path: string) => ipcRenderer.invoke('config:setWorkspace', path),
  },

  // Stats
  stats: {
    getFeatureStats: (featureName: string) => ipcRenderer.invoke('stats:getFeatureStats', featureName),
    getGitStats: (featureName: string, projectName: string) => 
      ipcRenderer.invoke('stats:getGitStats', featureName, projectName),
    getProjectDiff: (featureName: string, projectName: string, ignoreWhitespace?: boolean) =>
      ipcRenderer.invoke('stats:getProjectDiff', featureName, projectName, ignoreWhitespace),
    syncWorktrees: (featureName: string) =>
      ipcRenderer.invoke('stats:syncWorktrees', featureName),
  },

  // Settings & Storage (NEW)
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },

  // Feature History (NEW)
  featureHistory: {
    save: (feature: any) => ipcRenderer.invoke('features:saveHistory', feature),
    getAll: (status?: string) => ipcRenderer.invoke('features:getHistory', status),
    updateStatus: (id: string, status: string) => ipcRenderer.invoke('features:updateStatus', id, status),
  },

  // Activity Log (NEW)
  activity: {
    log: (activity: any) => ipcRenderer.invoke('activity:log', activity),
    getRecent: (hours?: number) => ipcRenderer.invoke('activity:getRecent', hours),
  },

  // App Statistics (NEW)
  appStats: {
    get: () => ipcRenderer.invoke('stats:get'),
  },

  // Terminal
  terminal: {
    create: (options: { cols: number, rows: number, cwd: string }) => 
      ipcRenderer.invoke('terminal:create', options),
    write: (pid: number, data: string) => 
      ipcRenderer.invoke('terminal:write', pid, data),
    resize: (pid: number, cols: number, rows: number) => 
      ipcRenderer.invoke('terminal:resize', pid, cols, rows),
    kill: (pid: number) => 
      ipcRenderer.invoke('terminal:kill', pid),
    onData: (pid: number, callback: (data: string) => void) => {
      const listener = (_: any, termPid: number, data: string) => {
        if (termPid === pid) callback(data)
      }
      ipcRenderer.on('terminal:data', listener)
      return () => ipcRenderer.removeListener('terminal:data', listener)
    },
    onExit: (pid: number, callback: (code: number) => void) => {
      const listener = (_: any, termPid: number, code: number) => {
        if (termPid === pid) callback(code)
      }
      ipcRenderer.on('terminal:exit', listener)
      return () => ipcRenderer.removeListener('terminal:exit', listener)
    },
  },

  // Events
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args))
  },
  
  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback)
  },
})

// TypeScript type definition for the exposed API
declare global {
  interface Window {
    nexworkAPI: {
      ping: () => Promise<string>
      selectFolder: () => Promise<string | null>
      runCommand: (command: string, workingDir?: string) => Promise<{success: boolean, output: string, error: string | null}>
      openInTerminal: (folderPath: string) => Promise<{success: boolean, error?: string}>
      openInVSCode: (folderPath: string) => Promise<{success: boolean, error?: string}>
      openInIDE: (folderPath: string, ide: string) => Promise<{success: boolean, error?: string}>
      features: any
      projects: any
      templates: any
      config: any
      stats: any
      terminal?: {
        create: (options: { cols: number, rows: number, cwd: string }) => Promise<{ pid: number, success: boolean, error?: string }>
        write: (pid: number, data: string) => Promise<{ success: boolean, error?: string }>
        resize: (pid: number, cols: number, rows: number) => Promise<{ success: boolean, error?: string }>
        kill: (pid: number) => Promise<{ success: boolean, error?: string }>
        onData: (pid: number, callback: (data: string) => void) => () => void
        onExit: (pid: number, callback: (code: number) => void) => () => void
      }
      on: (channel: string, callback: (...args: any[]) => void) => void
      off: (channel: string, callback: (...args: any[]) => void) => void
    }
  }
}
