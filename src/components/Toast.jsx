import { useEffect, useRef, useState } from 'react'

export default function Toast() {
  const [message, setMessage] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const handler = (event) => {
      setMessage(event.detail)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setMessage(null), 2800)
    }
    window.addEventListener('willow:toast', handler)
    return () => {
      window.removeEventListener('willow:toast', handler)
      clearTimeout(timerRef.current)
    }
  }, [])

  if (!message) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[80] flex justify-center px-4">
      <div
        key={message}
        className="animate-pop-in rounded-2xl bg-ink-900/85 px-5 py-3 text-sm font-medium text-cream-50 shadow-2xl backdrop-blur"
      >
        {message}
      </div>
    </div>
  )
}
