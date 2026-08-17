import dayjs from 'dayjs'

export function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(totalSeconds, 0)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatDeadline(deadlineDate?: string): string {
  return deadlineDate ? dayjs(deadlineDate).format('M 月 D 日') : ''
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function formatDayLabel(dayKey: string): string {
  const day = dayjs(dayKey)
  return `${day.format('M 月 D 日')} ${WEEKDAYS[day.day()]}`
}

export function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}
