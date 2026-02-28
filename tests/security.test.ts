import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  sanitizeFeatureName,
  validateBranchName,
  isPathInWorkspace,
  sanitizeCommand,
  validateProjectName,
  featureOperationLimiter,
} from '../electron/main/security'

// ── sanitizeFeatureName ────────────────────────────────────────────

describe('sanitizeFeatureName', () => {
  it('returns a valid name unchanged', () => {
    expect(sanitizeFeatureName('my-feature')).toBe('my-feature')
  })

  it('converts spaces to dashes', () => {
    expect(sanitizeFeatureName('my new feature')).toBe('my-new-feature')
  })

  it('strips command injection characters', () => {
    expect(sanitizeFeatureName('feat;rm -rf /')).toBe('featrm-rf')
  })

  it('strips backtick injection', () => {
    expect(sanitizeFeatureName('feat`whoami`')).toBe('featwhoami')
  })

  it('strips pipe and dollar sign', () => {
    expect(sanitizeFeatureName('feat|$HOME')).toBe('featHOME')
  })

  it('strips directory traversal sequences', () => {
    expect(sanitizeFeatureName('../../etc/passwd')).toBe('etc-passwd')
  })

  it('collapses consecutive dashes', () => {
    expect(sanitizeFeatureName('a---b')).toBe('a-b')
  })

  it('removes leading and trailing dashes', () => {
    expect(sanitizeFeatureName('-test-')).toBe('test')
  })

  it('throws on empty string', () => {
    expect(() => sanitizeFeatureName('')).toThrow('Invalid feature name')
  })

  it('throws on null/undefined', () => {
    expect(() => sanitizeFeatureName(null as any)).toThrow('Invalid feature name')
    expect(() => sanitizeFeatureName(undefined as any)).toThrow('Invalid feature name')
  })

  it('throws when sanitized result is empty', () => {
    expect(() => sanitizeFeatureName(';|`$(){}')).toThrow('cannot be empty after sanitization')
  })

  it('throws when name exceeds 255 characters', () => {
    const longName = 'a'.repeat(256)
    expect(() => sanitizeFeatureName(longName)).toThrow('too long')
  })

  it('allows 255 characters', () => {
    const maxName = 'a'.repeat(255)
    expect(sanitizeFeatureName(maxName)).toBe(maxName)
  })
})

// ── validateBranchName ─────────────────────────────────────────────

describe('validateBranchName', () => {
  it('accepts valid branch names', () => {
    expect(validateBranchName('feature/my-feature')).toBe(true)
    expect(validateBranchName('main')).toBe(true)
    expect(validateBranchName('release/1.0.0')).toBe(true)
    expect(validateBranchName('fix_bug.123')).toBe(true)
  })

  it('rejects empty or null input', () => {
    expect(validateBranchName('')).toBe(false)
    expect(validateBranchName(null as any)).toBe(false)
    expect(validateBranchName(undefined as any)).toBe(false)
  })

  it('rejects names starting with a dot', () => {
    expect(validateBranchName('.hidden')).toBe(false)
  })

  it('rejects names with double dots', () => {
    expect(validateBranchName('feature..main')).toBe(false)
  })

  it('rejects names ending with .lock', () => {
    expect(validateBranchName('branch.lock')).toBe(false)
  })

  it('rejects names containing @{', () => {
    expect(validateBranchName('branch@{0}')).toBe(false)
  })

  it('rejects names with double slashes', () => {
    expect(validateBranchName('feature//branch')).toBe(false)
  })

  it('rejects names starting or ending with slash', () => {
    expect(validateBranchName('/branch')).toBe(false)
    expect(validateBranchName('branch/')).toBe(false)
  })

  it('rejects names with special chars', () => {
    expect(validateBranchName('branch name')).toBe(false)
    expect(validateBranchName('branch;name')).toBe(false)
    expect(validateBranchName('branch`name')).toBe(false)
  })
})

// ── isPathInWorkspace ──────────────────────────────────────────────

describe('isPathInWorkspace', () => {
  it('returns true for a path inside workspace', () => {
    expect(isPathInWorkspace('/home/user/workspace/project', '/home/user/workspace')).toBe(true)
  })

  it('returns true for workspace root itself', () => {
    expect(isPathInWorkspace('/home/user/workspace', '/home/user/workspace')).toBe(true)
  })

  it('returns false for path outside workspace', () => {
    expect(isPathInWorkspace('/etc/passwd', '/home/user/workspace')).toBe(false)
  })

  it('catches directory traversal attempts', () => {
    expect(isPathInWorkspace('/home/user/workspace/../../../etc/passwd', '/home/user/workspace')).toBe(false)
  })

  it('handles nested paths correctly', () => {
    expect(isPathInWorkspace('/home/user/workspace/a/b/c/d', '/home/user/workspace')).toBe(true)
  })
})

// ── sanitizeCommand ────────────────────────────────────────────────

describe('sanitizeCommand', () => {
  it('returns a clean command unchanged', () => {
    expect(sanitizeCommand('git status')).toBe('git status')
  })

  it('strips null bytes', () => {
    expect(sanitizeCommand('git\0status')).toBe('gitstatus')
  })

  it('throws on empty input', () => {
    expect(() => sanitizeCommand('')).toThrow('Invalid command')
  })

  it('throws on null/undefined', () => {
    expect(() => sanitizeCommand(null as any)).toThrow('Invalid command')
  })

  it('throws when command exceeds 10000 characters', () => {
    expect(() => sanitizeCommand('a'.repeat(10001))).toThrow('too long')
  })

  it('allows 10000 characters', () => {
    const maxCmd = 'a'.repeat(10000)
    expect(sanitizeCommand(maxCmd)).toBe(maxCmd)
  })
})

// ── validateProjectName ────────────────────────────────────────────

describe('validateProjectName', () => {
  it('accepts valid project names', () => {
    expect(validateProjectName('my-project')).toBe(true)
    expect(validateProjectName('my_project')).toBe(true)
    expect(validateProjectName('my.project')).toBe(true)
    expect(validateProjectName('MyProject123')).toBe(true)
  })

  it('rejects empty or null input', () => {
    expect(validateProjectName('')).toBe(false)
    expect(validateProjectName(null as any)).toBe(false)
  })

  it('rejects names with spaces', () => {
    expect(validateProjectName('my project')).toBe(false)
  })

  it('rejects names with special characters', () => {
    expect(validateProjectName('project;drop')).toBe(false)
    expect(validateProjectName('project/path')).toBe(false)
    expect(validateProjectName('project`cmd`')).toBe(false)
  })

  it('rejects names exceeding 255 characters', () => {
    expect(validateProjectName('a'.repeat(256))).toBe(false)
  })

  it('accepts names at 255 characters', () => {
    expect(validateProjectName('a'.repeat(255))).toBe(true)
  })
})

// ── RateLimiter (via featureOperationLimiter) ──────────────────────

describe('RateLimiter', () => {
  beforeEach(() => {
    featureOperationLimiter.reset('test-key')
  })

  it('allows requests under the limit', () => {
    for (let i = 0; i < 20; i++) {
      expect(featureOperationLimiter.checkLimit('test-key')).toBe(true)
    }
  })

  it('blocks requests over the limit', () => {
    for (let i = 0; i < 20; i++) {
      featureOperationLimiter.checkLimit('test-key')
    }
    expect(featureOperationLimiter.checkLimit('test-key')).toBe(false)
  })

  it('tracks keys independently', () => {
    for (let i = 0; i < 20; i++) {
      featureOperationLimiter.checkLimit('key-a')
    }
    expect(featureOperationLimiter.checkLimit('key-a')).toBe(false)
    expect(featureOperationLimiter.checkLimit('key-b')).toBe(true)
    featureOperationLimiter.reset('key-a')
    featureOperationLimiter.reset('key-b')
  })

  it('reset clears the limit for a key', () => {
    for (let i = 0; i < 20; i++) {
      featureOperationLimiter.checkLimit('test-key')
    }
    expect(featureOperationLimiter.checkLimit('test-key')).toBe(false)
    featureOperationLimiter.reset('test-key')
    expect(featureOperationLimiter.checkLimit('test-key')).toBe(true)
  })
})
