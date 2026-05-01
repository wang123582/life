import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { difficultyTemplateLabels, encouragementMessages, stateTemplateLabels } from './lib/defaults'
import { buildTodayTimeline, getStateLabel, sendFeishuConnectionTest, sendTodayReportToFeishu } from './lib/feishu'
import type { BeforeInstallPromptEvent } from './lib/pwa'
import { useLifeApp } from './hooks/useLifeApp'
import { useTimerRemaining } from './hooks/useTimerRemaining'
import type { DifficultyType, ReviewInput, StateType, TabKey, TodayItem } from './types'

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'today', label: '今天' },
  { key: 'pool', label: '任务池' },
  { key: 'templates', label: '模板' },
  { key: 'review', label: '复盘' },
]

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
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
  kicker,
  title,
  subtitle,
  actions,
  children,
}: {
  kicker?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="panel">
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
  const { data, dayKey, dayPlan, pendingTodayItems, activeRelaxWindow, todayDifficultyRecords, todayStateRecords, todayFocusSessions, actions } =
    useLifeApp()
  const [activeTab, setActiveTab] = useState<TabKey>('today')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskKind, setTaskKind] = useState<'normal' | 'routine'>('normal')
  const [taskTime, setTaskTime] = useState('')
  const [ruleText, setRuleText] = useState('')
  const [ruleType, setRuleType] = useState<'do' | 'avoid'>('do')
  const [avoidText, setAvoidText] = useState('')
  const [communicationNote, setCommunicationNote] = useState(dayPlan.communicationNote)
  const [stateType, setStateType] = useState<StateType>('distracted')
  const [stateTrigger, setStateTrigger] = useState('')
  const [stateResponse, setStateResponse] = useState('')
  const [stateResult, setStateResult] = useState<'better' | 'same' | 'worse'>('better')
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [expandedTaskId, setExpandedTaskId] = useState<string>('')
  const [showMobileTodayExtras, setShowMobileTodayExtras] = useState(false)
  const [stepInputs, setStepInputs] = useState<Record<string, string>>({})
  const [finishOpen, setFinishOpen] = useState(false)
  const [timerCompleted, setTimerCompleted] = useState(true)
  const [markStepDone, setMarkStepDone] = useState(true)
  const [difficultyType, setDifficultyType] = useState<DifficultyType>('too_big')
  const [difficultyNote, setDifficultyNote] = useState('')
  const [nextAction, setNextAction] = useState('')
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
  const [encouragementIndex, setEncouragementIndex] = useState(0)
  const [contextReminder, setContextReminder] = useState('')
  const [lastReminderKey, setLastReminderKey] = useState('')
  const [lastInteractionAt, setLastInteractionAt] = useState<number>(() => Date.now())
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState<boolean>(() => window.matchMedia('(display-mode: standalone)').matches)
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(() => window.matchMedia('(max-width: 768px)').matches)

  const activeTimer = data.activeTimer
  const remainingSeconds = useTimerRemaining(activeTimer)
  const activeItem = useMemo(
    () => dayPlan.todayItems.find((item) => item.id === activeTimer?.dayItemId),
    [dayPlan.todayItems, activeTimer],
  )
  const activeStep = useMemo(
    () => activeItem?.steps.find((step) => step.id === activeTimer?.stepId),
    [activeItem, activeTimer],
  )
  const primaryTodayItem = pendingTodayItems[0] ?? dayPlan.todayItems[0]
  const primaryStep = primaryTodayItem?.steps.find((step) => !step.isDone)
  const primaryAvoid = dayPlan.avoidItems.find((item) => !item.isDone)?.text ?? data.ruleDefs.find((rule) => rule.type === 'avoid')?.text
  const primaryRule = data.ruleDefs.find((rule) => rule.type === 'do')?.text
  const nextRoutine = dayPlan.todayItems.find((item) => item.kind === 'routine' && !item.isDone)
  const primaryStepLabel = primaryStep?.title ?? '先拆一个最小动作'
  const activeTimerRange = activeTimer
    ? `${dayjs(activeTimer.startedAt).format('HH:mm')} - ${dayjs(activeTimer.startedAt).add(activeTimer.durationMinutes, 'minute').format('HH:mm')}`
    : ''

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
    const firstPendingItem = pendingTodayItems[0]?.id ?? dayPlan.todayItems[0]?.id ?? ''
    setSelectedItemId((prev) => prev || firstPendingItem)
  }, [pendingTodayItems, dayPlan.todayItems])

  useEffect(() => {
    if (!data.settings.encouragementEnabled) return

    const timerId = window.setInterval(() => {
      setEncouragementIndex((prev) => (prev + 1) % encouragementMessages.length)
    }, 15000)

    return () => window.clearInterval(timerId)
  }, [data.settings.encouragementEnabled])

  useEffect(() => {
    if (!activeTimer || remainingSeconds > 0 || finishOpen) return

    setFinishOpen(true)

    if ('Notification' in window && Notification.permission === 'granted') {
      void new Notification('番茄钟结束', {
        body: '先别散掉，记录一下结果和卡点，再决定下一步。',
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
    }
  }, [isMobileLayout])

  useEffect(() => {
    const title = activeTimer
      ? `专注中 ${formatSeconds(remainingSeconds)} · ${activeItem?.title ?? 'life'}`
      : `${primaryTodayItem?.title ?? 'life'} · ${primaryStep?.title ?? '先开始今天的一小步'}`

    document.title = title
  }, [activeTimer, remainingSeconds, activeItem, primaryTodayItem, primaryStep])

  useEffect(() => {
    const emitReminder = (key: string, message: string) => {
      if (lastReminderKey === key) return

      setLastReminderKey(key)
      setContextReminder(message)

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
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [activeTimer, data.taskDefs, dayKey, dayPlan.todayItems, lastInteractionAt, lastReminderKey, primaryStep, primaryTodayItem])

  const summary = {
    total: dayPlan.todayItems.length,
    done: dayPlan.todayItems.filter((item) => item.isDone).length,
    avoidDone: dayPlan.avoidItems.filter((item) => item.isDone).length,
    focusCount: todayFocusSessions.filter((session) => session.status === 'completed').length,
  }

  const selectedItem = dayPlan.todayItems.find((item) => item.id === selectedItemId) ?? dayPlan.todayItems[0]
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

  const handleAddTaskDefinition = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    actions.addTaskDefinition(taskTitle, taskKind, taskKind === 'routine' ? taskTime : undefined)
    setTaskTitle('')
    setTaskTime('')
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

  const handleAddState = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    actions.addStateRecord(stateType, stateTrigger, stateResponse, stateResult)
    setStateTrigger('')
    setStateResponse('')
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
    })
    setFinishOpen(false)
    setTimerCompleted(true)
    setDifficultyNote('')
    setNextAction('')
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
      feishuWebhookUrl: feishuWebhookUrl.trim(),
      feishuKeyword: feishuKeyword.trim(),
      feishuSecret: feishuSecret.trim(),
    })
  }

  const syncTodayToFeishu = async (reviewPayload: typeof dayPlan.review) => {
    const webhookUrl = feishuWebhookUrl.trim()

    if (!webhookUrl) {
      throw new Error('先填飞书群机器人的 webhook 地址。')
    }

    actions.updateSettings({
      feishuWebhookUrl: webhookUrl,
      feishuKeyword: feishuKeyword.trim(),
      feishuSecret: feishuSecret.trim(),
    })

    await sendTodayReportToFeishu({
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
    })
  }

  const handleSaveReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const updatedAt = new Date().toISOString()
    const savedReview = {
      ...reviewForm,
      updatedAt,
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

    try {
      await syncTodayToFeishu(savedReview)
      setReviewSaveStatus('success')
      setReviewSaveMessage('已保存今日复盘，并自动同步到飞书。')
      setFeishuSyncStatus('success')
      setFeishuSyncMessage('已把今天总结、完成步骤和困难日志发到飞书。')
    } catch (error) {
      setReviewSaveStatus('error')
      setReviewSaveMessage(`复盘已保存，但飞书同步失败：${error instanceof Error ? error.message : '请稍后再试。'}`)
      setFeishuSyncStatus('error')
      setFeishuSyncMessage(error instanceof Error ? error.message : '同步飞书失败。')
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

  const handleSyncToFeishu = async () => {
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

      await syncTodayToFeishu(reviewPayload)

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
            <span className="section-kicker">今日主线</span>
            <h1>给自己一个正常的一天</h1>
            <p>先列今天要做的，再拆出最小下一步。卡住了，就把卡点继续拆掉。</p>
            <div className="topbar-tags">
              <span className="topbar-tag">现在最重要：{primaryTodayItem?.title ?? '先挑一个任务'}</span>
              <span className="topbar-tag">下一步：{primaryStepLabel}</span>
              {primaryAvoid ? <span className="topbar-tag warning">不做：{primaryAvoid}</span> : null}
            </div>
          </div>
          <div className="topbar-actions">
            {!isStandalone && installPromptEvent ? (
              <button type="button" className="primary-button" onClick={handleInstallApp}>
                安装到手机桌面
              </button>
            ) : null}
            <button type="button" className="ghost-button" onClick={askNotificationPermission}>
              开启系统提醒
            </button>
            <button type="button" className="ghost-button danger" onClick={actions.resetAll}>
              重置数据
            </button>
          </div>
        </header>

        {activeTimer ? (
          <div className="focus-strip">
            <div>
              <span className="muted-label">专注已经开始</span>
              <strong>
                正在做：{activeItem?.title ?? '当前任务'}
                {activeStep ? ` · ${activeStep.title}` : ''}
              </strong>
              <p>现在是专注中，不用急着结束；先把这一小轮做完。{activeTimerRange ? `这轮时间：${activeTimerRange}` : ''}</p>
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

        {activeTab === 'today' ? (
          <div className="page-grid">
            <div className="column-main">
              <Section
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
                    <button type="button" className="ghost-button" onClick={() => setActiveTab('review')}>
                      晚上记得复盘
                    </button>
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
                kicker="Execution"
                title="今天要做什么"
                subtitle="从任务池拖进今天后，给每个任务至少拆一个最小动作。"
                actions={<span className="muted-label">推荐保留 {data.dailyTemplate.topTaskSlots} 个核心任务</span>}
              >
                <div className="task-list">
                  {dayPlan.todayItems.map((item) => {
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
                                <button
                                  type="button"
                                  className="tiny-button subtle"
                                  onClick={() => actions.startFocusTimer(item.id, step.id)}
                                >
                                  开始这一步
                                </button>
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

                  {dayPlan.todayItems.length === 0 ? <p className="empty-hint">先去任务池挑 1 个任务放进今天吧。</p> : null}
                </div>
              </Section>

              <Section
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
                  {showMobileTodayExtras ? '收起状态、交流和卡点' : '查看状态、交流和卡点'}
                </button>
              </div>
            ) : null}

            <div className={isMobileLayout && !showMobileTodayExtras ? 'column-side mobile-hidden' : 'column-side'}>
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

              <Section kicker="State" title="状态与交流" subtitle="把状态记录和人与人连接放在一个地方，不再分成很多块。">
                <div className="compact-stack">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={dayPlan.communicationDone}
                      onChange={(event) => actions.setCommunication(event.target.checked, communicationNote)}
                    />
                    <span>今天已经主动和一个人认真交流过</span>
                  </label>
                  <textarea
                    value={communicationNote}
                    onChange={(event) => setCommunicationNote(event.target.value)}
                    onBlur={() => actions.setCommunication(dayPlan.communicationDone, communicationNote)}
                    placeholder="记一下你联系了谁，或者准备联系谁。"
                    rows={3}
                  />

                  <form className="stack-form" onSubmit={handleAddState}>
                    <label>
                      当前状态
                      <select value={stateType} onChange={(event) => setStateType(event.target.value as StateType)}>
                        {Object.entries(stateTemplateLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      诱因
                      <input value={stateTrigger} onChange={(event) => setStateTrigger(event.target.value)} placeholder="例如：刷了一会儿手机后停不下来" />
                    </label>
                    <label>
                      应对
                      <input value={stateResponse} onChange={(event) => setStateResponse(event.target.value)} placeholder="例如：先走动 5 分钟再回来" />
                    </label>
                    <div className="inline-grid compact-inline-grid">
                      <label>
                        结果
                        <select value={stateResult} onChange={(event) => setStateResult(event.target.value as 'better' | 'same' | 'worse')}>
                          <option value="better">变好了</option>
                          <option value="same">差不多</option>
                          <option value="worse">更糟了</option>
                        </select>
                      </label>
                      <button type="submit" className="primary-button">
                        记下状态
                      </button>
                    </div>
                  </form>

                  <ul className="log-list compact-log-list">
                    {todayStateRecords.slice(0, 3).map((record) => (
                      <li key={record.id}>
                        <strong>{stateTemplateLabels[record.stateType]}</strong>
                        <span>{record.trigger || '未写诱因'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>

              <Section kicker="Blockers" title="卡在哪里" subtitle="这里专门放你每一轮卡住的位置和下一步，不让它们消失。">
                <ul className="log-list highlight-log-list">
                  {todayDifficultyRecords.length === 0 ? <li>现在还没有卡点记录。</li> : null}
                  {todayDifficultyRecords.slice(0, 4).map((record) => (
                    <li key={record.id}>
                      <strong>{difficultyTemplateLabels[record.type]}</strong>
                      <span>{record.note || '这轮没有写清具体卡点。'}</span>
                      <span>下一步：{record.nextAction || '还没写下一步。'}</span>
                    </li>
                  ))}
                </ul>
              </Section>
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
                    <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="例如：整理简历、洗澡、复盘今天" />
                  </label>
                  <div className="inline-grid">
                    <label>
                      类型
                      <select value={taskKind} onChange={(event) => setTaskKind(event.target.value as 'normal' | 'routine')}>
                        <option value="normal">主动任务</option>
                        <option value="routine">固定生活任务</option>
                      </select>
                    </label>
                    <label>
                      提醒时间（可选）
                      <input value={taskTime} onChange={(event) => setTaskTime(event.target.value)} placeholder="如 21:00" />
                    </label>
                  </div>
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
                            {task.kind === 'routine' ? `固定生活任务 · ${task.scheduleTime ?? '时间待定'}` : '主动任务'}
                          </p>
                        </div>
                        <button type="button" className="primary-button" onClick={() => actions.addTaskToToday(task.id)}>
                          放进今天
                        </button>
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
              </Section>
            </div>
          </div>
        ) : null}

        {activeTab === 'templates' ? (
          <div className="page-grid narrow">
            <div className="column-main">
              <Section title="日 / 周模板" subtitle="固定模板是为了让你不用每天面对空白页面发愣。">
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
                      今日不做条数
                      <input value={dailyAvoids} onChange={(event) => setDailyAvoids(event.target.value)} />
                    </label>
                  </div>
                  <label>
                    今日交流提示
                    <input value={dailyPrompt} onChange={(event) => setDailyPrompt(event.target.value)} />
                  </label>
                  <label>
                    放松窗口分钟数
                    <input value={dailyRelaxMinutes} onChange={(event) => setDailyRelaxMinutes(event.target.value)} />
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
                  <button type="button" className="primary-button" onClick={handleSaveTemplates}>
                    保存模板
                  </button>
                </div>
              </Section>
            </div>

            <div className="column-side">
              <Section title="提醒与干预" subtitle="先做分级干预，别一上来就全硬锁。">
                <div className="stack-form">
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
                    <textarea rows={6} value={blockedTargets} onChange={(event) => setBlockedTargets(event.target.value)} />
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={data.settings.encouragementEnabled}
                      onChange={(event) => actions.updateSettings({ encouragementEnabled: event.target.checked })}
                    />
                    <span>开启鼓励提醒</span>
                  </label>
                </div>
              </Section>

              <Section title="专注黑名单" subtitle="专注时段请先别碰这些。Web 第一版先做提醒和软阻断提示。">
                <div className="chip-list">
                  {data.settings.blockedTargets.map((target) => (
                    <span key={target} className="chip warning">
                      {target}
                    </span>
                  ))}
                </div>
              </Section>

              <Section title="飞书同步" subtitle="把今天总结、做完的步骤和困难日志直接发到你的飞书群机器人。">
                <div className="stack-form">
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
                  <p className="muted">飞书官方更推荐服务端调用，但你这个项目是自用型 Web 第一版，所以这里先做成直连机器人 webhook。</p>
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
              <Section title="和时钟关联" subtitle="今天做了什么、什么时候做完、哪里卡住，按时间直接回看。">
                <ul className="timeline-list">
                  {todayTimeline.length === 0 ? <li className="timeline-empty">今天还没有形成时间线。</li> : null}
                  {todayTimeline.map((entry) => (
                    <li key={entry.id} className={`timeline-item ${entry.type}`}>
                      <span className="timeline-time">{dayjs(entry.happenedAt).format('HH:mm')}</span>
                      <div>
                        <strong>{entry.title}</strong>
                        <p>{entry.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="同步到飞书" subtitle="把今天总结、做完的步骤和困难日志直接发到飞书群里。">
                <div className="stack-form">
                  <button type="button" className="primary-button" onClick={handleSyncToFeishu} disabled={isSyncingFeishu}>
                    {isSyncingFeishu ? '正在同步到飞书…' : '同步今天日志到飞书'}
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
        <div className="floating-timer">
          <div>
            <span className="muted-label">正在专注</span>
            <strong>{formatSeconds(remainingSeconds)}</strong>
            <p>{activeItem?.title ?? '未绑定任务'}</p>
            <p className="muted">{activeStep?.title ?? '先把眼前这一小步做掉。'}</p>
          </div>
          <div className="floating-actions">
            <button type="button" className="ghost-button" onClick={() => setFinishOpen(true)}>
              提前结束并记录
            </button>
            <button type="button" className="ghost-button danger" onClick={actions.cancelTimer}>
              取消本轮
            </button>
          </div>
        </div>
      ) : null}

      {finishOpen && activeTimer ? (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="panel-header">
              <div>
                <h2>这一轮结束了</h2>
                <p>先别飘走，把结果和卡点记下来，再决定下一步。</p>
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
              <label>
                卡在哪 / 这一轮发生了什么
                <textarea rows={3} value={difficultyNote} onChange={(event) => setDifficultyNote(event.target.value)} />
              </label>
              <label>
                下一步准备怎么解决
                <textarea rows={3} value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="例如：先把需要的资料找齐，再开下一轮" />
              </label>
              <button type="submit" className="primary-button">
                记下来，并生成下一步
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
