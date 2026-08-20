import type { DailyReview, DayPlan } from '../types'

/**
 * M3 → M1 衔接：把昨日复盘里写的"明天这一件事"取出来，
 * 作为今日晨间锚点 (confirmMorningAnchor) 的预填内容。纯函数、无副作用。
 */
export function getAnchorPrefillFromReview(review: DailyReview | null | undefined): string[] {
  if (!review?.tomorrowTop3) {
    return []
  }
  return review.tomorrowTop3.map((title) => title.trim()).filter(Boolean)
}

export interface AnchorItem {
  title: string
  step?: string
}

/**
 * 取"今天之前最近一次有记录的复盘"里写的明天这一件事（含可选的预拆第一步），
 * 用于今天晨间锚点的预填。跳过空白天，找到最近写过明天这一件事的那天。
 * step 与 title 按原始下标对齐后再过滤空标题，保证步骤跟对任务。
 */
export function getNextDayAnchorItems(dayPlans: Record<string, DayPlan>, today: string): AnchorItem[] {
  const pastKeys = Object.keys(dayPlans)
    .filter((key) => key < today)
    .sort()
    .reverse()
  for (const key of pastKeys) {
    const review = dayPlans[key].review
    if (!review?.tomorrowTop3) continue
    const steps = review.tomorrowTop3Steps ?? []
    const items = review.tomorrowTop3
      .map((title, index) => ({ title: title.trim(), step: steps[index]?.trim() || undefined }))
      .filter((item) => item.title)
    if (items.length > 0) {
      return items
    }
  }
  return []
}

/** 仅取标题（兼容旧用法）。 */
export function getNextDayAnchorPrefill(dayPlans: Record<string, DayPlan>, today: string): string[] {
  return getNextDayAnchorItems(dayPlans, today).map((item) => item.title)
}

/** 情绪评分是否合法（1–5）。 */
export function isValidMoodScore(value: number | undefined): value is 1 | 2 | 3 | 4 | 5 {
  return value !== undefined && Number.isInteger(value) && value >= 1 && value <= 5
}
