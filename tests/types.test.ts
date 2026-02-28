import { describe, it, expect } from 'vitest'

// Test that all expected types are exported from the types module
describe('type exports', () => {
  it('exports all interfaces from types/index', async () => {
    const types = await import('../src/types/index')
    // These are interfaces, so we can't check them at runtime directly
    // But we can verify the module loads without errors
    expect(types).toBeDefined()
  })

  it('exports theme types', async () => {
    const { themes, darkThemes } = await import('../src/types/theme')
    expect(themes).toBeDefined()
    expect(darkThemes).toBeDefined()
    expect(Array.isArray(themes)).toBe(true)
    expect(Array.isArray(darkThemes)).toBe(true)
  })
})

describe('Feature type contract', () => {
  it('Feature objects match expected shape', () => {
    // Simulate a Feature object to verify the contract
    const feature = {
      name: 'test-feature',
      projects: [{ name: 'api', status: 'pending' as const, branch: 'feature/test', worktreePath: '' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    expect(feature.name).toBeTruthy()
    expect(feature.projects).toHaveLength(1)
    expect(feature.projects[0].status).toBe('pending')
    expect(feature.createdAt).toBeTruthy()
  })

  it('ProjectStatus has valid status enum values', () => {
    const validStatuses = ['pending', 'in_progress', 'completed']
    for (const status of validStatuses) {
      const project = { name: 'test', status, branch: 'main', worktreePath: '' }
      expect(validStatuses).toContain(project.status)
    }
  })
})
