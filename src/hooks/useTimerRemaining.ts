import { useEffect, useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import type { ActiveTimer } from '../types'

function getRemainingSeconds(activeTimer: ActiveTimer | null, currentTime: Dayjs = dayjs()): number {
  if (!activeTimer) return 0

  const endAt = dayjs(activeTimer.startedAt).add(activeTimer.durationMinutes, 'minute')
  return Math.max(0, endAt.diff(currentTime, 'second'))
}

export function useTimerRemaining(activeTimer: ActiveTimer | null): number {
  const [currentTime, setCurrentTime] = useState<Dayjs>(() => dayjs())

  useEffect(() => {
    setCurrentTime(dayjs())

    if (!activeTimer) return

    const timerId = window.setInterval(() => {
      setCurrentTime(dayjs())
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [activeTimer?.startedAt, activeTimer?.durationMinutes])

  return useMemo(() => getRemainingSeconds(activeTimer, currentTime), [activeTimer, currentTime])
}
