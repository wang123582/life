import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { playAlarmSound, playReminderSound } from './lib/alarm'
import { difficultyTemplateLabels, encouragementMessages, presetInterventions, stateTemplateLabels } from './lib/defaults'
import { buildTodayTimeline, getStateLabel, sendFeishuConnectionTest, buildReportPreviewText, sendFeishuPlainText } from './lib/feishu'
import { canUseFocusLock, getFocusLockStatus, openFocusLockAccessibilitySettings, saveFocusLockConfig } from './lib/focusLock'
import {
  canUseNativeTimer,
  checkExactAlarmAccess,
  clearRoutineReminderNotifications,
  clearFocusTimerNotification,
  ensureNativeTimerPermission,
  openExactAlarmSettings,
  scheduleFocusTimerNotification,
  syncRoutineReminderNotifications,
} from './lib/mobileTimer'
import type { BeforeInstallPromptEvent } from './lib/pwa'
import { createSyncSpaceId, isSyncEnvReady, syncSetupSql } from './lib/sync'
import { useLifeApp } from './hooks/useLifeApp'
import { useTimerRemaining } from './hooks/useTimerRemaining'
import type { DifficultyType, ReviewInput, StateType, TabKey, TodayItem } from './types'

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'today', label: '今天' },
  { key: 'pool', label: '任务池' },
  { key: 'templates', label: '设置' },
  { key: 'review', label: '复盘' },
]

const hourOptions = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, '0'))
const minuteOptions = Array.from({ length: 60 }, (_, value) => String(value).padStart(2, '0'))

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatDeadlineDate(deadlineDate?: string): string {
  return deadlineDate ? dayjs(deadlineDate).format('M 月 D 日') : ''
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getStepProgress(item: TodayItem) {
  const total = item.steps.length
  const done = item.steps.filter((step) => step.isDone).length
  return { total, done }
}

function getTaskStatusText(item: TodayItem) {
  if (item.isDone) return '已完成'
  if (item.steps.length === 0) return '待拆下一步'
  return '进行中'
}

function Section({
  className,
  kicker,
  title,
  subtitle,
  actions,
  children,
}: {
  className?: string
  kicker?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className={className ? `panel ${className}` : 'panel'}>
      <div className="panel-header">
        <div>
          {kicker ? <span className="section-kicker">{kicker}</span> : null}
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

function App() {
  const { data, dayKey, dayPlan, pendingTodayItems, activeRelaxWindow, todayDifficultyRecords, todayStateRecords, todayFocusSessions, sync, actions } =
    useLifeApp()
  const [activeTab, setActiveTab] = useState<TabKey>('today')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskKind, setTaskKind] = useState<'normal' | 'routine'>('normal')
  const [taskHour, setTaskHour] = useState('')
  const [taskMinute, setTaskMinute] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [ruleText, setRuleText] = useState('')
  const [ruleType, setRuleType] = useState<'do' | 'avoid'>('do')
  const [avoidText, setAvoidText] = useState('')
  const [communicationNote, setCommunicationNote] = useState(dayPlan.communicationNote)
  const [stateType, setStateType] = useState<StateType>('distracted')
  const [stateTrigger, setStateTrigger] = useState('')
  const [stateResponse, setStateResponse] = useState('')
  const [interventionStep, setInterventionStep] = useState<'pick-state' | 'try-method' | 'rate'>('pick-state')
  const [activeIntervention, setActiveIntervention] = useState('')
  const [customMethod, setCustomMethod] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [expandedTaskId, setExpandedTaskId] = useState<string>('')
  const [showMobileTodayExtras, setShowMobileTodayExtras] = useState(false)
  const [stepInputs, setStepInputs] = useState<Record<string, string>>({})
  const [finishOpen, setFinishOpen] = useState(false)
  const [timerCompleted, setTimerCompleted] = useState(true)
  const [markStepDone, setMarkStepDone] = useState(true)
  const [difficultyType, setDifficultyType] = useState<DifficultyType>('too_big')
  const [difficultyNote, setDifficultyNote] = useState('')
  const [accomplishment, setAccomplishment] = useState('')
  const [timerCollapsed, setTimerCollapsed] = useState(false)
  const [editingTimelineId, setEditingTimelineId] = useState<string | null>(null)
  const [showProcessNotes, setShowProcessNotes] = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const insertNotesMarkdown = useCallback((prefix: string, suffix: string, placeholder: string) => {
    const ta = notesRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const selected = value.slice(s, e)
    const insert = selected || placeholder
    const newVal = value.slice(0, s) + prefix + insert + suffix + value.slice(e)
    actions.updateProcessNotes(newVal)
    requestAnimationFrame(() => {
      ta.focus()
      const cur = s + prefix.length
      ta.setSelectionRange(cur, cur + insert.length)
    })
  }, [actions])
  const [nextAction, setNextAction] = useState('')
  const [quickStartTitle, setQuickStartTitle] = useState('')
  const [quickStartStep, setQuickStartStep] = useState('')
  const [showPoolAdvanced, setShowPoolAdvanced] = useState(false)
  const [dailySlots, setDailySlots] = useState(String(data.dailyTemplate.topTaskSlots))
  const [dailyRoutines, setDailyRoutines] = useState(String(data.dailyTemplate.routineSlots))
  const [dailyAvoids, setDailyAvoids] = useState(String(data.dailyTemplate.avoidSlots))
  const [dailyPrompt, setDailyPrompt] = useState(data.dailyTemplate.communicationPrompt)
  const [dailyRelaxMinutes, setDailyRelaxMinutes] = useState(String(data.dailyTemplate.relaxMinutes))
  const [weeklyDirections, setWeeklyDirections] = useState(data.weeklyTemplate.directions.join('\n'))
  const [weeklyRisks, setWeeklyRisks] = useState(data.weeklyTemplate.riskScenarios.join('\n'))
  const [weeklyCommunicationGoal, setWeeklyCommunicationGoal] = useState(data.weeklyTemplate.communicationGoal)
  const [weeklyRestPlan, setWeeklyRestPlan] = useState(data.weeklyTemplate.restPlan)
  const [blockedTargets, setBlockedTargets] = useState(data.settings.blockedTargets.join('\n'))
  const [syncSpaceId, setSyncSpaceId] = useState(data.settings.syncSpaceId)
  const [syncDeviceName, setSyncDeviceName] = useState(data.settings.syncDeviceName)
  const [feishuWebhookUrl, setFeishuWebhookUrl] = useState(data.settings.feishuWebhookUrl)
  const [feishuKeyword, setFeishuKeyword] = useState(data.settings.feishuKeyword)
  const [feishuSecret, setFeishuSecret] = useState(data.settings.feishuSecret)
  const [reviewForm, setReviewForm] = useState<ReviewInput>({
    wins: dayPlan.review?.wins ?? '',
    slips: dayPlan.review?.slips ?? '',
    commonState: dayPlan.review?.commonState ?? '',
    tomorrow: dayPlan.review?.tomorrow ?? '',
  })
  const [isTestingFeishu, setIsTestingFeishu] = useState(false)
  const [feishuTestMessage, setFeishuTestMessage] = useState('')
  const [feishuTestStatus, setFeishuTestStatus] = useState<'success' | 'error' | ''>('')
  const [isSyncingFeishu, setIsSyncingFeishu] = useState(false)
  const [feishuSyncMessage, setFeishuSyncMessage] = useState('')
  const [feishuSyncStatus, setFeishuSyncStatus] = useState<'success' | 'error' | ''>('')
  const [isSavingReview, setIsSavingReview] = useState(false)
  const [reviewSaveMessage, setReviewSaveMessage] = useState('')
  const [reviewSaveStatus, setReviewSaveStatus] = useState<'success' | 'error' | ''>('')
  const [nativeTimerStatus, setNativeTimerStatus] = useState<'success' | 'error' | ''>('')
  const [nativeTimerMessage, setNativeTimerMessage] = useState('')
  const [focusLockStatus, setFocusLockStatus] = useState<'success' | 'error' | ''>('')
  const [focusLockMessage, setFocusLockMessage] = useState('')
  const [focusLockServiceEnabled, setFocusLockServiceEnabled] = useState(false)
  const [syncCodeCopied, setSyncCodeCopied] = useState(false)
  const [syncSqlCopied, setSyncSqlCopied] = useState(false)
  const [flashMessage, setFlashMessage] = useState('')
  const [flashTone, setFlashTone] = useState<'info' | 'success' | 'warning'>('info')
  const [encouragementIndex, setEncouragementIndex] = useState(0)
  const [contextReminder, setContextReminder] = useState('')
  const [lastReminderKey, setLastReminderKey] = useState('')
  const [lastInteractionAt, setLastInteractionAt] = useState<number>(() => Date.now())
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState<boolean>(() => window.matchMedia('(display-mode: standalone)').matches)
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(() => window.matchMedia('(max-width: 768px)').matches)

  const activeTimer = data.activeTimer
  const isBreakTimer = activeTimer?.mode === 'shortBreak'
  const focusLockAvailable = canUseFocusLock()
  const nativeTimerAvailable = canUseNativeTimer()
  const remainingSeconds = useTimerRemaining(activeTimer)
  const activeItem = useMemo(
    () => dayPlan.todayItems.find((item) => item.id === activeTimer?.dayItemId),
    [dayPlan.todayItems, activeTimer],
  )
  const activeStep = useMemo(
    () => activeItem?.steps.find((step) => step.id === activeTimer?.stepId),
    [activeItem, activeTimer],
  )
  const actionableTodayItems = useMemo(() => dayPlan.todayItems.filter((item) => item.kind !== 'routine'), [dayPlan.todayItems])
  const simpleRoutineItems = useMemo(() => dayPlan.todayItems.filter((item) => item.kind === 'routine'), [dayPlan.todayItems])
  const actionablePendingItems = useMemo(() => pendingTodayItems.filter((item) => item.kind !== 'routine'), [pendingTodayItems])
  const plannedTaskIds = useMemo(
    () => new Set(dayPlan.todayItems.map((item) => item.sourceTaskId).filter((taskId): taskId is string => Boolean(taskId))),
    [dayPlan.todayItems],
  )
  const plannerSuggestions = useMemo(
    () => data.taskDefs.filter((task) => !task.archived && task.kind === 'normal' && !plannedTaskIds.has(task.id)).slice(0, isMobileLayout ? 3 : 4),
    [data.taskDefs, plannedTaskIds, isMobileLayout],
  )
  const completedTodayCount = useMemo(() => actionableTodayItems.filter((item) => item.isDone).length, [actionableTodayItems])
  const remainingTopTaskSlots = Math.max(data.dailyTemplate.topTaskSlots - actionableTodayItems.length, 0)
  const primaryTodayItem = actionablePendingItems[0] ?? actionableTodayItems[0]
  const firstPlannerSuggestion = plannerSuggestions[0]
  const primaryStep = primaryTodayItem?.steps.find((step) => !step.isDone)
  const primaryAvoid = dayPlan.avoidItems.find((item) => !item.isDone)?.text ?? data.ruleDefs.find((rule) => rule.type === 'avoid')?.text
  const primaryRule = data.ruleDefs.find((rule) => rule.type === 'do')?.text
  const nextRoutine = dayPlan.todayItems.find((item) => item.kind === 'routine' && !item.isDone)
  const primaryStepLabel = primaryStep?.title ?? '先拆一个最小动作'
  const routineReminderCount = useMemo(
    () => data.taskDefs.filter((task) => task.kind === 'routine' && Boolean(task.scheduleTime?.trim())).length,
    [data.taskDefs],
  )
  const activeTimerRange = activeTimer
    ? `${dayjs(activeTimer.startedAt).format('HH:mm')} - ${dayjs(activeTimer.startedAt).add(activeTimer.durationMinutes, 'minute').format('HH:mm')}`
    : ''
  const showCompactMobileTodayHeader = isMobileLayout && activeTab === 'today'

  const feedbackSummary = useMemo(() => {
    if (activeTimer?.mode === 'shortBreak') {
      return {
        tone: 'success' as const,
        title: '现在是休息时间',
        message: `刚推进完一轮，先休息 ${data.settings.breakMinutes} 分钟，再回来接着做 ${activeItem?.title ?? primaryTodayItem?.title ?? '下一步'}。`,
      }
    }

    if (activeTimer) {
      return {
        tone: 'success' as const,
        title: '正在推进中',
        message: `别切走，这一轮先把 ${activeStep?.title ?? activeItem?.title ?? '当前动作'} 做掉。`,
      }
    }

    if (!primaryTodayItem) {
      return {
        tone: firstPlannerSuggestion ? ('info' as const) : ('warning' as const),
        title: firstPlannerSuggestion ? '候选任务已经在这' : '先定一件事',
        message: firstPlannerSuggestion
          ? `不用先切页面了，直接把「${firstPlannerSuggestion.title}」拉进今天，或者立刻开始。`
          : '先写一件今天最重要的事，再点开始，别让页面把你拖住。',
      }
    }

    if (!primaryStep) {
      return {
        tone: 'info' as const,
        title: '已经进入状态了',
        message: `你已经选了「${primaryTodayItem.title}」，再补一个最小动作就能开工。`,
      }
    }

    if (completedTodayCount > 0) {
      return {
        tone: 'success' as const,
        title: '今天已经有推进',
        message: `已完成 ${completedTodayCount} 件，下一步就回到「${primaryStep.title}」。`,
      }
    }

    return {
      tone: 'info' as const,
      title: '现在就够了',
      message: `先做「${primaryStep.title}」，不用把所有功能都看懂。`,
    }
  }, [activeItem, activeStep, activeTimer, completedTodayCount, data.settings.breakMinutes, firstPlannerSuggestion, primaryStep, primaryTodayItem])

  useEffect(() => {
    setCommunicationNote(dayPlan.communicationNote)
  }, [dayPlan.communicationNote])

  useEffect(() => {
    setReviewForm({
      wins: dayPlan.review?.wins ?? '',
      slips: dayPlan.review?.slips ?? '',
      commonState: dayPlan.review?.commonState ?? '',
      tomorrow: dayPlan.review?.tomorrow ?? '',
    })
  }, [dayPlan.review])

  useEffect(() => {
    setFeishuWebhookUrl(data.settings.feishuWebhookUrl)
    setFeishuKeyword(data.settings.feishuKeyword)
    setFeishuSecret(data.settings.feishuSecret)
  }, [data.settings.feishuWebhookUrl, data.settings.feishuKeyword, data.settings.feishuSecret])

  useEffect(() => {
    setSyncSpaceId(data.settings.syncSpaceId)
    setSyncDeviceName(data.settings.syncDeviceName)
  }, [data.settings.syncSpaceId, data.settings.syncDeviceName])

  useEffect(() => {
    setBlockedTargets(data.settings.blockedTargets.join('\n'))
  }, [data.settings.blockedTargets])

  // Auto-request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    const firstPendingItem = actionablePendingItems[0]?.id ?? actionableTodayItems[0]?.id ?? ''
    setSelectedItemId((prev) => prev || firstPendingItem)
  }, [actionablePendingItems, actionableTodayItems])

  useEffect(() => {
    if (!data.settings.encouragementEnabled) return

    const timerId = window.setInterval(() => {
      setEncouragementIndex((prev) => (prev + 1) % encouragementMessages.length)
    }, 15000)

    return () => window.clearInterval(timerId)
  }, [data.settings.encouragementEnabled])

  useEffect(() => {
    if (!flashMessage) {
      return
    }

    const timerId = window.setTimeout(() => setFlashMessage(''), 2400)

    return () => window.clearTimeout(timerId)
  }, [flashMessage])

  useEffect(() => {
    if (!activeTimer || remainingSeconds > 0) return

    if (activeTimer.mode === 'shortBreak') {
      actions.finishBreakTimer()
      setFlashTone('success')
      setFlashMessage('休息时间结束了，回来继续下一轮。')

      if ('Notification' in window && Notification.permission === 'granted') {
        void new Notification('休息结束', {
          body: '休息差不多了，回来继续推进今天最重要的事。',
        })
      }

      return
    }

    if (finishOpen) return

    setFinishOpen(true)

    playAlarmSound()

    if ('Notification' in window && Notification.permission === 'granted') {
      void new Notification('番茄钟结束', {
        body: '先记一下结果，然后去休息一会儿。',
      })
    }
  }, [activeTimer, remainingSeconds, finishOpen])

  useEffect(() => {
    const handleActivity = () => setLastInteractionAt(Date.now())

    window.addEventListener('pointerdown', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('focus', handleActivity)

    return () => {
      window.removeEventListener('pointerdown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('focus', handleActivity)
    }
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPromptEvent(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setInstallPromptEvent(null)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches)
    }

    setIsMobileLayout(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    if (!isMobileLayout) {
      setShowMobileTodayExtras(false)
      setExpandedTaskId('')
      setShowPoolAdvanced(true)
      return
    }

    setShowPoolAdvanced(false)
  }, [isMobileLayout])

  useEffect(() => {
    if (!data.settings.mobileTimerEnabled) {
      void clearFocusTimerNotification()
      return
    }

    if (!activeTimer || !nativeTimerAvailable) {
      void clearFocusTimerNotification()
      return
    }

    const endsAt = dayjs(activeTimer.startedAt).add(activeTimer.durationMinutes, 'minute').toDate()
    const title = activeTimer.mode === 'shortBreak' ? 'life 休息提醒' : activeItem?.title ?? 'life 专注提醒'
    const body = activeTimer.mode === 'shortBreak'
      ? '休息时间结束后，回来继续下一轮。'
      : activeStep
        ? `这一轮结束了：${activeStep.title}`
        : '这一轮结束了，回来记录结果和下一步。'

    void scheduleFocusTimerNotification({
      endsAt,
      title,
      body,
    })
  }, [activeItem, activeStep, activeTimer, data.settings.mobileTimerEnabled, nativeTimerAvailable])

  useEffect(() => {
    if (!data.settings.mobileTimerEnabled || !nativeTimerAvailable) {
      void clearRoutineReminderNotifications()
      return
    }

    const routineTasks = data.taskDefs.filter((task) => task.kind === 'routine' && Boolean(task.scheduleTime?.trim()))
    void syncRoutineReminderNotifications(routineTasks)
  }, [data.taskDefs, data.settings.mobileTimerEnabled, nativeTimerAvailable])

  useEffect(() => {
    if (!focusLockAvailable) {
      setFocusLockServiceEnabled(false)
      return
    }

    void getFocusLockStatus().then((status) => {
      setFocusLockServiceEnabled(status.serviceEnabled)
    })
  }, [focusLockAvailable])

  useEffect(() => {
    const isFocusModeActive = Boolean(activeTimer && activeTimer.mode === 'focus')
    const untilTimestamp = activeTimer ? dayjs(activeTimer.startedAt).add(activeTimer.durationMinutes, 'minute').valueOf() : 0

    void saveFocusLockConfig({
      enabled: data.settings.appLockEnabled,
      active: data.settings.appLockEnabled && data.settings.blockerLevel !== 'light' && isFocusModeActive,
      untilTimestamp,
      blockedTargets: data.settings.blockedTargets,
    })
  }, [activeTimer, data.settings.appLockEnabled, data.settings.blockedTargets, data.settings.blockerLevel])

  useEffect(() => {
    const title = activeTimer
      ? activeTimer.mode === 'shortBreak'
        ? `休息中 ${formatSeconds(remainingSeconds)} · ${activeItem?.title ?? primaryTodayItem?.title ?? 'life'}`
        : `专注中 ${formatSeconds(remainingSeconds)} · ${activeItem?.title ?? 'life'}`
      : `${primaryTodayItem?.title ?? 'life'} · ${primaryStep?.title ?? '先开始今天的一小步'}`

    document.title = title
  }, [activeTimer, remainingSeconds, activeItem, primaryTodayItem, primaryStep])

  useEffect(() => {
    const emitReminder = (key: string, message: string) => {
      if (lastReminderKey === key) return

      setLastReminderKey(key)
      setContextReminder(message)

      playReminderSound()

      if ('Notification' in window && Notification.permission === 'granted') {
        void new Notification('life 提醒你一下', {
          body: message,
        })
      }
    }

    const intervalId = window.setInterval(() => {
      const now = dayjs()
      const hhmm = now.format('HH:mm')
      const idleTooLong = Date.now() - lastInteractionAt > 10 * 60 * 1000
      const matchedRoutine = data.taskDefs.find(
        (task) => task.kind === 'routine' && task.scheduleTime === hhmm && !dayPlan.todayItems.find((item) => item.sourceTaskId === task.id && item.isDone),
      )

      if (matchedRoutine) {
        emitReminder(`routine-${dayKey}-${matchedRoutine.id}-${hhmm}`, `到 ${matchedRoutine.title} 了，先把生活的骨架守住。`)
        return
      }

      if (hhmm === '09:00') {
        emitReminder(`morning-${dayKey}`, `别空着开始今天。先回到：${primaryTodayItem?.title ?? '挑一个任务放进今天'}。`)
        return
      }

      if (hhmm === '22:00') {
        emitReminder(`night-${dayKey}`, '快到收尾时间了，去复盘一下今天，顺手写明天第一步。')
        return
      }

      if (!activeTimer && idleTooLong && primaryTodayItem) {
        emitReminder(
          `idle-${dayKey}-${Math.floor(Date.now() / (10 * 60 * 1000))}`,
          `你刚才停住了，回到：${primaryTodayItem.title}。下一步：${primaryStep?.title ?? '先拆一个最小动作'}`,
        )
      }
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [activeTimer, data.taskDefs, dayKey, dayPlan.todayItems, lastInteractionAt, lastReminderKey, primaryStep, primaryTodayItem])

  const summary = {
    total: actionableTodayItems.length,
    done: completedTodayCount,
    avoidDone: dayPlan.avoidItems.filter((item) => item.isDone).length,
    focusCount: todayFocusSessions.filter((session) => session.status === 'completed').length,
  }

  const selectedItem = actionableTodayItems.find((item) => item.id === selectedItemId) ?? actionableTodayItems[0]
  const completedSteps = useMemo(
    () =>
      dayPlan.todayItems.flatMap((item) =>
        item.steps
          .filter((step) => step.isDone)
          .map((step) => ({
            taskTitle: item.title,
            stepTitle: step.title,
            completedAt: step.completedAt,
          })),
      ),
    [dayPlan.todayItems],
  )
  const todayTimeline = useMemo(
    () => buildTodayTimeline({ completedSteps, difficulties: todayDifficultyRecords, focusSessions: todayFocusSessions }).slice(0, 12),
    [completedSteps, todayDifficultyRecords, todayFocusSessions],
  )

  const startTask = (item: TodayItem) => {
    const firstPendingStep = item.steps.find((step) => !step.isDone)
    actions.startFocusTimer(item.id, firstPendingStep?.id)
  }

  const toggleTaskExpand = (itemId: string) => {
    setSelectedItemId(itemId)
    setExpandedTaskId((prev) => (prev === itemId ? '' : itemId))
  }

  const handleQuickStart = (startImmediately = false) => {
    const created = actions.quickStartTodayTask(quickStartTitle, quickStartStep)

    if (!created) {
      return
    }

    setQuickStartTitle('')
    setQuickStartStep('')
    setActiveTab('today')
    setSelectedItemId(created.todayItemId)

    if (isMobileLayout) {
      setExpandedTaskId(created.todayItemId)
    }

    if (startImmediately) {
      actions.startFocusTimer(created.todayItemId, created.stepId)
      setFlashTone('success')
      setFlashMessage('已经帮你放进今天，并直接开始这一轮专注。')
      return
    }

    setFlashTone('success')
    setFlashMessage('已经放进今天。现在只要点开它，继续下一步就行。')
  }

  const handleAddTaskDefinition = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const scheduleTime = taskKind === 'routine' && taskHour && taskMinute ? `${taskHour}:${taskMinute}` : undefined

    actions.addTaskDefinition(taskTitle, taskKind, scheduleTime, taskKind === 'normal' ? taskDeadline : undefined)
    setTaskTitle('')
    setTaskHour('')
    setTaskMinute('')
    setTaskDeadline('')
  }

  const handleRemoveTaskDefinition = (taskId: string, title: string) => {
    const confirmed = window.confirm(`要把「${title}」从任务池删除吗？未完成的今日副本也会一起移除。`)

    if (!confirmed) {
      return
    }

    actions.removeTaskDefinition(taskId)
    setFlashTone('warning')
    setFlashMessage(`已从任务池删除「${title}」。`)
  }

  const handleLaunchTaskDefinition = (taskId: string, title: string) => {
    const launched = actions.launchTaskDefinition(taskId)

    if (!launched) {
      return
    }

    setActiveTab('today')
    setSelectedItemId(launched.todayItemId)

    if (isMobileLayout) {
      setExpandedTaskId(launched.todayItemId)
    }

    setFlashTone('success')
    setFlashMessage(
      launched.createdStep
        ? `已把「${title}」放进今天，并帮你补好第一步后直接开始。`
        : `已从任务池直接开始「${title}」。`,
    )
  }

  const handleAddAvoid = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    actions.addAvoidItem(avoidText)
    setAvoidText('')
  }

  const handleAddRule = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    actions.addRuleDefinition(ruleText, ruleType)
    setRuleText('')
  }

  const handleFinishTimer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const previousScrollTop = window.scrollY
    const activeElement = document.activeElement

    if (activeElement instanceof HTMLElement) {
      activeElement.blur()
    }

    actions.finishTimer({
      completed: timerCompleted,
      markStepDone,
      difficultyType: timerCompleted ? undefined : difficultyType,
      difficultyNote,
      nextAction,
      accomplishment,
    })
    setFinishOpen(false)
    setTimerCompleted(true)
    setDifficultyNote('')
    setNextAction('')
    setAccomplishment('')
    setMarkStepDone(true)

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: previousScrollTop, behavior: 'auto' })
    })
  }

  const handleSaveTemplates = () => {
    actions.updateDailyTemplate({
      topTaskSlots: Number(dailySlots) || data.dailyTemplate.topTaskSlots,
      routineSlots: Number(dailyRoutines) || data.dailyTemplate.routineSlots,
      avoidSlots: Number(dailyAvoids) || data.dailyTemplate.avoidSlots,
      communicationPrompt: dailyPrompt.trim() || data.dailyTemplate.communicationPrompt,
      relaxMinutes: Number(dailyRelaxMinutes) || data.dailyTemplate.relaxMinutes,
    })
    actions.updateWeeklyTemplate({
      directions: splitLines(weeklyDirections),
      riskScenarios: splitLines(weeklyRisks),
      communicationGoal: weeklyCommunicationGoal.trim(),
      restPlan: weeklyRestPlan.trim(),
    })
    actions.updateSettings({
      blockedTargets: splitLines(blockedTargets),
      syncSpaceId: syncSpaceId.trim().toUpperCase(),
      syncDeviceName: syncDeviceName.trim() || data.settings.syncDeviceName,
      feishuWebhookUrl: feishuWebhookUrl.trim(),
      feishuKeyword: feishuKeyword.trim(),
      feishuSecret: feishuSecret.trim(),
    })
    setFlashTone('success')
    setFlashMessage('设置已经保存。先回到今天页继续做事就行。')
  }

  const handleBlockedTargetsChange = (value: string) => {
    setBlockedTargets(value)
    actions.updateSettings({
      blockedTargets: splitLines(value),
    })
  }

  const handleSaveReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const savedReview = {
      ...reviewForm,
      updatedAt: new Date().toISOString(),
    }

    setIsSavingReview(true)
    setReviewSaveStatus('')
    setReviewSaveMessage('')
    actions.saveReview(reviewForm)

    if (!data.settings.feishuAutoSyncReview) {
      setReviewSaveStatus('success')
      setReviewSaveMessage('已保存今日复盘。')
      setIsSavingReview(false)
      return
    }

    // Auto-sync to feishu after saving review
    try {
      const text = buildReportPreviewText({
        webhookUrl: feishuWebhookUrl.trim(),
        keyword: feishuKeyword.trim(),
        secret: feishuSecret.trim(),
        dayKey,
        review: savedReview,
        completedSteps,
        difficulties: todayDifficultyRecords,
        focusSessions: todayFocusSessions,
        commonStateLabel: getStateLabel(savedReview.commonState ?? ''),
        communicationDone: dayPlan.communicationDone,
        communicationNote,
        processNotes: dayPlan.processNotes,
      })
      await sendFeishuPlainText(
        { webhookUrl: feishuWebhookUrl.trim(), keyword: feishuKeyword.trim(), secret: feishuSecret.trim() },
        text,
      )
      setReviewSaveStatus('success')
      setReviewSaveMessage('已保存复盘，并自动同步到飞书。')
      setFeishuSyncStatus('success')
      setFeishuSyncMessage('已把今天总结发到飞书。')
    } catch (error) {
      setReviewSaveStatus('error')
      setReviewSaveMessage(`复盘已保存，但飞书同步失败：${error instanceof Error ? error.message : '请稍后再试。'}`)
    } finally {
      setIsSavingReview(false)
    }
  }

  const handleTestFeishuConnection = async () => {
    const webhookUrl = feishuWebhookUrl.trim()
    const keyword = feishuKeyword.trim()
    const secret = feishuSecret.trim()

    if (!webhookUrl) {
      setFeishuTestStatus('error')
      setFeishuTestMessage('先填飞书群机器人的 webhook 地址。')
      return
    }

    setIsTestingFeishu(true)
    setFeishuTestStatus('')
    setFeishuTestMessage('')

    try {
      actions.updateSettings({
        feishuWebhookUrl: webhookUrl,
        feishuKeyword: keyword,
        feishuSecret: secret,
      })

      await sendFeishuConnectionTest({
        webhookUrl,
        keyword,
        secret,
      })

      setFeishuTestStatus('success')
      setFeishuTestMessage('飞书连接成功，机器人已经收到一条测试消息。')
    } catch (error) {
      setFeishuTestStatus('error')
      setFeishuTestMessage(error instanceof Error ? error.message : '飞书连接失败。')
    } finally {
      setIsTestingFeishu(false)
    }
  }

  const handleCreateSyncSpace = () => {
    const nextSpaceId = createSyncSpaceId()
    setSyncSpaceId(nextSpaceId)
    actions.updateSettings({
      syncEnabled: true,
      syncSpaceId: nextSpaceId,
      syncDeviceName: syncDeviceName.trim() || data.settings.syncDeviceName,
    })
  }

  const handleSaveSyncSettings = () => {
    actions.updateSettings({
      syncEnabled: data.settings.syncEnabled,
      syncSpaceId: syncSpaceId.trim().toUpperCase(),
      syncDeviceName: syncDeviceName.trim() || data.settings.syncDeviceName,
    })
  }

  const handlePullCloud = async () => {
    try {
      handleSaveSyncSettings()
      await sync.pullFromCloud('manual')
    } catch {
      // 错误状态由 hook 内部统一处理
    }
  }

  const handlePushCloud = async () => {
    try {
      handleSaveSyncSettings()
      await sync.pushToCloud('manual')
    } catch {
      // 错误状态由 hook 内部统一处理
    }
  }

  const handleEnableNativeTimer = async () => {
    const granted = await ensureNativeTimerPermission()

    if (granted) {
      const scheduledCount = await syncRoutineReminderNotifications(
        data.taskDefs.filter((task) => task.kind === 'routine' && Boolean(task.scheduleTime?.trim())),
      )
      const exactAlarmAccess = await checkExactAlarmAccess()

      actions.updateSettings({ mobileTimerEnabled: true })
      setNativeTimerStatus('success')
      setNativeTimerMessage(
        scheduledCount > 0
          ? `已经拿到手机提醒权限，并同步了 ${scheduledCount} 条固定生活提醒。${exactAlarmAccess === 'granted' ? '系统精确提醒也已开启。' : '如果想让提醒更准时，再点一次“打开系统闹钟设置”。'}`
          : '已经拿到手机提醒权限。以后切后台或锁屏，番茄钟结束也会提醒你。',
      )
      return
    }

    setNativeTimerStatus('error')
    setNativeTimerMessage('没有拿到手机提醒权限，计时仍然只能停留在应用页面里。')
  }

  const handleTestNativeTimer = async () => {
    const granted = await ensureNativeTimerPermission()

    if (!granted) {
      setNativeTimerStatus('error')
      setNativeTimerMessage('测试失败：还没有拿到手机提醒权限。')
      return
    }

    await scheduleFocusTimerNotification({
      endsAt: dayjs().add(15, 'second').toDate(),
      title: 'life 测试提醒',
      body: '如果你 15 秒后收到了这条，说明手机原生计时提醒已经能用。',
    })

    setNativeTimerStatus('success')
    setNativeTimerMessage('已经安排了一条 15 秒后的测试提醒，锁屏也能测。')
  }

  const handleOpenExactAlarmSettings = async () => {
    const granted = await openExactAlarmSettings()

    setNativeTimerStatus(granted ? 'success' : 'error')
    setNativeTimerMessage(
      granted ? '系统精确提醒已经开启，固定生活任务会更接近手机闹钟的效果。' : '已打开系统提醒设置。把精确提醒打开后，固定任务会更准时。',
    )
  }

  const handleOpenFocusLockSettings = async () => {
    await openFocusLockAccessibilitySettings()
    setFocusLockStatus('success')
    setFocusLockMessage('已经打开安卓无障碍设置。把 life 的应用锁定服务打开后，再回来点一次“检查应用锁状态”。')
  }

  const handleCheckFocusLockStatus = async () => {
    const status = await getFocusLockStatus()
    setFocusLockServiceEnabled(status.serviceEnabled)

    if (status.serviceEnabled) {
      setFocusLockStatus('success')
      setFocusLockMessage('应用锁定服务已经开启。专注时打开黑名单应用，会被拉回 life。')
      return
    }

    setFocusLockStatus('error')
    setFocusLockMessage('还没开启应用锁定服务。先去安卓无障碍设置里打开它。')
  }

  const handleCopySyncCode = async () => {
    if (!syncSpaceId.trim()) {
      return
    }

    await navigator.clipboard.writeText(syncSpaceId.trim().toUpperCase())
    setSyncCodeCopied(true)
    setFlashTone('info')
    setFlashMessage('同步码已复制，去另一台设备直接粘贴就行。')
    window.setTimeout(() => setSyncCodeCopied(false), 2000)
  }

  const handleCopySyncSql = async () => {
    await navigator.clipboard.writeText(syncSetupSql)
    setSyncSqlCopied(true)
    setFlashTone('info')
    setFlashMessage('建表 SQL 已复制。去 Supabase 执行后，同步才会真正生效。')
    window.setTimeout(() => setSyncSqlCopied(false), 2000)
  }

  const handleSyncToFeishu = async () => {
    const webhookUrl = feishuWebhookUrl.trim()
    if (!webhookUrl) {
      setFeishuSyncStatus('error')
      setFeishuSyncMessage('先填飞书群机器人的 webhook 地址。')
      return
    }

    setIsSyncingFeishu(true)
    setFeishuSyncStatus('')
    setFeishuSyncMessage('')

    try {
      const reviewPayload = reviewForm.wins || reviewForm.slips || reviewForm.commonState || reviewForm.tomorrow
        ? {
            ...reviewForm,
            updatedAt: dayPlan.review?.updatedAt ?? new Date().toISOString(),
          }
        : dayPlan.review

      const text = buildReportPreviewText({
        webhookUrl,
        keyword: feishuKeyword.trim(),
        secret: feishuSecret.trim(),
        dayKey,
        review: reviewPayload,
        completedSteps,
        difficulties: todayDifficultyRecords,
        focusSessions: todayFocusSessions,
        commonStateLabel: getStateLabel(reviewPayload?.commonState ?? ''),
        communicationDone: dayPlan.communicationDone,
        communicationNote,
        processNotes: dayPlan.processNotes,
      })

      actions.updateSettings({
        feishuWebhookUrl: webhookUrl,
        feishuKeyword: feishuKeyword.trim(),
        feishuSecret: feishuSecret.trim(),
      })

      await sendFeishuPlainText(
        { webhookUrl, keyword: feishuKeyword.trim(), secret: feishuSecret.trim() },
        text,
      )

      setFeishuSyncStatus('success')
      setFeishuSyncMessage('已把今天总结、完成步骤和困难日志发到飞书。')
    } catch (error) {
      setFeishuSyncStatus('error')
      setFeishuSyncMessage(error instanceof Error ? error.message : '同步飞书失败。')
    } finally {
      setIsSyncingFeishu(false)
    }
  }

  const askNotificationPermission = async () => {
    if (!('Notification' in window)) return
    await Notification.requestPermission()
  }

  const handleInstallApp = async () => {
    if (!installPromptEvent) return

    await installPromptEvent.prompt()
    await installPromptEvent.userChoice
    setInstallPromptEvent(null)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">life</div>
          <p className="brand-subtitle">先把今天过稳，再谈更远的事。</p>
        </div>

        <nav className="nav-list">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={tab.key === activeTab ? 'nav-button active' : 'nav-button'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="muted-label">今日日期</span>
          <strong>{dayjs(dayKey).format('M 月 D 日 dddd')}</strong>
          <p>{encouragementMessages[encouragementIndex]}</p>
        </div>

        <div className="sidebar-card">
          <span className="muted-label">今日闭环</span>
          <p>
            {summary.done}/{summary.total} 个任务完成 · {summary.focusCount} 个有效番茄钟
          </p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-copy">
            <span className="section-kicker">{showCompactMobileTodayHeader ? (isBreakTimer ? '休息一下' : '马上开始') : '今日主线'}</span>
            <h1>
              {showCompactMobileTodayHeader
                ? isBreakTimer
                  ? '这一轮做完了，先休息一下'
                  : activeTimer
                    ? '继续这一轮专注'
                    : '先写任务，马上开工'
                : isBreakTimer
                  ? '推进完一轮后，先把休息也认真过掉'
                  : '给自己一个正常的一天'}
            </h1>
            <p>
              {showCompactMobileTodayHeader
                ? isBreakTimer
                  ? `休息 ${formatSeconds(remainingSeconds)}，等会儿回来继续 ${activeItem?.title ?? primaryTodayItem?.title ?? '当前任务'}。`
                  : activeTimer
                  ? `这轮先做：${activeStep?.title ?? activeItem?.title ?? '当前动作'}。别继续往下翻了。`
                  : primaryTodayItem
                    ? `当前最重要：${primaryTodayItem.title} · 下一步：${primaryStepLabel}`
                    : '别先研究全部功能，直接写下今天最重要的一件事，然后点开始。'
                : isBreakTimer
                  ? `刚完成一轮专注。现在给自己 ${data.settings.breakMinutes} 分钟休息，结束后继续回到「${activeItem?.title ?? primaryTodayItem?.title ?? '今天的主任务'}」。`
                  : '先列今天要做的，再拆出最小下一步。卡住了，就把卡点继续拆掉。'}
            </p>
            {!showCompactMobileTodayHeader ? (
              <div className="topbar-tags">
                <span className="topbar-tag">现在最重要：{primaryTodayItem?.title ?? '先挑一个任务'}</span>
                <span className="topbar-tag">下一步：{primaryStepLabel}</span>
                {primaryAvoid ? <span className="topbar-tag warning">不做：{primaryAvoid}</span> : null}
              </div>
            ) : null}
          </div>
          <div className="topbar-actions">
            {showCompactMobileTodayHeader ? (
              isBreakTimer ? (
                <button type="button" className="primary-button" onClick={actions.finishBreakTimer}>
                  提前结束休息
                </button>
              ) : primaryTodayItem ? (
                <button type="button" className="primary-button" onClick={() => startTask(primaryTodayItem)}>
                  {activeTimer ? '继续当前专注' : '直接开始当前任务'}
                </button>
              ) : firstPlannerSuggestion ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handleLaunchTaskDefinition(firstPlannerSuggestion.id, firstPlannerSuggestion.title)}
                >
                  直接开始第一候选任务
                </button>
              ) : (
                <button type="button" className="primary-button" onClick={() => setActiveTab('pool')}>
                  去任务池挑一个
                </button>
              )
            ) : null}
            {!isStandalone && installPromptEvent ? (
              <button type="button" className="primary-button" onClick={handleInstallApp}>
                安装到手机桌面
              </button>
            ) : null}
            {!showCompactMobileTodayHeader ? (
              <details className="topbar-actions-details">
                <summary>更多今天操作</summary>
                <div className="topbar-actions-menu">
                  <button type="button" className="ghost-button" onClick={askNotificationPermission}>
                    开启系统提醒
                  </button>
                  <button type="button" className="ghost-button danger" onClick={actions.resetAll}>
                    重置数据
                  </button>
                </div>
              </details>
            ) : null}
          </div>
        </header>

        {activeTimer ? (
          <div className="focus-strip">
            <div>
              <span className="muted-label">{isBreakTimer ? '休息时间' : '专注已经开始'}</span>
              <strong>
                {isBreakTimer
                  ? `刚完成：${activeItem?.title ?? '这一轮专注'}`
                  : `正在做：${activeItem?.title ?? '当前任务'}${activeStep ? ` · ${activeStep.title}` : ''}`}
              </strong>
              <p>
                {isBreakTimer
                  ? `现在先休息一下。休息结束后，再回来继续下一轮。${activeTimerRange ? `休息时间：${activeTimerRange}` : ''}`
                  : `现在是专注中，不用急着结束；先把这一小轮做完。${activeTimerRange ? `这轮时间：${activeTimerRange}` : ''}`}
              </p>
            </div>
            <div className="focus-strip-time">{formatSeconds(remainingSeconds)}</div>
          </div>
        ) : null}

        {contextReminder ? (
          <div className="context-reminder">
            <div>
              <span className="muted-label">现在请回到你自己设的目标上</span>
              <strong>{contextReminder}</strong>
            </div>
            <div className="context-reminder-actions">
              {primaryTodayItem ? (
                <button type="button" className="primary-button" onClick={() => startTask(primaryTodayItem)}>
                  立刻开始这一小步
                </button>
              ) : (
                <button type="button" className="primary-button" onClick={() => setActiveTab('pool')}>
                  先去任务池挑一个
                </button>
              )}
              <button type="button" className="ghost-button" onClick={() => setContextReminder('')}>
                我知道了
              </button>
            </div>
          </div>
        ) : null}

        {!showCompactMobileTodayHeader ? (
          <div className={`feedback-strip ${feedbackSummary.tone}`}>
            <div>
              <span className="muted-label">即时反馈</span>
              <strong>{feedbackSummary.title}</strong>
              <p>{feedbackSummary.message}</p>
            </div>
            {flashMessage ? <span className={`feedback-badge ${flashTone}`}>{flashMessage}</span> : null}
          </div>
        ) : flashMessage ? <span className={`feedback-badge mobile-feedback-badge ${flashTone}`}>{flashMessage}</span> : null}

        {activeTab === 'today' ? (
          <div className="page-grid today-page-grid">
            <div className="column-main">
              <Section
                className="today-overview-section"
                kicker="Overview"
                title="今天必须做的事情"
                subtitle="今天必须做的、必须守住的、必须记得去生活的，都放在这里。"
              >
                <div className="goal-banner">
                  <div>
                    <span className="muted-label">当前目标锚点</span>
                    <h3>{primaryTodayItem?.title ?? data.weeklyTemplate.directions[0] ?? '先从任务池挑一个任务放进今天'}</h3>
                    <p>
                      下一步：{primaryStepLabel}
                      {primaryAvoid ? ` · 当前边界：${primaryAvoid}` : ''}
                    </p>
                    {primaryRule ? <p>长期提醒：{primaryRule}</p> : null}
                  </div>
                  <div className="goal-banner-actions">
                    {primaryTodayItem ? (
                      <button type="button" className="primary-button" onClick={() => startTask(primaryTodayItem)}>
                        回到当前任务
                      </button>
                    ) : (
                      <button type="button" className="primary-button" onClick={() => setActiveTab('pool')}>
                        去任务池挑任务
                      </button>
                    )}
                  </div>
                </div>

                <div className="summary-grid">
                  <div className="summary-card">
                    <span>今天要做</span>
                    <strong>{summary.total}</strong>
                  </div>
                  <div className="summary-card">
                    <span>已完成</span>
                    <strong>{summary.done}</strong>
                  </div>
                  <div className="summary-card">
                    <span>不做清单守住</span>
                    <strong>
                      {summary.avoidDone}/{dayPlan.avoidItems.length || data.dailyTemplate.avoidSlots}
                    </strong>
                  </div>
                  <div className="summary-card">
                    <span>真实交流</span>
                    <strong>{dayPlan.communicationDone ? '已完成' : '还没有'}</strong>
                  </div>
                </div>
              </Section>

              <Section
                className="today-quickstart-section"
                kicker="Quick start"
                title={showCompactMobileTodayHeader ? '现在就写，写完就开始' : '别研究全部，先开一件事'}
                subtitle={showCompactMobileTodayHeader ? '手机上只保留开工入口：任务名、下一步、直接开始。' : '第一次用时，只做三步：写下最重要的一件事、补一个最小动作、直接开始。'}
              >
                <div className="quick-start-card">
                  {!showCompactMobileTodayHeader ? (
                    <ol className="quick-start-steps">
                      <li>先写今天最重要的一件事。</li>
                      <li>再写一个小到能立刻开始的动作。</li>
                      <li>点“直接开始”，别再切来切去。</li>
                    </ol>
                  ) : (
                    <p className="quick-start-mobile-note">先写一件事和一个最小动作，别先往下翻。</p>
                  )}
                  <div className="stack-form">
                    <label>
                      今天最重要的一件事
                      <input
                        value={quickStartTitle}
                        onChange={(event) => setQuickStartTitle(event.target.value)}
                        placeholder="例如：把简历的自我介绍改完"
                      />
                    </label>
                    <label>
                      现在只做这一步（可选）
                      <input
                        value={quickStartStep}
                        onChange={(event) => setQuickStartStep(event.target.value)}
                        placeholder="例如：先写第一段，不求完整"
                      />
                    </label>
                    <div className="quick-start-actions">
                      <button type="button" className="ghost-button" onClick={() => handleQuickStart(false)} disabled={!quickStartTitle.trim()}>
                        先放进今天
                      </button>
                      <button type="button" className="primary-button" onClick={() => handleQuickStart(true)} disabled={!quickStartTitle.trim()}>
                        直接开始 25 分钟
                      </button>
                    </div>
                  </div>

                  <div className="planner-inline-card">
                    <div className="planner-inline-copy">
                      <span className="muted-label">晨间挑选</span>
                      <strong>
                        今天建议保留 {data.dailyTemplate.topTaskSlots} 个核心任务，现在已选 {actionableTodayItems.length} 个
                        {remainingTopTaskSlots > 0 ? `，还可以再挑 ${remainingTopTaskSlots} 个。` : '，先别继续加了，直接开工。'}
                      </strong>
                      <p>
                        {plannerSuggestions.length > 0
                          ? '下面这些还没进今天，点一下就能加入今天或直接开始。'
                          : actionableTodayItems.length > 0
                            ? '任务池里的主动任务已经挑得差不多了，先把今天的任务做掉。'
                            : '如果任务池还是空的，就先在上面写一件今天最重要的事。'}
                      </p>
                    </div>

                    {plannerSuggestions.length > 0 ? (
                      <div className="planner-suggestion-list">
                        {plannerSuggestions.map((task) => (
                          <article key={task.id} className="planner-suggestion-card">
                            <div>
                              <strong>{task.title}</strong>
                              <p>
                                {task.deadlineDate
                                  ? `截止 ${formatDeadlineDate(task.deadlineDate)} · 这类任务会每天自动进今天。`
                                  : isMobileLayout
                                    ? '点一下就能拉进今天。'
                                    : '不切页面，直接决定它今天要不要做。'}
                              </p>
                            </div>
                            <div className="planner-suggestion-actions">
                              <button type="button" className="ghost-button compact-action-button" onClick={() => actions.addTaskToToday(task.id)}>
                                加入今天
                              </button>
                              <button type="button" className="primary-button compact-action-button" onClick={() => handleLaunchTaskDefinition(task.id, task.title)}>
                                直接开始
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="planner-empty-state">
                        <button type="button" className="ghost-button compact-action-button" onClick={() => setActiveTab('pool')}>
                          去任务池整理更多任务
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              <Section
                className="today-tasks-section"
                kicker="Execution"
                title={showCompactMobileTodayHeader ? '现在就干这几件' : '今天要做什么'}
                subtitle={showCompactMobileTodayHeader ? '手机上只保留任务、下一步和开始按钮。' : '从任务池拖进今天后，给每个任务至少拆一个最小动作。'}
                actions={<span className="muted-label">推荐保留 {data.dailyTemplate.topTaskSlots} 个核心任务</span>}
              >
                <div className="task-list">
                  {actionableTodayItems.map((item) => {
                    const sourceTask = data.taskDefs.find((task) => task.id === item.sourceTaskId)
                    const firstPendingStep = item.steps.find((step) => !step.isDone)
                    const stepProgress = getStepProgress(item)
                    const progressPercent = stepProgress.total === 0 ? 0 : Math.round((stepProgress.done / stepProgress.total) * 100)
                    const isTaskExpanded = !isMobileLayout || expandedTaskId === item.id
                    return (
                      <article
                        key={item.id}
                        className={item.id === selectedItemId ? `task-card selected ${!isTaskExpanded ? 'compact-mobile-card' : ''}` : `task-card ${!isTaskExpanded ? 'compact-mobile-card' : ''}`}
                      >
                        <div className="task-card-top">
                          <div className="task-card-heading">
                            <span className="task-index-badge">{String(item.order).padStart(2, '0')}</span>
                            <button type="button" className="task-title-button" onClick={() => setSelectedItemId(item.id)}>
                              <span className={item.isDone ? 'task-title done' : 'task-title'}>{item.title}</span>
                              <span className="pill">{item.kind === 'routine' ? '生活任务' : '主动任务'}</span>
                            </button>
                          </div>
                          {isTaskExpanded ? (
                            <div className="task-card-actions">
                              <button type="button" className="tiny-button icon-button" onClick={() => actions.moveTodayItem(item.id, -1)}>
                                ↑
                              </button>
                              <button type="button" className="tiny-button icon-button" onClick={() => actions.moveTodayItem(item.id, 1)}>
                                ↓
                              </button>
                              <button type="button" className="tiny-button success-button" onClick={() => actions.toggleTodayItemDone(item.id)}>
                                {item.isDone ? '取消完成' : '完成'}
                              </button>
                              <button type="button" className="tiny-button danger-button" onClick={() => actions.removeTodayItem(item.id)}>
                                移出今天
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <div className="task-meta-row">
                          <span className="task-meta-chip">{getTaskStatusText(item)}</span>
                          <span className="task-meta-chip">{stepProgress.done}/{stepProgress.total || 1} 步完成</span>
                          {sourceTask?.deadlineDate ? <span className="task-meta-chip warning">截止：{formatDeadlineDate(sourceTask.deadlineDate)}</span> : null}
                          {firstPendingStep ? <span className="task-meta-chip accent">当前下一步：{firstPendingStep.title}</span> : null}
                        </div>

                        <div className="task-progress-bar" aria-hidden="true">
                          <span style={{ width: `${progressPercent}%` }} />
                        </div>

                        {isMobileLayout && !isTaskExpanded ? (
                          <div className="task-mobile-preview">
                            <p>{firstPendingStep?.title ?? '还没分解下一步，先点展开再写。'}</p>
                            <div className="task-mobile-actions">
                              <button type="button" className="ghost-button compact-action-button" onClick={() => toggleTaskExpand(item.id)}>
                                展开编辑
                              </button>
                              <button type="button" className="primary-button compact-action-button" onClick={() => startTask(item)}>
                                直接开始
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {isTaskExpanded && item.steps.length > 0 ? (
                          <ul className="step-list">
                            {item.steps.map((step) => (
                              <li key={step.id} className={step.isDone ? 'step-item step-item-done' : 'step-item'}>
                                <label className="step-main">
                                  <span className={step.isDone ? 'step-check checked' : 'step-check'}>
                                    <input
                                      type="checkbox"
                                      checked={step.isDone}
                                      onChange={() => actions.toggleStepDone(item.id, step.id)}
                                    />
                                    <span className="step-check-indicator" />
                                  </span>
                                  <span className="step-copy">
                                    <strong className={step.isDone ? 'done' : ''}>{step.title}</strong>
                                    <small>
                                      {step.isDone
                                        ? `这一小步已完成${step.completedAt ? ` · ${dayjs(step.completedAt).format('HH:mm')}` : ''}`
                                        : '把注意力只放在这一小步上'}
                                    </small>
                                  </span>
                                </label>
                                <div className="step-actions">
                                  <button
                                    type="button"
                                    className="tiny-button subtle"
                                    onClick={() => actions.startFocusTimer(item.id, step.id)}
                                  >
                                    开始这一步
                                  </button>
                                  <button
                                    type="button"
                                    className="tiny-button danger-button"
                                    onClick={() => actions.removeStep(item.id, step.id)}
                                  >
                                    删除
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : isTaskExpanded ? (
                          <p className="empty-hint">先给这个任务拆一个最小动作，再开始番茄钟。</p>
                        ) : null}

                        {isTaskExpanded ? (
                          <div className="task-footer">
                            <form
                              className="inline-form"
                              onSubmit={(event) => {
                                event.preventDefault()
                                actions.addStep(item.id, stepInputs[item.id] ?? '')
                                setStepInputs((prev) => ({ ...prev, [item.id]: '' }))
                              }}
                            >
                              <input
                                value={stepInputs[item.id] ?? ''}
                                onChange={(event) => setStepInputs((prev) => ({ ...prev, [item.id]: event.target.value }))}
                                placeholder="例如：先写标题和第一段"
                              />
                              <button type="submit" className="tiny-button step-add-button form-action-button">
                                分解
                              </button>
                            </form>
                            <div className="task-footer-actions">
                              {isMobileLayout ? (
                                <button type="button" className="ghost-button compact-action-button" onClick={() => setExpandedTaskId('')}>
                                  收起
                                </button>
                              ) : null}
                              <button type="button" className="primary-button" onClick={() => startTask(item)}>
                                开始 25 分钟专注
                                {firstPendingStep ? ` · ${firstPendingStep.title}` : ''}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    )
                  })}

                  {actionableTodayItems.length === 0 ? <p className="empty-hint">先去任务池挑 1 个真正要推进的任务放进今天吧。</p> : null}
                </div>
              </Section>

              <Section
                kicker="Simple"
                title="固定简单提醒"
                subtitle="像吃饭、洗澡、走动这种简单事情，不再混进需要分解的主任务里，只负责按时提醒。"
              >
                <div className="task-list compact">
                  {simpleRoutineItems.map((item) => {
                    const sourceTask = data.taskDefs.find((task) => task.id === item.sourceTaskId)

                    return (
                      <article key={item.id} className="task-card compact simple-reminder-card">
                        <div>
                          <strong>{item.title}</strong>
                          <p className="muted">提醒时间：{sourceTask?.scheduleTime ?? '未设置'} · 不需要分解，到了就做。</p>
                        </div>
                        <button type="button" className={item.isDone ? 'ghost-button compact-action-button' : 'primary-button compact-action-button'} onClick={() => actions.toggleTodayItemDone(item.id)}>
                          {item.isDone ? '今天已完成' : '标记完成'}
                        </button>
                      </article>
                    )
                  })}
                  {simpleRoutineItems.length === 0 ? <p className="empty-hint">还没有固定简单提醒，可以在任务池里加一个固定生活任务。</p> : null}
                </div>
              </Section>

              <Section
                className="today-boundaries-section"
                kicker="Boundaries"
                title="今天不做什么"
                subtitle="给自己划边界，别让今天又被同样的东西吃掉。"
                actions={<span className="muted-label">今天先守住 1 - 3 条就够了</span>}
              >
                <div className="avoid-entry-row">
                  <form className="inline-form avoid-entry-form" onSubmit={handleAddAvoid}>
                    <input value={avoidText} onChange={(event) => setAvoidText(event.target.value)} placeholder="例如：专注时段不刷短视频" />
                    <button type="submit" className="ghost-button avoid-action-button">加入不做清单</button>
                  </form>
                  <p className="muted avoid-helper-text">今天不需要写很多，先把最容易失守的那几条钉住。</p>
                </div>
                <div className="chip-list">
                  {dayPlan.avoidItems.length === 0 ? <p className="empty-hint">还没有写边界，先写一条最容易失守的。</p> : null}
                  {dayPlan.avoidItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.isDone ? 'chip avoid-chip active' : 'chip avoid-chip'}
                      onClick={() => actions.toggleAvoidDone(item.id)}
                    >
                      <span className="avoid-chip-title">{item.text}</span>
                      <span className="avoid-chip-state">{item.isDone ? '今天守住了' : '点一下表示今天要守住'}</span>
                    </button>
                  ))}
                </div>
              </Section>
            </div>

            {isMobileLayout ? (
              <div className="mobile-side-toggle">
                <button type="button" className="ghost-button mobile-side-toggle-button" onClick={() => setShowMobileTodayExtras((prev) => !prev)}>
                  {showMobileTodayExtras ? '收起卡住时再用' : '卡住了再展开'}
                </button>
              </div>
            ) : null}

            <div className={isMobileLayout && !showMobileTodayExtras ? 'column-side mobile-hidden' : 'column-side'}>
              <div className="column-side-sticky">
              <Section kicker="Now" title="现在先做" subtitle="右边只留下当前最需要看的几件事。">
                <div className="compact-stack">
                  <div className="side-summary-card">
                    <span className="muted-label">最小下一步</span>
                    {selectedItem ? (
                      <>
                        <h3 className="focus-title">{selectedItem.title}</h3>
                        <p className="muted">
                          {selectedItem.steps.find((step) => !step.isDone)?.title ?? '还没有拆出下一步，先补一个。'}
                        </p>
                      </>
                    ) : (
                      <p className="empty-hint">先选一个今天任务。</p>
                    )}
                  </div>

                  <div className="side-summary-card">
                    <span className="muted-label">下一条生活提醒</span>
                    <p className="focus-title compact-title">{nextRoutine?.title ?? '今天的固定生活任务都已经处理过了。'}</p>
                    <p className="muted">
                      {nextRoutine?.sourceTaskId
                        ? `提醒时间：${data.taskDefs.find((task) => task.id === nextRoutine.sourceTaskId)?.scheduleTime ?? '未设置'}`
                        : '如果你还没吃饭、休息或联系人，可以现在补一项。'}
                    </p>
                  </div>

                  {activeRelaxWindow ? (
                    <div className="relax-card compact-relax-card">
                      <strong>已解锁 {activeRelaxWindow.minutes} 分钟放松</strong>
                      <p>{activeRelaxWindow.recommendation}</p>
                      <p>截止：{dayjs(activeRelaxWindow.expiresAt).format('HH:mm')}</p>
                      <button type="button" className="primary-button" onClick={() => actions.consumeRelaxWindow(activeRelaxWindow.id)}>
                        我现在去放松一下
                      </button>
                    </div>
                  ) : null}
                </div>
              </Section>

              <Section kicker="Support" title="卡住了？试试这些" subtitle="选一个你现在的状态，系统会建议你做什么。试完打个分，好用的方法会记下来。">
                <div className="compact-stack">
                  {interventionStep === 'pick-state' ? (
                    <div className="stack-form">
                      <p className="muted">现在什么感觉？</p>
                      <div className="chip-list">
                        {Object.entries(stateTemplateLabels).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`chip ${stateType === value ? 'active' : ''}`}
                            onClick={() => {
                              setStateType(value as StateType)
                              setInterventionStep('try-method')
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : interventionStep === 'try-method' ? (
                    <div className="stack-form">
                      <div className="intervention-header">
                        <span className="chip active">{stateTemplateLabels[stateType]}</span>
                        <button type="button" className="ghost-button" onClick={() => setInterventionStep('pick-state')}>
                          换一个
                        </button>
                      </div>
                      <p className="muted">试试下面这些，选一个去做：</p>
                      <div className="intervention-list">
                        {presetInterventions
                          .filter((m) => m.forStates.includes(stateType))
                          .map((method) => (
                            <button
                              key={method.id}
                              type="button"
                              className={`intervention-card ${activeIntervention === method.id ? 'active' : ''}`}
                              onClick={() => {
                                setActiveIntervention(method.id)
                                setStateResponse(method.label)
                              }}
                            >
                              <strong>{method.label}</strong>
                              {method.duration ? <span className="intervention-duration">{method.duration} 分钟</span> : null}
                            </button>
                          ))}
                      </div>
                      <div className="inline-form">
                        <input
                          value={customMethod}
                          onChange={(event) => setCustomMethod(event.target.value)}
                          placeholder="或者写你自己的方法…"
                        />
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={!customMethod.trim()}
                          onClick={() => {
                            setStateResponse(customMethod.trim())
                            setActiveIntervention('custom')
                            setInterventionStep('rate')
                          }}
                        >
                          去试
                        </button>
                      </div>
                      {activeIntervention && activeIntervention !== 'custom' ? (
                        <button type="button" className="primary-button" onClick={() => setInterventionStep('rate')}>
                          去做：{stateResponse}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="stack-form">
                      <div className="intervention-header">
                        <span className="chip active">{stateTemplateLabels[stateType]}</span>
                        <span className="muted">→ {stateResponse}</span>
                      </div>
                      <p className="muted">试完了？感觉怎么样？</p>
                      <div className="intervention-rate-buttons">
                        {(['better', 'same', 'worse'] as const).map((result) => (
                          <button
                            key={result}
                            type="button"
                            className={`ghost-button ${result === 'better' ? 'success-button' : result === 'worse' ? 'danger-button' : ''}`}
                            onClick={() => {
                              actions.addStateRecord(stateType, stateTrigger, stateResponse, result)
                              setInterventionStep('pick-state')
                              setActiveIntervention('')
                              setCustomMethod('')
                              setStateResponse('')
                              setStateTrigger('')
                            }}
                          >
                            {result === 'better' ? '好多了' : result === 'same' ? '没变化' : '更糟了'}
                          </button>
                        ))}
                      </div>
                      <input
                        value={stateTrigger}
                        onChange={(event) => setStateTrigger(event.target.value)}
                        placeholder="可选：记一下诱因是什么"
                      />
                    </div>
                  )}

                  {todayStateRecords.length > 0 ? (
                    <details className="info-details">
                      <summary>今天的尝试记录（{todayStateRecords.length}）</summary>
                      <ul className="log-list compact-log-list top-space">
                        {todayStateRecords.slice(0, 5).map((record) => (
                          <li key={record.id}>
                            <strong>{stateTemplateLabels[record.stateType]}</strong>
                            <span>→ {record.response || '未记录方法'}</span>
                            <span className={record.result === 'better' ? 'success' : record.result === 'worse' ? 'danger' : ''}>
                              {record.result === 'better' ? '✓ 好了' : record.result === 'same' ? '— 没变' : '✗ 更糟'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={dayPlan.communicationDone}
                      onChange={(event) => actions.setCommunication(event.target.checked, communicationNote)}
                    />
                    <span>今天已经主动和一个人认真交流过</span>
                  </label>
                </div>
              </Section>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'pool' ? (
          <div className="page-grid narrow">
            <div className="column-main">
              <Section title="任务池" subtitle="先把自己能做的事列出来，再决定今天拉哪几个进去。">
                <form className="stack-form" onSubmit={handleAddTaskDefinition}>
                  <label>
                    任务名称
                    <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="例如：整理简历 / 吃饭 12:30 / 晚上洗澡 21:30" />
                  </label>
                  <label className="checkbox-row toggle-row">
                    <input
                      type="checkbox"
                      checked={taskKind === 'routine'}
                      onChange={(event) => {
                        const nextKind = event.target.checked ? 'routine' : 'normal'
                        setTaskKind(nextKind)
                        if (nextKind === 'normal') {
                              setTaskHour('')
                              setTaskMinute('')
                            } else {
                              setTaskDeadline('')
                        }
                      }}
                    />
                    <span>这是固定生活提醒</span>
                  </label>
                  {taskKind === 'routine' || showPoolAdvanced ? (
                    <div className="stack-form">
                      <label>
                        类型
                        <select
                          value={taskKind}
                          onChange={(event) => {
                            const nextKind = event.target.value as 'normal' | 'routine'
                            setTaskKind(nextKind)
                            if (nextKind === 'routine') {
                              setTaskDeadline('')
                            } else {
                              setTaskHour('')
                              setTaskMinute('')
                            }
                          }}
                        >
                          <option value="normal">主动任务</option>
                          <option value="routine">固定生活任务</option>
                        </select>
                      </label>
                      <label>
                        {taskKind === 'routine' ? '提醒时间（可选）' : '截止日期（可选）'}
                        {taskKind === 'routine' ? (
                          <div className="time-picker-row">
                            <select value={taskHour} onChange={(event) => setTaskHour(event.target.value)}>
                              <option value="">时</option>
                              {hourOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                            <span className="time-picker-separator">:</span>
                            <select value={taskMinute} onChange={(event) => setTaskMinute(event.target.value)}>
                              <option value="">分</option>
                              {minuteOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <input type="date" value={taskDeadline} onChange={(event) => setTaskDeadline(event.target.value)} />
                        )}
                      </label>
                    </div>
                  ) : null}
                  {!showPoolAdvanced && taskKind === 'normal' ? (
                    <button type="button" className="ghost-button compact-action-button" onClick={() => setShowPoolAdvanced(true)}>
                      展开更多设置
                    </button>
                  ) : null}
                  <p className="muted">
                    手机上一般只填一行就够了。像成熟任务软件一样，你可以直接写「吃饭 12:30」或「晚上洗澡 21:30」，系统会自动识别成固定提醒。
                    主动任务如果填了截止日期，它会每天自动进今天，直到做完为止。
                  </p>
                  <button type="submit" className="primary-button">
                    加入任务池
                  </button>
                </form>

                <div className="task-list compact">
                  {data.taskDefs
                    .filter((task) => !task.archived)
                    .map((task) => (
                      <article key={task.id} className="task-card compact">
                        <div>
                          <strong>{task.title}</strong>
                          <p className="muted">
                            {task.kind === 'routine'
                              ? `固定生活任务 · ${task.scheduleTime ?? '时间待定'}`
                              : task.deadlineDate
                                ? `主动任务 · 截止 ${formatDeadlineDate(task.deadlineDate)} · 会每天自动进今天`
                                : '主动任务'}
                          </p>
                        </div>
                        <div className="task-pool-actions">
                          {task.kind === 'normal' ? (
                            <>
                              <button type="button" className="primary-button" onClick={() => handleLaunchTaskDefinition(task.id, task.title)}>
                                直接开始
                              </button>
                              <button type="button" className="ghost-button" onClick={() => actions.addTaskToToday(task.id)}>
                                只放进今天
                              </button>
                            </>
                          ) : (
                            <button type="button" className="primary-button" onClick={() => actions.addTaskToToday(task.id)}>
                              放进今天
                            </button>
                          )}
                          <button type="button" className="ghost-button danger-button" onClick={() => handleRemoveTaskDefinition(task.id, task.title)}>
                            删除
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              </Section>
            </div>

            <div className="column-side">
              <Section title="提醒你别空转" subtitle="今天不是要完成所有任务，只要把最重要的推进一小步。">
                <ul className="bullet-list">
                  <li>今天只保留 {data.dailyTemplate.topTaskSlots} 个核心任务。</li>
                  <li>每个任务先拆一个最小动作，再开番茄钟。</li>
                  <li>固定生活任务也算任务，它们是生活的骨架。</li>
                </ul>
              </Section>

              <Section title="长期规则" subtitle="这些规则会不断提醒你回到自己设的目标。">
                <details className="info-details" open={!isMobileLayout}>
                  <summary>{isMobileLayout ? '展开长期规则' : '长期规则'}</summary>
                  <div className="stack-form top-space">
                    <form className="stack-form" onSubmit={handleAddRule}>
                      <div className="inline-grid">
                        <label>
                          类型
                          <select value={ruleType} onChange={(event) => setRuleType(event.target.value as 'do' | 'avoid')}>
                            <option value="do">要做</option>
                            <option value="avoid">不做</option>
                          </select>
                        </label>
                        <label>
                          规则内容
                          <input value={ruleText} onChange={(event) => setRuleText(event.target.value)} placeholder="例如：晚上 11 点后不再刷手机" />
                        </label>
                      </div>
                      <button type="submit" className="primary-button">
                        加一条长期规则
                      </button>
                    </form>
                    <div className="chip-list">
                      {data.ruleDefs.map((rule) => (
                        <span key={rule.id} className={rule.type === 'avoid' ? 'chip' : 'chip active'}>
                          {rule.type === 'avoid' ? '不做' : '要做'} · {rule.text}
                        </span>
                      ))}
                    </div>
                  </div>
                </details>
              </Section>
            </div>
          </div>
        ) : null}

        {activeTab === 'templates' ? (
          <div className="page-grid narrow">
            <div className="column-main">
              <Section title="核心设置" subtitle="大多数时候只要把今天任务控制少一点，别一上来改一堆选项。">
                <div className="stack-form">
                  <div className="inline-grid triple">
                    <label>
                      今日核心任务数
                      <input value={dailySlots} onChange={(event) => setDailySlots(event.target.value)} />
                    </label>
                    <label>
                      今日生活任务数
                      <input value={dailyRoutines} onChange={(event) => setDailyRoutines(event.target.value)} />
                    </label>
                    <label>
                      放松窗口分钟数
                      <input value={dailyRelaxMinutes} onChange={(event) => setDailyRelaxMinutes(event.target.value)} />
                    </label>
                  </div>
                  <p className="muted">如果你刚开始用，建议保持默认：3 个核心任务、2 个生活提醒，其他先别动。</p>
                  <details className="info-details">
                    <summary>展开长期模板和节奏设置</summary>
                    <div className="stack-form top-space">
                      <label>
                        今日不做条数
                        <input value={dailyAvoids} onChange={(event) => setDailyAvoids(event.target.value)} />
                      </label>
                      <label>
                        今日交流提示
                        <input value={dailyPrompt} onChange={(event) => setDailyPrompt(event.target.value)} />
                      </label>
                      <label>
                        每周 3 个方向（每行一项）
                        <textarea rows={4} value={weeklyDirections} onChange={(event) => setWeeklyDirections(event.target.value)} />
                      </label>
                      <label>
                        本周最容易失守的场景（每行一项）
                        <textarea rows={4} value={weeklyRisks} onChange={(event) => setWeeklyRisks(event.target.value)} />
                      </label>
                      <label>
                        本周交流目标
                        <input value={weeklyCommunicationGoal} onChange={(event) => setWeeklyCommunicationGoal(event.target.value)} />
                      </label>
                      <label>
                        本周休息安排
                        <input value={weeklyRestPlan} onChange={(event) => setWeeklyRestPlan(event.target.value)} />
                      </label>
                    </div>
                  </details>
                  <button type="button" className="primary-button" onClick={handleSaveTemplates}>
                    保存核心设置
                  </button>
                </div>
              </Section>
            </div>

            <div className="column-side">
              <Section title="设备与提醒" subtitle="默认只保留提醒和同步概况。跨端同步、防分心、飞书都先折叠起来。">
                <div className="stack-form">
                  <div className="sync-summary-card">
                    <div>
                      <span className="muted-label">当前同步状态</span>
                      <strong>
                        {!sync.envReady ? '还没接上 Supabase' : data.settings.syncEnabled ? '已准备同步' : '同步未开启'}
                      </strong>
                    </div>
                    <p>
                      {!sync.envReady
                        ? '如果你暂时只在一台设备上用，可以先不管同步。'
                        : data.settings.syncEnabled
                          ? '手机和电脑填同一个同步空间码，就会共用一份数据。'
                          : '想让手机和电脑互通时，再打开同步。'}
                    </p>
                  </div>
                  <div className="settings-basics-card">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={data.settings.mobileTimerEnabled}
                        onChange={(event) => actions.updateSettings({ mobileTimerEnabled: event.target.checked })}
                      />
                      <span>手机端开启原生提醒</span>
                    </label>
                    <div className="feishu-actions compact-actions-grid">
                      <button type="button" className="ghost-button" onClick={handleEnableNativeTimer}>
                        先申请提醒权限
                      </button>
                    </div>
                    <p className="muted">先把这台设备的提醒权限开通就够了。更细的提醒排查放到下面再展开。</p>
                    {nativeTimerMessage ? (
                      <p className={nativeTimerStatus === 'error' ? 'sync-status error' : 'sync-status success'}>{nativeTimerMessage}</p>
                    ) : null}
                  </div>

                  <details className="info-details">
                    <summary>展开提醒细节和排查</summary>
                    <div className="stack-form top-space">
                      <p className="muted">当前已配置 {routineReminderCount} 条固定生活提醒，它们会按任务池里的时间每天提醒。</p>
                      <div className="feishu-actions compact-actions-grid">
                        <button type="button" className="ghost-button" onClick={handleTestNativeTimer}>
                          测试手机提醒
                        </button>
                        <button type="button" className="ghost-button" onClick={handleOpenExactAlarmSettings}>
                          打开系统闹钟设置
                        </button>
                      </div>
                    </div>
                  </details>

                  <details className="info-details">
                    <summary>跨设备时再展开同步</summary>
                    <div className="stack-form top-space">
                      <label>
                        这台设备叫什么
                        <input value={syncDeviceName} onChange={(event) => setSyncDeviceName(event.target.value)} placeholder="例如：我的手机 / 家里电脑" />
                      </label>
                      <label>
                        同步空间码
                        <input value={syncSpaceId} onChange={(event) => setSyncSpaceId(event.target.value.toUpperCase())} placeholder="例如：ABCD-EFGH" />
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={data.settings.syncEnabled}
                          onChange={(event) => actions.updateSettings({ syncEnabled: event.target.checked })}
                        />
                        <span>开启手机和电脑共用同一份数据</span>
                      </label>
                      <div className="feishu-actions compact-actions-grid">
                        <button type="button" className="ghost-button" onClick={handleCreateSyncSpace}>
                          生成同步码
                        </button>
                        <button type="button" className="ghost-button" onClick={handleCopySyncCode} disabled={!syncSpaceId.trim()}>
                          {syncCodeCopied ? '已复制同步码' : '复制同步码'}
                        </button>
                        <button type="button" className="ghost-button" onClick={handlePullCloud}>
                          从云端拉下来
                        </button>
                        <button type="button" className="primary-button" onClick={handlePushCloud}>
                          上传这台设备数据
                        </button>
                      </div>
                      {sync.message ? (
                        <p className={sync.status === 'error' ? 'sync-status error' : 'sync-status success'}>{sync.message}</p>
                      ) : null}
                      <ul className="bullet-list compact-bullet-list">
                        <li>第一次用：先在一台设备上生成同步码，再去另一台填同一个码。</li>
                        <li>先点“上传这台设备数据”，再到另一台点“从云端拉下来”。</li>
                        <li>只有真要跨设备时，才需要配 Supabase。</li>
                      </ul>
                      {!isSyncEnvReady() ? (
                        <p className="sync-status error">跨端同步已经接进去了，但还要先把 `.env` 里的 Supabase 地址和 key 填上。</p>
                      ) : null}
                      <details className="info-details nested-details">
                        <summary>展开 Supabase 建表 SQL</summary>
                        <div className="details-actions">
                          <button type="button" className="ghost-button compact-action-button" onClick={handleCopySyncSql}>
                            {syncSqlCopied ? '已复制 SQL' : '复制 SQL'}
                          </button>
                        </div>
                        <p className="muted">Supabase 里执行这段 SQL 后，同步才会真正可用：</p>
                        <pre className="code-block">{syncSetupSql}</pre>
                      </details>
                    </div>
                  </details>

                  <details className="info-details">
                    <summary>需要时再展开防分心（安卓）</summary>
                    <div className="stack-form top-space">
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={data.settings.appLockEnabled}
                          onChange={(event) => actions.updateSettings({ appLockEnabled: event.target.checked })}
                        />
                        <span>专注时锁定黑名单应用（安卓）</span>
                      </label>
                      <div className="feishu-actions compact-actions-grid">
                        <button type="button" className="ghost-button" onClick={handleOpenFocusLockSettings}>
                          打开无障碍设置
                        </button>
                        <button type="button" className="ghost-button" onClick={handleCheckFocusLockStatus}>
                          检查应用锁状态
                        </button>
                      </div>
                      <p className="muted">当前状态：{focusLockAvailable ? (focusLockServiceEnabled ? '应用锁定服务已开启' : '还没开启应用锁定服务') : '只在安卓安装包里可用'}</p>
                      {focusLockMessage ? (
                        <p className={focusLockStatus === 'error' ? 'sync-status error' : 'sync-status success'}>{focusLockMessage}</p>
                      ) : null}
                      {focusLockAvailable ? (
                        <p className="muted">
                          {data.settings.blockerLevel === 'light'
                            ? '当前干预等级是轻提醒，不会真的拦住应用；改成软阻断或硬阻断后，开始专注时才会拉回 life。'
                            : data.settings.blockedTargets.length === 0
                              ? '还没填黑名单应用，先至少加一个应用名或包名。'
                              : '黑名单现在会即时保存；开始专注后，命中的应用会被拉回 life。'}
                        </p>
                      ) : null}
                      <ul className="bullet-list compact-bullet-list">
                        <li>测试应用锁定时，先开始一轮专注，再去点开黑名单应用。</li>
                        <li>如果没被拦住，先检查无障碍服务状态，再确认黑名单里填的是应用名或包名。</li>
                      </ul>
                      <label>
                        干预等级
                        <select
                          value={data.settings.blockerLevel}
                          onChange={(event) => actions.updateSettings({ blockerLevel: event.target.value as 'light' | 'soft' | 'hard' })}
                        >
                          <option value="light">轻提醒</option>
                          <option value="soft">软阻断</option>
                          <option value="hard">硬阻断（文字上先约束）</option>
                        </select>
                      </label>
                      <label>
                        需要重点防的应用 / 网站（每行一项）
                        <textarea rows={5} value={blockedTargets} onChange={(event) => handleBlockedTargetsChange(event.target.value)} />
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={data.settings.encouragementEnabled}
                          onChange={(event) => actions.updateSettings({ encouragementEnabled: event.target.checked })}
                        />
                        <span>开启鼓励提醒</span>
                      </label>
                      <div className="chip-list compact-chip-list">
                        {data.settings.blockedTargets.map((target) => (
                          <span key={target} className="chip warning">
                            {target}
                          </span>
                        ))}
                      </div>
                    </div>
                  </details>

                  <details className="info-details">
                    <summary>需要时再展开飞书同步（可选）</summary>
                    <div className="stack-form top-space">
                      <label>
                        飞书 webhook 地址
                        <input
                          value={feishuWebhookUrl}
                          onChange={(event) => setFeishuWebhookUrl(event.target.value)}
                          placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                        />
                      </label>
                      <label>
                        关键词（可选）
                        <input
                          value={feishuKeyword}
                          onChange={(event) => setFeishuKeyword(event.target.value)}
                          placeholder="如果机器人设置了关键词，就填这里"
                        />
                      </label>
                      <label>
                        签名密钥（可选）
                        <input
                          value={feishuSecret}
                          onChange={(event) => setFeishuSecret(event.target.value)}
                          placeholder="如果机器人开启签名校验，就填这里"
                        />
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={data.settings.feishuAutoSyncReview}
                          onChange={(event) => actions.updateSettings({ feishuAutoSyncReview: event.target.checked })}
                        />
                        <span>保存复盘后自动同步到飞书</span>
                      </label>
                      <div className="feishu-actions">
                        <button type="button" className="primary-button" onClick={handleTestFeishuConnection} disabled={isTestingFeishu}>
                          {isTestingFeishu ? '正在测试连接…' : '测试飞书连接'}
                        </button>
                        <button type="button" className="ghost-button" onClick={handleSaveTemplates}>
                          保存飞书配置
                        </button>
                      </div>
                      {feishuTestMessage ? (
                        <p className={feishuTestStatus === 'error' ? 'sync-status error' : 'sync-status success'}>{feishuTestMessage}</p>
                      ) : null}
                      <p className="muted">这一项纯属可选。先把今天用顺了，再回来接飞书也不迟。</p>
                    </div>
                  </details>

                  <details className="info-details">
                    <summary>最后再展开更多操作</summary>
                    <div className="top-space">
                      <button type="button" className="ghost-button danger" onClick={actions.resetAll}>
                        重置全部数据
                      </button>
                    </div>
                  </details>
                </div>
              </Section>
            </div>
          </div>
        ) : null}

        {activeTab === 'review' ? (
          <div className="page-grid narrow">
            <div className="column-main">
              <Section title="晚间复盘" subtitle="不要写长文，只要把今天最重要的得失看清楚。">
                <form className="stack-form" onSubmit={handleSaveReview}>
                  <label>
                    今天完成了什么
                    <textarea
                      rows={3}
                      value={reviewForm.wins}
                      onChange={(event) => setReviewForm((prev) => ({ ...prev, wins: event.target.value }))}
                    />
                  </label>
                  <label>
                    今天失守了什么
                    <textarea
                      rows={3}
                      value={reviewForm.slips}
                      onChange={(event) => setReviewForm((prev) => ({ ...prev, slips: event.target.value }))}
                    />
                  </label>
                  <label>
                    今天最常进入什么状态
                    <select
                      value={reviewForm.commonState}
                      onChange={(event) => setReviewForm((prev) => ({ ...prev, commonState: event.target.value as StateType | '' }))}
                    >
                      <option value="">暂不选择</option>
                      {Object.entries(stateTemplateLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    明天第一步是什么
                    <textarea
                      rows={3}
                      value={reviewForm.tomorrow}
                      onChange={(event) => setReviewForm((prev) => ({ ...prev, tomorrow: event.target.value }))}
                    />
                  </label>
                  <button type="submit" className="primary-button" disabled={isSavingReview}>
                    {isSavingReview
                      ? '正在保存并同步…'
                      : data.settings.feishuAutoSyncReview
                        ? '保存今日复盘并自动同步'
                        : '保存今日复盘'}
                  </button>
                  {reviewSaveMessage ? (
                    <p className={reviewSaveStatus === 'error' ? 'sync-status error' : 'sync-status success'}>{reviewSaveMessage}</p>
                  ) : null}
                </form>
              </Section>
            </div>

            <div className="column-side">
              <Section title="和时钟关联" subtitle="今天做了什么、什么时候做完、哪里卡住。可以直接编辑或删除条目，修改后发送飞书即为最新内容。">
                <ul className="timeline-list">
                  {todayTimeline.length === 0 ? <li className="timeline-empty">今天还没有形成时间线。</li> : null}
                  {todayTimeline.map((entry) => (
                    <li key={entry.id} className={`timeline-item ${entry.type}`}>
                      <span className="timeline-time">{dayjs(entry.happenedAt).format('HH:mm')}</span>
                      <div
                        onClick={() => {
                          if (entry.type === 'step') return
                          setEditingTimelineId(entry.id)
                        }}
                        style={{ cursor: entry.type !== 'step' ? 'pointer' : undefined }}
                      >
                        <strong>{entry.title}</strong>
                        <p className="timeline-detail-truncated">
                          {entry.detail}
                        </p>
                      </div>
                      {entry.type !== 'step' ? (
                        <button
                          type="button"
                          className="tiny-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (entry.type === 'difficulty') actions.removeDifficultyRecord(entry.id)
                            else if (entry.type === 'focus') actions.removeFocusSession(entry.id)
                          }}
                        >
                          ×
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="同步到飞书" subtitle="上方「和时钟关联」就是发送内容的预览，直接修改数据即可影响飞书内容。">
                <div className="stack-form">
                  <button type="button" className="primary-button" onClick={handleSyncToFeishu} disabled={isSyncingFeishu}>
                    {isSyncingFeishu ? '正在发送…' : '同步今天日志到飞书'}
                  </button>
                  {feishuSyncMessage ? (
                    <p className={feishuSyncStatus === 'error' ? 'sync-status error' : 'sync-status success'}>{feishuSyncMessage}</p>
                  ) : null}
                </div>
              </Section>

              <Section title="今天的困难" subtitle="卡点不是失败，是下一步的入口。">
                <ul className="log-list">
                  {todayDifficultyRecords.length === 0 ? <li>还没有记录困难。</li> : null}
                  {todayDifficultyRecords.map((record) => (
                    <li key={record.id}>
                      <strong>{difficultyTemplateLabels[record.type]}</strong>
                      <span>{record.note || '未写具体说明'}</span>
                      <span>下一步：{record.nextAction || '还没写'}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="周模板预览" subtitle="明天之前先别乱加，把这一周的板子守住。">
                <ul className="bullet-list">
                  {data.weeklyTemplate.directions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="muted">易失守场景：{data.weeklyTemplate.riskScenarios.join('、')}</p>
                <p className="muted">交流目标：{data.weeklyTemplate.communicationGoal}</p>
              </Section>
            </div>
          </div>
        ) : null}
      </main>

      {activeTimer ? (
        timerCollapsed ? (
          <button type="button" className="floating-timer-mini" onClick={() => setTimerCollapsed(false)}>
            ⏱ {formatSeconds(remainingSeconds)}
          </button>
        ) : (
        <div className={`floating-timer${showProcessNotes ? ' notes-open' : ''}`}>
          {showProcessNotes ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong style={{ fontSize: 20 }}>{formatSeconds(remainingSeconds)}</strong> {isBreakTimer ? '休息中' : activeItem?.title ?? '专注中'}</span>
              <button type="button" className="ghost-button" onClick={() => setShowProcessNotes(false)}>收起</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="muted-label">{isBreakTimer ? '正在休息' : '正在专注'}</span>
                  <strong>{formatSeconds(remainingSeconds)}</strong>
                  <p>{isBreakTimer ? `刚完成：${activeItem?.title ?? '这一轮专注'}` : activeItem?.title ?? '未绑定任务'}</p>
                  <p className="muted">{isBreakTimer ? '先休息，结束后回来继续。' : activeStep?.title ?? '先把眼前这一小步做掉。'}</p>
                </div>
                <button type="button" className="ghost-button" onClick={() => setTimerCollapsed(true)} style={{ fontSize: 18, padding: '2px 8px' }}>−</button>
              </div>
            </>
          )}
          {!showProcessNotes && (
            <div className="floating-actions">
              <button type="button" className="ghost-button" onClick={() => setShowProcessNotes(true)}>
                📝 过程笔记
              </button>
              {isBreakTimer ? (
                <button type="button" className="ghost-button" onClick={actions.finishBreakTimer}>
                  提前结束休息
                </button>
              ) : (
                <button type="button" className="ghost-button" onClick={() => setFinishOpen(true)}>
                  提前结束并记录
                </button>
              )}
              <button type="button" className="ghost-button danger" onClick={actions.cancelTimer}>
                {isBreakTimer ? '取消休息' : '取消本轮'}
              </button>
            </div>
          )}
          {showProcessNotes ? (
            <div className="process-notes-panel">
              <textarea
                ref={notesRef}
                value={dayPlan.processNotes ?? ''}
                onChange={(e) => actions.updateProcessNotes(e.target.value)}
                placeholder="随时记录想法、发现、卡点…"
                style={{ width: '100%', fontFamily: 'monospace', fontSize: 16, flex: 1 }}
              />
              <div className="notes-toolbar">
                <button type="button" onClick={() => {
                  const now = dayjs().format('HH:mm')
                  const cur = dayPlan.processNotes ?? ''
                  const sep = cur.trim() ? `\n\n--- ${now} ---\n` : `--- ${now} ---\n`
                  actions.updateProcessNotes(cur + sep)
                  requestAnimationFrame(() => {
                    const ta = notesRef.current
                    if (ta) { ta.scrollTop = ta.scrollHeight; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
                  })
                }}>+ 新笔记</button>
                <button type="button" onClick={() => insertNotesMarkdown('\n```\n', '\n```\n', 'code')}>{'</>'}</button>
                <button type="button" onClick={() => insertNotesMarkdown('`', '`', 'code')}>` `</button>
                <button type="button" onClick={() => insertNotesMarkdown('**', '**', '粗体')}>B</button>
                <button type="button" onClick={() => insertNotesMarkdown('- ', '\n', '列表')}>•</button>
              </div>
            </div>
          ) : null}
        </div>
        )
      ) : null}

      {finishOpen && activeTimer?.mode === 'focus' ? (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="panel-header">
              <div>
                <h2>这一轮结束了</h2>
                <p>先记一下结果和卡点；保存后就会自动进入休息时间。</p>
              </div>
              <button type="button" className="tiny-button" onClick={() => setFinishOpen(false)}>
                关闭
              </button>
            </div>
            <form className="stack-form" onSubmit={handleFinishTimer}>
              <label>
                这轮完成了吗？
                <select value={timerCompleted ? 'yes' : 'no'} onChange={(event) => setTimerCompleted(event.target.value === 'yes')}>
                  <option value="yes">完成了</option>
                  <option value="no">没有</option>
                </select>
              </label>
              {activeStep ? (
                <label className="checkbox-row">
                  <input type="checkbox" checked={markStepDone} onChange={(event) => setMarkStepDone(event.target.checked)} />
                  <span>顺手把当前最小任务标记完成</span>
                </label>
              ) : null}
              {!timerCompleted ? (
                <label>
                  困难类型
                  <select value={difficultyType} onChange={(event) => setDifficultyType(event.target.value as DifficultyType)}>
                    {Object.entries(difficultyTemplateLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {timerCompleted ? (
                <label>
                  这轮完成了什么
                  <textarea rows={3} value={accomplishment} onChange={(event) => setAccomplishment(event.target.value)} placeholder="例如：完成了登录页面的表单验证" />
                </label>
              ) : null}
              <label>
                卡在哪 / 这一轮发生了什么
                <textarea rows={3} value={difficultyNote} onChange={(event) => setDifficultyNote(event.target.value)} />
              </label>
              <label>
                下一步准备怎么解决
                <textarea rows={3} value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="例如：先把需要的资料找齐，再开下一轮" />
              </label>
              <button type="submit" className="primary-button">
                记下来，并进入休息时间
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {editingTimelineId ? (() => {
        const entry = todayTimeline.find((e) => e.id === editingTimelineId)
        if (!entry) return null
        const difficulty = entry.type === 'difficulty' ? todayDifficultyRecords.find((r) => r.id === entry.id) : null
        const session = entry.type === 'focus' ? todayFocusSessions.find((s) => s.id === entry.id) : null
        return (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="panel-header">
                <div>
                  <h2>编辑记录</h2>
                  <p>{entry.title}　{dayjs(entry.happenedAt).format('HH:mm')}</p>
                </div>
                <button type="button" className="tiny-button" onClick={() => setEditingTimelineId(null)}>关闭</button>
              </div>
              <div className="stack-form">
                {difficulty ? (
                  <>
                    <label>
                      卡点说明
                      <textarea
                        rows={8}
                        defaultValue={difficulty.note}
                        onBlur={(e) => actions.updateDifficultyRecord(entry.id, { note: e.target.value })}
                      />
                    </label>
                    <label>
                      下一步
                      <textarea
                        rows={6}
                        defaultValue={difficulty.nextAction}
                        onBlur={(e) => actions.updateDifficultyRecord(entry.id, { nextAction: e.target.value })}
                      />
                    </label>
                  </>
                ) : null}
                {session ? (
                  <label>
                    这轮完成了什么
                    <textarea
                      rows={8}
                      defaultValue={session.accomplishment ?? ''}
                      onBlur={(e) => actions.updateFocusSession(entry.id, { accomplishment: e.target.value })}
                    />
                  </label>
                ) : null}
                <button type="button" className="primary-button" onClick={() => setEditingTimelineId(null)}>
                  保存并关闭
                </button>
              </div>
            </div>
          </div>
        )
      })() : null}
    </div>
  )
}

export default App
