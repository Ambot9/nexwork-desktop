import { describe, it, expect } from 'vitest'
import { themes, darkThemes } from '../src/types/theme'
import type { ThemeMode } from '../src/types/theme'

describe('theme definitions', () => {
  it('exports all 6 themes', () => {
    expect(themes).toHaveLength(6)
  })

  it('has unique IDs', () => {
    const ids = themes.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each theme has required fields', () => {
    for (const theme of themes) {
      expect(theme.id).toBeTruthy()
      expect(theme.name).toBeTruthy()
      expect(theme.author).toBeTruthy()
      expect(theme.background).toBeTruthy()
      expect(theme.textColors).toBeTruthy()
      expect(theme.textColors.prompt).toBeTruthy()
      expect(theme.textColors.command).toBeTruthy()
      expect(theme.textColors.output).toBeTruthy()
    }
  })

  it('system theme has no color dots', () => {
    const system = themes.find((t) => t.id === 'system')
    expect(system?.dots).toBeUndefined()
  })

  it('non-system themes have color dots', () => {
    const nonSystem = themes.filter((t) => t.id !== 'system')
    for (const theme of nonSystem) {
      expect(theme.dots).toBeDefined()
      expect(theme.dots!.length).toBeGreaterThan(0)
    }
  })

  it('darkThemes contains expected themes', () => {
    expect(darkThemes).toContain('dark')
    expect(darkThemes).toContain('ember')
    expect(darkThemes).toContain('monokai')
    expect(darkThemes).toContain('oneDarkPro')
  })

  it('darkThemes does not contain light or system', () => {
    expect(darkThemes).not.toContain('light')
    expect(darkThemes).not.toContain('system')
  })

  it('all ThemeMode values are covered in themes array', () => {
    const allModes: ThemeMode[] = ['system', 'light', 'dark', 'ember', 'monokai', 'oneDarkPro']
    const themeIds = themes.map((t) => t.id)
    for (const mode of allModes) {
      expect(themeIds).toContain(mode)
    }
  })
})
