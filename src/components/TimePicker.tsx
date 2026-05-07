import { useCallback, useEffect, useRef, useState } from 'react'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

const ITEM_HEIGHT = 40
const VISIBLE_COUNT = 5 // show 5 items at a time, middle one is selected

interface WheelColumnProps {
  items: string[]
  value: string
  onChange: (value: string) => void
  label: string
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

function WheelColumn({ items, value, onChange, label }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const scrollStart = useRef(0)
  const currentOffset = useRef(0)
  const animFrame = useRef(0)
  const [offset, setOffset] = useState(0)
  const isDragging = useRef(false)
  const lastMoveTime = useRef(0)
  const lastMoveY = useRef(0)
  const velocity = useRef(0)

  const selectedIndex = items.indexOf(value)
  const maxOffset = (items.length - 1) * ITEM_HEIGHT

  // sync offset when value changes externally
  useEffect(() => {
    const idx = items.indexOf(value)
    if (idx >= 0) {
      const newOffset = idx * ITEM_HEIGHT
      currentOffset.current = newOffset
      setOffset(newOffset)
    }
  }, [value, items])

  const snapToNearest = useCallback(
    (rawOffset: number) => {
      const clamped = clamp(rawOffset, 0, maxOffset)
      const index = Math.round(clamped / ITEM_HEIGHT)
      const snapped = index * ITEM_HEIGHT
      currentOffset.current = snapped
      setOffset(snapped)
      onChange(items[index])
    },
    [items, maxOffset, onChange],
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      cancelAnimationFrame(animFrame.current)
      isDragging.current = true
      touchStartY.current = e.touches[0].clientY
      scrollStart.current = currentOffset.current
      lastMoveTime.current = Date.now()
      lastMoveY.current = e.touches[0].clientY
      velocity.current = 0
    },
    [],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current) return
      e.preventDefault()
      const deltaY = touchStartY.current - e.touches[0].clientY
      const now = Date.now()
      const dt = now - lastMoveTime.current
      if (dt > 0) {
        velocity.current = (lastMoveY.current - e.touches[0].clientY) / dt
      }
      lastMoveTime.current = now
      lastMoveY.current = e.touches[0].clientY
      const newOffset = clamp(scrollStart.current + deltaY, -ITEM_HEIGHT, maxOffset + ITEM_HEIGHT)
      currentOffset.current = newOffset
      setOffset(newOffset)
    },
    [maxOffset],
  )

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
    // apply momentum
    const momentum = velocity.current * 120
    snapToNearest(currentOffset.current + momentum)
  }, [snapToNearest])

  // mouse wheel
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const direction = e.deltaY > 0 ? 1 : -1
      const idx = items.indexOf(value)
      const nextIdx = clamp(idx + direction, 0, items.length - 1)
      const snapped = nextIdx * ITEM_HEIGHT
      currentOffset.current = snapped
      setOffset(snapped)
      onChange(items[nextIdx])
    },
    [items, value, onChange],
  )

  // mouse drag for desktop
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      cancelAnimationFrame(animFrame.current)
      isDragging.current = true
      touchStartY.current = e.clientY
      scrollStart.current = currentOffset.current
      velocity.current = 0
      lastMoveTime.current = Date.now()
      lastMoveY.current = e.clientY

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return
        const deltaY = touchStartY.current - ev.clientY
        const now = Date.now()
        const dt = now - lastMoveTime.current
        if (dt > 0) {
          velocity.current = (lastMoveY.current - ev.clientY) / dt
        }
        lastMoveTime.current = now
        lastMoveY.current = ev.clientY
        const newOffset = clamp(scrollStart.current + deltaY, -ITEM_HEIGHT, maxOffset + ITEM_HEIGHT)
        currentOffset.current = newOffset
        setOffset(newOffset)
      }

      const handleMouseUp = () => {
        isDragging.current = false
        const momentum = velocity.current * 120
        snapToNearest(currentOffset.current + momentum)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [maxOffset, snapToNearest],
  )

  const centerIndex = Math.round(offset / ITEM_HEIGHT)
  const halfVisible = Math.floor(VISIBLE_COUNT / 2)

  return (
    <div className="wheel-column">
      <span className="wheel-label">{label}</span>
      <div
        ref={containerRef}
        className="wheel-viewport"
        style={{ height: VISIBLE_COUNT * ITEM_HEIGHT }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <div className="wheel-highlight" style={{ top: halfVisible * ITEM_HEIGHT, height: ITEM_HEIGHT }} />
        <div
          className="wheel-track"
          style={{ transform: `translateY(${halfVisible * ITEM_HEIGHT - offset}px)` }}
        >
          {items.map((item, i) => {
            const distance = Math.abs(i - centerIndex)
            const opacity = distance === 0 ? 1 : distance === 1 ? 0.5 : 0.25
            const scale = distance === 0 ? 1 : distance === 1 ? 0.88 : 0.78
            return (
              <div
                key={item}
                className={`wheel-item ${i === selectedIndex ? 'selected' : ''}`}
                style={{
                  height: ITEM_HEIGHT,
                  opacity,
                  transform: `scale(${scale})`,
                }}
                onClick={() => snapToNearest(i * ITEM_HEIGHT)}
              >
                {item}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface TimePickerProps {
  value: string // "HH:MM" or ""
  onChange: (value: string) => void
  className?: string
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [hour, setHour] = useState(() => {
    if (value) {
      const parts = value.split(':')
      return parts[0] ?? '12'
    }
    return '12'
  })

  const [minute, setMinute] = useState(() => {
    if (value) {
      const parts = value.split(':')
      return parts[1] ?? '00'
    }
    return '00'
  })

  // sync from external value
  useEffect(() => {
    if (value) {
      const parts = value.split(':')
      if (parts[0]) setHour(parts[0])
      if (parts[1]) setMinute(parts[1])
    }
  }, [value])

  const handleHourChange = useCallback(
    (h: string) => {
      setHour(h)
      onChange(`${h}:${minute}`)
    },
    [minute, onChange],
  )

  const handleMinuteChange = useCallback(
    (m: string) => {
      setMinute(m)
      onChange(`${hour}:${m}`)
    },
    [hour, onChange],
  )

  return (
    <div className={`time-picker ${className ?? ''}`}>
      <WheelColumn items={HOURS} value={hour} onChange={handleHourChange} label="时" />
      <span className="time-picker-separator">:</span>
      <WheelColumn items={MINUTES} value={minute} onChange={handleMinuteChange} label="分" />
    </div>
  )
}
