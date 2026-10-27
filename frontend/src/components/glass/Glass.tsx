import type { ComponentPropsWithoutRef, ComponentPropsWithRef } from 'react'

type Material = 'soft' | 'elevated' | 'inset'
type SurfaceProps = ComponentPropsWithoutRef<'section'> & { material?: Material }

/** Shared material primitive. Native props preserve semantics and keyboard behavior. */
export function GlassPanel({ material = 'soft', className = '', ...props }: SurfaceProps) {
  return <section className={`glass-surface glass-${material} ${className}`} {...props} />
}

export function GlassCard({ material = 'soft', className = '', ...props }: ComponentPropsWithoutRef<'article'> & { material?: Material }) {
  return <article className={`glass-surface glass-${material} ${className}`} {...props} />
}

export function GlassButton({ variant = 'primary', className = '', type = 'button', ...props }: ComponentPropsWithoutRef<'button'> & { variant?: 'primary' | 'secondary' | 'quiet' }) {
  return <button type={type} className={`glass-button glass-button-${variant} ${className}`} {...props} />
}

export function GlassSidebar({ material = 'elevated', className = '', ...props }: ComponentPropsWithoutRef<'aside'> & { material?: Material }) {
  return <aside className={`glass-surface glass-${material} ${className}`} {...props} />
}

export function GlassNavbar({ material = 'soft', className = '', ...props }: ComponentPropsWithoutRef<'header'> & { material?: Material }) {
  return <header className={`glass-surface glass-${material} ${className}`} {...props} />
}

export function GlassSearch({ material = 'inset', className = '', ...props }: ComponentPropsWithoutRef<'label'> & { material?: Material }) {
  return <label className={`glass-surface glass-${material} ${className}`} {...props} />
}

export function GlassTable({ material = 'soft', className = '', ...props }: ComponentPropsWithoutRef<'table'> & { material?: Material }) {
  return <table className={`glass-table glass-${material} ${className}`} {...props} />
}

// Purpose-specific names use the same three materials rather than independent styles.
export const GlassStatCard = GlassCard
export const GlassProductCard = GlassCard
export const GlassChartContainer = GlassPanel

/** Native dialog supplies modal focus containment, Escape and focus restoration. */
export function GlassModal({ material = 'elevated', className = '', ...props }: ComponentPropsWithRef<'dialog'> & { material?: Material }) {
  return <dialog className={`glass-surface glass-${material} glass-modal ${className}`} {...props} />
}

/** Native disclosure preserves keyboard access without imposing menu semantics. */
export function GlassDropdown({ material = 'elevated', className = '', ...props }: ComponentPropsWithoutRef<'details'> & { material?: Material }) {
  return <details className={`glass-surface glass-${material} glass-dropdown ${className}`} {...props} />
}
