import type { AppRuntime } from '../app/useAppRuntime'
import type { LifeApp } from '../hooks/useLifeApp'
import type { TabKey } from '../types'

export interface ViewProps {
  life: LifeApp
  runtime: AppRuntime
  goToTab: (key: TabKey) => void
}
