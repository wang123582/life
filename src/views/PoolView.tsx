import { useState } from 'react'
import { Empty, Fold, Section, Segmented } from '../ui/primitives'
import { formatDeadline } from './helpers'
import type { ViewProps } from './types'
import type { RuleType, TaskKind } from '../types'

export function PoolView({ life, runtime, goToTab }: ViewProps) {
  const { data, actions } = life
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TaskKind>('normal')
  const [time, setTime] = useState('')
  const [deadline, setDeadline] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [ruleText, setRuleText] = useState('')
  const [ruleType, setRuleType] = useState<RuleType>('do')

  const tasks = data.taskDefs.filter((task) => !task.archived)
  const normals = tasks.filter((task) => task.kind === 'normal')
  const routines = tasks.filter((task) => task.kind === 'routine')

  const remove = (taskId: string, taskTitle: string) => {
    if (!window.confirm(`把「${taskTitle}」从任务池删掉？未完成的今日副本也会一起移除。`)) return
    actions.removeTaskDefinition(taskId)
  }

  return (
    <>
      <Section title="加一件">
        <form
          className="compose"
          onSubmit={(event) => {
            event.preventDefault()
            actions.addTaskDefinition(
              title,
              kind,
              kind === 'routine' && time ? time : undefined,
              kind === 'normal' ? deadline : undefined,
              kind === 'normal' ? nextStep : undefined,
            )
            setTitle('')
            setTime('')
            setDeadline('')
            setNextStep('')
          }}
        >
          <input
            value={title}
            placeholder="要做什么？也可以直接写「吃饭 12:30」"
            onChange={(event) => setTitle(event.target.value)}
          />
          {kind === 'normal' ? (
            <input
              value={nextStep}
              placeholder="下一秒手放在哪？填不出来就再拆一层"
              onChange={(event) => setNextStep(event.target.value)}
            />
          ) : null}
          <div className="compose-foot">
            <Segmented
              value={kind}
              onChange={(next) => {
                setKind(next)
                setTime('')
                setDeadline('')
                setNextStep('')
              }}
              options={[
                { value: 'normal', label: '主动任务' },
                { value: 'routine', label: '生活提醒' },
              ]}
            />
            {kind === 'routine' ? (
              <input className="slim" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            ) : (
              <input className="slim" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
            )}
            <button
              type="submit"
              className="btn primary sm"
              disabled={!title.trim() || (kind === 'normal' && !nextStep.trim())}
            >
              加入
            </button>
          </div>
        </form>
      </Section>

      <Section title="主动任务" count={normals.length}>
        <ul className="lines">
          {normals.map((task) => (
            <li key={task.id}>
              <span className="ln-title">{task.title}</span>
              <em className="ln-meta">{task.deadlineDate ? `截止 ${formatDeadline(task.deadlineDate)}` : ''}</em>
              <span className="row">
                <button type="button" className="link" onClick={() => actions.addTaskToToday(task.id)}>
                  进今天
                </button>
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    if (!actions.launchTaskDefinition(task.id)) return
                    goToTab('today')
                    runtime.notify(`已开始「${task.title}」。`, 'success')
                  }}
                >
                  直接开始
                </button>
                <button type="button" className="icon-btn" aria-label="删除" onClick={() => remove(task.id, task.title)}>
                  ✕
                </button>
              </span>
            </li>
          ))}
          {normals.length === 0 ? (
            <Empty>先把能做的事列出来，再决定今天拉哪几件。填了截止日期的会每天自动进今天，直到做完。</Empty>
          ) : null}
        </ul>
      </Section>

      <Section title="生活提醒" count={routines.length}>
        <ul className="lines">
          {routines.map((task) => (
            <li key={task.id}>
              <span className="ln-title">{task.title}</span>
              <em className="ln-meta">{task.scheduleTime ?? '未设时间'}</em>
              <span className="row">
                <button type="button" className="link" onClick={() => actions.addTaskToToday(task.id)}>
                  进今天
                </button>
                <button type="button" className="icon-btn" aria-label="删除" onClick={() => remove(task.id, task.title)}>
                  ✕
                </button>
              </span>
            </li>
          ))}
          {routines.length === 0 ? <Empty>吃饭、休息、洗澡也是任务，它们是生活的骨架。</Empty> : null}
        </ul>
      </Section>

      <Fold title="长期规则" count={data.ruleDefs.length} desc="不针对今天，是长期要守的方向和红线。">
        <form
          className="rule-add"
          onSubmit={(event) => {
            event.preventDefault()
            actions.addRuleDefinition(ruleText, ruleType)
            setRuleText('')
          }}
        >
          <Segmented
            value={ruleType}
            onChange={setRuleType}
            options={[
              { value: 'do', label: '要做' },
              { value: 'avoid', label: '不做' },
            ]}
          />
          <input value={ruleText} placeholder="例如：晚上 11 点后不再刷手机" onChange={(event) => setRuleText(event.target.value)} />
          <button type="submit" className="btn sm" disabled={!ruleText.trim()}>
            加入
          </button>
        </form>
        <ul className="rules">
          {data.ruleDefs.map((rule) => (
            <li key={rule.id} className={rule.type === 'avoid' ? 'avoid' : undefined}>
              <span className="mark" role="img" aria-label={rule.type === 'avoid' ? '不做' : '要做'}>
                {rule.type === 'avoid' ? '✗' : '✓'}
              </span>
              <span className="rule-text">{rule.text}</span>
              <button type="button" className="icon-btn" aria-label="删除" onClick={() => actions.removeRuleDefinition(rule.id)}>
                ✕
              </button>
            </li>
          ))}
          {data.ruleDefs.length === 0 ? <Empty>还没有规则。红勾是要守的方向，叉是红线。</Empty> : null}
        </ul>
      </Fold>
    </>
  )
}
