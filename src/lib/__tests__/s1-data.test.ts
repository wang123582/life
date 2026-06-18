import { afterEach, describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import { defaultData, purgeOldData, STORAGE_KEY } from '../defaults'
import { loadData } from '../storage'
import type { LifeAppData } from '../../types'

afterEach(() => {
  window.localStorage.clear()
})

describe('S1 defaultData shape', () => {
  it('includes the new fields with correct defaults', () => {
    const data = defaultData()
    expect(data.curiosityItems).toEqual([])
    expect(data.settings.reviewReminderEnabled).toBe(true)
    expect(data.settings.reviewReminderTime).toBe('22:30')
    expect(data.settings.hardStopEnabled).toBe(true)
    expect(data.settings.hardStopTime).toBe('23:00')
    const todayKey = dayjs().format('YYYY-MM-DD')
    expect(data.dayPlans[todayKey].morningAnchorDone).toBe(false)
  })

  it('preset rules contain the three execution guidelines', () => {
    const data = defaultData()
    const doRules = data.ruleDefs.filter((r) => r.type === 'do').map((r) => r.text)
    expect(doRules).toHaveLength(3)
    expect(doRules.some((t) => t.includes('好奇清单'))).toBe(true)
    expect(doRules.some((t) => t.includes('独立思考 3 分钟'))).toBe(true)
    expect(doRules.some((t) => t.includes('空转超过 5 分钟'))).toBe(true)
  })
})

describe('S1 loadData backward compatibility', () => {
  it('backfills new fields for an old snapshot missing them', () => {
    const todayKey = dayjs().format('YYYY-MM-DD')
    // Simulate an old snapshot that predates the new fields.
    const oldSnapshot = {
      updatedAt: new Date().toISOString(),
      taskDefs: [],
      ruleDefs: [],
      dayPlans: {
        [todayKey]: {
          dayKey: todayKey,
          todayItems: [],
          avoidItems: [],
          communicationDone: false,
          communicationNote: '',
          processNotes: '',
          processNotesColor: '#1f2937',
          review: null,
          // NOTE: no morningAnchorDone
        },
      },
      difficultyRecords: [],
      stateRecords: [],
      focusSessions: [],
      relaxWindows: [],
      // NOTE: no curiosityItems
      dailyTemplate: { topTaskSlots: 3, routineSlots: 2, avoidSlots: 1, communicationPrompt: 'x', relaxMinutes: 15 },
      weeklyTemplate: { directions: [], riskScenarios: [], communicationGoal: '', restPlan: '' },
      settings: {
        // an old settings object missing the new reminder keys
        focusMinutes: 25,
        breakMinutes: 5,
      },
      activeTimer: null,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(oldSnapshot))

    const loaded = loadData()

    expect(loaded.curiosityItems).toEqual([])
    expect(loaded.settings.reviewReminderTime).toBe('22:30')
    expect(loaded.settings.hardStopTime).toBe('23:00')
    expect(loaded.settings.reviewReminderEnabled).toBe(true)
    expect(loaded.settings.hardStopEnabled).toBe(true)
    expect(loaded.dayPlans[todayKey].morningAnchorDone).toBe(false)
    // existing values preserved
    expect(loaded.settings.focusMinutes).toBe(25)
  })

  it('returns defaults when storage is empty', () => {
    const loaded = loadData()
    expect(loaded.curiosityItems).toEqual([])
    expect(loaded.settings.reviewReminderTime).toBe('22:30')
  })
})

describe('S1 purgeOldData', () => {
  it('keeps only the last 30 days and preserves new fields', () => {
    const recent = dayjs().format('YYYY-MM-DD')
    const old = dayjs().subtract(45, 'day').format('YYYY-MM-DD')
    const base = defaultData()
    const data: LifeAppData = {
      ...base,
      curiosityItems: [{ id: 'c1', text: 'keep me', createdAt: new Date().toISOString() }],
      dayPlans: {
        ...base.dayPlans,
        [old]: { ...base.dayPlans[recent], dayKey: old },
      },
    }

    const purged = purgeOldData(data)

    expect(purged.dayPlans[old]).toBeUndefined()
    expect(purged.dayPlans[recent]).toBeDefined()
    // new top-level field untouched by purge
    expect(purged.curiosityItems).toHaveLength(1)
  })
})
