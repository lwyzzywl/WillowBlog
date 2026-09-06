import { useEffect, useId, useState } from 'react'

export default function CircularProgress({
  value,
  size = 120,
  stroke = 10,
  color = '#f59e0b',
  colorEnd = '#fbbf24',
  track = '#f1e7d7',
  label = '掌握度',
  center,
}) {
  const gradientId = useId()
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const [offset, setOffset] = useState(circumference)

  useEffect(() => {
    let raf
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        setOffset(circumference * (1 - Math.min(100, value) / 100))
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [value, circumference])

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={colorEnd} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {center || (
          <>
            <span className="font-display text-2xl font-bold">
              {Math.round(value)}
              <span className="text-sm">%</span>
            </span>
            <span className="text-[10px] text-ink-400">{label}</span>
          </>
        )}
      </div>
    </div>
  )
}
