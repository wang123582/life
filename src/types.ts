export type TaskKind = 'normal' | 'routine'
export type RuleType = 'do' | 'avoid'
export type DifficultyType = 'too_big' | 'dont_know' | 'no_material' | 'resistance' | 'interrupted'
export type StateType = 'distracted' | 'delay' | 'tired' | 'irritable' | 'stuck' | 'numb_scroll'
export type ResponseResult = 'better' | 'same' | 'worse'
export type TimerMode = 'focus' | 'shortBreak'
export type RelaxSourceType = 'focus' | 'task' | 'routine'
export type TabKey = 'today' | 'pool' | 'templates' | 'review'

export interface TaskDefinition {
  id: string
  title: string
  kind: TaskKind
  scheduleTime?: string
  archived?: boolean
  createdAt: string
}

export interface RuleDefinition {
  id: string
  type: RuleType
  text: string
  createdAt: string
}

export interface TaskStep {
  id: string
  title: string
  isDone: boolean
  completedAt?: string
}

export interface TodayItem {
  id: string
  sourceTaskId?: string
  title: string
  kind: TaskKind
  isDone: boolean
  order: number
  steps: TaskStep[]
  createdAt: string
}

export interface AvoidItem {
  id: string
  text: string
  isDone: boolean
  createdAt: string
}

export interface DailyReview {
  wins: string
  slips: string
  commonState: StateType | ''
  tomorrow: string
  updatedAt: string
}

export interface DayPlan {
  dayKey: string
  todayItems: TodayItem[]
  avoidItems: AvoidItem[]
  communicationDone: boolean
  communicationNote: string
  review: DailyReview | null
}

export interface DifficultyRecord {
  id: string
  dayKey: string
  todayItemId?: string
  type: DifficultyType
  note: string
  nextAction: string
  createdAt: string
}

export interface StateRecord {
  id: string
  dayKey: string
  stateType: StateType
  trigger: string
  response: string
  result: ResponseResult
  createdAt: string
}

export interface FocusSession {
  id: string
  dayKey: string
  todayItemId?: string
  stepId?: string
  mode: TimerMode
  startedAt: string
  endedAt: string
  plannedMinutes: number
  status: 'completed' | 'cancelled'
}

export interface RelaxWindow {
  id: string
  dayKey: string
  sourceType: RelaxSourceType
  sourceId: string
  minutes: number
  recommendation: string
  createdAt: string
  expiresAt: string
  used: boolean
}

export interface DailyTemplate {
  topTaskSlots: number
  routineSlots: number
  avoidSlots: number
  communicationPrompt: string
  relaxMinutes: number
}

export interface WeeklyTemplate {
  directions: string[]
  riskScenarios: string[]
  communicationGoal: string
  restPlan: string
}

export interface AppSettings {
  focusMinutes: number
  breakMinutes: number
  blockerLevel: 'light' | 'soft' | 'hard'
  blockedTargets: string[]
  encouragementEnabled: boolean
  feishuWebhookUrl: string
  feishuKeyword: string
  feishuSecret: string
  feishuAutoSyncReview: boolean
}

export interface ActiveTimer {
  mode: TimerMode
  dayItemId?: string
  stepId?: string
  startedAt: string
  durationMinutes: number
}

export interface LifeAppData {
  taskDefs: TaskDefinition[]
  ruleDefs: RuleDefinition[]
  dayPlans: Record<string, DayPlan>
  difficultyRecords: DifficultyRecord[]
  stateRecords: StateRecord[]
  focusSessions: FocusSession[]
  relaxWindows: RelaxWindow[]
  dailyTemplate: DailyTemplate
  weeklyTemplate: WeeklyTemplate
  settings: AppSettings
  activeTimer: ActiveTimer | null
}

export interface FinishTimerPayload {
  completed: boolean
  markStepDone?: boolean
  difficultyType?: DifficultyType
  difficultyNote?: string
  nextAction?: string
}

export interface ReviewInput {
  wins: string
  slips: string
  commonState: StateType | ''
  tomorrow: string
}
