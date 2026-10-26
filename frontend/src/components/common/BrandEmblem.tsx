export default function BrandEmblem({ size = 46, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="be-gold" x1="14" y1="8" x2="50" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f0d78c" />
          <stop offset=".45" stopColor="#d9a441" />
          <stop offset="1" stopColor="#8a6420" />
        </linearGradient>
        <linearGradient id="be-steel" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e8ebee" />
          <stop offset=".5" stopColor="#9aa3ad" />
          <stop offset="1" stopColor="#5c646d" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="#101318" stroke="url(#be-steel)" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="23.5" fill="none" stroke="url(#be-gold)" strokeWidth="1.4" strokeDasharray="3.2 2.4" opacity=".9" />
      <circle cx="32" cy="32" r="20" fill="#161a20" stroke="#3a424c" strokeWidth="1" />
      <path d="M32 13.5 44.5 46h-5.4l-2.3-6.2H23.2L20.9 46H15.5L28 13.5h4zm-1.7 22.6h7.4L32 24.8l-1.7 11.3z" fill="url(#be-gold)" />
      <path d="M24 39.5h16l1.6 4.2H22.4L24 39.5z" fill="url(#be-steel)" opacity=".85" />
      <circle cx="32" cy="47.8" r="2.6" fill="#101318" stroke="url(#be-gold)" strokeWidth="1.3" />
      <circle cx="14.5" cy="22" r="1.4" fill="url(#be-gold)" />
      <circle cx="49.5" cy="22" r="1.4" fill="url(#be-gold)" />
      <circle cx="14.5" cy="42" r="1.4" fill="url(#be-gold)" />
      <circle cx="49.5" cy="42" r="1.4" fill="url(#be-gold)" />
    </svg>
  )
}
