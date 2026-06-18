/**
 * 核心原则（proposal §5）——固定内置、不可编辑、不可关闭。
 * 与可编辑的「执行守则」(ruleDefs) 区分：原则不可改，守则可改。
 */
export const CORE_PRINCIPLES = [
  '今日 3 件事优先于一切',
  '23:00 硬性收工，无例外',
  '感到拖延时，只启动 5 分钟',
  '崩溃后不自责，只重启',
  '进度由完成件数衡量，不由感觉',
  'AI 是工具，不是拐杖',
] as const

export type CorePrinciple = (typeof CORE_PRINCIPLES)[number]
