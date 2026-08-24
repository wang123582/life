import { defaultData, ensureDayPlan, pruneEmptyDays, STORAGE_KEY } from './defaults'
import type { DayPlan, LifeAppData } from '../types'

/**
 * 只挑当前类型认得的字段读进来。
 * 从前是 `{...fallback, ...parsed}`，删掉的功能（今日模板、放松窗口、边界清单、
 * 「今天和人认真聊过」）会以死键的形式一直留在快照里，还会被同步推到云端。
 * 逐字段挑选之后，删掉的东西读一次就真的没了。
 */
export function loadData(): LifeAppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return defaultData()
    }

    const fallback = defaultData()
    const parsed = JSON.parse(raw) as Partial<LifeAppData>

    const dayPlans: Record<string, DayPlan> = {}
    for (const [key, plan] of Object.entries(parsed.dayPlans ?? {})) {
      dayPlans[key] = {
        dayKey: plan.dayKey ?? key,
        todayItems: plan.todayItems ?? [],
        processNotes: plan.processNotes ?? '',
        processNotesColor: plan.processNotesColor ?? '#1f2937',
        morningAnchorDone: plan.morningAnchorDone ?? false,
        morningAnchorAt: plan.morningAnchorAt,
        review: plan.review ?? null,
      }
    }

    const merged = ensureDayPlan({
      updatedAt: parsed.updatedAt ?? fallback.updatedAt,
      taskDefs: parsed.taskDefs ?? fallback.taskDefs,
      ruleDefs: parsed.ruleDefs ?? fallback.ruleDefs,
      dayPlans: parsed.dayPlans ? dayPlans : fallback.dayPlans,
      difficultyRecords: parsed.difficultyRecords ?? fallback.difficultyRecords,
      stateRecords: parsed.stateRecords ?? fallback.stateRecords,
      focusSessions: parsed.focusSessions ?? fallback.focusSessions,
      curiosityItems: parsed.curiosityItems ?? fallback.curiosityItems,
      settings: {
        ...fallback.settings,
        ...parsed.settings,
      },
      activeTimer: parsed.activeTimer ?? fallback.activeTimer,
    })
    return pruneEmptyDays(merged)
  } catch {
    return defaultData()
  }
}

export function saveData(data: LifeAppData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
