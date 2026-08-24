export type TaskKind = 'normal' | 'routine'
export type RuleType = 'do' | 'avoid'
export type DifficultyType = 'too_big' | 'dont_know' | 'no_material' | 'resistance' | 'interrupted'
export type StateType = 'distracted' | 'delay' | 'tired' | 'irritable' | 'stuck' | 'numb_scroll'
export type ResponseResult = 'better' | 'same' | 'worse'
export type TimerMode = 'focus' | 'shortBreak'
export type TabKey = 'today' | 'pool' | 'templates' | 'review'

export interface TaskDefinition {
  id: string
  title: string
  kind: TaskKind
  /** 「下一秒手放在哪」：normal 任务强制填写，创建今日副本时作为第一步。 */
  nextStep?: string
  scheduleTime?: string
  deadlineDate?: string
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

export interface CuriosityItem {
  id: string
  text: string
  createdAt: string
  archived?: boolean
}

export interface DailyReview {
  wins: string
  slips: string
  commonState: StateType | ''
  /** 遗留字段：早期"明天第一步"单行输入留下的，表单已不再写入，只用于回看老记录。 */
  tomorrow?: string
  tomorrowTop3?: string[]
  tomorrowTop3Steps?: string[]
  moodScore?: 1 | 2 | 3 | 4 | 5
  updatedAt: string
}

export interface DayPlan {
  dayKey: string
  todayItems: TodayItem[]
  processNotes: string
  processNotesColor: string
  morningAnchorDone: boolean
  morningAnchorAt?: string
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
  accomplishment?: string
}

export interface AppSettings {
  /** 强调色预设 id，见 ui/theme.ts 的 ACCENTS。 */
  theme: string
  /** 明暗外观：auto 跟随系统。旧快照没有这个字段时按 auto 处理。 */
  appearance: 'auto' | 'light' | 'dark'
  focusMinutes: number
  breakMinutes: number
  desktopNotificationsEnabled: boolean
  blockerLevel: 'light' | 'soft' | 'hard'
  blockedTargets: string[]
  syncEnabled: boolean
  syncSpaceId: string
  syncDeviceName: string
  mobileTimerEnabled: boolean
  appLockEnabled: boolean
  feishuWebhookUrl: string
  feishuKeyword: string
  feishuSecret: string
  feishuAutoSyncReview: boolean
  feishuScheduledSyncEnabled: boolean
  feishuScheduledSyncTime: string
  feishuLastScheduledSyncDayKey: string
  reviewReminderEnabled: boolean
  reviewReminderTime: string
  hardStopEnabled: boolean
  hardStopTime: string
}

export interface ActiveTimer {
  mode: TimerMode
  dayItemId?: string
  stepId?: string
  startedAt: string
  durationMinutes: number
}

export interface LifeAppData {
  updatedAt: string
  taskDefs: TaskDefinition[]
  ruleDefs: RuleDefinition[]
  dayPlans: Record<string, DayPlan>
  difficultyRecords: DifficultyRecord[]
  stateRecords: StateRecord[]
  focusSessions: FocusSession[]
  curiosityItems: CuriosityItem[]
  settings: AppSettings
  activeTimer: ActiveTimer | null
}

export interface FinishTimerPayload {
  completed: boolean
  markStepDone?: boolean
  difficultyType?: DifficultyType
  difficultyNote?: string
  nextAction?: string
  accomplishment?: string
}

export interface ReviewInput {
  wins: string
  slips: string
  commonState: StateType | ''
  /** 遗留字段：早期"明天第一步"单行输入留下的，表单已不再写入，只用于回看老记录。 */
  tomorrow?: string
  tomorrowTop3?: string[]
  tomorrowTop3Steps?: string[]
  moodScore?: 1 | 2 | 3 | 4 | 5
}
