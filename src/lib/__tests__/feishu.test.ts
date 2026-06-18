import { describe, expect, it } from 'vitest'
import { buildReviewExtraLines } from '../feishu'
import type { DailyReview } from '../../types'

function review(partial: Partial<DailyReview>): DailyReview {
  return { wins: '', slips: '', commonState: '', tomorrow: '', updatedAt: '', ...partial }
}

describe('S3 buildReviewExtraLines', () => {
  it('outputs tomorrowTop3 and moodScore when present', () => {
    const lines = buildReviewExtraLines(review({ tomorrowTop3: [' 方案 ', '', '健身'], moodScore: 4 }))
    expect(lines).toContain('明日三件事：方案、健身')
    expect(lines).toContain('今日状态评分：4/5')
  })

  it('outputs nothing when fields are absent or empty', () => {
    expect(buildReviewExtraLines(review({}))).toEqual([])
    expect(buildReviewExtraLines(review({ tomorrowTop3: ['', '  '] }))).toEqual([])
    expect(buildReviewExtraLines(null)).toEqual([])
  })
})
