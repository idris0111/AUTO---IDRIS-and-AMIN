import { useReducedMotion } from 'framer-motion'
import { useRef, type ReactNode, type MouseEvent } from 'react'

type Props = {
  children: ReactNode
  className?: string
  max?: number
}

export default function TiltCard({ children, className = '', max = 6 }: Props) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  if (reduced) return <div className={className}>{children}</div>

  function onMove(event: MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width - 0.5
    const py = (event.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-4px)`
    el.style.setProperty('--tilt-x', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--tilt-y', `${(py * 100).toFixed(1)}%`)
  }

  function onLeave() {
    const el = ref.current
    if (!el) return
    el.style.transform = ''
  }

  return (
    <div
      ref={ref}
      className={`au-tilt ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </div>
  )
}
