import { defaultData, ensureDayPlan, STORAGE_KEY } from './defaults'
import type { LifeAppData } from '../types'

export function loadData(): LifeAppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return defaultData()
    }

    const parsed = JSON.parse(raw) as LifeAppData
    return ensureDayPlan(parsed)
  } catch {
    return defaultData()
  }
}

export function saveData(data: LifeAppData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
