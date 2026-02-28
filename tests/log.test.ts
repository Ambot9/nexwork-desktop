import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('main process log', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('log.error always calls console.error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { log } = await import('../electron/main/log')
    log.error('test error')
    expect(spy).toHaveBeenCalledWith('test error')
  })

  it('log module exports info, warn, and error', async () => {
    const { log } = await import('../electron/main/log')
    expect(typeof log.info).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.error).toBe('function')
  })
})

describe('renderer log', () => {
  it('exports info, warn, and error', async () => {
    const { log } = await import('../src/utils/log')
    expect(typeof log.info).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.error).toBe('function')
  })

  it('log.error always calls console.error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { log } = await import('../src/utils/log')
    log.error('renderer error')
    expect(spy).toHaveBeenCalledWith('renderer error')
  })
})
