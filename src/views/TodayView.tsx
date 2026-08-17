import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { presetInterventions, stateTemplateLabels } from '../lib/defaults'
import { getNextDayAnchorItems } from '../lib/review'
import { Empty, Fold, Modal, Section } from '../ui/primitives'
import { formatDeadline } from './helpers'
import type { ViewProps } from './types'
import type { StateType, TodayItem } from '../types'

/** 晨间锚点未确认时，整页只剩这一件事——D1 硬阻断在界面上的形态。 */
function AnchorGate({ life }: { life: ViewProps['life'] }) {
  const { data, dayKey, actions } = life
  const prefill = useMemo(() => getNextDayAnchorItems(data.dayPlans, dayKey), [data.dayPlans, dayKey])
  const [inputs, setInputs] = useState<string[]>(() => prefill.map((item) => item.title))

  useEffect(() => {
    if (prefill.length > 0) setInputs(prefill.map((item) => item.title))
  }, [prefill])

  const canConfirm = inputs.some((text) => text?.trim())

  return (
    <div className="gate">
      <p className="kicker">今日三件事</p>
      <h1>{prefill.length > 0 ? '确认今天这三件事' : '今天要做的三件事'}</h1>
      <p className="lede">
        {prefill.length > 0 ? '昨晚已经写好了，确认就能开始。' : '按重要性从上往下写。确认之前，别的页面都进不去。'}
      </p>

      <ol className="gate-list">
        {Array.from({ length: data.dailyTemplate.topTaskSlots }).map((_, index) => (
          <li key={index}>
            <span>{index + 1}</span>
            <input
              value={inputs[index] ?? ''}
              placeholder={index === 0 ? '最重要的一件' : '还有什么'}
              onChange={(event) =>
                setInputs((prev) => {
                  const next = [...prev]
                  next[index] = event.target.value
                  return next
                })
              }
            />
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="btn primary"
        disabled={!canConfirm}
        onClick={() => actions.confirmMorningAnchor(inputs, prefill.map((item) => item.step ?? ''))}
      >
        确认，开始今天
      </button>
      <p className="fine">写不出来就写最小的那件。写下来比写对重要。</p>
    </div>
  )
}

function TaskRow({ item, index, life }: { item: TodayItem; index: number; life: ViewProps['life'] }) {
  const { data, actions } = life
  const [adding, setAdding] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [stepInput, setStepInput] = useState('')

  const source = data.taskDefs.find((task) => task.id === item.sourceTaskId)
  const doneSteps = item.steps.filter((step) => step.isDone)
  const openSteps = item.steps.filter((step) => !step.isDone)
  const visibleSteps = showDone ? item.steps : openSteps

  return (
    <li className={item.isDone ? 'entry done' : 'entry'}>
      <div className="row-main">
        <button
          type="button"
          className="box"
          aria-label={item.isDone ? '取消完成' : '标记完成'}
          onClick={() => actions.toggleTodayItemDone(item.id)}
        >
          <span aria-hidden="true">{item.isDone ? '✓' : index}</span>
        </button>

        <div className="row-text">
          <p className="row-title">{item.title}</p>
          {source?.deadlineDate ? <p className="row-sub">截止 {formatDeadline(source.deadlineDate)}</p> : null}
        </div>

        <div className="row-tools">
          {!item.isDone ? (
            <button type="button" className="btn primary sm" onClick={() => actions.startFocusTimer(item.id, openSteps[0]?.id)}>
              专注
            </button>
          ) : null}
          <button type="button" className="icon-btn" aria-label="上移" onClick={() => actions.moveTodayItem(item.id, -1)}>
            ↑
          </button>
          <button type="button" className="icon-btn" aria-label="下移" onClick={() => actions.moveTodayItem(item.id, 1)}>
            ↓
          </button>
          <button type="button" className="icon-btn" aria-label="移出今天" onClick={() => actions.removeTodayItem(item.id)}>
            ✕
          </button>
        </div>
      </div>

      {visibleSteps.length > 0 ? (
        <ul className="steps">
          {visibleSteps.map((step) => (
            <li key={step.id} className={step.isDone ? 'done' : undefined}>
              <label>
                <input type="checkbox" checked={step.isDone} onChange={() => actions.toggleStepDone(item.id, step.id)} />
                <span>{step.title}</span>
              </label>
              <span className="step-tools">
                {step.isDone ? (
                  <em>{step.completedAt ? dayjs(step.completedAt).format('HH:mm') : ''}</em>
                ) : (
                  <button type="button" className="btn sm" onClick={() => actions.startFocusTimer(item.id, step.id)}>
                    开始
                  </button>
                )}
                <button type="button" className="icon-btn" aria-label="删除" onClick={() => actions.removeStep(item.id, step.id)}>
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={item.steps.length > 0 ? 'row-foot quiet' : 'row-foot'}>
        {adding ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              actions.addStep(item.id, stepInput)
              setStepInput('')
            }}
          >
            <input
              autoFocus
              value={stepInput}
              placeholder="下一步做什么？"
              onChange={(event) => setStepInput(event.target.value)}
              onBlur={() => !stepInput.trim() && setAdding(false)}
            />
          </form>
        ) : (
          <button type="button" className="link" onClick={() => setAdding(true)}>
            ＋ 拆一步
          </button>
        )}
        {doneSteps.length > 0 ? (
          <button type="button" className="link dim" onClick={() => setShowDone((prev) => !prev)}>
            {showDone ? '收起已完成' : `已完成 ${doneSteps.length} 步`}
          </button>
        ) : null}
      </div>
    </li>
  )
}

function StuckDialog({ life, onClose }: { life: ViewProps['life']; onClose: () => void }) {
  const { actions } = life
  const [stateType, setStateType] = useState<StateType | ''>('')
  const [method, setMethod] = useState('')
  const [custom, setCustom] = useState('')

  return (
    <Modal title="卡住了" desc="先认出状态，再挑一个动作。试完打个分，好用的会记下来。" onClose={onClose}>
      <div className="stack">
        <p className="label">现在什么感觉</p>
        <div className="chips">
          {Object.entries(stateTemplateLabels).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={stateType === value ? 'chip on' : 'chip'}
              onClick={() => {
                setStateType(value as StateType)
                setMethod('')
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {stateType ? (
          <>
            <p className="label">试试这个</p>
            <div className="chips">
              {presetInterventions
                .filter((preset) => preset.forStates.includes(stateType))
                .map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={method === preset.label ? 'chip on' : 'chip'}
                    onClick={() => setMethod(preset.label)}
                  >
                    {preset.label}
                    {preset.duration ? ` · ${preset.duration}′` : ''}
                  </button>
                ))}
            </div>
            <input
              value={custom}
              placeholder="或者写你自己的方法"
              onChange={(event) => {
                setCustom(event.target.value)
                setMethod(event.target.value)
              }}
            />
          </>
        ) : null}

        {stateType && method ? (
          <>
            <p className="label">试完了，感觉怎么样</p>
            <div className="row">
              {([
                ['better', '好多了'],
                ['same', '没变化'],
                ['worse', '更糟了'],
              ] as const).map(([result, label]) => (
                <button
                  key={result}
                  type="button"
                  className="btn"
                  onClick={() => {
                    actions.addStateRecord(stateType, '', method, result)
                    onClose()
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  )
}

export function TodayView({ life, runtime, goToTab }: ViewProps) {
  const { data, dayPlan, isMorningAnchorPending, activeRelaxWindow, actions } = life
  const [quick, setQuick] = useState('')
  const [avoidText, setAvoidText] = useState('')
  const [curiosity, setCuriosity] = useState('')
  const [showStuck, setShowStuck] = useState(false)
  const [showCuriosity, setShowCuriosity] = useState(false)

  const mainItems = dayPlan.todayItems.filter((item) => item.kind !== 'routine')
  const routines = dayPlan.todayItems.filter((item) => item.kind === 'routine')
  const routinesDone = routines.filter((item) => item.isDone).length
  const openCuriosity = data.curiosityItems.filter((item) => !item.archived)

  if (isMorningAnchorPending) return <AnchorGate life={life} />

  return (
    <>
      {activeRelaxWindow ? (
        <div className="banner">
          <div>
            <b>放松窗口 {activeRelaxWindow.minutes} 分钟</b>
            <span>
              {activeRelaxWindow.recommendation} 到 {dayjs(activeRelaxWindow.expiresAt).format('HH:mm')}。
            </span>
          </div>
          <button type="button" className="btn sm" onClick={() => actions.consumeRelaxWindow(activeRelaxWindow.id)}>
            去放松
          </button>
        </div>
      ) : null}

      <Section
        title="主线"
        count={`${mainItems.filter((item) => item.isDone).length}/${mainItems.length}`}
        actions={
          <button type="button" className="link" onClick={() => goToTab('pool')}>
            任务池 →
          </button>
        }
      >
        <ol className="rows">
          {mainItems.map((item, index) => (
            <TaskRow key={item.id} item={item} index={index + 1} life={life} />
          ))}
        </ol>

        <form
          className="add"
          onSubmit={(event) => {
            event.preventDefault()
            if (!actions.quickStartTodayTask(quick)) return
            setQuick('')
            runtime.notify('已放进今天。', 'success')
          }}
        >
          <input value={quick} placeholder="＋ 再加一件今天要做的" onChange={(event) => setQuick(event.target.value)} />
        </form>

        {mainItems.length === 0 ? <Empty>今天还没有主线。写一件，或从任务池挑——每件先拆一个能立刻动手的小步骤。</Empty> : null}
      </Section>

      <Section
        title="边界"
        count={`${dayPlan.avoidItems.filter((item) => item.isDone).length}/${dayPlan.avoidItems.length}`}
      >
        <div className="chips">
          {dayPlan.avoidItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.isDone ? 'chip held' : 'chip'}
              onClick={() => actions.toggleAvoidDone(item.id)}
            >
              {item.isDone ? '✓ ' : ''}
              {item.text}
            </button>
          ))}
          <form
            className="chip-input"
            onSubmit={(event) => {
              event.preventDefault()
              actions.addAvoidItem(avoidText)
              setAvoidText('')
            }}
          >
            <input value={avoidText} placeholder="＋ 今天不碰什么" onChange={(event) => setAvoidText(event.target.value)} />
          </form>
        </div>
      </Section>

      {routines.length > 0 ? (
        <Fold
          title="生活"
          count={`${routinesDone}/${routines.length}`}
          desc="到点了就勾掉。这是一天的骨架。"
          open={routinesDone < routines.length}
        >
          <div className="chips">
            {routines.map((item) => {
              const source = data.taskDefs.find((task) => task.id === item.sourceTaskId)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={item.isDone ? 'chip held' : 'chip'}
                  onClick={() => actions.toggleTodayItemDone(item.id)}
                >
                  {item.isDone ? '✓ ' : ''}
                  {item.title}
                  {source?.scheduleTime ? <em>{source.scheduleTime}</em> : null}
                </button>
              )
            })}
          </div>
        </Fold>
      ) : null}

      <footer className="today-foot">
        <button type="button" className="link" onClick={() => setShowStuck(true)}>
          卡住了
        </button>
        <button type="button" className="link" onClick={() => setShowCuriosity(true)}>
          好奇清单{openCuriosity.length > 0 ? ` ${openCuriosity.length}` : ''}
        </button>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={dayPlan.communicationDone}
            onChange={(event) => actions.setCommunication(event.target.checked, dayPlan.communicationNote)}
          />
          今天和人认真聊过
        </label>
      </footer>

      {showStuck ? <StuckDialog life={life} onClose={() => setShowStuck(false)} /> : null}

      {showCuriosity ? (
        <Modal title="好奇清单" desc="零散兴趣先记下来，等放松窗口再看。" onClose={() => setShowCuriosity(false)}>
          <form
            className="add"
            onSubmit={(event) => {
              event.preventDefault()
              actions.addCuriosityItem(curiosity)
              setCuriosity('')
            }}
          >
            <input autoFocus value={curiosity} placeholder="＋ 想看的、想查的" onChange={(event) => setCuriosity(event.target.value)} />
          </form>
          <ul className="lines">
            {openCuriosity.map((item) => (
              <li key={item.id}>
                <span className="ln-title">{item.text}</span>
                <em className="ln-meta" />
                <span className="row">
                  <button type="button" className="link" onClick={() => actions.archiveCuriosityItem(item.id)}>
                    消化
                  </button>
                  <button type="button" className="icon-btn" aria-label="删除" onClick={() => actions.removeCuriosityItem(item.id)}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
            {openCuriosity.length === 0 ? <Empty>还没有记。</Empty> : null}
          </ul>
        </Modal>
      ) : null}
    </>
  )
}
