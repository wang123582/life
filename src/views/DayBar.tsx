import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import type { LifeApp } from '../hooks/useLifeApp'

const DAY_START = 7

function toMinutes(time: string, fallback: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time?.trim() ?? '')
  if (!match) return fallback
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * 今天这条：一天从 07:00 到收工时间，画成一条真实的时间轴。
 * 红杠 = 完成的一轮专注，刻痕 = 勾掉的一步，竖线 = 现在，斜线区 = 收工之后。
 * 它回答的是「今天还剩多少，你把它用在哪了」，不是装饰。
 */
export function DayBar({ life }: { life: LifeApp }) {
  const { dayKey, dayPlan, todayFocusSessions, data } = life
  const [now, setNow] = useState(() => dayjs())

  useEffect(() => {
    const id = window.setInterval(() => setNow(dayjs()), 60000)
    return () => window.clearInterval(id)
  }, [])

  const startMin = DAY_START * 60
  const stopMin = toMinutes(data.settings.hardStopTime, 23 * 60)
  const endMin = Math.max(stopMin + 30, startMin + 240)
  const span = endMin - startMin
  const at = (minutes: number) => Math.min(Math.max(((minutes - startMin) / span) * 100, 0), 100)

  const sessions = todayFocusSessions
    .filter((session) => session.mode === 'focus' && session.status === 'completed')
    .map((session) => {
      const from = dayjs(session.startedAt)
      const to = dayjs(session.endedAt)
      const left = at(from.hour() * 60 + from.minute())
      const right = at(to.hour() * 60 + to.minute())
      return {
        id: session.id,
        left,
        width: Math.max(right - left, 0.7),
        label: `${from.format('HH:mm')}–${to.format('HH:mm')} 专注${session.accomplishment ? `：${session.accomplishment}` : ''}`,
      }
    })

  const notches = dayPlan.todayItems.flatMap((item) =>
    item.steps
      .filter((step) => step.isDone && step.completedAt)
      .map((step) => {
        const time = dayjs(step.completedAt)
        return { id: step.id, left: at(time.hour() * 60 + time.minute()), label: `${time.format('HH:mm')} ${step.title}` }
      }),
  )

  const isToday = dayKey === now.format('YYYY-MM-DD')
  const nowMin = now.hour() * 60 + now.minute()
  const showNow = isToday && nowMin >= startMin && nowMin <= endMin
  const leftMinutes = Math.max(stopMin - nowMin, 0)
  const hours = []
  for (let hour = DAY_START; hour * 60 <= endMin; hour += 3) hours.push(hour)

  return (
    <figure className="daybar">
      <div className="daybar-track">
        <span className="daybar-after" style={{ left: `${at(stopMin)}%` }} aria-hidden="true" />
        {sessions.map((session) => (
          <span key={session.id} className="daybar-focus" style={{ left: `${session.left}%`, width: `${session.width}%` }} title={session.label} />
        ))}
        {notches.map((notch) => (
          <span key={notch.id} className="daybar-notch" style={{ left: `${notch.left}%` }} title={notch.label} />
        ))}
        {showNow ? <span className="daybar-now" style={{ left: `${at(nowMin)}%` }} aria-hidden="true" /> : null}
      </div>

      <div className="daybar-scale" aria-hidden="true">
        {hours.map((hour) => (
          <span key={hour} style={{ left: `${at(hour * 60)}%` }}>
            {String(hour).padStart(2, '0')}
          </span>
        ))}
        <span className="daybar-stop" style={{ left: `${at(stopMin)}%` }}>
          收工
        </span>
      </div>

      <figcaption>
        {isToday
          ? leftMinutes > 0
            ? `离收工还有 ${Math.floor(leftMinutes / 60)} 小时 ${leftMinutes % 60} 分 · 已专注 ${sessions.length} 轮`
            : `已经过了收工时间 · 今天专注 ${sessions.length} 轮`
          : `这一天专注 ${sessions.length} 轮`}
      </figcaption>
    </figure>
  )
}
