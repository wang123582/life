import { describe, expect, it } from 'vitest'
import { getAnchorPrefillFromReview, getNextDayAnchorPrefill, isValidMoodScore } from '../review'
import type { DailyReview, DayPlan } from '../../types'

function makeReview(partial: Partial<DailyReview>): DailyReview {
  return {
    wins: '',
    slips: '',
    commonState: '',
    tomorrow: '',
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

describe('M3 getAnchorPrefillFromReview', () => {
  it('returns trimmed non-empty tomorrowTop3', () => {
    const review = makeReview({ tomorrowTop3: ['  写方案 ', '', '健身', '   '] })
    expect(getAnchorPrefillFromReview(review)).toEqual(['写方案', '健身'])
  })

  it('returns [] when review is null or has no tomorrowTop3', () => {
    expect(getAnchorPrefillFromReview(null)).toEqual([])
    expect(getAnchorPrefillFromReview(undefined)).toEqual([])
    expect(getAnchorPrefillFromReview(makeReview({}))).toEqual([])
  })
})

describe('M3 getNextDayAnchorPrefill', () => {
  const planWith = (dayKey: string, tomorrowTop3?: string[]): DayPlan => ({
    dayKey,
    todayItems: [],
    avoidItems: [],
    communicationDone: false,
    communicationNote: '',
    processNotes: '',
    processNotesColor: '#1f2937',
    morningAnchorDone: false,
    review: tomorrowTop3 ? makeReview({ tomorrowTop3 }) : null,
  })

  it('returns the most recent past review tomorrowTop3, skipping empty days', () => {
    const dayPlans: Record<string, DayPlan> = {
      '2026-06-15': planWith('2026-06-15', ['旧的一件']),
      '2026-06-17': planWith('2026-06-17', ['写方案', '健身', '回邮件']), // 最近一次写过
      '2026-06-18': planWith('2026-06-18'), // 昨天没写明日三件事
    }
    expect(getNextDayAnchorPrefill(dayPlans, '2026-06-19')).toEqual(['写方案', '健身', '回邮件'])
  })

  it('returns [] when no past day has tomorrowTop3', () => {
    const dayPlans: Record<string, DayPlan> = {
      '2026-06-18': planWith('2026-06-18'),
      '2026-06-19': planWith('2026-06-19', ['今天的，不该被自己取用']),
    }
    expect(getNextDayAnchorPrefill(dayPlans, '2026-06-19')).toEqual([])
  })
})

describe('M3 isValidMoodScore', () => {
  it('accepts 1..5 integers only', () => {
    expect(isValidMoodScore(1)).toBe(true)
    expect(isValidMoodScore(5)).toBe(true)
    expect(isValidMoodScore(0)).toBe(false)
    expect(isValidMoodScore(6)).toBe(false)
    expect(isValidMoodScore(undefined)).toBe(false)
    expect(isValidMoodScore(2.5)).toBe(false)
  })
})
