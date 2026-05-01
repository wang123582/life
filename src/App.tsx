import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { difficultyTemplateLabels, encouragementMessages, stateTemplateLabels } from './lib/defaults'
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

function Section({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
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
  const [reviewForm, setReviewForm] = useState<ReviewInput>({
    wins: dayPlan.review?.wins ?? '',
    slips: dayPlan.review?.slips ?? '',
    commonState: dayPlan.review?.commonState ?? '',
    tomorrow: dayPlan.review?.tomorrow ?? '',
  })
  const [encouragementIndex, setEncouragementIndex] = useState(0)
  const [contextReminder, setContextReminder] = useState('')
  const [lastReminderKey, setLastReminderKey] = useState('')
  const [lastInteractionAt, setLastInteractionAt] = useState<number>(() => Date.now())
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState<boolean>(() => window.matchMedia('(display-mode: standalone)').matches)

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

  const startTask = (item: TodayItem) => {
    const firstPendingStep = item.steps.find((step) => !step.isDone)
    actions.startFocusTimer(item.id, firstPendingStep?.id)
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
    })
  }

  const handleSaveReview = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    actions.saveReview(reviewForm)
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
          <div>
            <h1>给自己一个正常的一天</h1>
            <p>先列今天要做的，再拆出最小下一步。卡住了，就把卡点继续拆掉。</p>
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
              <Section title="今天的板子" subtitle="今天最重要的三件事、生活节奏和与人的联系，都放在这里。">
                <div className="goal-banner">
                  <div>
                    <span className="muted-label">当前目标锚点</span>
                    <h3>{primaryTodayItem?.title ?? data.weeklyTemplate.directions[0] ?? '先从任务池挑一个任务放进今天'}</h3>
                    <p>
                      下一步：{primaryStep?.title ?? '先拆一个最小动作'}
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
                title="今天要做什么"
                subtitle="从任务池拖进今天后，给每个任务至少拆一个最小动作。"
                actions={<span className="muted-label">推荐保留 {data.dailyTemplate.topTaskSlots} 个核心任务</span>}
              >
                <div className="task-list">
                  {dayPlan.todayItems.map((item) => {
                    const firstPendingStep = item.steps.find((step) => !step.isDone)
                    return (
                      <article key={item.id} className={item.id === selectedItemId ? 'task-card selected' : 'task-card'}>
                        <div className="task-card-top">
                          <button type="button" className="task-title-button" onClick={() => setSelectedItemId(item.id)}>
                            <span className={item.isDone ? 'task-title done' : 'task-title'}>{item.title}</span>
                            <span className="pill">{item.kind === 'routine' ? '生活任务' : '主动任务'}</span>
                          </button>
                          <div className="task-card-actions">
                            <button type="button" className="tiny-button" onClick={() => actions.moveTodayItem(item.id, -1)}>
                              ↑
                            </button>
                            <button type="button" className="tiny-button" onClick={() => actions.moveTodayItem(item.id, 1)}>
                              ↓
                            </button>
                            <button type="button" className="tiny-button" onClick={() => actions.toggleTodayItemDone(item.id)}>
                              {item.isDone ? '取消完成' : '完成'}
                            </button>
                            <button type="button" className="tiny-button danger" onClick={() => actions.removeTodayItem(item.id)}>
                              移出今天
                            </button>
                          </div>
                        </div>

                        {item.steps.length > 0 ? (
                          <ul className="step-list">
                            {item.steps.map((step) => (
                              <li key={step.id} className="step-item">
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={step.isDone}
                                    onChange={() => actions.toggleStepDone(item.id, step.id)}
                                  />
                                  <span className={step.isDone ? 'done' : ''}>{step.title}</span>
                                </label>
                                <button
                                  type="button"
                                  className="tiny-button"
                                  onClick={() => actions.startFocusTimer(item.id, step.id)}
                                >
                                  只做这一步
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="empty-hint">先给这个任务拆一个最小动作，再开始番茄钟。</p>
                        )}

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
                            <button type="submit">拆一小步</button>
                          </form>
                          <button type="button" className="primary-button" onClick={() => startTask(item)}>
                            开始 25 分钟专注
                            {firstPendingStep ? ` · ${firstPendingStep.title}` : ''}
                          </button>
                        </div>
                      </article>
                    )
                  })}

                  {dayPlan.todayItems.length === 0 ? <p className="empty-hint">先去任务池挑 1 个任务放进今天吧。</p> : null}
                </div>
              </Section>

              <Section title="今天不做什么" subtitle="给自己划边界，别让今天又被同样的东西吃掉。">
                <form className="inline-form" onSubmit={handleAddAvoid}>
                  <input value={avoidText} onChange={(event) => setAvoidText(event.target.value)} placeholder="例如：专注时段不刷短视频" />
                  <button type="submit">加入不做清单</button>
                </form>
                <div className="chip-list">
                  {dayPlan.avoidItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.isDone ? 'chip active' : 'chip'}
                      onClick={() => actions.toggleAvoidDone(item.id)}
                    >
                      {item.isDone ? '已守住 · ' : ''}
                      {item.text}
                    </button>
                  ))}
                </div>
              </Section>
            </div>

            <div className="column-side">
              <Section title="最小下一步" subtitle="只盯住下一步，别试图一口吞完。">
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
              </Section>

              <Section title="状态记录" subtitle="看见自己最常掉进什么状态，才能知道怎么拉回来。">
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
                  <label>
                    结果
                    <select value={stateResult} onChange={(event) => setStateResult(event.target.value as 'better' | 'same' | 'worse')}>
                      <option value="better">变好了</option>
                      <option value="same">差不多</option>
                      <option value="worse">更糟了</option>
                    </select>
                  </label>
                  <button type="submit" className="primary-button">
                    记下这次状态
                  </button>
                </form>
                <ul className="log-list">
                  {todayStateRecords.slice(0, 4).map((record) => (
                    <li key={record.id}>
                      <strong>{stateTemplateLabels[record.stateType]}</strong>
                      <span>{record.trigger || '未写诱因'}</span>
                      <span>应对：{record.response || '未写'}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="与人交流" subtitle={data.dailyTemplate.communicationPrompt}>
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
              </Section>

              <Section title="放松窗口" subtitle="奖励的是一个有效闭环，不是刷水任务。">
                {activeRelaxWindow ? (
                  <div className="relax-card">
                    <strong>已解锁 {activeRelaxWindow.minutes} 分钟放松</strong>
                    <p>{activeRelaxWindow.recommendation}</p>
                    <p>截止：{dayjs(activeRelaxWindow.expiresAt).format('HH:mm')}</p>
                    <button type="button" className="primary-button" onClick={() => actions.consumeRelaxWindow(activeRelaxWindow.id)}>
                      我现在去放松一下
                    </button>
                  </div>
                ) : (
                  <p className="empty-hint">完成一个有效番茄钟或一个任务闭环后，会在这里解锁放松窗口。</p>
                )}
              </Section>

              <Section title="下一条生活提醒" subtitle="先守住生活骨架，再谈效率。">
                <p className="focus-title">{nextRoutine?.title ?? '今天的固定生活任务都已经处理过了。'}</p>
                <p className="muted">
                  {nextRoutine?.sourceTaskId
                    ? `提醒时间：${data.taskDefs.find((task) => task.id === nextRoutine.sourceTaskId)?.scheduleTime ?? '未设置'}`
                    : '如果你还没吃饭、休息或联系人，可以现在补一项。'}
                </p>
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
                  <button type="submit" className="primary-button">
                    保存今日复盘
                  </button>
                </form>
              </Section>
            </div>

            <div className="column-side">
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
              结束并记录
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
