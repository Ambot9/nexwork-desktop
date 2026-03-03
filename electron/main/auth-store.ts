import { app } from 'electron'
import path from 'path'
import fs from 'fs'

/**
 * Simple JSON-file-based auth persistence.
 * Bypasses electron-store (which has an ESM compat issue) so
 * git auth survives app restarts.
 */

interface AuthData {
  provider: string // 'github' | 'gitlab' | 'gitlab-self-hosted' | 'local' | ''
  user: string
  avatar: string
  gitlabUrl?: string // For self-hosted GitLab
}

const AUTH_FILE = path.join(app.getPath('userData'), 'nexwork-auth.json')

const DEFAULTS: AuthData = { provider: '', user: '', avatar: '' }

function read(): AuthData {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const raw = fs.readFileSync(AUTH_FILE, 'utf-8')
      return { ...DEFAULTS, ...JSON.parse(raw) }
    }
  } catch {
    // corrupt file — return defaults
  }
  return { ...DEFAULTS }
}

function write(data: AuthData): void {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export const authStore = {
  get(): AuthData {
    return read()
  },

  set(data: Partial<AuthData>): void {
    const current = read()
    write({ ...current, ...data })
  },

  clear(): void {
    write({ ...DEFAULTS })
  },
}
