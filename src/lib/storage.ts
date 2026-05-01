import { defaultData, ensureDayPlan, STORAGE_KEY } from './defaults'
import type { LifeAppData } from '../types'

export function loadData(): LifeAppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return defaultData()
    }

    const fallback = defaultData()
    const parsed = JSON.parse(raw) as Partial<LifeAppData>

    return ensureDayPlan({
      ...fallback,
      ...parsed,
      taskDefs: parsed.taskDefs ?? fallback.taskDefs,
      ruleDefs: parsed.ruleDefs ?? fallback.ruleDefs,
      dayPlans: parsed.dayPlans ?? fallback.dayPlans,
      difficultyRecords: parsed.difficultyRecords ?? fallback.difficultyRecords,
      stateRecords: parsed.stateRecords ?? fallback.stateRecords,
      focusSessions: parsed.focusSessions ?? fallback.focusSessions,
      relaxWindows: parsed.relaxWindows ?? fallback.relaxWindows,
      dailyTemplate: {
        ...fallback.dailyTemplate,
        ...parsed.dailyTemplate,
      },
      weeklyTemplate: {
        ...fallback.weeklyTemplate,
        ...parsed.weeklyTemplate,
      },
      settings: {
        ...fallback.settings,
        ...parsed.settings,
      },
      activeTimer: parsed.activeTimer ?? fallback.activeTimer,
    })
  } catch {
    return defaultData()
  }
}

export function saveData(data: LifeAppData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
