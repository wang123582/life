import { useCallback, useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { playAlarmSound, playReminderSound } from '../lib/alarm'
import { canUseFocusLock, getFocusLockStatus, openFocusLockAccessibilitySettings, saveFocusLockConfig } from '../lib/focusLock'
import {
  canUseNativeTimer,
  checkExactAlarmAccess,
  clearFocusTimerNotification,
  clearRoutineReminderNotifications,
  ensureNativeTimerPermission,
  openExactAlarmSettings,
  scheduleFocusTimerNotification,
  syncEveningReminders,
  syncRoutineReminderNotifications,
} from '../lib/mobileTimer'
import type { BeforeInstallPromptEvent } from '../lib/pwa'
import { sendDayReport } from '../lib/report'
import { formatSeconds } from '../ui/format'
import { useTimerRemaining } from '../hooks/useTimerRemaining'
import type { LifeApp } from '../hooks/useLifeApp'

export type FlashTone = 'info' | 'success' | 'warning'

export interface Flash {
  message: string
  tone: FlashTone
}

const MOBILE_QUERY = '(max-width: 900px)'

/**
 * 应用级副作用集中处：通知权限、原生提醒、应用锁、标题、空转提醒、飞书定时提交。
 * 视图组件只消费这里返回的状态，不再各自持有一堆定时器。
 */
export function useAppRuntime(life: LifeApp, options: { onFocusTimerEnded: () => void; finishDialogOpen: boolean }) {
  const { data, dayKey, dayPlan, actions } = life
  const { settings } = data
  const activeTimer = data.activeTimer

  const [isMobile, setIsMobile] = useState<boolean>(() => window.matchMedia(MOBILE_QUERY).matches)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [reminder, setReminder] = useState('')
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState<boolean>(() => window.matchMedia('(display-mode: standalone)').matches)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    'Notification' in window ? Notification.permission : 'unsupported',
  )
  const [nativeMessage, setNativeMessage] = useState('')
  const [nativeStatus, setNativeStatus] = useState<'success' | 'error' | ''>('')
  const [lockServiceEnabled, setLockServiceEnabled] = useState(false)
  const [lockMessage, setLockMessage] = useState('')
  const [lockStatus, setLockStatus] = useState<'success' | 'error' | ''>('')
  const [autoFeishuMessage, setAutoFeishuMessage] = useState('')
  const [autoFeishuStatus, setAutoFeishuStatus] = useState<'success' | 'error' | ''>('')

  const lastReminderKeyRef = useRef('')
  const lastInteractionRef = useRef(Date.now())
  const scheduledFeishuRef = useRef('')

  const notify = useCallback((message: string, tone: FlashTone = 'info') => {
    setFlash({ message, tone })
  }, [])

  const nativeAvailable = canUseNativeTimer()
  const lockAvailable = canUseFocusLock()
  const desktopSupported = permission !== 'unsupported'
  const desktopActive = desktopSupported && permission === 'granted' && settings.desktopNotificationsEnabled

  const pushDesktop = useCallback(
    (title: string, body: string, force = false) => {
      if (!settings.desktopNotificationsEnabled) return
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      if (!force && document.visibilityState === 'visible' && document.hasFocus()) return
      void new Notification(title, { body })
    },
    [settings.desktopNotificationsEnabled],
  )

  const requestDesktopPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setPermission('unsupported')
      notify('当前浏览器不支持电脑消息提醒。', 'warning')
      return 'unsupported' as const
    }

    const result = await Notification.requestPermission()
    setPermission(result)

    if (result === 'granted') {
      actions.updateSettings({ desktopNotificationsEnabled: true })
      notify('电脑消息提醒已开启。', 'success')
    } else if (result === 'denied') {
      notify('浏览器拦截了消息提醒，可在地址栏旁重新允许。', 'warning')
    }

    return result
  }, [actions, notify])

  const testDesktopNotification = useCallback(async () => {
    const result = permission === 'granted' ? 'granted' : await requestDesktopPermission()
    if (result !== 'granted') return

    if (!settings.desktopNotificationsEnabled) {
      actions.updateSettings({ desktopNotificationsEnabled: true })
    }

    pushDesktop('life 提醒测试', '看到这条，说明番茄结束和固定提醒都会这样弹出来。', true)
    notify('已发送一条提醒测试。', 'success')
  }, [actions, notify, permission, pushDesktop, requestDesktopPermission, settings.desktopNotificationsEnabled])

  // ---- 布局 / 安装 / 权限 -------------------------------------------------
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    setIsMobile(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstallEvent(null)
      setIsStandalone(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    const sync = () => setPermission('Notification' in window ? Notification.permission : 'unsupported')
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  useEffect(() => {
    const onActivity = () => {
      lastInteractionRef.current = Date.now()
    }
    window.addEventListener('pointerdown', onActivity)
    window.addEventListener('keydown', onActivity)
    window.addEventListener('focus', onActivity)
    return () => {
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
      window.removeEventListener('focus', onActivity)
    }
  }, [])

  useEffect(() => {
    if (!flash) return
    const timerId = window.setTimeout(() => setFlash(null), 2600)
    return () => window.clearTimeout(timerId)
  }, [flash])

  // ---- 外观：强调色 + 明暗 ------------------------------------------------
  useEffect(() => {
    document.documentElement.dataset.accent = settings.theme || 'default'
    const appearance = settings.appearance ?? 'auto'

    if (appearance === 'auto') {
      delete document.documentElement.dataset.mode
    } else {
      document.documentElement.dataset.mode = appearance
    }
  }, [settings.theme, settings.appearance])

  // ---- 计时：秒数由 useTimerRemaining 统一推进，供状态条和悬浮计时器共用 --
  const remainingSeconds = useTimerRemaining(activeTimer)

  useEffect(() => {
    document.title = activeTimer
      ? `${activeTimer.mode === 'shortBreak' ? '休息' : '专注'} ${formatSeconds(remainingSeconds)} · life`
      : 'life'
  }, [activeTimer, remainingSeconds])

  const { onFocusTimerEnded, finishDialogOpen } = options

  useEffect(() => {
    if (!activeTimer || remainingSeconds > 0) return

    if (activeTimer.mode === 'shortBreak') {
      actions.finishBreakTimer()
      notify('休息结束了，回来继续下一轮。', 'success')
      pushDesktop('休息结束', '休息差不多了，回来继续推进今天最重要的事。', true)
      return
    }

    if (finishDialogOpen) return

    onFocusTimerEnded()
    playAlarmSound()
    pushDesktop('番茄钟结束', '先记一下结果，然后去休息一会儿。', true)
  }, [actions, activeTimer, finishDialogOpen, notify, onFocusTimerEnded, pushDesktop, remainingSeconds])

  // ---- 原生提醒 / 应用锁 --------------------------------------------------
  useEffect(() => {
    if (!settings.mobileTimerEnabled || !activeTimer || !nativeAvailable) {
      void clearFocusTimerNotification()
      return
    }

    void scheduleFocusTimerNotification({
      endsAt: dayjs(activeTimer.startedAt).add(activeTimer.durationMinutes, 'minute').toDate(),
      title: activeTimer.mode === 'shortBreak' ? 'life 休息提醒' : 'life 专注提醒',
      body: activeTimer.mode === 'shortBreak' ? '休息结束了，回来继续下一轮。' : '这一轮结束了，回来记录结果和下一步。',
    })
  }, [activeTimer, nativeAvailable, settings.mobileTimerEnabled])

  useEffect(() => {
    if (!settings.mobileTimerEnabled || !nativeAvailable) {
      void clearRoutineReminderNotifications()
      return
    }

    void syncRoutineReminderNotifications(
      data.taskDefs.filter((task) => task.kind === 'routine' && Boolean(task.scheduleTime?.trim())),
    )
  }, [data.taskDefs, nativeAvailable, settings.mobileTimerEnabled])

  useEffect(() => {
    if (!nativeAvailable) return

    void syncEveningReminders({
      reviewReminderEnabled: settings.reviewReminderEnabled,
      reviewReminderTime: settings.reviewReminderTime,
      hardStopEnabled: settings.hardStopEnabled,
      hardStopTime: settings.hardStopTime,
    })
  }, [
    nativeAvailable,
    settings.hardStopEnabled,
    settings.hardStopTime,
    settings.reviewReminderEnabled,
    settings.reviewReminderTime,
  ])

  useEffect(() => {
    if (!lockAvailable) {
      setLockServiceEnabled(false)
      return
    }
    void getFocusLockStatus().then((status) => setLockServiceEnabled(status.serviceEnabled))
  }, [lockAvailable])

  useEffect(() => {
    const focusing = Boolean(activeTimer && activeTimer.mode === 'focus')

    void saveFocusLockConfig({
      enabled: settings.appLockEnabled,
      active: settings.appLockEnabled && settings.blockerLevel !== 'light' && focusing,
      untilTimestamp: activeTimer ? dayjs(activeTimer.startedAt).add(activeTimer.durationMinutes, 'minute').valueOf() : 0,
      blockedTargets: settings.blockedTargets,
    })
  }, [activeTimer, settings.appLockEnabled, settings.blockedTargets, settings.blockerLevel])

  // ---- 情境提醒：固定生活任务 / 早晚节点 / 空转 --------------------------
  const primaryPending = life.pendingTodayItems.find((item) => item.kind !== 'routine')

  useEffect(() => {
    const emit = (key: string, message: string) => {
      if (lastReminderKeyRef.current === key) return
      lastReminderKeyRef.current = key
      setReminder(message)
      playReminderSound()
      pushDesktop('life 提醒你一下', message)
    }

    const intervalId = window.setInterval(() => {
      const hhmm = dayjs().format('HH:mm')
      const idleTooLong = Date.now() - lastInteractionRef.current > 10 * 60 * 1000
      const routine = data.taskDefs.find(
        (task) =>
          task.kind === 'routine' &&
          task.scheduleTime === hhmm &&
          !dayPlan.todayItems.find((item) => item.sourceTaskId === task.id && item.isDone),
      )

      if (routine) {
        emit(`routine-${dayKey}-${routine.id}-${hhmm}`, `到 ${routine.title} 了，先把生活的骨架守住。`)
        return
      }

      if (hhmm === '09:00') {
        emit(`morning-${dayKey}`, `别空着开始今天。先回到：${primaryPending?.title ?? '挑一件事放进今天'}。`)
        return
      }

      if (hhmm === '22:00') {
        emit(`night-${dayKey}`, '快到收尾时间了，去复盘一下今天，顺手写明天第一步。')
        return
      }

      if (!activeTimer && idleTooLong && primaryPending) {
        emit(`idle-${dayKey}-${Math.floor(Date.now() / (10 * 60 * 1000))}`, `你刚才停住了，回到：${primaryPending.title}。`)
      }
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [activeTimer, data.taskDefs, dayKey, dayPlan.todayItems, primaryPending, pushDesktop])

  // ---- 飞书定时提交 -------------------------------------------------------
  useEffect(() => {
    if (!settings.feishuScheduledSyncEnabled || !settings.feishuWebhookUrl.trim()) return

    const check = () => {
      const scheduledTime = settings.feishuScheduledSyncTime || '12:00'

      if (dayjs().format('HH:mm') < scheduledTime) return
      if (settings.feishuLastScheduledSyncDayKey === dayKey) return
      if (scheduledFeishuRef.current === dayKey) return

      scheduledFeishuRef.current = dayKey

      void sendDayReport(settings, data, dayKey)
        .then(() => {
          actions.updateSettings({ feishuLastScheduledSyncDayKey: dayKey })
          setAutoFeishuStatus('success')
          setAutoFeishuMessage(`已在 ${dayjs().format('HH:mm')} 自动把今天进展发到飞书。`)
          notify('已自动提交飞书。', 'success')
        })
        .catch((error: unknown) => {
          setAutoFeishuStatus('error')
          setAutoFeishuMessage(
            `到 ${scheduledTime} 了，但自动同步飞书失败：${error instanceof Error ? error.message : '请稍后再试。'}`,
          )
        })
    }

    check()
    const intervalId = window.setInterval(check, 30000)
    return () => window.clearInterval(intervalId)
    // data 每次改动都会变，放进依赖会让定时器不停重建；这里只在配置或日期变化时重挂。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dayKey,
    settings.feishuScheduledSyncEnabled,
    settings.feishuScheduledSyncTime,
    settings.feishuWebhookUrl,
    settings.feishuLastScheduledSyncDayKey,
  ])

  // ---- 对外动作 -----------------------------------------------------------
  const enableNativeTimer = useCallback(async () => {
    const granted = await ensureNativeTimerPermission()

    if (!granted) {
      setNativeStatus('error')
      setNativeMessage('没有拿到手机提醒权限，计时只能停留在应用页面里。')
      return
    }

    const scheduled = await syncRoutineReminderNotifications(
      data.taskDefs.filter((task) => task.kind === 'routine' && Boolean(task.scheduleTime?.trim())),
    )
    const exact = await checkExactAlarmAccess()

    actions.updateSettings({ mobileTimerEnabled: true })
    setNativeStatus('success')
    setNativeMessage(
      scheduled > 0
        ? `已拿到提醒权限，并同步了 ${scheduled} 条固定生活提醒。${exact === 'granted' ? '系统精确提醒也已开启。' : '想更准时，可以再打开系统闹钟设置。'}`
        : '已拿到提醒权限。锁屏时番茄钟结束也会提醒你。',
    )
  }, [actions, data.taskDefs])

  const testNativeTimer = useCallback(async () => {
    const granted = await ensureNativeTimerPermission()

    if (!granted) {
      setNativeStatus('error')
      setNativeMessage('测试失败：还没有拿到手机提醒权限。')
      return
    }

    await scheduleFocusTimerNotification({
      endsAt: dayjs().add(15, 'second').toDate(),
      title: 'life 测试提醒',
      body: '15 秒后收到这条，说明手机原生提醒可用。',
    })

    setNativeStatus('success')
    setNativeMessage('已安排一条 15 秒后的测试提醒，锁屏也能测。')
  }, [])

  const openSystemAlarmSettings = useCallback(async () => {
    const granted = await openExactAlarmSettings()
    setNativeStatus(granted ? 'success' : 'error')
    setNativeMessage(granted ? '系统精确提醒已开启。' : '已打开系统提醒设置，把精确提醒打开后固定任务会更准时。')
  }, [])

  const openLockSettings = useCallback(async () => {
    await openFocusLockAccessibilitySettings()
    setLockStatus('success')
    setLockMessage('已打开安卓无障碍设置。打开 life 的应用锁定服务后，回来点一次「检查状态」。')
  }, [])

  const checkLockStatus = useCallback(async () => {
    const status = await getFocusLockStatus()
    setLockServiceEnabled(status.serviceEnabled)
    setLockStatus(status.serviceEnabled ? 'success' : 'error')
    setLockMessage(
      status.serviceEnabled ? '应用锁定服务已开启，专注时打开黑名单应用会被拉回 life。' : '还没开启应用锁定服务。',
    )
  }, [])

  const promptInstall = useCallback(async () => {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
  }, [installEvent])

  const desktopStatusText = !desktopSupported
    ? '当前浏览器不支持消息提醒。'
    : permission === 'granted'
      ? settings.desktopNotificationsEnabled
        ? '电脑消息提醒已开启。'
        : '浏览器已授权，但你在应用里关掉了电脑提醒。'
      : permission === 'denied'
        ? '浏览器已拒绝提醒，需要在站点权限里重新允许。'
        : '还没拿到电脑消息提醒权限。'

  const dismissReminder = useCallback(() => setReminder(''), [])

  return {
    isMobile,
    remainingSeconds,
    flash,
    notify,
    reminder,
    dismissReminder,
    desktop: {
      supported: desktopSupported,
      active: desktopActive,
      permission,
      statusText: desktopStatusText,
      request: requestDesktopPermission,
      test: testDesktopNotification,
    },
    install: { available: !isStandalone && Boolean(installEvent), prompt: promptInstall },
    native: {
      available: nativeAvailable,
      status: nativeStatus,
      message: nativeMessage,
      enable: enableNativeTimer,
      test: testNativeTimer,
      openSystemAlarmSettings,
    },
    focusLock: {
      available: lockAvailable,
      serviceEnabled: lockServiceEnabled,
      status: lockStatus,
      message: lockMessage,
      openSettings: openLockSettings,
      check: checkLockStatus,
    },
    autoFeishu: { status: autoFeishuStatus, message: autoFeishuMessage },
  }
}

export type AppRuntime = ReturnType<typeof useAppRuntime>
