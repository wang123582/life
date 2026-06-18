import type { DailyReview } from '../types'

/**
 * M3 → M1 衔接：把昨日复盘里写的"明日三件事"取出来，
 * 作为今日晨间锚点 (confirmMorningAnchor) 的预填内容。纯函数、无副作用。
 */
export function getAnchorPrefillFromReview(review: DailyReview | null | undefined): string[] {
  if (!review?.tomorrowTop3) {
    return []
  }
  return review.tomorrowTop3.map((title) => title.trim()).filter(Boolean)
}

/** 情绪评分是否合法（1–5）。 */
export function isValidMoodScore(value: number | undefined): value is 1 | 2 | 3 | 4 | 5 {
  return value !== undefined && Number.isInteger(value) && value >= 1 && value <= 5
}
