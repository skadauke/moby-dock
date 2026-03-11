import { describe, it, expect } from 'vitest'

describe('Smoke tests', () => {
  it('should pass basic assertions', () => {
    expect(true).toBe(true)
    expect(1 + 1).toBe(2)
  })

  it('should have correct environment', () => {
    expect(typeof window).toBe('object')
    expect(typeof document).toBe('object')
  })

  it('should export /api/remote/token route handler', async () => {
    const mod = await import('@/app/api/remote/token/route')
    expect(mod.GET).toBeDefined()
    expect(typeof mod.GET).toBe('function')
  })
})
