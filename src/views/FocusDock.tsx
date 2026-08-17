import { useEffect, useRef, useState } from 'react'
import { difficultyTemplateLabels } from '../lib/defaults'
import { Field, Modal } from '../ui/primitives'
import { formatSeconds } from './helpers'
import type { LifeApp } from '../hooks/useLifeApp'
import type { DifficultyType } from '../types'

/**
 * 顶栏计时器：全站唯一显示倒计时的地方（不再另有横幅和悬浮窗）。
 * 点开是一个小浮层，放当前任务和结束 / 取消。
 */
export function FocusTicker({
  life,
  remainingSeconds,
  onRequestFinish,
}: {
  life: LifeApp
  remainingSeconds: number
  onRequestFinish: () => void
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const { data, dayPlan, actions } = life
  const timer = data.activeTimer

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!timer) return null

  const isBreak = timer.mode === 'shortBreak'
  const item = dayPlan.todayItems.find((entry) => entry.id === timer.dayItemId)
  const step = item?.steps.find((entry) => entry.id === timer.stepId)
  const total = timer.durationMinutes * 60
  const percent = total === 0 ? 0 : ((total - remainingSeconds) / total) * 100

  return (
    <div className="ticker-wrap" ref={boxRef}>
      <button type="button" className={isBreak ? 'ticker rest' : 'ticker'} onClick={() => setOpen((prev) => !prev)}>
        <span className="ticker-ring" style={{ ['--p' as string]: `${percent}%` }} aria-hidden="true" />
        {formatSeconds(remainingSeconds)}
      </button>

      {open ? (
        <div className="pop">
          <p className="pop-kicker">{isBreak ? '休息中' : '专注中'}</p>
          <p className="pop-title">{isBreak ? `刚完成：${item?.title ?? '这一轮'}` : step?.title ?? item?.title ?? '未绑定任务'}</p>
          <div className="pop-actions">
            {isBreak ? (
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  actions.finishBreakTimer()
                  setOpen(false)
                }}
              >
                提前结束休息
              </button>
            ) : (
              <button
                type="button"
                className="btn primary sm"
                onClick={() => {
                  onRequestFinish()
                  setOpen(false)
                }}
              >
                结束并记录
              </button>
            )}
            <button
              type="button"
              className="link danger"
              onClick={() => {
                actions.cancelTimer()
                setOpen(false)
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** 番茄结束记录：没完成时引导写出下一步，而不是直接退出。 */
export function FinishFocusDialog({ life, onClose }: { life: LifeApp; onClose: () => void }) {
  const { data, dayPlan, actions } = life
  const timer = data.activeTimer
  const item = dayPlan.todayItems.find((entry) => entry.id === timer?.dayItemId)
  const step = item?.steps.find((entry) => entry.id === timer?.stepId)

  const [completed, setCompleted] = useState(true)
  const [markStepDone, setMarkStepDone] = useState(true)
  const [difficultyType, setDifficultyType] = useState<DifficultyType>('too_big')
  const [accomplishment, setAccomplishment] = useState('')
  const [note, setNote] = useState('')
  const [nextAction, setNextAction] = useState('')

  return (
    <Modal title="这一轮结束了" desc="记一句结果，保存后自动进入休息。" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          actions.finishTimer({
            completed,
            markStepDone,
            difficultyType: completed ? undefined : difficultyType,
            difficultyNote: note,
            nextAction,
            accomplishment,
          })
          onClose()
        }}
      >
        <div className="choice">
          <button type="button" className={completed ? 'on' : undefined} onClick={() => setCompleted(true)}>
            完成了
          </button>
          <button type="button" className={!completed ? 'on' : undefined} onClick={() => setCompleted(false)}>
            没完成
          </button>
        </div>

        {step ? (
          <label className="inline-check">
            <input type="checkbox" checked={markStepDone} onChange={(event) => setMarkStepDone(event.target.checked)} />
            顺手把「{step.title}」标记完成
          </label>
        ) : null}

        {completed ? (
          <Field label="这轮完成了什么">
            <textarea rows={3} value={accomplishment} placeholder="例如：写完了登录页的表单校验" onChange={(event) => setAccomplishment(event.target.value)} />
          </Field>
        ) : (
          <Field label="卡在哪一类">
            <select value={difficultyType} onChange={(event) => setDifficultyType(event.target.value as DifficultyType)}>
              {Object.entries(difficultyTemplateLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="发生了什么">
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <Field label="下一步怎么办" hint="会自动加回任务">
          <textarea rows={2} value={nextAction} placeholder="例如：先把资料找齐，再开下一轮" onChange={(event) => setNextAction(event.target.value)} />
        </Field>

        <button type="submit" className="btn primary">
          记下来，进入休息
        </button>
      </form>
    </Modal>
  )
}
