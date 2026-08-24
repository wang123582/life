import { useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import {
  createEmptyDayPlan,
  createId,
  createTodayItemFromTask,
  currentDayKey,
  defaultData,
  ensureDayPlan,
} from '../lib/defaults'
import { parseQuickTaskInput } from '../lib/quickCapture'
import { loadData, saveData } from '../lib/storage'
import { isSyncEnvReady, pullRemoteSnapshot, pushRemoteSnapshot } from '../lib/sync'
import type {
  AppSettings,
  DayPlan,
  DifficultyRecord,
  FinishTimerPayload,
  FocusSession,
  LifeAppData,
  ReviewInput,
  RuleType,
  StateRecord,
  StateType,
  TaskDefinition,
  TaskKind,
  TaskStep,
  TodayItem,
} from '../types'

function clonePlan(plan: ReturnType<typeof createEmptyDayPlan>) {
  return {
    ...plan,
    todayItems: plan.todayItems.map((item) => ({
      ...item,
      steps: item.steps.map((step) => ({ ...step })),
    })),
    review: plan.review ? { ...plan.review } : null,
  }
}

function getForcedDeadlineTasks(taskDefs: TaskDefinition[]): TaskDefinition[] {
  return taskDefs
    .filter((task) => task.kind === 'normal' && !task.archived && Boolean(task.deadlineDate?.trim()))
    .sort((left, right) => dayjs(left.deadlineDate).valueOf() - dayjs(right.deadlineDate).valueOf())
}

/**
 * 每天自动补齐的两类今日副本：
 * - 维护类（生活）：不上主线、不计完成率，只是给到点提醒一个能打勾的落点；
 * - 填了截止日期的主动任务：到期前每天都要出现，直到做完。
 */
function syncForcedTasksIntoPlan(plan: DayPlan, taskDefs: TaskDefinition[]): DayPlan {
  const routines = taskDefs.filter((task) => task.kind === 'routine' && !task.archived)
  const forcedTasks = [...routines, ...getForcedDeadlineTasks(taskDefs)]

  if (forcedTasks.length === 0) {
    return plan
  }

  const existingSourceIds = new Set(
    plan.todayItems.map((item) => item.sourceTaskId).filter((taskId): taskId is string => Boolean(taskId)),
  )
  const additions = forcedTasks
    .filter((task) => !existingSourceIds.has(task.id))
    .map((task, index) => createTodayItemFromTask(task, plan.todayItems.length + index + 1))

  if (additions.length === 0) {
    return plan
  }

  return {
    ...plan,
    todayItems: [...plan.todayItems, ...additions].map((item, index) => ({ ...item, order: index + 1 })),
  }
}

function syncForcedTasksForDay(data: LifeAppData, dayKey: string): LifeAppData {
  const plan = data.dayPlans[dayKey]

  if (!plan) {
    return data
  }

  const syncedPlan = syncForcedTasksIntoPlan(plan, data.taskDefs)

  if (syncedPlan === plan) {
    return data
  }

  return {
    ...data,
    dayPlans: {
      ...data.dayPlans,
      [dayKey]: syncedPlan,
    },
  }
}

function syncDeadlineTaskCompletion(data: LifeAppData, todayItem?: TodayItem): LifeAppData {
  if (!todayItem?.sourceTaskId) {
    return data
  }

  const task = data.taskDefs.find((item) => item.id === todayItem.sourceTaskId)

  if (!task || task.kind !== 'normal' || !task.deadlineDate?.trim()) {
    return data
  }

  const shouldArchive = todayItem.isDone

  if (Boolean(task.archived) === shouldArchive) {
    return data
  }

  return {
    ...data,
    taskDefs: data.taskDefs.map((item) => (item.id === task.id ? { ...item, archived: shouldArchive } : item)),
  }
}

function stampData(data: LifeAppData): LifeAppData {
  return {
    ...data,
    updatedAt: new Date().toISOString(),
  }
}

export function useLifeApp() {
  const [data, setData] = useState<LifeAppData>(() => loadData())
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const dayKey = currentDayKey()
  const latestDataRef = useRef(data)
  const lastSyncedUpdatedAtRef = useRef('')
  const applyingRemoteRef = useRef(false)

  useEffect(() => {
    latestDataRef.current = data
  }, [data])

  useEffect(() => {
    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      const synced = syncForcedTasksForDay(next, dayKey)

      return synced === next ? next : stampData(synced)
    })
  }, [dayKey, data.taskDefs])

  useEffect(() => {
    saveData(data)
  }, [data])

  const safeData = useMemo(() => syncForcedTasksForDay(ensureDayPlan(data, dayKey), dayKey), [data, dayKey])
  const dayPlan = safeData.dayPlans[dayKey] ?? createEmptyDayPlan(dayKey, safeData.taskDefs)
  const syncReady = Boolean(safeData.settings.syncEnabled && safeData.settings.syncSpaceId.trim() && isSyncEnvReady())

  const updateDayPlan = (updater: (plan: typeof dayPlan) => typeof dayPlan) => {
    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      const currentPlan = next.dayPlans[dayKey]

      return stampData({
        ...next,
        dayPlans: {
          ...next.dayPlans,
          [dayKey]: updater(clonePlan(currentPlan)),
        },
      })
    })
  }

  const applyRemoteData = (remoteData: LifeAppData) => {
    applyingRemoteRef.current = true
    lastSyncedUpdatedAtRef.current = remoteData.updatedAt
    setData(ensureDayPlan(remoteData, dayKey))
    window.setTimeout(() => {
      applyingRemoteRef.current = false
    }, 0)
  }

  const pullFromCloud = async (source: 'manual' | 'auto' = 'manual') => {
    if (!safeData.settings.syncSpaceId.trim()) {
      setSyncStatus('error')
      setSyncMessage('先填同步空间码。')
      throw new Error('先填同步空间码。')
    }

    if (!isSyncEnvReady()) {
      setSyncStatus('error')
      setSyncMessage('还没配置 Supabase。先把 .env 里的地址和 key 填上。')
      throw new Error('还没配置 Supabase。先把 .env 里的地址和 key 填上。')
    }

    if (source === 'manual') {
      setSyncStatus('syncing')
      setSyncMessage('正在从云端拉取…')
    }

    const remoteData = await pullRemoteSnapshot(safeData.settings.syncSpaceId)

    if (!remoteData) {
      if (source === 'manual') {
        setSyncStatus('error')
        setSyncMessage('云端还没有数据，先在一台设备上保存后上传一次。')
      }
      return
    }

    if (!latestDataRef.current.updatedAt || dayjs(remoteData.updatedAt).isAfter(dayjs(latestDataRef.current.updatedAt))) {
      applyRemoteData(remoteData)
      setSyncStatus('success')
      setSyncMessage('已从云端拉下最新数据。')
      return
    }

    lastSyncedUpdatedAtRef.current = latestDataRef.current.updatedAt
    setSyncStatus('success')
    setSyncMessage(source === 'manual' ? '当前设备已经是最新数据。' : '已检查云端，没有更新。')
  }

  const pushToCloud = async (source: 'manual' | 'auto' = 'manual') => {
    const currentData = latestDataRef.current

    if (!currentData.settings.syncSpaceId.trim()) {
      setSyncStatus('error')
      setSyncMessage('先填同步空间码。')
      throw new Error('先填同步空间码。')
    }

    if (!isSyncEnvReady()) {
      setSyncStatus('error')
      setSyncMessage('还没配置 Supabase。先把 .env 里的地址和 key 填上。')
      throw new Error('还没配置 Supabase。先把 .env 里的地址和 key 填上。')
    }

    if (source === 'manual') {
      setSyncStatus('syncing')
      setSyncMessage('正在上传到云端…')
    }

    await pushRemoteSnapshot(currentData.settings.syncSpaceId, currentData, currentData.settings.syncDeviceName)
    lastSyncedUpdatedAtRef.current = currentData.updatedAt
    setSyncStatus('success')
    setSyncMessage('已把这台设备的数据上传到云端。')
  }

  const addTaskDefinition = (title: string, kind: TaskKind, scheduleTime?: string, deadlineDate?: string, nextStep?: string) => {
    const parsedInput = parseQuickTaskInput(title, kind, scheduleTime)
    if (!parsedInput.title) return
    if (parsedInput.kind === 'normal' && !nextStep?.trim()) return

    const task: TaskDefinition = {
      id: createId('task'),
      title: parsedInput.title,
      kind: parsedInput.kind,
      nextStep: parsedInput.kind === 'normal' ? nextStep?.trim() || undefined : undefined,
      scheduleTime: parsedInput.scheduleTime,
      deadlineDate: parsedInput.kind === 'normal' ? deadlineDate?.trim() || undefined : undefined,
      createdAt: new Date().toISOString(),
    }

    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      const nextTaskDefs = [task, ...next.taskDefs]
      // 维护类和有截止日期的任务都会自动进今天：前者要给到点提醒一个落点，后者到期前每天都得出现。
      const isForced = task.kind === 'routine' || Boolean(task.deadlineDate)

      return stampData({
        ...next,
        taskDefs: nextTaskDefs,
        dayPlans: isForced
          ? {
              ...next.dayPlans,
              [dayKey]: syncForcedTasksIntoPlan(clonePlan(next.dayPlans[dayKey]), nextTaskDefs),
            }
          : next.dayPlans,
      })
    })
  }

  const quickStartTodayTask = (title: string, firstStep?: string) => {
    const cleanTitle = title.trim()
    const cleanStep = firstStep?.trim()

    if (!cleanTitle) {
      return null
    }

    const task: TaskDefinition = {
      id: createId('task'),
      title: cleanTitle,
      kind: 'normal',
      // 写进任务定义，而不是只当今天的第一步——否则以后从任务池「直接开始」会丢掉这句，
      // 退回到「先开始：xxx」的兜底文案。三个创建入口对这个字段必须同一个口径。
      nextStep: cleanStep || undefined,
      createdAt: new Date().toISOString(),
    }

    const todayItemId = createId('today')
    const firstStepId = cleanStep ? createId('step') : undefined

    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      const plan = clonePlan(next.dayPlans[dayKey])
      const todayItem: TodayItem = {
        id: todayItemId,
        sourceTaskId: task.id,
        title: task.title,
        kind: 'normal',
        isDone: false,
        order: plan.todayItems.length + 1,
        steps: cleanStep
          ? [
              {
                id: firstStepId!,
                title: cleanStep,
                isDone: false,
                completedAt: undefined,
              },
            ]
          : [],
        createdAt: new Date().toISOString(),
      }

      return stampData({
        ...next,
        taskDefs: [task, ...next.taskDefs],
        dayPlans: {
          ...next.dayPlans,
          [dayKey]: {
            ...plan,
            todayItems: [...plan.todayItems, todayItem],
          },
        },
      })
    })

    return {
      taskId: task.id,
      todayItemId,
      stepId: firstStepId,
    }
  }

  /**
   * 晨间锚点：一天只锚一件事。标题和「下一秒手放在哪」都必须有，
   * 建的 taskDef 也带上 nextStep——和任务池「加一件」、今天页「快速加一件」同一个口径。
   */
  const confirmMorningAnchor = (title: string, step: string): string | null => {
    const cleanTitle = title.trim()
    const cleanStep = step.trim()
    if (!cleanTitle || !cleanStep) return null

    const now = new Date().toISOString()
    const taskId = createId('task')
    const task: TaskDefinition = { id: taskId, title: cleanTitle, kind: 'normal', nextStep: cleanStep, createdAt: now }
    const item: TodayItem = {
      id: createId('today'),
      sourceTaskId: taskId,
      title: cleanTitle,
      kind: 'normal',
      isDone: false,
      order: 0,
      steps: [{ id: createId('step'), title: cleanStep, isDone: false }],
      createdAt: now,
    }

    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      const plan = clonePlan(next.dayPlans[dayKey])

      return stampData({
        ...next,
        taskDefs: [task, ...next.taskDefs],
        dayPlans: {
          ...next.dayPlans,
          [dayKey]: {
            ...plan,
            // 锚定这一件排在最前，直接成为主线。
            todayItems: [item, ...plan.todayItems].map((entry, index) => ({ ...entry, order: index + 1 })),
            morningAnchorDone: true,
            morningAnchorAt: now,
          },
        },
      })
    })

    return item.id
  }

  const resetMorningAnchor = () => {
    updateDayPlan((plan) => ({
      ...plan,
      morningAnchorDone: false,
      morningAnchorAt: undefined,
    }))
  }

  const removeTaskDefinition = (taskId: string) => {
    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      const removedTodayItemIds = new Set<string>()

      const nextDayPlans = Object.fromEntries(
        Object.entries(next.dayPlans).map(([planKey, plan]) => {
          const clonedPlan = clonePlan(plan)

          clonedPlan.todayItems = clonedPlan.todayItems
            .filter((item) => {
              const shouldRemove = item.sourceTaskId === taskId && !item.isDone

              if (shouldRemove) {
                removedTodayItemIds.add(item.id)
              }

              return !shouldRemove
            })
            .map((item, index) => ({ ...item, order: index + 1 }))

          return [planKey, clonedPlan]
        }),
      ) as LifeAppData['dayPlans']

      const shouldClearActiveTimer = next.activeTimer?.dayItemId ? removedTodayItemIds.has(next.activeTimer.dayItemId) : false

      return stampData({
        ...next,
        taskDefs: next.taskDefs.filter((task) => task.id !== taskId),
        dayPlans: nextDayPlans,
        activeTimer: shouldClearActiveTimer ? null : next.activeTimer,
      })
    })
  }

  const toggleTodayItemDone = (itemId: string) => {
    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      const plan = clonePlan(next.dayPlans[dayKey])
      let updatedItem: TodayItem | undefined
      const now = new Date().toISOString()

      plan.todayItems = plan.todayItems.map((item) => {
        if (item.id !== itemId) return item

        const isDone = !item.isDone
        const steps = item.steps.length === 0
          ? item.steps
          : item.steps.map((step) => ({
              ...step,
              isDone,
              completedAt: isDone ? step.completedAt ?? now : undefined,
            }))

        updatedItem = {
          ...item,
          isDone,
          steps,
        }

        return updatedItem
      })

      let updated: LifeAppData = stampData({
        ...next,
        dayPlans: {
          ...next.dayPlans,
          [dayKey]: plan,
        },
      })

      updated = syncDeadlineTaskCompletion(updated, updatedItem)

      return updated
    })
  }

  /**
   * 换主线：把目标那件事挪到所有「未完成的主动任务」之前，它就是今天这一件。
   * 「今天不做」里唯一允许的动作就是它——不是同时做两件，是换掉。
   */
  function promoteInPlan(plan: DayPlan, target: TodayItem): DayPlan {
    const rest = plan.todayItems.filter((item) => item.id !== target.id)
    const firstPending = rest.findIndex((item) => item.kind !== 'routine' && !item.isDone)
    const insertAt = firstPending < 0 ? rest.length : firstPending
    const items = [...rest.slice(0, insertAt), target, ...rest.slice(insertAt)]

    return { ...plan, todayItems: items.map((item, index) => ({ ...item, order: index + 1 })) }
  }

  const focusOnTodayItem = (itemId: string) => {
    updateDayPlan((plan) => {
      const target = plan.todayItems.find((item) => item.id === itemId)
      if (!target || target.kind === 'routine' || target.isDone) return plan
      return promoteInPlan(plan, target)
    })
  }

  const focusOnTask = (taskId: string) => {
    const task = safeData.taskDefs.find((item) => item.id === taskId && !item.archived)
    if (!task || task.kind === 'routine') return

    updateDayPlan((plan) => {
      const existing = plan.todayItems.find((item) => item.sourceTaskId === taskId && !item.isDone)
      const target = existing ?? createTodayItemFromTask(task, plan.todayItems.length + 1)
      return promoteInPlan(plan, target)
    })
  }

  const removeTodayItem = (itemId: string) => {
    updateDayPlan((plan) => ({
      ...plan,
      todayItems: plan.todayItems
        .filter((item) => item.id !== itemId)
        .map((item, index) => ({ ...item, order: index + 1 })),
    }))
  }

  const addStep = (todayItemId: string, title: string) => {
    const cleanTitle = title.trim()
    if (!cleanTitle) return

    updateDayPlan((plan) => ({
      ...plan,
      todayItems: plan.todayItems.map((item) =>
        item.id === todayItemId
          ? {
              ...item,
              isDone: false,
              steps: [
                ...item.steps,
                {
                  id: createId('step'),
                  title: cleanTitle,
                  isDone: false,
                  completedAt: undefined,
                },
              ],
            }
          : item,
      ),
    }))
  }

  const removeStep = (todayItemId: string, stepId: string) => {
    updateDayPlan((plan) => ({
      ...plan,
      todayItems: plan.todayItems.map((item) => {
        if (item.id !== todayItemId) return item

        const steps = item.steps.filter((step) => step.id !== stepId)

        return {
          ...item,
          steps,
          isDone: steps.length > 0 ? steps.every((step) => step.isDone) : false,
        }
      }),
    }))
  }

  const toggleStepDone = (todayItemId: string, stepId: string) => {
    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      const plan = clonePlan(next.dayPlans[dayKey])
      let updatedItem: TodayItem | undefined

      plan.todayItems = plan.todayItems.map((item) => {
        if (item.id !== todayItemId) return item

        const steps = item.steps.map((step) =>
          step.id === stepId
            ? {
                ...step,
                isDone: !step.isDone,
                completedAt: step.isDone ? undefined : new Date().toISOString(),
              }
            : step,
        )
        const allDone = steps.length > 0 && steps.every((step) => step.isDone)
        updatedItem = {
          ...item,
          steps,
          isDone: allDone,
        }

        return updatedItem
      })

      let updated: LifeAppData = stampData({
        ...next,
        dayPlans: {
          ...next.dayPlans,
          [dayKey]: plan,
        },
      })

      updated = syncDeadlineTaskCompletion(updated, updatedItem)

      return updated
    })
  }

  const addStateRecord = (stateType: StateType, trigger: string, response: string, result: StateRecord['result']) => {
    const record: StateRecord = {
      id: createId('state'),
      dayKey,
      stateType,
      trigger: trigger.trim(),
      response: response.trim(),
      result,
      createdAt: new Date().toISOString(),
    }

    setData((prev) => ({
      ...stampData(ensureDayPlan(prev, dayKey)),
      stateRecords: [record, ...prev.stateRecords],
    }))
  }

  const addRuleDefinition = (text: string, type: RuleType) => {
    const cleanText = text.trim()
    if (!cleanText) return

    setData((prev) => ({
      ...stampData(prev),
      ruleDefs: [
        {
          id: createId('rule'),
          type,
          text: cleanText,
          createdAt: new Date().toISOString(),
        },
        ...prev.ruleDefs,
      ],
    }))
  }

  const removeRuleDefinition = (id: string) => {
    setData((prev) => stampData({
      ...prev,
      ruleDefs: prev.ruleDefs.filter((rule) => rule.id !== id),
    }))
  }

  const updateRuleDefinition = (id: string, text: string) => {
    const cleanText = text.trim()
    if (!cleanText) return

    setData((prev) => stampData({
      ...prev,
      ruleDefs: prev.ruleDefs.map((rule) => (rule.id === id ? { ...rule, text: cleanText } : rule)),
    }))
  }

  const addCuriosityItem = (text: string) => {
    const cleanText = text.trim()
    if (!cleanText) return

    setData((prev) => stampData({
      ...prev,
      curiosityItems: [
        { id: createId('curio'), text: cleanText, createdAt: new Date().toISOString() },
        ...prev.curiosityItems,
      ],
    }))
  }

  const removeCuriosityItem = (id: string) => {
    setData((prev) => stampData({
      ...prev,
      curiosityItems: prev.curiosityItems.filter((item) => item.id !== id),
    }))
  }

  const archiveCuriosityItem = (id: string) => {
    setData((prev) => stampData({
      ...prev,
      curiosityItems: prev.curiosityItems.map((item) => (item.id === id ? { ...item, archived: true } : item)),
    }))
  }

  const updateSettings = (payload: Partial<AppSettings>) => {
    setData((prev) => ({
      ...stampData(prev),
      settings: {
        ...prev.settings,
        ...payload,
      },
    }))
  }

  const startFocusTimer = (dayItemId?: string, stepId?: string) => {
    setData((prev) => ({
      ...stampData(ensureDayPlan(prev, dayKey)),
      activeTimer: {
        mode: 'focus',
        dayItemId,
        stepId,
        startedAt: new Date().toISOString(),
        durationMinutes: prev.settings.focusMinutes,
      },
    }))
  }

  const cancelTimer = () => {
    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      if (!next.activeTimer) return next

      const session: FocusSession = {
        id: createId('focus'),
        dayKey,
        todayItemId: next.activeTimer.dayItemId,
        stepId: next.activeTimer.stepId,
        mode: next.activeTimer.mode,
        startedAt: next.activeTimer.startedAt,
        endedAt: new Date().toISOString(),
        plannedMinutes: next.activeTimer.durationMinutes,
        status: 'cancelled',
      }

      return stampData({
        ...next,
        activeTimer: null,
        focusSessions: [session, ...next.focusSessions],
      })
    })
  }

  const finishBreakTimer = () => {
    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      const activeTimer = next.activeTimer

      if (!activeTimer || activeTimer.mode !== 'shortBreak') {
        return next
      }

      const session: FocusSession = {
        id: createId('focus'),
        dayKey,
        todayItemId: activeTimer.dayItemId,
        stepId: activeTimer.stepId,
        mode: activeTimer.mode,
        startedAt: activeTimer.startedAt,
        endedAt: new Date().toISOString(),
        plannedMinutes: activeTimer.durationMinutes,
        status: 'completed',
      }

      return stampData({
        ...next,
        activeTimer: null,
        focusSessions: [session, ...next.focusSessions],
      })
    })
  }

  const finishTimer = (payload: FinishTimerPayload) => {
    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      if (!next.activeTimer) return next

      const activeTimer = next.activeTimer
      const session: FocusSession = {
        id: createId('focus'),
        dayKey,
        todayItemId: activeTimer.dayItemId,
        stepId: activeTimer.stepId,
        mode: activeTimer.mode,
        startedAt: activeTimer.startedAt,
        endedAt: new Date().toISOString(),
        plannedMinutes: activeTimer.durationMinutes,
        status: payload.completed ? 'completed' : 'cancelled',
        accomplishment: payload.accomplishment?.trim() || undefined,
      }

      const plan = clonePlan(next.dayPlans[dayKey])

      if (payload.markStepDone && activeTimer.dayItemId && activeTimer.stepId) {
        const finishedAt = new Date().toISOString()
        plan.todayItems = plan.todayItems.map((item) => {
          if (item.id !== activeTimer.dayItemId) return item
          const steps: TaskStep[] = item.steps.map((step) =>
            step.id === activeTimer.stepId ? { ...step, isDone: true, completedAt: finishedAt } : step,
          )
          const allDone = steps.length > 0 && steps.every((step) => step.isDone)
          return {
            ...item,
            steps,
            isDone: allDone || item.isDone,
          }
        })
      }

      let updated: LifeAppData = stampData({
        ...next,
        activeTimer:
          payload.completed && activeTimer.mode === 'focus' && next.settings.breakMinutes > 0
            ? {
                mode: 'shortBreak',
                dayItemId: activeTimer.dayItemId,
                stepId: activeTimer.stepId,
                startedAt: new Date().toISOString(),
                durationMinutes: next.settings.breakMinutes,
              }
            : null,
        focusSessions: [session, ...next.focusSessions],
        dayPlans: {
          ...next.dayPlans,
          [dayKey]: plan,
        },
      })

      if (payload.difficultyType || payload.nextAction?.trim()) {
        const difficulty: DifficultyRecord = {
          id: createId('difficulty'),
          dayKey,
          todayItemId: activeTimer.dayItemId,
          type: payload.difficultyType ?? 'too_big',
          note: payload.difficultyNote?.trim() ?? '',
          nextAction: payload.nextAction?.trim() ?? '',
          createdAt: new Date().toISOString(),
        }

        updated = {
          ...updated,
          difficultyRecords: [difficulty, ...updated.difficultyRecords],
        }

        if (payload.nextAction?.trim() && activeTimer.dayItemId) {
          updated = {
            ...updated,
            dayPlans: {
              ...updated.dayPlans,
              [dayKey]: {
                ...updated.dayPlans[dayKey],
                todayItems: updated.dayPlans[dayKey].todayItems.map((item) =>
                  item.id === activeTimer.dayItemId
                    ? {
                        ...item,
                        isDone: false,
                        steps: [
                          ...item.steps,
                          {
                            id: createId('step'),
                            title: payload.nextAction!.trim(),
                            isDone: false,
                            completedAt: undefined,
                          },
                        ],
                      }
                    : item,
                ),
              },
            },
          }
        }
      }

      const latestItem = activeTimer.dayItemId
        ? updated.dayPlans[dayKey].todayItems.find((item) => item.id === activeTimer.dayItemId)
        : undefined
      updated = syncDeadlineTaskCompletion(updated, latestItem)

      return updated
    })
  }

  const saveReview = (payload: ReviewInput) => {
    updateDayPlan((plan) => ({
      ...plan,
      review: {
        // 先摊开旧记录，保住 tomorrow 这类表单已不再写入的遗留字段。
        ...plan.review,
        ...payload,
        updatedAt: new Date().toISOString(),
      },
    }))
  }

  const updateProcessNotes = (notes: string) => {
    updateDayPlan((plan) => ({
      ...plan,
      processNotes: notes,
    }))
  }

  const updateProcessNotesColor = (color: string) => {
    updateDayPlan((plan) => ({
      ...plan,
      processNotesColor: color,
    }))
  }

  const resetAll = () => {
    setData(defaultData())
  }

  const removeDifficultyRecord = (id: string) => {
    setData((prev) => stampData({
      ...prev,
      difficultyRecords: prev.difficultyRecords.filter((r) => r.id !== id),
    }))
  }

  const updateDifficultyRecord = (id: string, updates: { note?: string; nextAction?: string }) => {
    setData((prev) => stampData({
      ...prev,
      difficultyRecords: prev.difficultyRecords.map((r) =>
        r.id === id ? { ...r, ...updates } : r,
      ),
    }))
  }

  const removeFocusSession = (id: string) => {
    setData((prev) => stampData({
      ...prev,
      focusSessions: prev.focusSessions.filter((s) => s.id !== id),
    }))
  }

  const updateFocusSession = (id: string, updates: { accomplishment?: string }) => {
    setData((prev) => stampData({
      ...prev,
      focusSessions: prev.focusSessions.map((s) =>
        s.id === id ? { ...s, ...updates } : s,
      ),
    }))
  }

  useEffect(() => {
    if (!syncReady) {
      return
    }

    void pullFromCloud('auto').catch((error) => {
      setSyncStatus('error')
      setSyncMessage(error instanceof Error ? error.message : '自动拉取云端数据失败。')
    })

    const intervalId = window.setInterval(() => {
      void pullFromCloud('auto').catch(() => undefined)
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [syncReady, safeData.settings.syncSpaceId])

  useEffect(() => {
    if (!syncReady || applyingRemoteRef.current) {
      return
    }

    if (!safeData.updatedAt || safeData.updatedAt === lastSyncedUpdatedAtRef.current) {
      return
    }

    const timerId = window.setTimeout(() => {
      void pushToCloud('auto').catch((error) => {
        setSyncStatus('error')
        setSyncMessage(error instanceof Error ? error.message : '自动上传云端失败。')
      })
    }, 1200)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [safeData.updatedAt, syncReady])

  const pendingTodayItems = dayPlan.todayItems.filter((item) => !item.isDone)
  const isMorningAnchorPending = !dayPlan.morningAnchorDone
  const todayDifficultyRecords = safeData.difficultyRecords.filter((record) => record.dayKey === dayKey)
  const todayStateRecords = safeData.stateRecords.filter((record) => record.dayKey === dayKey)
  const todayFocusSessions = safeData.focusSessions.filter((session) => session.dayKey === dayKey)

  return {
    data: safeData,
    dayKey,
    dayPlan,
    pendingTodayItems,
    isMorningAnchorPending,
    todayDifficultyRecords,
    todayStateRecords,
    todayFocusSessions,
    sync: {
      isReady: syncReady,
      envReady: isSyncEnvReady(),
      status: syncStatus,
      message: syncMessage,
      pullFromCloud,
      pushToCloud,
    },
    actions: {
      addTaskDefinition,
      quickStartTodayTask,
      confirmMorningAnchor,
      resetMorningAnchor,
      focusOnTodayItem,
      focusOnTask,
      removeTaskDefinition,
      toggleTodayItemDone,
      removeTodayItem,
      addStep,
      removeStep,
      toggleStepDone,
      addStateRecord,
      addRuleDefinition,
      removeRuleDefinition,
      updateRuleDefinition,
      addCuriosityItem,
      removeCuriosityItem,
      archiveCuriosityItem,
      updateSettings,
      startFocusTimer,
      cancelTimer,
      finishBreakTimer,
      finishTimer,
      saveReview,
      updateProcessNotes,
      updateProcessNotesColor,
      removeDifficultyRecord,
      updateDifficultyRecord,
      removeFocusSession,
      updateFocusSession,
      resetAll,
    },
  }
}

/** 整个应用的状态与动作集合，供各视图组件复用。 */
export type LifeApp = ReturnType<typeof useLifeApp>
