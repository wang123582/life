import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { dayPlanHasRecord, difficultyTemplateLabels, stateTemplateLabels } from '../lib/defaults'
import { buildTodayTimeline } from '../lib/feishu'
import { sendDayReport } from '../lib/report'
import { buildProgressSummary } from '../lib/stats'
import { Empty, Field, Fold, Modal, Note, Section, Stat } from '../ui/primitives'
import type { ViewProps } from './types'
import type { ReviewInput, StateType } from '../types'

type HistoryFilter = 'all' | 'review' | 'focus' | 'difficulty' | 'notes'

function emptyForm(review: ViewProps['life']['dayPlan']['review'], slots: number): ReviewInput {
  return {
    wins: review?.wins ?? '',
    slips: review?.slips ?? '',
    commonState: review?.commonState ?? '',
    tomorrow: review?.tomorrow ?? '',
    tomorrowTop3: review?.tomorrowTop3 ?? Array(slots).fill(''),
    tomorrowTop3Steps: review?.tomorrowTop3Steps ?? Array(slots).fill(''),
    moodScore: review?.moodScore,
  }
}

export function ReviewView({ life, runtime }: ViewProps) {
  const { data, dayKey, dayPlan, todayDifficultyRecords, todayFocusSessions, actions } = life
  const slots = data.dailyTemplate.topTaskSlots

  const [form, setForm] = useState<ReviewInput>(() => emptyForm(dayPlan.review, slots))
  const [saving, setSaving] = useState(false)
  const [saveNote, setSaveNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [historyQuery, setHistoryQuery] = useState('')
  const [historySyncing, setHistorySyncing] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    setForm(emptyForm(dayPlan.review, slots))
  }, [dayPlan.review, slots])

  const progress = useMemo(() => buildProgressSummary(data, 30), [data])

  const timeline = useMemo(() => {
    const completedSteps = dayPlan.todayItems.flatMap((item) =>
      item.steps.filter((step) => step.isDone).map((step) => ({ taskTitle: item.title, stepTitle: step.title, completedAt: step.completedAt })),
    )
    return buildTodayTimeline({ completedSteps, difficulties: todayDifficultyRecords, focusSessions: todayFocusSessions }).slice(0, 20)
  }, [dayPlan.todayItems, todayDifficultyRecords, todayFocusSessions])

  const historyDays = useMemo(
    () =>
      Object.entries(data.dayPlans)
        .filter(([key]) => key <= dayKey && dayPlanHasRecord(data, key))
        .sort(([left], [right]) => (left > right ? -1 : 1))
        .map(([key, plan]) => ({
          key,
          plan,
          difficulties: data.difficultyRecords.filter((record) => record.dayKey === key),
          sessions: data.focusSessions.filter((session) => session.dayKey === key),
        })),
    [data, dayKey],
  )

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase()

    return historyDays.filter(({ plan, difficulties, sessions }) => {
      const matches =
        historyFilter === 'all' ||
        (historyFilter === 'review' && Boolean(plan.review)) ||
        (historyFilter === 'focus' && sessions.length > 0) ||
        (historyFilter === 'difficulty' && difficulties.length > 0) ||
        (historyFilter === 'notes' && Boolean(plan.processNotes?.trim()))

      if (!matches) return false
      if (!query) return true

      return [plan.review?.wins, plan.review?.slips, plan.review?.tomorrow, plan.processNotes, ...difficulties.map((d) => `${d.note} ${d.nextAction}`), ...sessions.map((s) => s.accomplishment ?? '')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [historyDays, historyFilter, historyQuery])

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setSaveNote(null)
    actions.saveReview(form)

    if (!data.settings.feishuAutoSyncReview) {
      setSaveNote({ tone: 'success', text: '已保存。' })
      setSaving(false)
      return
    }

    try {
      await sendDayReport(data.settings, data, dayKey)
      actions.updateSettings({ feishuLastScheduledSyncDayKey: dayKey })
      setSaveNote({ tone: 'success', text: '已保存，并同步到飞书。' })
    } catch (error) {
      setSaveNote({ tone: 'error', text: `已保存，但飞书同步失败：${error instanceof Error ? error.message : '稍后再试。'}` })
    } finally {
      setSaving(false)
    }
  }

  const sendDay = async (target: string) => {
    setSending(true)
    setHistorySyncing(target)

    try {
      await sendDayReport(data.settings, data, target)
      if (target === dayKey) actions.updateSettings({ feishuLastScheduledSyncDayKey: dayKey })
      runtime.notify(`${target} 已发到飞书。`, 'success')
    } catch (error) {
      runtime.notify(error instanceof Error ? error.message : '同步飞书失败。', 'warning')
    } finally {
      setSending(false)
      setHistorySyncing('')
    }
  }

  const entry = timeline.find((item) => item.id === editingId)
  const difficulty = entry?.type === 'difficulty' ? todayDifficultyRecords.find((record) => record.id === editingId) : null
  const session = entry?.type === 'focus' ? todayFocusSessions.find((item) => item.id === editingId) : null
  const anchors = dayPlan.todayItems.filter((item) => item.kind === 'normal').slice(0, data.dailyTemplate.topTaskSlots)

  return (
    <>
      <Section title="今天怎么样">
        <div className="stats">
          <Stat label="连续打卡" value={`${progress.currentStreak} 天`} />
          <Stat label="本周完成率" value={`${Math.round(progress.weeklyCompletionRate * 100)}%`} />
          <Stat label="今天完成" value={`${anchors.filter((item) => item.isDone).length}/${anchors.length}`} />
          <Stat label="专注" value={`${todayFocusSessions.filter((item) => item.status === 'completed').length} 轮`} />
        </div>
        <div className="heat" aria-label="近 30 天">
          {progress.days.map((day) => {
            const level = day.doneCount === 0 && day.focusCount === 0 ? 0 : day.doneCount >= 3 ? 3 : day.doneCount >= 1 ? 2 : 1
            return <span key={day.dayKey} className={`c l${level}`} title={`${day.dayKey}：完成 ${day.doneCount}/${day.totalCount}，专注 ${day.focusCount}`} />
          })}
        </div>
      </Section>

      <Section
        title="复盘"
        actions={
          <button type="button" className="link" onClick={() => void sendDay(dayKey)} disabled={sending}>
            {sending ? '发送中…' : '发到飞书'}
          </button>
        }
      >
        <form className="stack" onSubmit={save}>
          <Field label="今天完成了什么">
            <textarea rows={3} value={form.wins} onChange={(event) => setForm((prev) => ({ ...prev, wins: event.target.value }))} />
          </Field>
          <Field label="今天失守了什么">
            <textarea rows={3} value={form.slips} onChange={(event) => setForm((prev) => ({ ...prev, slips: event.target.value }))} />
          </Field>

          <div className="pair">
            <Field label="最常进入的状态">
              <select value={form.commonState} onChange={(event) => setForm((prev) => ({ ...prev, commonState: event.target.value as StateType | '' }))}>
                <option value="">暂不选择</option>
                {Object.entries(stateTemplateLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="状态评分">
              <div className="mood">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    className={form.moodScore === score ? 'on' : undefined}
                    onClick={() => setForm((prev) => ({ ...prev, moodScore: score as 1 | 2 | 3 | 4 | 5 }))}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {anchors.length > 0 ? (
            <ul className="check-list">
              {anchors.map((item) => (
                <li key={item.id} className={item.isDone ? 'done' : undefined}>
                  {item.isDone ? '✓' : '○'} {item.title}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="stack">
            <span className="label">
              明天这一件事<em>顺手写第一步，明早确认即用</em>
            </span>
            {Array.from({ length: slots }, (_, index) => index).map((index) => (
              <div key={index} className="pair tight">
                <input
                  value={form.tomorrowTop3?.[index] ?? ''}
                  placeholder="是什么"
                  onChange={(event) =>
                    setForm((prev) => {
                      const next = [...(prev.tomorrowTop3 ?? ['', '', ''])]
                      next[index] = event.target.value
                      return { ...prev, tomorrowTop3: next }
                    })
                  }
                />
                <input
                  value={form.tomorrowTop3Steps?.[index] ?? ''}
                  placeholder="第一步（可选）"
                  onChange={(event) =>
                    setForm((prev) => {
                      const next = [...(prev.tomorrowTop3Steps ?? ['', '', ''])]
                      next[index] = event.target.value
                      return { ...prev, tomorrowTop3Steps: next }
                    })
                  }
                />
              </div>
            ))}
          </div>

          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? '保存中…' : '保存复盘'}
          </button>
          {saveNote ? <Note tone={saveNote.tone}>{saveNote.text}</Note> : null}
          {runtime.autoFeishu.message ? <Note tone={runtime.autoFeishu.status === 'error' ? 'error' : 'muted'}>{runtime.autoFeishu.message}</Note> : null}
        </form>
      </Section>

      <Section title="今天的轨迹" count={timeline.length}>
        <ul className="track">
          {timeline.map((item) => (
            <li key={item.id} className={item.type}>
              <em>{dayjs(item.happenedAt).format('HH:mm')}</em>
              <button type="button" disabled={item.type === 'step'} onClick={() => setEditingId(item.id)}>
                <b>{item.title}</b>
                <span>{item.detail}</span>
              </button>
              {item.type !== 'step' ? (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="删除"
                  onClick={() => (item.type === 'difficulty' ? actions.removeDifficultyRecord(item.id) : actions.removeFocusSession(item.id))}
                >
                  ✕
                </button>
              ) : null}
            </li>
          ))}
          {timeline.length === 0 ? <Empty>今天还没有记录。做完一步、或结束一轮番茄，这里就会有。</Empty> : null}
        </ul>
      </Section>

      <Fold title="历史" count={`${historyDays.length} 天`} desc="只保留有记录的日子，空白天会自动清掉。">
        <div className="pair">
          <select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as HistoryFilter)}>
            <option value="all">全部</option>
            <option value="review">有复盘</option>
            <option value="focus">有专注</option>
            <option value="difficulty">有困难</option>
            <option value="notes">有笔记</option>
          </select>
          <input value={historyQuery} placeholder="搜索" onChange={(event) => setHistoryQuery(event.target.value)} />
        </div>
        <ul className="lines">
          {filteredHistory.map(({ key, plan, difficulties, sessions }) => (
            <li key={key} className="history">
              <details>
                <summary>
                  <b>{dayjs(key).format('M 月 D 日')}</b>
                  <em>
                    {plan.todayItems.filter((item) => item.isDone).length}/{plan.todayItems.length} 完成 · {sessions.length} 轮专注
                  </em>
                </summary>
                <div className="history-body">
                  {plan.review?.wins ? <p>完成：{plan.review.wins}</p> : null}
                  {plan.review?.slips ? <p>失守：{plan.review.slips}</p> : null}
                  {plan.review?.tomorrow ? <p>明天第一步：{plan.review.tomorrow}</p> : null}
                  {difficulties.map((record) => (
                    <p key={record.id}>
                      {difficultyTemplateLabels[record.type]}：{record.note || '未写'}
                      {record.nextAction ? ` → ${record.nextAction}` : ''}
                    </p>
                  ))}
                  <button type="button" className="link" disabled={historySyncing === key} onClick={() => void sendDay(key)}>
                    {historySyncing === key ? '补交中…' : '补交飞书'}
                  </button>
                </div>
              </details>
            </li>
          ))}
          {filteredHistory.length === 0 ? <Empty>没有匹配的记录。</Empty> : null}
        </ul>
      </Fold>

      {entry ? (
        <Modal title="编辑记录" desc={`${entry.title} · ${dayjs(entry.happenedAt).format('HH:mm')}`} onClose={() => setEditingId(null)}>
          <div className="stack">
            {difficulty ? (
              <>
                <Field label="卡点">
                  <textarea rows={4} defaultValue={difficulty.note} onBlur={(event) => actions.updateDifficultyRecord(difficulty.id, { note: event.target.value })} />
                </Field>
                <Field label="下一步">
                  <textarea rows={3} defaultValue={difficulty.nextAction} onBlur={(event) => actions.updateDifficultyRecord(difficulty.id, { nextAction: event.target.value })} />
                </Field>
              </>
            ) : null}
            {session ? (
              <Field label="这轮完成了什么">
                <textarea rows={4} defaultValue={session.accomplishment ?? ''} onBlur={(event) => actions.updateFocusSession(session.id, { accomplishment: event.target.value })} />
              </Field>
            ) : null}
            <button type="button" className="btn primary" onClick={() => setEditingId(null)}>
              完成
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
