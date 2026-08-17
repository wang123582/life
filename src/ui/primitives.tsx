import type { ReactNode } from 'react'

/**
 * 日志本版式：标题和计数落在左侧页边栏，正文在右栏。
 * 分组靠位置区分，不靠盒子——所以正文里不再需要任何描边。
 * 窄屏时页边栏塌成一条普通标题行。
 */
export function Section({
  title,
  count,
  desc,
  actions,
  children,
  className,
}: {
  title?: string
  count?: ReactNode
  desc?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={className ? `sec ${className}` : 'sec'}>
      {title ? (
        <header className="gutter">
          <h2>{title}</h2>
          {count !== undefined && count !== null ? <b>{count}</b> : null}
          {actions ? <div className="gutter-actions">{actions}</div> : null}
        </header>
      ) : (
        <div className="gutter" aria-hidden="true" />
      )}
      <div className="body">
        {desc ? <p className="desc">{desc}</p> : null}
        {children}
      </div>
    </section>
  )
}

/** 折叠区块：次要内容默认收起，标题仍在页边栏，收合箭头贴着正文栏。 */
export function Fold({
  title,
  count,
  desc,
  children,
  open,
}: {
  title: string
  count?: ReactNode
  desc?: string
  children: ReactNode
  open?: boolean
}) {
  return (
    <details className="sec fold" open={open}>
      <summary>
        <span className="gutter">
          <h2>{title}</h2>
          {count !== undefined && count !== null ? <b>{count}</b> : null}
        </span>
        <span className="fold-bar">
          {desc ? <span className="desc">{desc}</span> : null}
          <i aria-hidden="true" />
        </span>
      </summary>
      <div className="body">{children}</div>
    </details>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">
        {label}
        {hint ? <em>{hint}</em> : null}
      </span>
      {children}
    </label>
  )
}

export function Toggle({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <label className={disabled ? 'switch disabled' : 'switch'}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="track" aria-hidden="true">
        <span className="knob" />
      </span>
      <span>{children}</span>
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (next: T) => void
}) {
  return (
    <div className="seg">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          className={option.value === value ? 'active' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

export function Note({ tone, children }: { tone?: 'muted' | 'success' | 'error'; children: ReactNode }) {
  if (!children) return null
  return <p className={`note ${tone ?? 'muted'}`}>{children}</p>
}

export function Modal({
  title,
  desc,
  onClose,
  children,
}: {
  title: string
  desc?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label={title}>
        <header>
          <div>
            <h2>{title}</h2>
            {desc ? <p>{desc}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
