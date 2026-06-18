import { describe, expect, it } from 'vitest'
import { getAnchorPrefillFromReview, isValidMoodScore } from '../review'
import type { DailyReview } from '../../types'

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
