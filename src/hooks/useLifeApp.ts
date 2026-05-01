import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { createEmptyDayPlan, createId, currentDayKey, defaultData, ensureDayPlan } from '../lib/defaults'
import { loadData, saveData } from '../lib/storage'
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

export function useLifeApp() {
  const [data, setData] = useState<LifeAppData>(() => loadData())
  const dayKey = currentDayKey()

  useEffect(() => {
    setData((prev) => ensureDayPlan(prev, dayKey))
  }, [dayKey])

  useEffect(() => {
    saveData(data)
  }, [data])

  const safeData = useMemo(() => ensureDayPlan(data, dayKey), [data, dayKey])
  const dayPlan = safeData.dayPlans[dayKey] ?? createEmptyDayPlan(dayKey, safeData.taskDefs)
  const activeRelaxWindow = safeData.relaxWindows.find((window) => !window.used && dayjs(window.expiresAt).isAfter(dayjs()))

  const updateDayPlan = (updater: (plan: typeof dayPlan) => typeof dayPlan) => {
    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      const currentPlan = next.dayPlans[dayKey]

      return {
        ...next,
        dayPlans: {
          ...next.dayPlans,
          [dayKey]: updater(clonePlan(currentPlan)),
        },
      }
    })
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
      ...prev,
      taskDefs: [task, ...prev.taskDefs],
    }))
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

  const toggleTodayItemDone = (itemId: string) => {
    setData((prev) => {
      const next = ensureDayPlan(prev, dayKey)
      const plan = clonePlan(next.dayPlans[dayKey])
      let changedSource: TodayItem | undefined

      plan.todayItems = plan.todayItems.map((item) => {
        if (item.id !== itemId) return item

        changedSource = { ...item }
        const isDone = !item.isDone
        const steps = item.steps.length === 0
          ? item.steps
          : item.steps.map((step) => ({ ...step, isDone }))

        return {
          ...item,
          isDone,
          steps,
        }
      })

      let updated: LifeAppData = {
        ...next,
        dayPlans: {
          ...next.dayPlans,
          [dayKey]: plan,
        },
      }

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

        const steps = item.steps.map((step) => (step.id === stepId ? { ...step, isDone: !step.isDone } : step))
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
      ...ensureDayPlan(prev, dayKey),
      stateRecords: [record, ...prev.stateRecords],
    }))
  }

  const addRuleDefinition = (text: string, type: RuleType) => {
    const cleanText = text.trim()
    if (!cleanText) return

    setData((prev) => ({
      ...prev,
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
      ...prev,
      dailyTemplate: {
        ...prev.dailyTemplate,
        ...payload,
      },
    }))
  }

  const updateWeeklyTemplate = (payload: WeeklyTemplate) => {
    setData((prev) => ({
      ...prev,
      weeklyTemplate: payload,
    }))
  }

  const updateSettings = (payload: Partial<AppSettings>) => {
    setData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...payload,
      },
    }))
  }

  const startFocusTimer = (dayItemId?: string, stepId?: string) => {
    setData((prev) => ({
      ...ensureDayPlan(prev, dayKey),
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

      return {
        ...next,
        activeTimer: null,
        focusSessions: [session, ...next.focusSessions],
      }
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
        plan.todayItems = plan.todayItems.map((item) => {
          if (item.id !== activeTimer.dayItemId) return item
          const steps: TaskStep[] = item.steps.map((step) =>
            step.id === activeTimer.stepId ? { ...step, isDone: true } : step,
          )
          const allDone = steps.length > 0 && steps.every((step) => step.isDone)
          return {
            ...item,
            steps,
            isDone: allDone || item.isDone,
          }
        })
      }

      let updated: LifeAppData = {
        ...next,
        activeTimer: null,
        focusSessions: [session, ...next.focusSessions],
        dayPlans: {
          ...next.dayPlans,
          [dayKey]: plan,
        },
      }

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
      ...prev,
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
    actions: {
      addTaskDefinition,
      addTaskToToday,
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
