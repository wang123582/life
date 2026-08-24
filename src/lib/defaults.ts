import dayjs from 'dayjs'
import {
  type DayPlan,
  type DifficultyType,
  type LifeAppData,
  type RuleDefinition,
  type StateType,
  type TaskDefinition,
  type TaskKind,
  type TodayItem,
} from '../types'

export const STORAGE_KEY = 'life-app-v1'

export const stateTemplateLabels: Record<StateType, string> = {
  distracted: '分心',
  delay: '拖延',
  tired: '疲惫',
  irritable: '烦躁',
  stuck: '卡住',
  numb_scroll: '麻木刷手机',
}

export interface InterventionMethod {
  id: string
  label: string
  duration?: number // minutes
  forStates: StateType[]
}

export const presetInterventions: InterventionMethod[] = [
  { id: 'eyes-closed', label: '闭目养神', duration: 5, forStates: ['tired', 'irritable', 'distracted'] },
  { id: 'walk', label: '出去走一走', duration: 5, forStates: ['tired', 'numb_scroll', 'stuck', 'delay'] },
  { id: 'recall-goal', label: '回想最开始想做什么', forStates: ['distracted', 'numb_scroll', 'delay', 'stuck'] },
  { id: 'deep-breath', label: '深呼吸 10 次', duration: 2, forStates: ['irritable', 'tired', 'stuck'] },
  { id: 'drink-water', label: '喝杯水 / 洗把脸', duration: 2, forStates: ['tired', 'numb_scroll'] },
  { id: 'talk-self', label: '写一句话：我现在最想…', forStates: ['delay', 'stuck', 'distracted'] },
  { id: 'shrink-task', label: '把任务缩到最小一步', forStates: ['delay', 'stuck', 'too_big' as StateType] },
  { id: 'change-place', label: '换个位置坐', duration: 1, forStates: ['numb_scroll', 'distracted', 'tired'] },
]

export const difficultyTemplateLabels: Record<DifficultyType, string> = {
  too_big: '任务太大',
  dont_know: '不会做',
  no_material: '没资料',
  resistance: '不想做',
  interrupted: '被打断',
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function currentDayKey(): string {
  return dayjs().format('YYYY-MM-DD')
}

export function createTaskDefinition(
  title: string,
  kind: TaskKind,
  scheduleTime?: string,
  nextStep?: string,
): TaskDefinition {
  return {
    id: createId('task'),
    title,
    kind,
    nextStep: kind === 'normal' ? nextStep?.trim() || undefined : undefined,
    scheduleTime,
    createdAt: new Date().toISOString(),
  }
}

/**
 * 任务池里的一条 → 今天的一条。
 * 维护类（routine）不带步骤：它没有"做不做"的决策余地，到点提醒直接了结，
 * 不进主线、不占步骤、不计入完成率（见《自律 App 设计要点》第 3 条）。
 * 主动任务把「下一秒手放在哪」直接落成第一步——主屏显示的就是这一句。
 */
export function createTodayItemFromTask(task: TaskDefinition, order: number): TodayItem {
  return {
    id: createId('today'),
    sourceTaskId: task.id,
    title: task.title,
    kind: task.kind,
    isDone: false,
    order,
    steps:
      task.kind === 'normal' && task.nextStep?.trim()
        ? [
            {
              id: createId('step'),
              title: task.nextStep.trim(),
              isDone: false,
              completedAt: undefined,
            },
          ]
        : [],
    createdAt: new Date().toISOString(),
  }
}

function defaultDeviceName(): string {
  if (typeof navigator === 'undefined') {
    return '这台设备'
  }

  if (/android/i.test(navigator.userAgent)) {
    return '手机'
  }

  return '电脑'
}

export function defaultTaskDefs(): TaskDefinition[] {
  return [
    createTaskDefinition('主动联系一个人', 'routine', '20:30'),
    createTaskDefinition('吃饭', 'routine', '12:30'),
    createTaskDefinition('休息走动 10 分钟', 'routine', '16:00'),
    createTaskDefinition('洗澡', 'routine', '22:30'),
    createTaskDefinition('洗衣服', 'routine', '21:00'),
    createTaskDefinition('把今天最重要的事推进一小步', 'normal', undefined, '打开要做的那个文件，看一眼上次停在哪'),
  ]
}

export function defaultRuleDefs(): RuleDefinition[] {
  const now = new Date().toISOString()
  return [
    {
      id: createId('rule'),
      type: 'do',
      text: '零散兴趣加入"好奇清单"，不在核心任务时段看',
      createdAt: now,
    },
    {
      id: createId('rule'),
      type: 'do',
      text: '遇到难题先独立思考 3 分钟，写下思路再问 AI',
      createdAt: now,
    },
    {
      id: createId('rule'),
      type: 'do',
      text: '感到空转超过 5 分钟 → 立刻打开任务清单',
      createdAt: now,
    },
    {
      id: createId('rule'),
      type: 'avoid',
      text: '专注时段不刷短视频',
      createdAt: now,
    },
  ]
}

export function createEmptyDayPlan(dayKey = currentDayKey(), taskDefs: TaskDefinition[] = defaultTaskDefs()): DayPlan {
  // 所有维护类都建今日副本：它们不上主线也不计完成率，只是给到点提醒一个可以打勾的落点。
  const routines = taskDefs
    .filter((task) => task.kind === 'routine' && !task.archived)
    .map((task, index) => createTodayItemFromTask(task, index + 1))

  const deadlineTasks = taskDefs
    .filter((task) => task.kind === 'normal' && !task.archived && Boolean(task.deadlineDate?.trim()))
    .sort((left, right) => dayjs(left.deadlineDate).valueOf() - dayjs(right.deadlineDate).valueOf())
    .map((task, index) => createTodayItemFromTask(task, routines.length + index + 1))

  return {
    dayKey,
    todayItems: [...routines, ...deadlineTasks],
    processNotes: '',
      processNotesColor: '#1f2937',
    morningAnchorDone: false,
    review: null,
  }
}

export function defaultData(): LifeAppData {
  const taskDefs = defaultTaskDefs()
  const now = new Date().toISOString()

  return {
    updatedAt: now,
    taskDefs,
    ruleDefs: defaultRuleDefs(),
    dayPlans: {
      [currentDayKey()]: createEmptyDayPlan(currentDayKey(), taskDefs),
    },
    difficultyRecords: [],
    stateRecords: [],
    focusSessions: [],
    curiosityItems: [],
    settings: {
      theme: 'default',
      appearance: 'auto',
      focusMinutes: 25,
      breakMinutes: 5,
      desktopNotificationsEnabled: true,
      blockerLevel: 'soft',
      blockedTargets: ['抖音', '微博', '小红书', 'Bilibili'],
      syncEnabled: false,
      syncSpaceId: '',
      syncDeviceName: defaultDeviceName(),
      mobileTimerEnabled: true,
      appLockEnabled: false,
      feishuWebhookUrl: '',
      feishuKeyword: '',
      feishuSecret: '',
      feishuAutoSyncReview: false,
      feishuScheduledSyncEnabled: true,
      feishuScheduledSyncTime: '12:00',
      feishuLastScheduledSyncDayKey: '',
      reviewReminderEnabled: true,
      reviewReminderTime: '22:30',
      hardStopEnabled: true,
      hardStopTime: '23:00',
    },
    activeTimer: null,
  }
}

export function ensureDayPlan(data: LifeAppData, dayKey = currentDayKey()): LifeAppData {
  if (data.dayPlans[dayKey]) {
    return data
  }

  return {
    ...data,
    updatedAt: new Date().toISOString(),
    dayPlans: {
      ...data.dayPlans,
      [dayKey]: createEmptyDayPlan(dayKey, data.taskDefs),
    },
  }
}

/**
 * 判断某一天是否有"真实记录"（用户当天确实做过/记过事），
 * 用于历史展示与自动清理空白天。自动生成的固定提醒、截止任务（未操作）不算记录。
 */
export function dayPlanHasRecord(data: LifeAppData, dayKey: string): boolean {
  const plan = data.dayPlans[dayKey]
  if (!plan) return false

  if (plan.review) return true
  if (plan.processNotes?.trim()) return true
  if (plan.morningAnchorDone) return true
  if (plan.todayItems.some((item) => item.isDone || item.steps.some((step) => step.isDone))) return true

  if (data.difficultyRecords.some((record) => record.dayKey === dayKey)) return true
  if (data.stateRecords.some((record) => record.dayKey === dayKey)) return true
  if (data.focusSessions.some((session) => session.dayKey === dayKey)) return true

  return false
}

/**
 * 自动清理"没有记录"的空白天：保留今天与所有有记录的天（不再按 30 天上限删除），
 * 这样历史可以一直往回看，而空白天会被自动删掉。
 */
export function pruneEmptyDays(data: LifeAppData, today = currentDayKey()): LifeAppData {
  const dayPlans: Record<string, DayPlan> = {}
  for (const [key, plan] of Object.entries(data.dayPlans)) {
    if (key === today || dayPlanHasRecord(data, key)) {
      dayPlans[key] = plan
    }
  }

  // 被删掉的空白天不会有困难/状态/番茄记录，所以这些数组无需再过滤。
  return {
    ...data,
    dayPlans,
  }
}
