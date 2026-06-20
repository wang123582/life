import type { DailyReview, DayPlan } from '../types'

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

/**
 * 取"今天之前最近一次有记录的复盘"里写的明日三件事，用于今天晨间锚点的预填。
 * 跳过被跳过的空白天，找到最近写过明日三件事的那天。
 */
export function getNextDayAnchorPrefill(dayPlans: Record<string, DayPlan>, today: string): string[] {
  const pastKeys = Object.keys(dayPlans)
    .filter((key) => key < today)
    .sort()
    .reverse()
  for (const key of pastKeys) {
    const titles = getAnchorPrefillFromReview(dayPlans[key].review)
    if (titles.length > 0) {
      return titles
    }
  }
  return []
}

/** 情绪评分是否合法（1–5）。 */
export function isValidMoodScore(value: number | undefined): value is 1 | 2 | 3 | 4 | 5 {
  return value !== undefined && Number.isInteger(value) && value >= 1 && value <= 5
}
