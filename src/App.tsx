import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { useAppRuntime } from './app/useAppRuntime'
import { useLifeApp } from './hooks/useLifeApp'
import { TABS } from './ui/theme'
import { DayBar } from './views/DayBar'
import { FinishFocusDialog, FocusTicker } from './views/FocusDock'
import { NotesSheet } from './views/NotesSheet'
import { PoolView } from './views/PoolView'
import { ReviewView } from './views/ReviewView'
import { SettingsView } from './views/SettingsView'
import { TodayView } from './views/TodayView'
import type { TabKey } from './types'

const PAGE_TITLE: Record<TabKey, string> = {
  today: '今天',
  pool: '任务池',
  review: '复盘',
  templates: '设置',
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function App() {
  const life = useLifeApp()
  const [tab, setTab] = useState<TabKey>('today')
  const [finishOpen, setFinishOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

  const onFocusTimerEnded = useCallback(() => setFinishOpen(true), [])
  const runtime = useAppRuntime(life, { onFocusTimerEnded, finishDialogOpen: finishOpen })

  const { data, dayKey, isMorningAnchorPending } = life
  const locked = isMorningAnchorPending

  // D1 硬阻断：未确认今日三件事前，任何入口都只能回到今天页。
  useEffect(() => {
    if (locked && tab !== 'today') setTab('today')
  }, [locked, tab])

  const goToTab = useCallback(
    (key: TabKey) => {
      if (locked && key !== 'today') return
      setTab(key)
    },
    [locked],
  )

  const viewProps = { life, runtime, goToTab }
  const day = dayjs(dayKey)

  return (
    <div className="app">
      <header className="top">
        <div className="top-in">
          <span className="logo">life</span>

          <nav className="tabs">
            {TABS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={entry.key === tab ? 'on' : undefined}
                disabled={locked && entry.key !== 'today'}
                title={locked && entry.key !== 'today' ? '先定今天三件事' : undefined}
                onClick={() => goToTab(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </nav>

          <div className="top-right">
            <FocusTicker life={life} remainingSeconds={runtime.remainingSeconds} onRequestFinish={() => setFinishOpen(true)} />
            <button type="button" className="icon-btn" aria-label="过程笔记" onClick={() => setNotesOpen(true)}>
              ✎
            </button>
          </div>
        </div>
      </header>

      <main className="page">
        {!locked ? (
          <header className="sec page-head">
            <div className="gutter">
              <h2 className="date">{day.format('M 月 D 日')}</h2>
              <b>{WEEKDAYS[day.day()]}</b>
            </div>
            <div className="body">
              <h1>{PAGE_TITLE[tab]}</h1>
              {tab === 'today' ? <DayBar life={life} /> : null}
            </div>
          </header>
        ) : null}

        {runtime.reminder ? (
          <div className="sec">
            <div className="gutter" />
            <div className="body">
              <div className="banner warn">
                <div>
                  <b>回到你自己设的目标上</b>
                  <span>{runtime.reminder}</span>
                </div>
                <button type="button" className="btn sm" onClick={runtime.dismissReminder}>
                  知道了
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'today' ? <TodayView {...viewProps} /> : null}
        {tab === 'pool' ? <PoolView {...viewProps} /> : null}
        {tab === 'review' ? <ReviewView {...viewProps} /> : null}
        {tab === 'templates' ? <SettingsView {...viewProps} /> : null}
      </main>

      <nav className="bottom">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={entry.key === tab ? 'on' : undefined}
            disabled={locked && entry.key !== 'today'}
            onClick={() => goToTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {runtime.flash ? <div className={`toast ${runtime.flash.tone}`}>{runtime.flash.message}</div> : null}

      {finishOpen && data.activeTimer?.mode === 'focus' ? <FinishFocusDialog life={life} onClose={() => setFinishOpen(false)} /> : null}
      <NotesSheet life={life} open={notesOpen} onToggle={setNotesOpen} />
    </div>
  )
}

export default App
