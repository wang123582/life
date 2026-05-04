import type { TaskKind } from '../types'

interface ParsedInlineTime {
  cleanTitle: string
  scheduleTime: string
}

const inlineTimePattern = /(?:^|\s)(?<period>今天早上|今天上午|今早|早上|上午|中午|下午|傍晚|晚上|今晚|凌晨)?\s*(?<hour>\d{1,2})(?:(?::|：)(?<minute>\d{2})|点(?<minuteCn>\d{1,2})?分?)$/

function formatScheduleTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function normalizeHour(period: string | undefined, rawHour: number): number {
  if (rawHour < 0 || rawHour > 23) {
    return rawHour
  }

  if (!period) {
    return rawHour
  }

  if ((period === '下午' || period === '傍晚' || period === '晚上' || period === '今晚') && rawHour < 12) {
    return rawHour + 12
  }

  if ((period === '早上' || period === '上午' || period === '今天早上' || period === '今天上午' || period === '今早') && rawHour === 12) {
    return 0
  }

  if (period === '中午') {
    if (rawHour === 0) return 12
    if (rawHour < 11) return rawHour + 12
  }

  if (period === '凌晨' && rawHour === 12) {
    return 0
  }

  return rawHour
}

function parseInlineTime(rawTitle: string): ParsedInlineTime | null {
  const trimmed = rawTitle.trim()
  const matched = trimmed.match(inlineTimePattern)

  if (!matched?.groups) {
    return null
  }

  const rawHour = Number(matched.groups.hour)
  const rawMinute = matched.groups.minute ? Number(matched.groups.minute) : matched.groups.minuteCn ? Number(matched.groups.minuteCn) : 0
  const hour = normalizeHour(matched.groups.period, rawHour)

  if (Number.isNaN(hour) || Number.isNaN(rawMinute) || hour < 0 || hour > 23 || rawMinute < 0 || rawMinute > 59) {
    return null
  }

  const matchedText = matched[0]
  const cleanTitle = trimmed.slice(0, trimmed.length - matchedText.length).trim().replace(/[·•,，;；:：\-—]+$/, '').trim()

  if (!cleanTitle) {
    return null
  }

  return {
    cleanTitle,
    scheduleTime: formatScheduleTime(hour, rawMinute),
  }
}

export function parseQuickTaskInput(rawTitle: string, fallbackKind: TaskKind, fallbackScheduleTime?: string) {
  const explicitScheduleTime = fallbackScheduleTime?.trim()
  const inlineTime = explicitScheduleTime ? null : parseInlineTime(rawTitle)
  const cleanTitle = (inlineTime?.cleanTitle ?? rawTitle).trim()

  return {
    title: cleanTitle,
    kind: inlineTime && fallbackKind === 'normal' ? ('routine' as const) : fallbackKind,
    scheduleTime: explicitScheduleTime || inlineTime?.scheduleTime,
    parsedInlineTime: Boolean(inlineTime),
  }
}
