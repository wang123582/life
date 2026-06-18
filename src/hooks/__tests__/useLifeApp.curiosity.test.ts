import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useLifeApp } from '../useLifeApp'

beforeEach(() => {
  window.localStorage.clear()
})

describe('M2 curiosity list', () => {
  it('adds, archives and removes curiosity items; skips blanks', () => {
    const { result } = renderHook(() => useLifeApp())
    expect(result.current.data.curiosityItems).toHaveLength(0)

    act(() => {
      result.current.actions.addCuriosityItem('  ') // blank -> skipped
      result.current.actions.addCuriosityItem('看一篇论文')
    })
    expect(result.current.data.curiosityItems).toHaveLength(1)
    const id = result.current.data.curiosityItems[0].id
    expect(result.current.data.curiosityItems[0].text).toBe('看一篇论文')

    act(() => {
      result.current.actions.archiveCuriosityItem(id)
    })
    expect(result.current.data.curiosityItems[0].archived).toBe(true)

    act(() => {
      result.current.actions.removeCuriosityItem(id)
    })
    expect(result.current.data.curiosityItems).toHaveLength(0)
  })
})

describe('M2 rule definitions', () => {
  it('default rules include the 3 execution guidelines and can be edited/removed', () => {
    const { result } = renderHook(() => useLifeApp())
    const doRules = result.current.data.ruleDefs.filter((r) => r.type === 'do')
    expect(doRules).toHaveLength(3)

    const target = doRules[0]
    act(() => {
      result.current.actions.updateRuleDefinition(target.id, '改写后的守则')
    })
    expect(result.current.data.ruleDefs.find((r) => r.id === target.id)?.text).toBe('改写后的守则')

    act(() => {
      result.current.actions.removeRuleDefinition(target.id)
    })
    expect(result.current.data.ruleDefs.find((r) => r.id === target.id)).toBeUndefined()
  })
})
