import confetti from 'canvas-confetti'

const CONFETTI_COLORS = ['#f59e0b', '#fb7185', '#34d399', '#60a5fa', '#c084fc', '#fbbf24']

/** 在点击位置（或屏幕中上方）撒下温暖配色的纸屑雨 */
export default function fireConfetti(event) {
  const origin = event?.currentTarget
    ? (() => {
        const rect = event.currentTarget.getBoundingClientRect()
        return {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        }
      })()
    : { x: 0.5, y: 0.6 }

  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 34,
    scalar: 0.95,
    ticks: 200,
    origin,
    colors: CONFETTI_COLORS,
    disableForReducedMotion: true,
  })
  setTimeout(() => {
    confetti({
      particleCount: 45,
      spread: 120,
      startVelocity: 26,
      scalar: 0.8,
      ticks: 160,
      origin,
      colors: CONFETTI_COLORS,
      shapes: ['star', 'circle'],
      disableForReducedMotion: true,
    })
  }, 220)
}
