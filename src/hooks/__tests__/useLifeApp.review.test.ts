import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useLifeApp } from '../useLifeApp'

beforeEach(() => {
  window.localStorage.clear()
})

describe('M3 saveReview persists tomorrowTop3 and moodScore', () => {
  it('stores the new review fields and refreshes updatedAt', () => {
    const { result } = renderHook(() => useLifeApp())

    act(() => {
      result.current.actions.saveReview({
        wins: '推进了方案',
        slips: '刷手机太久',
        commonState: 'numb_scroll',
        tomorrow: '先开方案第一段',
        tomorrowTop3: ['方案第一段', '健身', '回邮件'],
        moodScore: 4,
      })
    })

    const review = result.current.dayPlan.review
    expect(review).not.toBeNull()
    expect(review?.tomorrowTop3).toEqual(['方案第一段', '健身', '回邮件'])
    expect(review?.moodScore).toBe(4)
    expect(review?.wins).toBe('推进了方案')
    expect(review?.updatedAt).toBeTruthy()
  })
})
