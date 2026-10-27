import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

export default function ScrollProgress() {
  const reduced = useReducedMotion()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (reduced) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const el = document.documentElement
        const max = el.scrollHeight - el.clientHeight
        setProgress(max > 0 ? el.scrollTop / max : 0)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [reduced])

  if (reduced) return null

  return (
    <motion.div
      className="au-scroll-progress"
      aria-hidden="true"
      initial={false}
      animate={{ scaleX: progress }}
      transition={{ duration: 0.12, ease: 'linear' }}
    />
  )
}
