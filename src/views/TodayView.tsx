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
  const [title, setTitle] = useState(() => prefill[0]?.title ?? '')
  const [step, setStep] = useState(() => prefill[0]?.step ?? '')

  useEffect(() => {
    if (prefill.length > 0) {
      setTitle(prefill[0].title)
      setStep(prefill[0].step ?? '')
    }
  }, [prefill])

  const canConfirm = Boolean(title.trim() && step.trim())

  return (
    <div className="gate">
      <p className="kicker">今天唯一的一件事</p>
      <h1>{prefill.length > 0 ? '确认这一件事' : '今天要做的这一件事'}</h1>
      <p className="lede">
        {prefill.length > 0 ? '昨晚已经写好了，确认就能开始。' : '写这一件，别的事今天不存在。确认之前，别的页面都进不去。'}
      </p>

      <div className="gate-fields">
        <input value={title} placeholder="这一件是什么" onChange={(event) => setTitle(event.target.value)} />
        <input
          value={step}
          placeholder="下一秒手放在哪？填不出来就再拆一层"
          onChange={(event) => setStep(event.target.value)}
        />
      </div>

      <button
        type="button"
        className="btn primary"
        disabled={!canConfirm}
        onClick={() => actions.confirmMorningAnchor(title, step)}
      >
        确认，开始今天
      </button>
      <p className="fine">两格都写不出来，说明还没拆到能动手——再拆一层。</p>
    </div>
  )
}

/**
 * 主线那一件事。
 * 屏幕上永远只显示「当前这一步」，勾的是它、开始的也是它——不再有"在大任务上开始"这条岔路。
 * 还没拆出步骤时，页面上只给得出「＋ 拆一步」：填不出下一步就还不能开始。
 */
function TaskRow({ item, life }: { item: TodayItem; life: ViewProps['life'] }) {
  const { data, actions } = life
  const [adding, setAdding] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [stepInput, setStepInput] = useState('')

  const source = data.taskDefs.find((task) => task.id === item.sourceTaskId)
  const doneSteps = item.steps.filter((step) => step.isDone)
  const currentStep = item.steps.find((step) => !step.isDone)
  // 当前这一步已经写在主行了，列表里只放它后面的——同一句话不在页面上出现两次。
  const restSteps = item.steps.filter((step) => step.id !== currentStep?.id && (showDone || !step.isDone))
  const primaryText = currentStep?.title ?? item.title

  return (
    <li className={item.isDone ? 'entry done' : 'entry'}>
      <div className="row-main">
        <button
          type="button"
          className="box"
          aria-label={currentStep ? `完成「${currentStep.title}」` : item.isDone ? '取消完成' : '标记完成'}
          onClick={() =>
            currentStep ? actions.toggleStepDone(item.id, currentStep.id) : actions.toggleTodayItemDone(item.id)
          }
        >
          <span aria-hidden="true">{item.isDone ? '✓' : ''}</span>
        </button>

        <div className="row-text">
          <p className="row-title">{primaryText}</p>
          {currentStep || source?.deadlineDate ? (
            <p className="row-sub">
              {currentStep ? item.title : ''}
              {currentStep && source?.deadlineDate ? ' · ' : ''}
              {source?.deadlineDate ? `截止 ${formatDeadline(source.deadlineDate)}` : ''}
            </p>
          ) : null}
        </div>

        <div className="row-tools">
          {currentStep ? (
            <button type="button" className="btn primary sm" onClick={() => actions.startFocusTimer(item.id, currentStep.id)}>
              开始
            </button>
          ) : null}
          <button type="button" className="icon-btn" aria-label="移出今天" onClick={() => actions.removeTodayItem(item.id)}>
            ✕
          </button>
        </div>
      </div>

      {restSteps.length > 0 ? (
        <ul className="steps">
          {restSteps.map((step) => (
            <li key={step.id} className={step.isDone ? 'done' : undefined}>
              <label>
                <input type="checkbox" checked={step.isDone} onChange={() => actions.toggleStepDone(item.id, step.id)} />
                <span>{step.title}</span>
              </label>
              <span className="step-tools">
                {step.isDone ? <em>{step.completedAt ? dayjs(step.completedAt).format('HH:mm') : ''}</em> : null}
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
              placeholder={currentStep ? '再往后一步做什么？' : '下一秒手放在哪？填不出来就再拆一层'}
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

/**
 * 分叉收纳箱。主线没做完时只给一个输入框：写下来就回到当前这件事，
 * 记了什么本身也看不见——可见就会被拉走（《自律 App 设计要点》第 4 条）。
 * 主线做完了才把内容摊开供挑选。
 */
function CuriosityDialog({
  life,
  revealed,
  onClose,
}: {
  life: ViewProps['life']
  revealed: boolean
  onClose: () => void
}) {
  const { data, actions } = life
  const [text, setText] = useState('')
  const open = data.curiosityItems.filter((item) => !item.archived)

  return (
    <Modal
      title={revealed ? '好奇清单' : '记一笔'}
      desc={revealed ? '今天这一件做完了，现在可以挑一个看。' : '写下来就放下它，回到当前这件事。等今天这一件做完再看。'}
      onClose={onClose}
    >
      <form
        className="add"
        onSubmit={(event) => {
          event.preventDefault()
          actions.addCuriosityItem(text)
          setText('')
          if (!revealed) onClose()
        }}
      >
        <input autoFocus value={text} placeholder="＋ 想看的、想查的" onChange={(event) => setText(event.target.value)} />
      </form>

      {revealed ? (
        <ul className="lines">
          {open.map((item) => (
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
          {open.length === 0 ? <Empty>还没有记。</Empty> : null}
        </ul>
      ) : null}
    </Modal>
  )
}

export function TodayView({ life, runtime, goToTab }: ViewProps) {
  const { data, dayPlan, isMorningAnchorPending, actions } = life
  const [quick, setQuick] = useState('')
  const [quickStep, setQuickStep] = useState('')
  const [showStuck, setShowStuck] = useState(false)
  const [showCuriosity, setShowCuriosity] = useState(false)

  // 维护类（生活）不进主屏：它到点自己会来提醒，见 app/useAppRuntime 的情境提醒。
  const mainItems = dayPlan.todayItems.filter((item) => item.kind !== 'routine')
  const mainPending = mainItems.filter((item) => !item.isDone)
  // 主屏只留一件：其余待做的（deadline 自动同步、之前多加的）一律收进「今天不做」。
  const activeItem = mainPending[0]
  const backlogItems = mainPending.slice(1)
  const backlogTasks = data.taskDefs.filter(
    (task) => task.kind === 'normal' && !task.archived && !mainItems.some((item) => item.sourceTaskId === task.id),
  )
  // 今天这一件做完了，收纳箱才摊开。
  const cleared = !activeItem && mainItems.length > 0

  const swapIn = (title: string, run: () => void) => {
    run()
    runtime.notify(`今天这一件换成「${title}」。`, 'success')
  }

  if (isMorningAnchorPending) return <AnchorGate life={life} />

  return (
    <>
      <Section
        title="主线"
        actions={
          <button type="button" className="link" onClick={() => goToTab('pool')}>
            任务池 →
          </button>
        }
      >
        {activeItem ? (
          <ol className="rows">
            <TaskRow item={activeItem} life={life} />
          </ol>
        ) : cleared ? (
          <Empty>今天这一件做完了。剩下的时间是你的——去复盘，或者从下面挑一件想看的。</Empty>
        ) : (
          <Empty>今天还没有这一件。写一件，或从任务池挑——先拆一个能立刻动手的小步骤。</Empty>
        )}

        <form
          className="add"
          onSubmit={(event) => {
            event.preventDefault()
            if (!actions.quickStartTodayTask(quick, quickStep)) return
            setQuick('')
            setQuickStep('')
            runtime.notify(activeItem ? '已放进「今天不做」，等这件做完再看。' : '已放进今天。', 'success')
          }}
        >
          <input
            value={quick}
            placeholder={activeItem ? '＋ 再想到一件，先记下' : '今天唯一的一件是什么'}
            onChange={(event) => setQuick(event.target.value)}
          />
          <input
            value={quickStep}
            placeholder="下一秒手放在哪？填不出来就再拆一层"
            onChange={(event) => setQuickStep(event.target.value)}
          />
          <button type="submit" className="btn primary sm" disabled={!quick.trim() || !quickStep.trim()}>
            {activeItem ? '记下' : '开始'}
          </button>
        </form>
      </Section>

      {backlogItems.length > 0 || backlogTasks.length > 0 ? (
        <Fold
          title="今天不做"
          count={backlogItems.length + backlogTasks.length}
          desc="不是稍后，是今天不做。真要动它，只能把今天这一件换掉。"
          friction
        >
          <ul className="lines">
            {backlogItems.map((item) => (
              <li key={item.id}>
                <span className="ln-title">{item.title}</span>
                <em className="ln-meta" />
                <span className="row">
                  <button
                    type="button"
                    className="link"
                    onClick={() => swapIn(item.title, () => actions.focusOnTodayItem(item.id))}
                  >
                    换上来
                  </button>
                </span>
              </li>
            ))}
            {backlogTasks.map((task) => (
              <li key={task.id}>
                <span className="ln-title">{task.title}</span>
                <em className="ln-meta" />
                <span className="row">
                  <button
                    type="button"
                    className="link"
                    onClick={() => swapIn(task.title, () => actions.focusOnTask(task.id))}
                  >
                    换上来
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Fold>
      ) : null}

      <footer className="today-foot">
        <button type="button" className="link" onClick={() => setShowStuck(true)}>
          卡住了
        </button>
        <button type="button" className="link" onClick={() => setShowCuriosity(true)}>
          {cleared ? `好奇清单 ${data.curiosityItems.filter((item) => !item.archived).length}` : '记一笔'}
        </button>
      </footer>

      {showStuck ? <StuckDialog life={life} onClose={() => setShowStuck(false)} /> : null}
      {showCuriosity ? <CuriosityDialog life={life} revealed={cleared} onClose={() => setShowCuriosity(false)} /> : null}
    </>
  )
}
