import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface ScheduleArg {
  notifications: Array<{ id: number; schedule: { on: { hour: number; minute: number } } }>
}

const isNativePlatform = vi.fn(() => true)
const checkPermissions = vi.fn(async () => ({ display: 'granted' }))
const requestPermissions = vi.fn(async () => ({ display: 'granted' }))
const createChannel = vi.fn(async (_opts: unknown) => undefined)
const cancel = vi.fn(async (_opts: unknown) => undefined)
const schedule = vi.fn(async (_opts: ScheduleArg) => undefined)

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNativePlatform() },
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: () => checkPermissions(),
    requestPermissions: () => requestPermissions(),
    createChannel: (opts: unknown) => createChannel(opts),
    cancel: (opts: unknown) => cancel(opts),
    schedule: (opts: ScheduleArg) => schedule(opts),
    getPending: async () => ({ notifications: [] }),
  },
}))

const SETTINGS = {
  reviewReminderEnabled: true,
  reviewReminderTime: '22:30',
  hardStopEnabled: true,
  hardStopTime: '23:00',
}

describe('S2 evening reminders', () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(true)
    cancel.mockClear()
    schedule.mockClear()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('schedules review and hard-stop reminders at the configured times', async () => {
    const { syncEveningReminders, DAILY_REMINDER_IDS } = await import('../mobileTimer')
    await syncEveningReminders(SETTINGS)

    // two schedule calls (review + hardStop)
    expect(schedule).toHaveBeenCalledTimes(2)
    const scheduled = schedule.mock.calls.map((call) => call[0].notifications[0])

    const review = scheduled.find((n) => n.id === DAILY_REMINDER_IDS.review)
    const hardStop = scheduled.find((n) => n.id === DAILY_REMINDER_IDS.hardStop)
    expect(review?.schedule.on).toEqual({ hour: 22, minute: 30 })
    expect(hardStop?.schedule.on).toEqual({ hour: 23, minute: 0 })
  })

  it('cancels reminders that are disabled', async () => {
    const { syncEveningReminders } = await import('../mobileTimer')
    await syncEveningReminders({ ...SETTINGS, reviewReminderEnabled: false, hardStopEnabled: false })
    // only cancels, no scheduling
    expect(schedule).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalled()
  })

  it('is a no-op on non-native platforms', async () => {
    isNativePlatform.mockReturnValue(false)
    const { syncEveningReminders } = await import('../mobileTimer')
    await syncEveningReminders(SETTINGS)
    expect(schedule).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
  })
})
