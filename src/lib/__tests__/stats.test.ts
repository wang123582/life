import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import { buildProgressSummary, computeDayStats, computeStreak, computeWeeklyRate, isActiveDay } from '../stats'
import { defaultData } from '../defaults'
import type { DayPlan, FocusSession, LifeAppData, TodayItem } from '../../types'

function item(id: string, isDone: boolean): TodayItem {
  return { id, title: id, kind: 'normal', isDone, order: 1, steps: [], createdAt: '2026-01-01T00:00:00.000Z' }
}

function plan(dayKey: string, items: TodayItem[], hasReview = false): DayPlan {
  return {
    dayKey,
    todayItems: items,
    processNotes: '',
    processNotesColor: '#1f2937',
    morningAnchorDone: true,
    review: hasReview
      ? { wins: '', slips: '', commonState: '', tomorrow: '', updatedAt: '2026-01-01T00:00:00.000Z' }
      : null,
  }
}

function focus(dayKey: string): FocusSession {
  return {
    id: `f-${dayKey}`,
    dayKey,
    mode: 'focus',
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-01-01T00:25:00.000Z',
    plannedMinutes: 25,
    status: 'completed',
  }
}

function emptyData(): LifeAppData {
  return { ...defaultData(), dayPlans: {}, focusSessions: [] }
}

const TODAY = dayjs('2026-06-17')
function key(offsetBack: number): string {
  return TODAY.subtract(offsetBack, 'day').format('YYYY-MM-DD')
}

describe('M4 computeDayStats', () => {
  it('computes done/total/focus/hasReview per day', () => {
    const data = emptyData()
    data.dayPlans[key(0)] = plan(key(0), [item('a', true), item('b', false)], true)
    data.focusSessions = [focus(key(0))]

    const days = computeDayStats(data, 3, TODAY)
    expect(days).toHaveLength(3)
    const todayStat = days[days.length - 1]
    expect(todayStat.doneCount).toBe(1)
    expect(todayStat.totalCount).toBe(2)
    expect(todayStat.focusCount).toBe(1)
    expect(todayStat.hasReview).toBe(true)
  })

  it('handles empty data', () => {
    const days = computeDayStats(emptyData(), 5, TODAY)
    expect(days).toHaveLength(5)
    expect(days.every((d) => d.doneCount === 0 && d.totalCount === 0 && d.focusCount === 0)).toBe(true)
  })
})

describe('M4 isActiveDay (D2)', () => {
  it('is active with >=1 done OR >=1 effective focus', () => {
    expect(isActiveDay({ dayKey: 'x', doneCount: 1, totalCount: 3, focusCount: 0, hasReview: false })).toBe(true)
    expect(isActiveDay({ dayKey: 'x', doneCount: 0, totalCount: 3, focusCount: 2, hasReview: false })).toBe(true)
    expect(isActiveDay({ dayKey: 'x', doneCount: 0, totalCount: 3, focusCount: 0, hasReview: false })).toBe(false)
  })
})

describe('M4 computeStreak', () => {
  it('counts consecutive active days back from the most recent', () => {
    const data = emptyData()
    data.dayPlans[key(2)] = plan(key(2), [item('a', true)])
    data.dayPlans[key(1)] = plan(key(1), [item('b', true)])
    data.dayPlans[key(0)] = plan(key(0), [item('c', true)])
    const days = computeDayStats(data, 5, TODAY)
    expect(computeStreak(days)).toBe(3)
  })

  it('does not break when today is not yet active', () => {
    const data = emptyData()
    data.dayPlans[key(1)] = plan(key(1), [item('b', true)])
    // today empty
    const days = computeDayStats(data, 5, TODAY)
    expect(computeStreak(days)).toBe(1)
  })

  it('returns 0 when neither today nor yesterday is active', () => {
    const data = emptyData()
    data.dayPlans[key(3)] = plan(key(3), [item('b', true)])
    const days = computeDayStats(data, 5, TODAY)
    expect(computeStreak(days)).toBe(0)
  })

  it('returns 0 for empty data', () => {
    expect(computeStreak(computeDayStats(emptyData(), 7, TODAY))).toBe(0)
  })
})

describe('M4 computeWeeklyRate', () => {
  it('is done/total across the 7-day window', () => {
    const data = emptyData()
    const weekStart = TODAY.startOf('week')
    data.dayPlans[weekStart.format('YYYY-MM-DD')] = plan(weekStart.format('YYYY-MM-DD'), [item('a', true), item('b', false)])
    data.dayPlans[weekStart.add(1, 'day').format('YYYY-MM-DD')] = plan(weekStart.add(1, 'day').format('YYYY-MM-DD'), [item('c', true)])
    // total = 3, done = 2
    expect(computeWeeklyRate(data, weekStart.format('YYYY-MM-DD'))).toBeCloseTo(2 / 3)
  })

  it('is 0 when there are no tasks', () => {
    expect(computeWeeklyRate(emptyData(), TODAY.startOf('week').format('YYYY-MM-DD'))).toBe(0)
  })
})

describe('M4 buildProgressSummary', () => {
  it('assembles days + streak + weekly rate', () => {
    const data = emptyData()
    data.dayPlans[key(0)] = plan(key(0), [item('a', true)])
    const summary = buildProgressSummary(data, 30, TODAY)
    expect(summary.days).toHaveLength(30)
    expect(summary.currentStreak).toBe(1)
    expect(summary.weeklyCompletionRate).toBeGreaterThanOrEqual(0)
  })
})
