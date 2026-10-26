import { useState } from 'react'
import type { ArticleCategory } from '../../types'

const fallbackClass: Record<ArticleCategory, string> = {
  guide: 'article-artwork-brakes',
  maintenance: 'article-artwork-engine',
  diy: 'article-artwork-suspension',
  review: 'article-artwork-oils',
  news: 'article-artwork-lighting',
}

export default function ArticleArtwork({ src, alt, category, className = '' }: {
  src?: string | null
  alt: string
  category: ArticleCategory
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  return (
    <div className={`article-artwork ${fallbackClass[category]} ${className}`} role="img" aria-label={alt}>
      {src && !failed && <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />}
    </div>
  )
}
