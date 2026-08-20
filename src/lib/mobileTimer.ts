import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const FOCUS_TIMER_NOTIFICATION_ID = 25001
const ROUTINE_NOTIFICATION_ID_BASE = 26000
const ROUTINE_NOTIFICATION_ID_RANGE = 10000
const LIFE_REMINDER_CHANNEL_ID = 'life-reminders'

/** S2：每日定时提醒的固定通知 id（避免与番茄/固定任务 id 段冲突）。 */
export const DAILY_REMINDER_IDS = {
  review: 27001,
  hardStop: 27002,
} as const

function parseScheduleTime(value?: string): { hour: number; minute: number } | null {
  if (!value) return null

  const matched = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!matched) return null

  const hour = Number(matched[1])
  const minute = Number(matched[2])

  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  return { hour, minute }
}

function buildRoutineNotificationId(taskId: string): number {
  let hash = 0

  for (let index = 0; index < taskId.length; index += 1) {
    hash = (hash * 31 + taskId.charCodeAt(index)) % ROUTINE_NOTIFICATION_ID_RANGE
  }

  return ROUTINE_NOTIFICATION_ID_BASE + hash
}

async function ensureReminderChannel(): Promise<void> {
  if (!canUseNativeTimer()) {
    return
  }

  await LocalNotifications.createChannel({
    id: LIFE_REMINDER_CHANNEL_ID,
    name: 'life 提醒',
    description: '用于专注结束和固定生活任务的提醒',
    importance: 5,
    visibility: 1,
    vibration: true,
  })
}

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

  await ensureReminderChannel()

  await LocalNotifications.cancel({ notifications: [{ id: FOCUS_TIMER_NOTIFICATION_ID }] })
  await LocalNotifications.schedule({
    notifications: [
      {
        id: FOCUS_TIMER_NOTIFICATION_ID,
        title: input.title,
        body: input.body,
        channelId: LIFE_REMINDER_CHANNEL_ID,
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

export async function clearRoutineReminderNotifications(): Promise<void> {
  if (!canUseNativeTimer()) {
    return
  }

  const pending = await LocalNotifications.getPending()
  const routineNotifications = pending.notifications
    .filter(
      (notification) =>
        notification.id >= ROUTINE_NOTIFICATION_ID_BASE && notification.id < ROUTINE_NOTIFICATION_ID_BASE + ROUTINE_NOTIFICATION_ID_RANGE,
    )
    .map((notification) => ({ id: notification.id }))

  if (routineNotifications.length > 0) {
    await LocalNotifications.cancel({ notifications: routineNotifications })
  }
}

export async function checkExactAlarmAccess(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (!canUseNativeTimer()) {
    return 'unavailable'
  }

  const status = await LocalNotifications.checkExactNotificationSetting()
  return status.exact_alarm === 'granted' ? 'granted' : 'denied'
}

export async function openExactAlarmSettings(): Promise<boolean> {
  if (!canUseNativeTimer()) {
    return false
  }

  const status = await LocalNotifications.changeExactNotificationSetting()
  return status.exact_alarm === 'granted'
}

/** S2：注册一个每天固定时间触发的本地提醒。time 形如 "22:30"。 */
export async function scheduleDailyReminder(id: number, time: string, title: string, body: string): Promise<boolean> {
  if (!canUseNativeTimer()) {
    return false
  }

  const parsed = parseScheduleTime(time)
  if (!parsed) {
    return false
  }

  const granted = await ensureNativeTimerPermission()
  if (!granted) {
    return false
  }

  await ensureReminderChannel()

  await LocalNotifications.cancel({ notifications: [{ id }] })
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        channelId: LIFE_REMINDER_CHANNEL_ID,
        schedule: {
          on: { hour: parsed.hour, minute: parsed.minute },
          allowWhileIdle: true,
        },
      },
    ],
  })

  return true
}

export async function cancelDailyReminder(id: number): Promise<void> {
  if (!canUseNativeTimer()) {
    return
  }

  await LocalNotifications.cancel({ notifications: [{ id }] })
}

/** S2：根据设置注册/取消"晚间复盘"与"硬性收工"两条每日提醒。 */
export async function syncEveningReminders(settings: {
  reviewReminderEnabled: boolean
  reviewReminderTime: string
  hardStopEnabled: boolean
  hardStopTime: string
}): Promise<void> {
  if (!canUseNativeTimer()) {
    return
  }

  if (settings.reviewReminderEnabled) {
    await scheduleDailyReminder(
      DAILY_REMINDER_IDS.review,
      settings.reviewReminderTime,
      'life · 晚间复盘',
      '该复盘了：看今天这一件，写明天这一件。',
    )
  } else {
    await cancelDailyReminder(DAILY_REMINDER_IDS.review)
  }

  if (settings.hardStopEnabled) {
    await scheduleDailyReminder(
      DAILY_REMINDER_IDS.hardStop,
      settings.hardStopTime,
      'life · 收工时间',
      '硬性收工时间到，今天就到这里，明天再继续。',
    )
  } else {
    await cancelDailyReminder(DAILY_REMINDER_IDS.hardStop)
  }
}

export async function syncRoutineReminderNotifications(
  tasks: Array<{ id: string; title: string; scheduleTime?: string }>,
): Promise<number> {
  if (!canUseNativeTimer()) {
    return 0
  }

  const granted = await ensureNativeTimerPermission()
  if (!granted) {
    return 0
  }

  await ensureReminderChannel()

  await clearRoutineReminderNotifications()

  const notifications = tasks.flatMap((task) => {
    const scheduleTime = parseScheduleTime(task.scheduleTime)

    if (!scheduleTime) {
      return []
    }

    return [
      {
        id: buildRoutineNotificationId(task.id),
        title: `life 提醒 · ${task.title}`,
        body: '到点了，先把这件生活任务做掉，再继续今天。',
        channelId: LIFE_REMINDER_CHANNEL_ID,
        group: LIFE_REMINDER_CHANNEL_ID,
        schedule: {
          on: {
            hour: scheduleTime.hour,
            minute: scheduleTime.minute,
          },
          allowWhileIdle: true,
        },
      },
    ]
  })

  if (notifications.length === 0) {
    return 0
  }

  await LocalNotifications.schedule({ notifications })
  return notifications.length
}
