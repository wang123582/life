import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import type { ActiveTimer } from '../types'

function getRemainingSeconds(activeTimer: ActiveTimer | null): number {
  if (!activeTimer) return 0

  const endAt = dayjs(activeTimer.startedAt).add(activeTimer.durationMinutes, 'minute')
  return Math.max(0, endAt.diff(dayjs(), 'second'))
}

export function useTimerRemaining(activeTimer: ActiveTimer | null): number {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => getRemainingSeconds(activeTimer))

  useEffect(() => {
    setRemainingSeconds(getRemainingSeconds(activeTimer))

    if (!activeTimer) return

    const timerId = window.setInterval(() => {
      setRemainingSeconds(getRemainingSeconds(activeTimer))
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [activeTimer])

  return remainingSeconds
}
