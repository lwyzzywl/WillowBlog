import { useState } from 'react'
import { Leaf } from 'lucide-react'
import Navbar from './components/Navbar'
import Dashboard from './components/Dashboard'
import CsFundamentals from './components/CsFundamentals'
import FocusTimer from './components/FocusTimer'
import KnowledgeNotebook from './components/KnowledgeNotebook'
import ProjectLog from './components/ProjectLog'
import SparklesBoard from './components/SparklesBoard'
import Toast from './components/Toast'
import fireConfetti from './confetti'
import { toast, todayKey } from './hooks'

/** 根据真实打卡日期计算连续学习天数（今天没打卡就从昨天起算） */
function computeStreak(keys) {
  const set = new Set(keys)
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  if (!set.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (set.has(todayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export default function App() {
  const [checkins, setCheckins] = useState(() => {
    try {
      localStorage.removeItem('willow:checkin')
      const raw = localStorage.getItem('willow:checkins')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  const today = todayKey()
  const checkedIn = checkins.includes(today)
  const streak = computeStreak(checkins)

  const persist = (next) => {
    try {
      localStorage.setItem('willow:checkins', JSON.stringify(next))
    } catch {
      /* 忽略存储异常 */
    }
  }

  const handleCheckIn = (event) => {
    if (checkedIn) return
    fireConfetti(event)
    const next = [...checkins, today]
    setCheckins(next)
    persist(next)
    toast('太棒了！今天也迈出了一小步 🌿')
  }

  const handleResetCheckins = () => {
    if (!window.confirm('确定要清空所有打卡记录，重新开始吗？')) return
    setCheckins([])
    persist([])
    toast('打卡记录已清零，从今天开始积累吧 🌱')
  }

  return (
    <div className="min-h-screen">
      <Navbar checkedIn={checkedIn} onCheckIn={handleCheckIn} streak={streak} />
      <FocusTimer />

      <main>
        <Dashboard
          checkedIn={checkedIn}
          onCheckIn={handleCheckIn}
          streak={streak}
          checkins={checkins}
          onResetCheckins={handleResetCheckins}
        />
        <div className="mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-amber-200/80 to-transparent" />
        <CsFundamentals />
        <div className="mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-rose-200/80 to-transparent" />
        <ProjectLog />
        <div className="mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-sky-200/80 to-transparent" />
        <KnowledgeNotebook />
        <div className="mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-violet-200/80 to-transparent" />
        <SparklesBoard />
      </main>

      <footer className="border-t border-amber-900/5 bg-cream-100/60 py-10 text-center">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-300 text-white shadow-md shadow-amber-200/60">
              <Leaf className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 font-display font-bold">每天进步一点点 🌿</p>
          <p className="mt-1 text-xs text-ink-400">
            WillowBlog · 用代码记录成长，用温柔治愈生活 · {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      <Toast />
    </div>
  )
}
