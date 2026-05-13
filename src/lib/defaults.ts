import dayjs from 'dayjs'
import {
  type DayPlan,
  type DifficultyType,
  type LifeAppData,
  type RuleDefinition,
  type StateType,
  type TaskDefinition,
  type TaskKind,
} from '../types'

export const STORAGE_KEY = 'life-app-v1'

export const encouragementMessages = [
  '先别想着做完一切，先把眼前这一小步做掉。',
  '你给自己设的目标值得被认真对待，现在就开始。',
  '不用完美，先开始 25 分钟，今天就会不一样。',
  '卡住也没关系，把困难写下来，下一步会更清楚。',
  '先回到你自己决定的目标上，手机晚一点再看。',
]

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

export function createTaskDefinition(title: string, kind: TaskKind, scheduleTime?: string): TaskDefinition {
  return {
    id: createId('task'),
    title,
    kind,
    scheduleTime,
    createdAt: new Date().toISOString(),
  }
}

function createTodayItemFromTask(task: TaskDefinition, order: number) {
  return {
    id: createId('today'),
    sourceTaskId: task.id,
    title: task.title,
    kind: task.kind,
    isDone: false,
    order,
    steps:
      task.kind === 'routine'
        ? [
            {
              id: createId('step'),
              title: `完成：${task.title}`,
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
    createTaskDefinition('把今天最重要的事推进一小步', 'normal'),
  ]
}

export function defaultRuleDefs(): RuleDefinition[] {
  return [
    {
      id: createId('rule'),
      type: 'avoid',
      text: '专注时段不刷短视频',
      createdAt: new Date().toISOString(),
    },
  ]
}

export function createEmptyDayPlan(dayKey = currentDayKey(), taskDefs: TaskDefinition[] = defaultTaskDefs()): DayPlan {
  const routines = taskDefs
    .filter((task) => task.kind === 'routine' && !task.archived)
    .slice(0, 2)
    .map((task, index) => createTodayItemFromTask(task, index + 1))

  const deadlineTasks = taskDefs
    .filter((task) => task.kind === 'normal' && !task.archived && Boolean(task.deadlineDate?.trim()))
    .sort((left, right) => dayjs(left.deadlineDate).valueOf() - dayjs(right.deadlineDate).valueOf())
    .map((task, index) => createTodayItemFromTask(task, routines.length + index + 1))

  return {
    dayKey,
    todayItems: [...routines, ...deadlineTasks],
    avoidItems: [],
    communicationDone: false,
    communicationNote: '',
    processNotes: '',
      processNotesColor: '#1f2937',
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
    relaxWindows: [],
    dailyTemplate: {
      topTaskSlots: 3,
      routineSlots: 2,
      avoidSlots: 1,
      communicationPrompt: '今天和一个人认真交流一次。',
      relaxMinutes: 15,
    },
    weeklyTemplate: {
      directions: ['推进一个核心目标', '保持身体节奏', '多和人交流'],
      riskScenarios: ['刷手机停不下来', '任务太大导致拖延'],
      communicationGoal: '本周主动联系至少 1 个人。',
      restPlan: '按时吃饭，至少留一个完整放松窗口。',
    },
    settings: {
      focusMinutes: 25,
      breakMinutes: 5,
      blockerLevel: 'soft',
      blockedTargets: ['抖音', '微博', '小红书', 'Bilibili'],
      encouragementEnabled: true,
      syncEnabled: false,
      syncSpaceId: '',
      syncDeviceName: defaultDeviceName(),
      mobileTimerEnabled: true,
      appLockEnabled: false,
      feishuWebhookUrl: '',
      feishuKeyword: '',
      feishuSecret: '',
      feishuAutoSyncReview: false,
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

/** Remove data older than 30 days */
export function purgeOldData(data: LifeAppData): LifeAppData {
  const cutoff = dayjs().subtract(30, 'day').format('YYYY-MM-DD')

  const dayPlans: Record<string, DayPlan> = {}
  for (const [key, plan] of Object.entries(data.dayPlans)) {
    if (key >= cutoff) dayPlans[key] = plan
  }

  return {
    ...data,
    dayPlans,
    difficultyRecords: data.difficultyRecords.filter((r) => r.dayKey >= cutoff),
    stateRecords: data.stateRecords.filter((r) => r.dayKey >= cutoff),
    focusSessions: data.focusSessions.filter((s) => s.dayKey >= cutoff),
    relaxWindows: data.relaxWindows.filter((w) => w.dayKey >= cutoff),
  }
}
