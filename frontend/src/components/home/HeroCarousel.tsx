import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

const slides = [
  { src: '/images/black-silver-coupe.jpg', alt: 'Чёрный спортивный автомобиль в графитовой студии', caption: '01 / ИНЖЕНЕРИЯ ДВИЖЕНИЯ', objectPosition: 'center 50%' },
  { src: '/images/hero-sport-coupe.jpg', alt: 'Тёмное спорт-купе на ночной трассе', caption: '02 / СПОРТИВНАЯ ДИНАМИКА', objectPosition: 'center 55%' },
  { src: '/images/hero-muscle-car.jpg', alt: 'Мощный автомобиль в тёмной студии', caption: '03 / МОЩЬ ДВИЖЕНИЯ', objectPosition: 'center 45%' },
  { src: '/images/hero-night-sedan.jpg', alt: 'Чёрный седан в студийном свете', caption: '04 / ГОРОДСКОЙ ХАРАКТЕР', objectPosition: 'center 50%' },
]

const INTERVAL = 5200

export default function HeroCarousel() {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (reduceMotion || paused) return
    timerRef.current = setInterval(() => {
      setIndex(prev => (prev + 1) % slides.length)
    }, INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [reduceMotion, paused])

  return (
    <div
      className="mp-hero-photo"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-label="Галерея автомобилей"
    >
      {slides.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          alt={i === index ? slide.alt : ''}
          aria-hidden={i !== index}
          className={`hero-slide${i === index ? ' hero-slide-active' : ''}`}
          style={{ objectPosition: slide.objectPosition }}
          fetchPriority={i === 0 ? 'high' : 'auto'}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}
      <span className="hero-slide-caption" aria-live="polite">{slides[index].caption}</span>
      <div className="hero-dots" role="tablist" aria-label="Слайды">
        {slides.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Слайд ${i + 1}: ${slide.caption}`}
            className={i === index ? 'active' : ''}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  )
}
