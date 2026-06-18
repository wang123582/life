import dayjs from 'dayjs'
import type { FocusSession, LifeAppData } from '../types'

export interface DayStat {
  dayKey: string
  doneCount: number
  totalCount: number
  focusCount: number
  hasReview: boolean
}

export interface ProgressSummary {
  days: DayStat[]
  currentStreak: number
  weeklyCompletionRate: number
}

/** 有效番茄：已完成的 focus（非 break、非取消）。 */
function isEffectiveFocus(session: FocusSession): boolean {
  return session.mode === 'focus' && session.status === 'completed'
}

function statForDay(data: LifeAppData, dayKey: string): DayStat {
  const plan = data.dayPlans[dayKey]
  const todayItems = plan?.todayItems ?? []
  const focusCount = data.focusSessions.filter((s) => s.dayKey === dayKey && isEffectiveFocus(s)).length

  return {
    dayKey,
    doneCount: todayItems.filter((item) => item.isDone).length,
    totalCount: todayItems.length,
    focusCount,
    hasReview: Boolean(plan?.review),
  }
}

/** 近 rangeDays 天（含今天）的每日统计，按时间从早到晚排列。 */
export function computeDayStats(data: LifeAppData, rangeDays: number, today = dayjs()): DayStat[] {
  const days: DayStat[] = []
  for (let offset = rangeDays - 1; offset >= 0; offset--) {
    const dayKey = today.subtract(offset, 'day').format('YYYY-MM-DD')
    days.push(statForDay(data, dayKey))
  }
  return days
}

/** D2：打卡有效 = 当日完成 ≥1 件 或 ≥1 个有效番茄。 */
export function isActiveDay(day: DayStat): boolean {
  return day.doneCount >= 1 || day.focusCount >= 1
}

/**
 * 连续打卡天数：从最近一天往回数连续的有效天。
 * 若"今天"还没活动，不算断签——跳过今天，从昨天继续数。
 */
export function computeStreak(days: DayStat[]): number {
  let i = days.length - 1
  if (i >= 0 && !isActiveDay(days[i])) {
    i -= 1 // 今天还没动，先跳过，不立即归零
  }
  let streak = 0
  for (; i >= 0; i--) {
    if (isActiveDay(days[i])) {
      streak += 1
    } else {
      break
    }
  }
  return streak
}

/** 本周完成率 = 周内完成件数 / 周内任务总数（无任务则 0）。weekStart 为周起始 dayKey。 */
export function computeWeeklyRate(data: LifeAppData, weekStart: string): number {
  let done = 0
  let total = 0
  for (let offset = 0; offset < 7; offset++) {
    const dayKey = dayjs(weekStart).add(offset, 'day').format('YYYY-MM-DD')
    const stat = statForDay(data, dayKey)
    done += stat.doneCount
    total += stat.totalCount
  }
  return total === 0 ? 0 : done / total
}

export function buildProgressSummary(data: LifeAppData, rangeDays = 30, today = dayjs()): ProgressSummary {
  const days = computeDayStats(data, rangeDays, today)
  const weekStart = today.startOf('week').format('YYYY-MM-DD')
  return {
    days,
    currentStreak: computeStreak(days),
    weeklyCompletionRate: computeWeeklyRate(data, weekStart),
  }
}
