import { buildReportPreviewText, getStateLabel, sendFeishuPlainText } from './feishu'
import type { AppSettings, LifeAppData } from '../types'

/** 过程笔记存的是富文本 HTML，发到飞书前先转成纯文本。 */
export function notesToPlainText(html: string): string {
  if (!html.trim()) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|pre)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '· ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 把某一天的所有记录拼成飞书报文文本；今天和历史补交共用这一份逻辑。 */
export function buildDayReport(data: LifeAppData, dayKey: string): string {
  const plan = data.dayPlans[dayKey]

  const completedSteps = (plan?.todayItems ?? []).flatMap((item) =>
    item.steps
      .filter((step) => step.isDone)
      .map((step) => ({ taskTitle: item.title, stepTitle: step.title, completedAt: step.completedAt })),
  )

  return buildReportPreviewText({
    webhookUrl: data.settings.feishuWebhookUrl,
    keyword: data.settings.feishuKeyword,
    secret: data.settings.feishuSecret,
    dayKey,
    review: plan?.review ?? null,
    completedSteps,
    difficulties: data.difficultyRecords.filter((record) => record.dayKey === dayKey),
    focusSessions: data.focusSessions.filter((session) => session.dayKey === dayKey),
    commonStateLabel: getStateLabel(plan?.review?.commonState ?? ''),
    communicationDone: plan?.communicationDone ?? false,
    communicationNote: plan?.communicationNote ?? '',
    processNotes: notesToPlainText(plan?.processNotes ?? ''),
  })
}

export async function sendDayReport(settings: AppSettings, data: LifeAppData, dayKey: string): Promise<void> {
  const webhookUrl = settings.feishuWebhookUrl.trim()

  if (!webhookUrl) {
    throw new Error('先在设置里填飞书群机器人的 webhook 地址。')
  }

  await sendFeishuPlainText(
    { webhookUrl, keyword: settings.feishuKeyword.trim(), secret: settings.feishuSecret.trim() },
    buildDayReport(data, dayKey),
  )
}
