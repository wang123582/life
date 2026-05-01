import dayjs from 'dayjs'
import { difficultyTemplateLabels, stateTemplateLabels } from './defaults'
import type { DailyReview, DifficultyRecord, FocusSession, StateType } from '../types'

export interface CompletedStepSummary {
  taskTitle: string
  stepTitle: string
  completedAt?: string
}

export interface TodayTimelineEntry {
  id: string
  type: 'focus' | 'step' | 'difficulty'
  title: string
  detail: string
  happenedAt: string
}

interface FeishuReportPayload {
  webhookUrl: string
  keyword?: string
  secret?: string
  dayKey: string
  review: DailyReview | null
  completedSteps: CompletedStepSummary[]
  difficulties: DifficultyRecord[]
  focusSessions: FocusSession[]
  commonStateLabel?: string
  communicationDone: boolean
  communicationNote: string
}

interface FeishuConnectionPayload {
  webhookUrl: string
  keyword?: string
  secret?: string
}

type FeishuTextLine = Array<{ tag: 'text'; text: string }>

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
}

async function generateSign(secret: string, timestamp: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${timestamp}\n${secret}`),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(''))
  return toBase64(signature)
}

function createTextLine(text: string): FeishuTextLine {
  return [{ tag: 'text', text }]
}

function buildParagraphs(payload: FeishuReportPayload): FeishuTextLine[] {
  const keywordPrefix = payload.keyword?.trim() ? `${payload.keyword!.trim()}\n` : ''
  const completedStepLines = payload.completedSteps.length > 0
    ? payload.completedSteps.map((step) => `- ${step.taskTitle}｜${step.stepTitle}${step.completedAt ? `（${dayjs(step.completedAt).format('HH:mm')}）` : ''}`)
    : ['- 今天还没有勾掉任何一步。']

  const difficultyLines = payload.difficulties.length > 0
    ? payload.difficulties.slice(0, 8).map((item) => `- ${dayjs(item.createdAt).format('HH:mm')}｜${difficultyTemplateLabels[item.type]}｜${item.note || '未写卡点'}｜下一步：${item.nextAction || '未写'}`)
    : ['- 今天还没有记录困难。']

  const focusLines = payload.focusSessions.length > 0
    ? payload.focusSessions.slice(0, 8).map((session) => `- ${dayjs(session.startedAt).format('HH:mm')} → ${dayjs(session.endedAt).format('HH:mm')}｜${session.status === 'completed' ? '完成' : '中断'}｜${session.plannedMinutes} 分钟`)
    : ['- 今天还没有番茄记录。']

  const review = payload.review
  const reviewLines = [
    `今天完成了什么：${review?.wins || '还没写。'}`,
    `今天失守了什么：${review?.slips || '还没写。'}`,
    `今天最常见的状态：${payload.commonStateLabel || '还没选。'}`,
    `明天第一步：${review?.tomorrow || '还没写。'}`,
  ]

  return [
    createTextLine(`${keywordPrefix}${dayjs(payload.dayKey).format('M 月 D 日')} 今天总结`),
    createTextLine(`交流：${payload.communicationDone ? '已完成' : '未完成'}${payload.communicationNote ? `｜${payload.communicationNote}` : ''}`),
    createTextLine('【今天总结】'),
    ...reviewLines.map((line) => createTextLine(line)),
    createTextLine('【做完的步骤】'),
    ...completedStepLines.map((line) => createTextLine(line)),
    createTextLine('【困难日志】'),
    ...difficultyLines.map((line) => createTextLine(line)),
    createTextLine('【和时钟关联】'),
    ...focusLines.map((line) => createTextLine(line)),
  ]
}

function buildFeishuBody(payload: FeishuReportPayload) {
  return {
    msg_type: 'post' as const,
    content: {
      post: {
        zh_cn: {
          title: `${payload.keyword?.trim() ? `${payload.keyword!.trim()} · ` : ''}${dayjs(payload.dayKey).format('M 月 D 日')} life 日报`,
          content: buildParagraphs(payload),
        },
      },
    },
  }
}

function buildConnectionTestBody(payload: FeishuConnectionPayload) {
  const prefix = payload.keyword?.trim() ? `${payload.keyword!.trim()} ` : ''

  return {
    msg_type: 'text' as const,
    content: {
      text: `${prefix}life 已连接飞书，可以开始同步今天的任务、复盘和困难日志了。`,
    },
  }
}

async function postToFeishu(payload: FeishuConnectionPayload, body: Record<string, unknown>): Promise<void> {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const requestBody = payload.secret?.trim()
    ? {
        timestamp,
        sign: await generateSign(payload.secret.trim(), timestamp),
        ...body,
      }
    : body

  const response = await fetch(payload.webhookUrl.trim(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  const result = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(`飞书返回 ${response.status}`)
  }

  if (result && typeof result === 'object' && 'code' in result && result.code !== 0) {
    throw new Error(typeof result.msg === 'string' ? result.msg : '飞书同步失败')
  }
}

export function buildTodayTimeline(entries: {
  completedSteps: CompletedStepSummary[]
  difficulties: DifficultyRecord[]
  focusSessions: FocusSession[]
}): TodayTimelineEntry[] {
  const stepEntries: TodayTimelineEntry[] = entries.completedSteps
    .filter((step) => step.completedAt)
    .map((step, index) => ({
      id: `step-${index}-${step.completedAt}`,
      type: 'step',
      title: `${step.taskTitle} · 完成一步`,
      detail: step.stepTitle,
      happenedAt: step.completedAt!,
    }))

  const difficultyEntries: TodayTimelineEntry[] = entries.difficulties.map((item) => ({
    id: item.id,
    type: 'difficulty',
    title: difficultyTemplateLabels[item.type],
    detail: `${item.note || '未写卡点'}${item.nextAction ? `｜下一步：${item.nextAction}` : ''}`,
    happenedAt: item.createdAt,
  }))

  const focusEntries: TodayTimelineEntry[] = entries.focusSessions.map((session) => ({
    id: session.id,
    type: 'focus',
    title: `${session.status === 'completed' ? '完成一轮专注' : '专注被中断'}`,
    detail: `${dayjs(session.startedAt).format('HH:mm')} → ${dayjs(session.endedAt).format('HH:mm')}｜${session.plannedMinutes} 分钟`,
    happenedAt: session.endedAt,
  }))

  return [...focusEntries, ...stepEntries, ...difficultyEntries]
    .sort((a, b) => dayjs(b.happenedAt).valueOf() - dayjs(a.happenedAt).valueOf())
}

export function getStateLabel(value: StateType | ''): string {
  if (!value) return ''
  return stateTemplateLabels[value]
}

export async function sendFeishuConnectionTest(payload: FeishuConnectionPayload): Promise<void> {
  await postToFeishu(payload, buildConnectionTestBody(payload))
}

export async function sendTodayReportToFeishu(payload: FeishuReportPayload): Promise<void> {
  await postToFeishu(payload, buildFeishuBody(payload))
}
