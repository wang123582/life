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
    .map((task, index) => ({
      id: createId('today'),
      sourceTaskId: task.id,
      title: task.title,
      kind: task.kind,
      isDone: false,
      order: index + 1,
      steps: [
        {
          id: createId('step'),
          title: `完成：${task.title}`,
          isDone: false,
          completedAt: undefined,
        },
      ],
      createdAt: new Date().toISOString(),
    }))

  return {
    dayKey,
    todayItems: routines,
    avoidItems: [],
    communicationDone: false,
    communicationNote: '',
    review: null,
  }
}

export function defaultData(): LifeAppData {
  const taskDefs = defaultTaskDefs()

  return {
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
      feishuWebhookUrl: '',
      feishuKeyword: '',
      feishuSecret: '',
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
    dayPlans: {
      ...data.dayPlans,
      [dayKey]: createEmptyDayPlan(dayKey, data.taskDefs),
    },
  }
}
