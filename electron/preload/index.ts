import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
const listenerMap = new Map<string, (...args: any[]) => void>()

contextBridge.exposeInMainWorld('nexworkAPI', {
  // System
  ping: () => ipcRenderer.invoke('ping'),
  selectFolder: () => ipcRenderer.invoke('system:selectFolder'),
  runCommand: (command: string, workingDir?: string) => ipcRenderer.invoke('system:runCommand', command, workingDir),
  openInTerminal: (folderPath: string, terminalApp?: string) =>
    ipcRenderer.invoke('system:openInTerminal', folderPath, terminalApp),
  openInVSCode: (folderPath: string) => ipcRenderer.invoke('system:openInVSCode', folderPath),
  openInFinder: (folderPath: string) => ipcRenderer.invoke('system:openInFinder', folderPath),
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
    getProjectCommits: (featureName: string, projectName: string) =>
      ipcRenderer.invoke('stats:getProjectCommits', featureName, projectName),
    syncWorktrees: (featureName: string) => ipcRenderer.invoke('stats:syncWorktrees', featureName),
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
    create: (options: { cols: number; rows: number; cwd: string }) => ipcRenderer.invoke('terminal:create', options),
    write: (pid: number, data: string) => ipcRenderer.invoke('terminal:write', pid, data),
    resize: (pid: number, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', pid, cols, rows),
    kill: (pid: number) => ipcRenderer.invoke('terminal:kill', pid),
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

  // Git
  git: {
    getConflictFiles: (workingDir: string) => ipcRenderer.invoke('git:getConflictFiles', workingDir),
  },

  // Git Auth
  gitAuth: {
    checkAuth: () => ipcRenderer.invoke('git:checkAuth'),
    githubLogin: () => ipcRenderer.invoke('git:githubLogin'),
    githubLoginNew: () => ipcRenderer.invoke('git:githubLoginNew'),
    gitlabLogin: () => ipcRenderer.invoke('git:gitlabLogin'),
    saveAuth: (data: { provider: string; user: string; avatar: string; gitlabUrl?: string }) =>
      ipcRenderer.invoke('git:saveAuth', data),
    onAuthCode: (callback: (code: string) => void) => {
      const listener = (_: any, code: string) => callback(code)
      ipcRenderer.on('git:authCode', listener)
      return () => ipcRenderer.removeListener('git:authCode', listener)
    },
    logout: () => ipcRenderer.invoke('git:logout'),
  },

  // Pull Requests
  pullRequests: {
    checkGhCli: () => ipcRenderer.invoke('pr:checkGhCli'),
    create: (projects: any[], options: { title: string; body: string; draft: boolean }) =>
      ipcRenderer.invoke('pr:create', projects, options),
  },

  // Events
  on: (channel: string, callback: (...args: any[]) => void) => {
    const wrapper = (_: any, ...args: any[]) => callback(...args)
    listenerMap.set(`${channel}::${callback}`, wrapper)
    ipcRenderer.on(channel, wrapper)
  },

  off: (channel: string, callback: (...args: any[]) => void) => {
    const key = `${channel}::${callback}`
    const wrapper = listenerMap.get(key)
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper)
      listenerMap.delete(key)
    }
  },
})

// TypeScript type definition for the exposed API
declare global {
  interface Window {
    nexworkAPI: {
      ping: () => Promise<string>
      selectFolder: () => Promise<string | null>
      runCommand: (
        command: string,
        workingDir?: string,
      ) => Promise<{ success: boolean; output: string; error: string | null }>
      openInTerminal: (folderPath: string, terminalApp?: string) => Promise<{ success: boolean; error?: string }>
      openInVSCode: (folderPath: string) => Promise<{ success: boolean; error?: string }>
      openInFinder: (folderPath: string) => Promise<{ success: boolean; error?: string }>
      openInIDE: (folderPath: string, ide: string) => Promise<{ success: boolean; error?: string }>
      system: {
        setAutoLaunch: (enabled: boolean) => Promise<any>
        getAutoLaunch: () => Promise<any>
      }
      features: any
      projects: any
      templates: any
      config: any
      stats: any
      settings: {
        get: (key: string) => Promise<{ success: boolean; value?: any }>
        set: (key: string, value: any) => Promise<any>
        getAll: () => Promise<any>
      }
      featureHistory: {
        save: (feature: any) => Promise<any>
        getAll: (status?: string) => Promise<any>
        updateStatus: (id: string, status: string) => Promise<any>
      }
      activity: {
        log: (activity: any) => Promise<any>
        getRecent: (hours?: number) => Promise<any>
      }
      appStats: {
        get: () => Promise<any>
      }
      git: {
        getConflictFiles: (workingDir: string) => Promise<{ success: boolean; files: string[] }>
      }
      gitAuth: {
        checkAuth: () => Promise<{ authenticated: boolean; provider: string; user: string; avatar: string }>
        githubLogin: () => Promise<{
          success: boolean
          user?: string
          avatar?: string
          error?: string
          alreadyLoggedIn?: boolean
          savedAccount?: boolean
          multipleAccounts?: boolean
          accounts?: Array<{ id: string; user: string; avatar: string }>
        }>
        githubLoginNew: () => Promise<{
          success: boolean
          user?: string
          avatar?: string
          error?: string
        }>
        gitlabLogin: () => Promise<{
          success: boolean
          user?: string
          avatar?: string
          error?: string
          alreadyLoggedIn?: boolean
          savedAccount?: boolean
          isSelfHosted?: boolean
          gitlabUrl?: string
          multipleAccounts?: boolean
          accounts?: Array<{ id: string; user: string; avatar: string; gitlabUrl?: string; isSelfHosted?: boolean }>
        }>
        saveAuth: (data: {
          provider: string
          user: string
          avatar: string
          gitlabUrl?: string
        }) => Promise<{ success: boolean; error?: string }>
        onAuthCode: (callback: (code: string) => void) => () => void
        logout: () => Promise<{ success: boolean; error?: string }>
      }
      pullRequests: {
        checkGhCli: () => Promise<{ installed: boolean; authenticated: boolean }>
        create: (
          projects: Array<{ projectName: string; workingDir: string; branch: string; baseBranch: string }>,
          options: { title: string; body: string; draft: boolean },
        ) => Promise<{ results: Array<{ projectName: string; prUrl?: string; error?: string }> }>
      }
      terminal?: {
        create: (options: {
          cols: number
          rows: number
          cwd: string
        }) => Promise<{ pid: number; success: boolean; error?: string }>
        write: (pid: number, data: string) => Promise<{ success: boolean; error?: string }>
        resize: (pid: number, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>
        kill: (pid: number) => Promise<{ success: boolean; error?: string }>
        onData: (pid: number, callback: (data: string) => void) => () => void
        onExit: (pid: number, callback: (code: number) => void) => () => void
      }
      on: (channel: string, callback: (...args: any[]) => void) => void
      off: (channel: string, callback: (...args: any[]) => void) => void
    }
  }
}
