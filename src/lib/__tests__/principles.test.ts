import { describe, expect, it } from 'vitest'
import { CORE_PRINCIPLES } from '../principles'

describe('M5 core principles', () => {
  it('contains exactly the 6 proposal §5 principles in order', () => {
    expect(CORE_PRINCIPLES).toEqual([
      '今日 3 件事优先于一切',
      '23:00 硬性收工，无例外',
      '感到拖延时，只启动 5 分钟',
      '崩溃后不自责，只重启',
      '进度由完成件数衡量，不由感觉',
      'AI 是工具，不是拐杖',
    ])
  })

  it('has length 6', () => {
    expect(CORE_PRINCIPLES).toHaveLength(6)
  })
})
