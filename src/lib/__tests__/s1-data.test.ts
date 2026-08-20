import { afterEach, describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import { defaultData, pruneEmptyDays, STORAGE_KEY } from '../defaults'
import { loadData } from '../storage'
import type { DayPlan, LifeAppData } from '../../types'

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
    // 一天一件不可配置：旧快照存的 3 也会被强制拉回 1
    expect(loaded.dailyTemplate.topTaskSlots).toBe(1)
  })

  it('returns defaults when storage is empty', () => {
    const loaded = loadData()
    expect(loaded.curiosityItems).toEqual([])
    expect(loaded.settings.reviewReminderTime).toBe('22:30')
  })
})

describe('S1 pruneEmptyDays', () => {
  const today = dayjs().format('YYYY-MM-DD')
  const base = defaultData()
  const blankPlan = (key: string): DayPlan => ({
    ...base.dayPlans[today],
    dayKey: key,
    todayItems: [],
    avoidItems: [],
    communicationDone: false,
    communicationNote: '',
    processNotes: '',
    morningAnchorDone: false,
    review: null,
  })

  it('keeps record-days at any age and today, drops empty days', () => {
    const oldWithRecord = dayjs().subtract(120, 'day').format('YYYY-MM-DD')
    const emptyOld = dayjs().subtract(3, 'day').format('YYYY-MM-DD')

    const data: LifeAppData = {
      ...base,
      curiosityItems: [{ id: 'c1', text: 'keep me', createdAt: new Date().toISOString() }],
      dayPlans: {
        [today]: base.dayPlans[today],
        [oldWithRecord]: {
          ...blankPlan(oldWithRecord),
          review: { wins: '做完了', slips: '', commonState: '', tomorrow: '', updatedAt: new Date().toISOString() },
        },
        [emptyOld]: blankPlan(emptyOld),
      },
    }

    const pruned = pruneEmptyDays(data, today)

    expect(pruned.dayPlans[oldWithRecord]).toBeDefined() // 有记录：不论多久都保留
    expect(pruned.dayPlans[emptyOld]).toBeUndefined() // 空白天：自动删除
    expect(pruned.dayPlans[today]).toBeDefined() // 今天：始终保留
    expect(pruned.curiosityItems).toHaveLength(1) // 顶层字段不受影响
  })

  it('treats a finished task / focus session / notes as a record', () => {
    const d1 = dayjs().subtract(10, 'day').format('YYYY-MM-DD')
    const d2 = dayjs().subtract(11, 'day').format('YYYY-MM-DD')
    const data: LifeAppData = {
      ...base,
      focusSessions: [{ id: 'f', dayKey: d2, mode: 'focus', startedAt: '', endedAt: '', plannedMinutes: 25, status: 'completed' }],
      dayPlans: {
        [today]: base.dayPlans[today],
        [d1]: { ...blankPlan(d1), processNotes: '记了一笔' },
        [d2]: blankPlan(d2),
      },
    }
    const pruned = pruneEmptyDays(data, today)
    expect(pruned.dayPlans[d1]).toBeDefined() // 有笔记
    expect(pruned.dayPlans[d2]).toBeDefined() // 有番茄记录
  })
})
