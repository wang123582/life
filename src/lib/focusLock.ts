import { Capacitor, registerPlugin } from '@capacitor/core'

interface FocusLockPlugin {
  saveConfig(options: { enabled: boolean; active: boolean; untilTimestamp: number; blockedPackages: string[] }): Promise<void>
  openAccessibilitySettings(): Promise<void>
  getStatus(): Promise<{ serviceEnabled: boolean }>
}

const FocusLock = registerPlugin<FocusLockPlugin>('FocusLock')

const blockedAppMap: Record<string, string> = {
  抖音: 'com.ss.android.ugc.aweme',
  微博: 'com.sina.weibo',
  小红书: 'com.xingin.xhs',
  bilibili: 'tv.danmaku.bili',
  Bilibili: 'tv.danmaku.bili',
  哔哩哔哩: 'tv.danmaku.bili',
  微信: 'com.tencent.mm',
  QQ: 'com.tencent.mobileqq',
}

export function resolveBlockedPackages(targets: string[]): string[] {
  return targets
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => blockedAppMap[item] ?? item)
    .filter((item) => item.includes('.'))
}

export function canUseFocusLock(): boolean {
  return Capacitor.getPlatform() === 'android'
}

export async function saveFocusLockConfig(config: { enabled: boolean; active: boolean; untilTimestamp: number; blockedTargets: string[] }): Promise<void> {
  if (!canUseFocusLock()) {
    return
  }

  await FocusLock.saveConfig({
    enabled: config.enabled,
    active: config.active,
    untilTimestamp: config.untilTimestamp,
    blockedPackages: resolveBlockedPackages(config.blockedTargets),
  })
}

export async function openFocusLockAccessibilitySettings(): Promise<void> {
  if (!canUseFocusLock()) {
    return
  }

  await FocusLock.openAccessibilitySettings()
}

export async function getFocusLockStatus(): Promise<{ serviceEnabled: boolean }> {
  if (!canUseFocusLock()) {
    return { serviceEnabled: false }
  }

  try {
    return await FocusLock.getStatus()
  } catch {
    return { serviceEnabled: false }
  }
}
