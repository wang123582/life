import { useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { createEmptyDayPlan, createId, currentDayKey, defaultData, ensureDayPlan } from '../lib/defaults'
import { loadData, saveData } from '../lib/storage'
import { isSyncEnvReady, pullRemoteSnapshot, pushRemoteSnapshot } from '../lib/sync'
import type {
  AppSettings,
  DifficultyRecord,
  FinishTimerPayload,
  FocusSession,
  LifeAppData,
  RelaxWindow,
  ReviewInput,
  RuleType,
  StateRecord,
  StateType,
  TaskDefinition,
  TaskKind,
  TaskStep,
  TodayItem,
  WeeklyTemplate,
} from '../types'

const relaxRecommendations = [
  '做得不错，去看 30 分钟影视解说放松一下。',
  '这轮已经推进了，听 15 分钟轻松内容，再回来继续。',
  '可以出去走走，或者看点轻松内容，但记得回来。',
]

function clonePlan(plan: ReturnType<typeof createEmptyDayPlan>) {
  return {
    ...plan,
    todayItems: plan.todayItems.map((item) => ({
      ...item,
      steps: item.steps.map((step) => ({ ...step })),
    })),
    avoidItems: plan.avoidItems.map((item) => ({ ...item })),
    review: plan.review ? { ...plan.review } : null,
  }
}

function randomRecommendation(): string {
  return relaxRecommendations[Math.floor(Math.random() * relaxRecommendations.length)]
}

function appendRelaxWindow(data: LifeAppData, sourceType: RelaxWindow['sourceType'], sourceId: string): LifeAppData {
  const dayKey = currentDayKey()
  const relaxWindow: RelaxWindow = {
    id: createId('relax'),
    dayKey,
    sourceType,
    sourceId,
    minutes: data.dailyTemplate.relaxMinutes,
    recommendation: randomRecommendation(),
    createdAt: new Date().toISOString(),
    expiresAt: dayjs().add(data.dailyTemplate.relaxMinutes, 'minute').toISOString(),
    used: false,
  }

  return {
    ...data,
    relaxWindows: [relaxWindow, ...data.relaxWindows],
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
    setData((prev) => ensureDayPlan(prev, dayKey))
  }, [dayKey])

  useEffect(() => {
    saveData(data)
  }, [data])

  const safeData = useMemo(() => ensureDayPlan(data, dayKey), [data, dayKey])
  const dayPlan = safeData.dayPlans[dayKey] ?? createEmptyDayPlan(dayKey, safeData.taskDefs)
  const activeRelaxWindow = safeData.relaxWindows.find((window) => !window.used && dayjs(window.expiresAt).isAfter(dayjs()))
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

  const addTaskDefinition = (title: string, kind: TaskKind, scheduleTime?: string) => {
    const cleanTitle = title.trim()
    if (!cleanTitle) return

    const task: TaskDefinition = {
      id: createId('task'),
      title: cleanTitle,
      kind,
      scheduleTime: scheduleTime?.trim() ? scheduleTime : undefined,
      createdAt: new Date().toISOString(),
    }

    setData((prev) => ({
      ...stampData(prev),
      taskDefs: [task, ...prev.taskDefs],
    }))
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

  const addTaskToToday = (taskId: string) => {
    const task = safeData.taskDefs.find((item) => item.id === taskId && !item.archived)
    if (!task) return

    updateDayPlan((plan) => {
      const existing = plan.todayItems.find((item) => item.sourceTaskId === taskId && !item.isDone)
      if (existing) return plan

      const newItem: TodayItem = {
        id: createId('today'),
        sourceTaskId: task.id,
        title: task.title,
        kind: task.kind,
        isDone: false,
        order: plan.todayItems.length + 1,
        steps: [],
        createdAt: new Date().toISOString(),
      }

      return {
        ...plan,
        todayItems: [...plan.todayItems, newItem],
      }
    })
  }

  const launchTaskDefinition = (taskId: string) => {
    const task = safeData.taskDefs.find((item) => item.id === taskId && !item.archived)
    if (!task) return null

    const currentPlan = ensureDayPlan(safeData, dayKey).dayPlans[dayKey]
    const existing = currentPlan.todayItems.find((item) => item.sourceTaskId === taskId && !item.isDone)
    const existingPendingStep = existing?.steps.find((step) => !step.isDone)
    const shouldCreateStarterStep = task.kind === 'normal' && (!existing || existing.steps.length === 0)
    const todayItemId = existing?.id ?? createId('today')
    const starterStepId = existingPendingStep?.id ?? (shouldCreateStarterStep ? createId('step') : undefined)
    const starterStepTitle = shouldCreateStarterStep ? `先开始：${task.title}` : undefined

    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      const plan = clonePlan(next.dayPlans[dayKey])

      if (!existing) {
        plan.todayItems = [
          ...plan.todayItems,
          {
            id: todayItemId,
            sourceTaskId: task.id,
            title: task.title,
            kind: task.kind,
            isDone: false,
            order: plan.todayItems.length + 1,
            steps: starterStepId && starterStepTitle
              ? [
                  {
                    id: starterStepId,
                    title: starterStepTitle,
                    isDone: false,
                    completedAt: undefined,
                  },
                ]
              : [],
            createdAt: new Date().toISOString(),
          },
        ]
      } else if (starterStepId && starterStepTitle) {
        plan.todayItems = plan.todayItems.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                steps: [
                  ...item.steps,
                  {
                    id: starterStepId,
                    title: starterStepTitle,
                    isDone: false,
                    completedAt: undefined,
                  },
                ],
              }
            : item,
        )
      }

      return stampData({
        ...next,
        dayPlans: {
          ...next.dayPlans,
          [dayKey]: plan,
        },
        activeTimer: {
          mode: 'focus',
          dayItemId: todayItemId,
          stepId: starterStepId,
          startedAt: new Date().toISOString(),
          durationMinutes: next.settings.focusMinutes,
        },
      })
    })

    return {
      todayItemId,
      stepId: starterStepId,
      createdTodayItem: !existing,
      createdStep: !existingPendingStep && Boolean(starterStepId),
    }
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
      let changedSource: TodayItem | undefined
      const now = new Date().toISOString()

      plan.todayItems = plan.todayItems.map((item) => {
        if (item.id !== itemId) return item

        changedSource = { ...item }
        const isDone = !item.isDone
        const steps = item.steps.length === 0
          ? item.steps
          : item.steps.map((step) => ({
              ...step,
              isDone,
              completedAt: isDone ? step.completedAt ?? now : undefined,
            }))

        return {
          ...item,
          isDone,
          steps,
        }
      })

      let updated: LifeAppData = stampData({
        ...next,
        dayPlans: {
          ...next.dayPlans,
          [dayKey]: plan,
        },
      })

      if (changedSource && !changedSource.isDone) {
        updated = appendRelaxWindow(updated, changedSource.kind === 'routine' ? 'routine' : 'task', changedSource.id)
      }

      return updated
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

  const moveTodayItem = (itemId: string, direction: -1 | 1) => {
    updateDayPlan((plan) => {
      const index = plan.todayItems.findIndex((item) => item.id === itemId)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= plan.todayItems.length) {
        return plan
      }

      const items = [...plan.todayItems]
      const [moved] = items.splice(index, 1)
      items.splice(targetIndex, 0, moved)

      return {
        ...plan,
        todayItems: items.map((item, idx) => ({ ...item, order: idx + 1 })),
      }
    })
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

  const toggleStepDone = (todayItemId: string, stepId: string) => {
    updateDayPlan((plan) => ({
      ...plan,
      todayItems: plan.todayItems.map((item) => {
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

        return {
          ...item,
          steps,
          isDone: allDone,
        }
      }),
    }))
  }

  const addAvoidItem = (text: string) => {
    const cleanText = text.trim()
    if (!cleanText) return

    updateDayPlan((plan) => ({
      ...plan,
      avoidItems: [
        ...plan.avoidItems,
        {
          id: createId('avoid'),
          text: cleanText,
          isDone: false,
          createdAt: new Date().toISOString(),
        },
      ],
    }))
  }

  const toggleAvoidDone = (avoidId: string) => {
    updateDayPlan((plan) => ({
      ...plan,
      avoidItems: plan.avoidItems.map((item) => (item.id === avoidId ? { ...item, isDone: !item.isDone } : item)),
    }))
  }

  const setCommunication = (done: boolean, note: string) => {
    updateDayPlan((plan) => ({
      ...plan,
      communicationDone: done,
      communicationNote: note,
    }))
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

  const updateDailyTemplate = (payload: Partial<LifeAppData['dailyTemplate']>) => {
    setData((prev) => ({
      ...stampData(prev),
      dailyTemplate: {
        ...prev.dailyTemplate,
        ...payload,
      },
    }))
  }

  const updateWeeklyTemplate = (payload: WeeklyTemplate) => {
    setData((prev) => ({
      ...stampData(prev),
      weeklyTemplate: payload,
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
        activeTimer: null,
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

      if (payload.completed) {
        updated = appendRelaxWindow(updated, 'focus', session.id)
      }

      return updated
    })
  }

  const consumeRelaxWindow = (windowId: string) => {
    setData((prev) => ({
      ...stampData(prev),
      relaxWindows: prev.relaxWindows.map((item) => (item.id === windowId ? { ...item, used: true } : item)),
    }))
  }

  const saveReview = (payload: ReviewInput) => {
    updateDayPlan((plan) => ({
      ...plan,
      review: {
        ...payload,
        updatedAt: new Date().toISOString(),
      },
    }))
  }

  const resetAll = () => {
    setData(defaultData())
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
  const todayDifficultyRecords = safeData.difficultyRecords.filter((record) => record.dayKey === dayKey)
  const todayStateRecords = safeData.stateRecords.filter((record) => record.dayKey === dayKey)
  const todayFocusSessions = safeData.focusSessions.filter((session) => session.dayKey === dayKey)

  return {
    data: safeData,
    dayKey,
    dayPlan,
    pendingTodayItems,
    activeRelaxWindow,
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
      addTaskToToday,
      launchTaskDefinition,
      removeTaskDefinition,
      toggleTodayItemDone,
      removeTodayItem,
      moveTodayItem,
      addStep,
      toggleStepDone,
      addAvoidItem,
      toggleAvoidDone,
      setCommunication,
      addStateRecord,
      addRuleDefinition,
      updateDailyTemplate,
      updateWeeklyTemplate,
      updateSettings,
      startFocusTimer,
      cancelTimer,
      finishTimer,
      consumeRelaxWindow,
      saveReview,
      resetAll,
    },
  }
}
