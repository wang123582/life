import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'
import { currentDayKey, defaultData, STORAGE_KEY } from '../lib/defaults'

/** UI 重构后的护栏：页面 shell 至少要能挂载，不能白屏。 */
describe('App 渲染', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('未确认今日三件事时，只显示晨间锚点', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/三件事/)
    expect(screen.queryByText('主线')).toBeNull()
  })

  it('确认锚点后进入今天页', () => {
    const data = defaultData()
    const dayKey = currentDayKey()
    data.dayPlans[dayKey].morningAnchorDone = true
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

    render(<App />)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('今天')
    expect(screen.getByText('主线')).toBeTruthy()
    expect(screen.getByText('边界')).toBeTruthy()
  })
})
