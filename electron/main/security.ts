/**
 * Security utilities for Nexwork Desktop
 * Validates and sanitizes user inputs to prevent security vulnerabilities
 */

import path from 'path'
import fs from 'fs'

/**
 * Validate workspace root path
 * Prevents directory traversal attacks
 */
export function validateWorkspacePath(workspacePath: string): boolean {
  try {
    // Must be an absolute path
    if (!path.isAbsolute(workspacePath)) {
      console.error('Security: Workspace path must be absolute')
      return false
    }

    // Must exist
    if (!fs.existsSync(workspacePath)) {
      console.error('Security: Workspace path does not exist')
      return false
    }

    // Must be a directory
    const stats = fs.statSync(workspacePath)
    if (!stats.isDirectory()) {
      console.error('Security: Workspace path is not a directory')
      return false
    }

    // Prevent access to system directories
    const normalizedPath = path.normalize(workspacePath).toLowerCase()
    const forbiddenPaths = [
      '/system',
      '/windows',
      '/program files',
      'c:\\windows',
      'c:\\program files',
      '/bin',
      '/sbin',
      '/usr/bin',
      '/usr/sbin'
    ]

    for (const forbidden of forbiddenPaths) {
      if (normalizedPath.includes(forbidden)) {
        console.error('Security: Access to system directories is forbidden')
        return false
      }
    }

    return true
  } catch (error) {
    console.error('Security: Error validating workspace path:', error)
    return false
  }
}

/**
 * Sanitize feature name
 * Prevents command injection and path traversal
 */
export function sanitizeFeatureName(featureName: string): string {
  if (!featureName || typeof featureName !== 'string') {
    throw new Error('Invalid feature name')
  }

  // Remove dangerous characters
  const sanitized = featureName
    .replace(/[;&|`$(){}[\]<>]/g, '') // Command injection chars
    .replace(/\.\./g, '') // Directory traversal
    .replace(/[\/\\]/g, '-') // Path separators
    .trim()

  if (sanitized.length === 0) {
    throw new Error('Feature name cannot be empty after sanitization')
  }

  if (sanitized.length > 255) {
    throw new Error('Feature name too long (max 255 characters)')
  }

  return sanitized
}

/**
 * Validate git branch name
 * Ensures branch names are safe for git operations
 */
export function validateBranchName(branchName: string): boolean {
  if (!branchName || typeof branchName !== 'string') {
    return false
  }

  // Git branch name rules
  const validPattern = /^[a-zA-Z0-9._\/-]+$/
  if (!validPattern.test(branchName)) {
    console.error('Security: Invalid characters in branch name')
    return false
  }

  // Forbidden patterns
  const forbidden = [
    /^\./,           // Cannot start with .
    /\.\.$/,         // Cannot end with ..
    /\.lock$/,       // Cannot end with .lock
    /@\{/,          // Cannot contain @{
    /\.\./,         // Cannot contain ..
    /\/\//,         // Cannot contain //
    /^\/|\/$/       // Cannot start or end with /
  ]

  for (const pattern of forbidden) {
    if (pattern.test(branchName)) {
      console.error('Security: Branch name contains forbidden pattern')
      return false
    }
  }

  return true
}

/**
 * Validate file path is within workspace
 * Prevents directory traversal attacks
 */
export function isPathInWorkspace(filePath: string, workspacePath: string): boolean {
  try {
    const normalizedFile = path.normalize(path.resolve(filePath))
    const normalizedWorkspace = path.normalize(path.resolve(workspacePath))

    return normalizedFile.startsWith(normalizedWorkspace)
  } catch (error) {
    console.error('Security: Error validating path:', error)
    return false
  }
}

/**
 * Sanitize terminal command input
 * Prevents command injection in integrated terminal
 */
export function sanitizeCommand(command: string): string {
  if (!command || typeof command !== 'string') {
    throw new Error('Invalid command')
  }

  // Remove null bytes
  const sanitized = command.replace(/\0/g, '')

  // Limit length
  if (sanitized.length > 10000) {
    throw new Error('Command too long (max 10000 characters)')
  }

  return sanitized
}

/**
 * Validate project name
 */
export function validateProjectName(projectName: string): boolean {
  if (!projectName || typeof projectName !== 'string') {
    return false
  }

  // Allow alphanumeric, hyphens, underscores, dots
  const validPattern = /^[a-zA-Z0-9._-]+$/
  if (!validPattern.test(projectName)) {
    console.error('Security: Invalid project name')
    return false
  }

  if (projectName.length > 255) {
    console.error('Security: Project name too long')
    return false
  }

  return true
}

/**
 * Rate limiting for operations
 * Prevents abuse of expensive operations
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  checkLimit(key: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(key) || []

    // Remove old requests outside the time window
    const validRequests = requests.filter(time => now - time < this.windowMs)

    if (validRequests.length >= this.maxRequests) {
      console.warn(`Security: Rate limit exceeded for ${key}`)
      return false
    }

    validRequests.push(now)
    this.requests.set(key, validRequests)

    // Cleanup old entries
    if (this.requests.size > 1000) {
      const cutoff = now - this.windowMs
      for (const [k, times] of this.requests.entries()) {
        if (times.every(t => t < cutoff)) {
          this.requests.delete(k)
        }
      }
    }

    return true
  }

  reset(key: string): void {
    this.requests.delete(key)
  }
}

// Global rate limiter instances
export const featureOperationLimiter = new RateLimiter(20, 60000) // 20 operations per minute
export const gitOperationLimiter = new RateLimiter(30, 60000) // 30 git operations per minute
export const terminalLimiter = new RateLimiter(100, 60000) // 100 terminal commands per minute
