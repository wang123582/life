import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const FOCUS_TIMER_NOTIFICATION_ID = 25001

export function canUseNativeTimer(): boolean {
  return Capacitor.isNativePlatform()
}

export async function ensureNativeTimerPermission(): Promise<boolean> {
  if (!canUseNativeTimer()) {
    return false
  }

  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') {
    return true
  }

  const requested = await LocalNotifications.requestPermissions()
  return requested.display === 'granted'
}

export async function scheduleFocusTimerNotification(input: { endsAt: Date; title: string; body: string }): Promise<boolean> {
  if (!canUseNativeTimer()) {
    return false
  }

  const granted = await ensureNativeTimerPermission()
  if (!granted) {
    return false
  }

  await LocalNotifications.cancel({ notifications: [{ id: FOCUS_TIMER_NOTIFICATION_ID }] })
  await LocalNotifications.schedule({
    notifications: [
      {
        id: FOCUS_TIMER_NOTIFICATION_ID,
        title: input.title,
        body: input.body,
        schedule: {
          at: input.endsAt,
          allowWhileIdle: true,
        },
      },
    ],
  })

  return true
}

export async function clearFocusTimerNotification(): Promise<void> {
  if (!canUseNativeTimer()) {
    return
  }

  await LocalNotifications.cancel({ notifications: [{ id: FOCUS_TIMER_NOTIFICATION_ID }] })
}
