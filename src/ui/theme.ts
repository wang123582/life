/** 强调色预设：只换 accent，明暗底色由 index.css 的 light/dark token 统一控制。 */
export interface AccentPreset {
  id: string
  label: string
  accent: string
  accent2: string
}

export const ACCENTS: AccentPreset[] = [
  { id: 'default', label: '靛蓝', accent: '#4f6bed', accent2: '#7c6cf5' },
  { id: 'ocean', label: '海青', accent: '#0ea5b7', accent2: '#22a7d8' },
  { id: 'forest', label: '森绿', accent: '#2f9e6e', accent2: '#4caf50' },
  { id: 'warm', label: '暖橙', accent: '#e2762f', accent2: '#e0a02a' },
  { id: 'violet', label: '紫粉', accent: '#9b5de5', accent2: '#e05a9c' },
]

export type Appearance = 'auto' | 'light' | 'dark'

export const APPEARANCES: Array<{ id: Appearance; label: string }> = [
  { id: 'auto', label: '跟随系统' },
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
]

/** 过程笔记取色盘，浅色与深色背景上都能读。 */
export const NOTE_COLORS: Array<{ label: string; value: string }> = [
  { label: '默认', value: 'inherit' },
  { label: '灰', value: '#8a92a0' },
  { label: '红', value: '#e0483c' },
  { label: '橙', value: '#d97706' },
  { label: '绿', value: '#12915f' },
  { label: '蓝', value: '#2563eb' },
  { label: '紫', value: '#7c3aed' },
]

export const TABS = [
  { key: 'today', label: '今天', icon: '◎' },
  { key: 'pool', label: '任务池', icon: '☰' },
  { key: 'review', label: '复盘', icon: '◔' },
  { key: 'templates', label: '设置', icon: '⚙' },
] as const
