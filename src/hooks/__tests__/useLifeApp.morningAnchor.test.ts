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

  it('confirms at most topTaskSlots items, skips blanks, and clears pending', () => {
    const { result } = renderHook(() => useLifeApp())
    const slots = result.current.data.dailyTemplate.topTaskSlots // default 3
    const before = result.current.dayPlan.todayItems.length

    act(() => {
      result.current.actions.confirmMorningAnchor(['写报告', '  ', '健身', '读书', '多余的一条'])
    })

    expect(result.current.isMorningAnchorPending).toBe(false)
    expect(result.current.dayPlan.morningAnchorDone).toBe(true)

    const normalTitles = result.current.dayPlan.todayItems
      .filter((item) => item.kind === 'normal')
      .map((item) => item.title)
    // exactly `slots` new normal items were added (blanks skipped, overflow trimmed)
    expect(result.current.dayPlan.todayItems.length).toBe(before + slots)
    expect(normalTitles).toContain('写报告')
    expect(normalTitles).toContain('健身')
    expect(normalTitles).toContain('读书')
    expect(normalTitles).not.toContain('多余的一条')

    // order is contiguous 1..n
    const orders = result.current.dayPlan.todayItems.map((item) => item.order)
    expect(orders).toEqual(orders.map((_, i) => i + 1))
  })

  it('resetMorningAnchor returns to pending', () => {
    const { result } = renderHook(() => useLifeApp())
    act(() => {
      result.current.actions.confirmMorningAnchor(['a', 'b', 'c'])
    })
    expect(result.current.isMorningAnchorPending).toBe(false)
    act(() => {
      result.current.actions.resetMorningAnchor()
    })
    expect(result.current.isMorningAnchorPending).toBe(true)
  })
})
