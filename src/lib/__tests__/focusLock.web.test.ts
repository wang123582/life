import { describe, expect, it } from 'vitest'
import { canUseFocusLock, saveFocusLockConfig } from '../focusLock'

describe('S4 focusLock web fallback', () => {
  it('is unavailable on the web (jsdom) platform', () => {
    expect(canUseFocusLock()).toBe(false)
  })

  it('saveFocusLockConfig resolves without throwing when unavailable', async () => {
    await expect(
      saveFocusLockConfig({ enabled: true, active: true, untilTimestamp: Date.now(), blockedTargets: ['抖音'] }),
    ).resolves.toBeUndefined()
  })
})
