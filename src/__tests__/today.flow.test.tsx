import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import { createTaskDefinition, currentDayKey, defaultData, STORAGE_KEY } from '../lib/defaults'
import type { LifeAppData } from '../types'

/**
 * 全流程护栏：一天一件的主干走一遍。
 * 这些断言锁的是设计立场，不是实现细节——
 * 一个开始入口、维护类不上主屏、「今天不做」只能换不能并行、收纳箱做完才可见。
 */

function seed(mutate: (data: LifeAppData) => void = () => {}) {
  const data = defaultData()
  mutate(data)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function anchorToday(title: string, step: string) {
  fireEvent.change(screen.getByPlaceholderText('这一件是什么'), { target: { value: title } })
  fireEvent.change(screen.getByPlaceholderText('下一秒手放在哪？填不出来就再拆一层'), { target: { value: step } })
  fireEvent.click(screen.getByRole('button', { name: '确认，开始今天' }))
}

describe('今天页全流程', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('晨间锚点两格都填了才放行，确认后主屏显示的是下一步而不是标题', () => {
    seed()
    render(<App />)

    const confirm = screen.getByRole('button', { name: '确认，开始今天' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    anchorToday('写比赛方案', '打开文档，写下标题')

    // 主屏显示「下一秒手放在哪」，任务标题降为副行
    expect(screen.getByText('打开文档，写下标题')).toBeTruthy()
    expect(screen.getByText(/写比赛方案/)).toBeTruthy()
  })

  it('页面上只有一个「开始」，它开的是当前这一步', () => {
    seed()
    render(<App />)
    anchorToday('写比赛方案', '打开文档，写下标题')

    // 唯一的开始入口
    const starts = screen.getAllByRole('button', { name: '开始' })
    expect(starts).toHaveLength(1)

    fireEvent.click(starts[0])

    // 计时器浮层里显示的就是那一步
    const timer = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as LifeAppData
    const item = timer.dayPlans[currentDayKey()].todayItems.find((entry) => entry.title === '写比赛方案')!
    expect(timer.activeTimer?.stepId).toBe(item.steps[0].id)
  })

  it('没拆出步骤就没有「开始」，只给得出「＋ 拆一步」', () => {
    seed((data) => {
      const dayKey = currentDayKey()
      data.dayPlans[dayKey].morningAnchorDone = true
      data.dayPlans[dayKey].todayItems = [
        { id: 'no-step', title: '一件没拆过的事', kind: 'normal', isDone: false, order: 1, steps: [], createdAt: '2026-01-01T00:00:00.000Z' },
      ]
    })
    render(<App />)

    expect(screen.queryByRole('button', { name: '开始' })).toBeNull()
    expect(screen.getByRole('button', { name: '＋ 拆一步' })).toBeTruthy()
  })

  it('维护类（生活）不在今天页占行，也不计入完成率', () => {
    seed((data) => {
      data.dayPlans[currentDayKey()].morningAnchorDone = true
    })
    render(<App />)

    expect(screen.queryByText('生活')).toBeNull()
    // 默认数据里有 5 条生活提醒，但今天页一条都不列
    expect(screen.queryByText('吃饭')).toBeNull()
    expect(screen.queryByText('洗澡')).toBeNull()
  })

  it('第二件事进不了主线，只能进「今天不做」，而且只能换不能并行', () => {
    seed((data) => {
      data.taskDefs = [...data.taskDefs, createTaskDefinition('改简历', 'normal', undefined, '把上一版打开')]
    })
    render(<App />)
    anchorToday('写比赛方案', '打开文档，写下标题')

    // 主线仍然只有一件
    expect(screen.getAllByRole('button', { name: '开始' })).toHaveLength(1)

    // 「今天不做」是两步摩擦：先出确认行，点确认才展开
    fireEvent.click(screen.getByText('今天不做'))
    fireEvent.click(screen.getByRole('button', { name: '确定要看 →' }))

    // 默认数据里本来就有一件主动任务，所以「今天不做」里不止一行——挑「改简历」那一行换
    const row = screen.getByText('改简历').closest('li')!
    fireEvent.click(within(row).getByRole('button', { name: '换上来' }))

    // 换过之后主线变成「改简历」的第一步，原来那件掉回「今天不做」
    expect(screen.getByText('把上一版打开')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: '开始' })).toHaveLength(1)
  })

  it('收纳箱在这一件做完前只能写不能看，做完才摊开', () => {
    seed()
    render(<App />)
    anchorToday('写比赛方案', '打开文档，写下标题')

    fireEvent.click(screen.getByRole('button', { name: '记一笔' }))
    const sheet = screen.getByRole('dialog', { name: '记一笔' })
    fireEvent.change(within(sheet).getByPlaceholderText('＋ 想看的、想查的'), { target: { value: '查一下四元数' } })
    fireEvent.submit(within(sheet).getByPlaceholderText('＋ 想看的、想查的'))

    // 写完就关，内容不可见——可见就会被拉走
    expect(screen.queryByText('查一下四元数')).toBeNull()

    // 勾掉当前这一步 → 这一件做完 → 收纳箱摊开
    fireEvent.click(screen.getByRole('button', { name: '完成「打开文档，写下标题」' }))
    expect(screen.getByText(/今天这一件做完了/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /好奇清单/ }))
    expect(screen.getByText('查一下四元数')).toBeTruthy()
  })
})
