import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useLifeApp } from '../useLifeApp'

beforeEach(() => {
  window.localStorage.clear()
})

describe('M1 morning anchor', () => {
  it('starts pending before confirmation', () => {
    const { result } = renderHook(() => useLifeApp())
    expect(result.current.isMorningAnchorPending).toBe(true)
  })

  it('anchors exactly one thing, keeps its next step, and clears pending', () => {
    const { result } = renderHook(() => useLifeApp())
    const before = result.current.dayPlan.todayItems.length

    act(() => {
      result.current.actions.confirmMorningAnchor('写报告', '打开文档，写下标题')
    })

    expect(result.current.isMorningAnchorPending).toBe(false)
    expect(result.current.dayPlan.morningAnchorDone).toBe(true)

    const normals = result.current.dayPlan.todayItems.filter((item) => item.kind === 'normal')
    // 一天一件：只多出这一条
    expect(result.current.dayPlan.todayItems.length).toBe(before + 1)
    expect(normals.map((item) => item.title)).toContain('写报告')

    // 「下一秒手放在哪」既落成今天的第一步，也写进任务定义——三个创建入口同一个口径
    const anchored = normals.find((item) => item.title === '写报告')!
    expect(anchored.steps[0].title).toBe('打开文档，写下标题')
    const task = result.current.data.taskDefs.find((entry) => entry.id === anchored.sourceTaskId)
    expect(task?.nextStep).toBe('打开文档，写下标题')

    // order is contiguous 1..n
    const orders = result.current.dayPlan.todayItems.map((item) => item.order)
    expect(orders).toEqual(orders.map((_, i) => i + 1))
  })

  it('refuses to anchor without a next step', () => {
    const { result } = renderHook(() => useLifeApp())
    act(() => {
      result.current.actions.confirmMorningAnchor('写报告', '   ')
    })
    expect(result.current.isMorningAnchorPending).toBe(true)
  })

  it('resetMorningAnchor returns to pending', () => {
    const { result } = renderHook(() => useLifeApp())
    act(() => {
      result.current.actions.confirmMorningAnchor('a', '第一步')
    })
    expect(result.current.isMorningAnchorPending).toBe(false)
    act(() => {
      result.current.actions.resetMorningAnchor()
    })
    expect(result.current.isMorningAnchorPending).toBe(true)
  })
})
