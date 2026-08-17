import { useCallback, useEffect, useRef } from 'react'
import dayjs from 'dayjs'
import { NOTE_COLORS } from '../ui/theme'
import type { LifeApp } from '../hooks/useLifeApp'

/** 全局过程笔记：任何页面随时记，按天存到 dayPlan.processNotes。 */
export function NotesSheet({ life, open, onToggle }: { life: LifeApp; open: boolean; onToggle: (next: boolean) => void }) {
  const { dayKey, dayPlan, actions } = life
  const editorRef = useRef<HTMLDivElement | null>(null)
  const saveTimer = useRef(0)

  const saveNow = useCallback(() => {
    const el = editorRef.current
    if (el) actions.updateProcessNotes(el.innerHTML)
  }, [actions])

  const onInput = useCallback(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(saveNow, 300)
  }, [saveNow])

  const exec = useCallback(
    (command: string, value?: string) => {
      const el = editorRef.current
      if (!el) return
      el.focus()
      document.execCommand(command, false, value)
      saveNow()
    },
    [saveNow],
  )

  const insertCode = useCallback(
    (block: boolean) => {
      const selection = window.getSelection()
      const text = (selection?.toString() || (block ? '代码块' : 'code'))
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      exec('insertHTML', block ? `<pre><code>${text}</code></pre><br>` : `<code>${text}</code>`)
    },
    [exec],
  )

  useEffect(() => {
    if (open) requestAnimationFrame(() => editorRef.current?.focus())
  }, [open])

  if (!open) return null

  return (
    <div className="notes-overlay" role="dialog" aria-label="过程笔记" onMouseDown={(event) => event.target === event.currentTarget && onToggle(false)}>
      <div className="notes-sheet">
        <header className="notes-head">
          <strong>{dayjs(dayKey).format('M 月 D 日')}</strong>
          <span>过程笔记 · 自动保存</span>
          <button type="button" className="icon-btn" onClick={() => onToggle(false)} aria-label="收起">
            ✕
          </button>
        </header>

        <div
          key={dayKey}
          ref={(el) => {
            editorRef.current = el
            if (el && !el.dataset.initialized) {
              el.innerHTML = dayPlan.processNotes ?? ''
              el.dataset.initialized = '1'
            }
          }}
          className="notes-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onBlur={saveNow}
          data-placeholder="随时记录想法、发现、卡点…"
        />

        <div className="notes-tools">
          <button
            type="button"
            onClick={() => {
              const el = editorRef.current
              if (!el) return
              const stamp = `<span class="stamp">${dayjs().format('HH:mm')}</span>&nbsp;`
              el.innerHTML += el.innerHTML.trim() ? `<br>${stamp}` : stamp
              actions.updateProcessNotes(el.innerHTML)
              requestAnimationFrame(() => {
                el.scrollTop = el.scrollHeight
                el.focus()
              })
            }}
          >
            ＋ 时间
          </button>
          <span className="sep" aria-hidden="true" />
          <button type="button" onClick={() => exec('bold')} style={{ fontWeight: 700 }} aria-label="加粗">
            B
          </button>
          <button type="button" onClick={() => exec('insertUnorderedList')} aria-label="列表">
            •
          </button>
          <button type="button" onClick={() => insertCode(false)} aria-label="行内代码">
            code
          </button>
          <button type="button" onClick={() => insertCode(true)} aria-label="代码块">
            {'</>'}
          </button>
          <span className="notes-colors">
            {NOTE_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className="dot"
                style={{ background: color.value === 'inherit' ? 'currentColor' : color.value }}
                title={color.label}
                aria-label={`字色 ${color.label}`}
                onClick={() => exec('foreColor', color.value === 'inherit' ? '' : color.value)}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}
