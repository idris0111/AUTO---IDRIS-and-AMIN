import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const slides = [
  { src: '/images/black-silver-coupe.jpg', alt: 'Чёрный спортивный автомобиль в графитовой студии', caption: '01 / ИНЖЕНЕРИЯ ДВИЖЕНИЯ', objectPosition: 'center 50%' },
  { src: '/images/hero-sport-coupe.jpg', alt: 'Тёмное спорт-купе на ночной трассе', caption: '02 / СПОРТИВНАЯ ДИНАМИКА', objectPosition: 'center 55%' },
  { src: '/images/hero-muscle-car.jpg', alt: 'Мощный автомобиль в тёмной студии', caption: '03 / МОЩЬ ДВИЖЕНИЯ', objectPosition: 'center 45%' },
  { src: '/images/hero-night-sedan.jpg', alt: 'Чёрный седан в студийном свете', caption: '04 / ГОРОДСКОЙ ХАРАКТЕР', objectPosition: 'center 50%' },
]

const INTERVAL = 6500

export default function HeroCarousel() {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(!document.hidden)
  const running = !reduceMotion && !paused && !hovered && !focused && visible

  useEffect(() => {
    const change = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', change)
    return () => document.removeEventListener('visibilitychange', change)
  }, [])

  useEffect(() => {
    if (!running) return
    const timer = setTimeout(() => {
      setIndex(prev => (prev + 1) % slides.length)
    }, INTERVAL)
    return () => {
      clearTimeout(timer)
    }
  }, [running, index])

  function step(amount: number) { setIndex(value => (value + amount + slides.length) % slides.length) }

  return (
    <div
      className="mp-hero-photo"
      data-slide={index}
    >
      {slides.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          alt=""
          aria-hidden="true"
          className={`hero-slide${i === index ? ' hero-slide-active' : ''}`}
          style={{ objectPosition: slide.objectPosition }}
          fetchPriority={i === 0 ? 'high' : 'auto'}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}
      <div className="hero-controls" role="region" aria-roledescription="carousel" aria-label={t('Галерея автомобилей')}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
        onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); step(1) }; if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1) } }}>
      <div className="hero-slide-meta" aria-live={running ? 'off' : 'polite'}><span>{String(index + 1).padStart(2, '0')} <i>/ 04</i></span><small>{t(slides[index].caption.slice(5))}</small></div>
      <div className="hero-navigation">
      <button type="button" onClick={() => step(-1)} aria-label={t('Предыдущий слайд')}><ChevronLeft size={17} /></button>
      <div className="hero-dots" role="group" aria-label={t('Галерея автомобилей')}>
        {slides.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            aria-pressed={i === index}
            aria-label={`${i + 1} · ${t(slide.caption.slice(5))}`}
            className={i === index ? 'active' : ''}
            onClick={() => setIndex(i)}
          ><span /></button>
        ))}
      </div>
      <button type="button" onClick={() => step(1)} aria-label={t('Следующий слайд')}><ChevronRight size={17} /></button>
      <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)} aria-label={t(paused ? 'Продолжить' : 'Приостановить')}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
      </div>
      </div>
    </div>
  )
}
