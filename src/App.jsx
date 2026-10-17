import { useMemo, useState } from 'react'
import { AlertTriangle, BookMarked, Code2, Leaf } from 'lucide-react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { CloudDataProvider, useCollection } from './context/CloudDataProvider'
import { configProblem } from './lib/supabase'
import { toast, todayKey } from './hooks'
import AdminLogin from './components/AdminLogin'
import Dashboard from './components/Dashboard'
import FocusTimer from './components/FocusTimer'
import KnowledgeNotebook from './components/KnowledgeNotebook'
import LeetCodeSection from './components/LeetCodeSection'
import MigrationDialog from './components/MigrationDialog'
import Navbar from './components/Navbar'
import ProjectLog from './components/ProjectLog'
import SparklesBoard from './components/SparklesBoard'
import Toast from './components/Toast'
import fireConfetti from './confetti'

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

/** 访客首页：只讲公开模块，不出现任何私人统计 */
function VisitorHero() {
  return (
    <section id="welcome" className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 md:pt-20">
        <p className="text-sm font-medium text-ink-400">Willow Blog · 公开分享</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">🌿 欢迎来到柳树小屋</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
          这里是站长公开分享学习笔记的地方。挑一篇文章慢慢读，不需要登录。
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <a
            href="#cs"
            className="group flex items-start gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-amber-100 transition hover:-translate-y-1 hover:shadow-md"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-500">
              <Code2 className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-display text-lg font-bold text-ink-800 group-hover:text-wood-700">力扣题解</span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-400">
                每道题的思路、解题过程与复杂度分析，代码可以直接复制。
              </span>
            </span>
          </a>

          <a
            href="#notes"
            className="group flex items-start gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-amber-100 transition hover:-translate-y-1 hover:shadow-md"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-500">
              <BookMarked className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-display text-lg font-bold text-ink-800 group-hover:text-wood-700">知识笔记</span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-400">
                操作系统、网络、算法等零散知识点的整理，按分类归档。
              </span>
            </span>
          </a>
        </div>
      </div>
    </section>
  )
}

/** 未配置 Supabase 时的醒目提示，避免开发者面对白屏 */
function ConfigNotice() {
  const [hidden, setHidden] = useState(false)
  const problem = configProblem()
  if (!problem || hidden) return null
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
      <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="text-sm leading-relaxed text-amber-800">
          <p className="font-bold">Supabase 尚未配置</p>
          <p className="mt-1 text-[13px]">{problem}</p>
          <p className="mt-1 text-[13px]">
            配置完成后可以正常读写云端数据；在此之前页面依然可以打开，但不会写入任何数据。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
        >
          知道了
        </button>
      </div>
    </div>
  )
}

function AppShell() {
  const { isAdmin, sessionLoading } = useAuth()
  const [migrationOpen, setMigrationOpen] = useState(false)
  const checkinsCollection = useCollection('checkins')
  const checkins = checkinsCollection.data

  const today = todayKey()
  const checkedIn = Array.isArray(checkins) && checkins.includes(today)
  const streak = useMemo(() => computeStreak(Array.isArray(checkins) ? checkins : []), [checkins])

  const handleCheckIn = (event) => {
    // 访客没有写权限，这里再挡一次（按钮本身也不会渲染）
    if (!isAdmin || checkedIn) return
    fireConfetti(event)
    checkinsCollection.commit((prev) => [...(Array.isArray(prev) ? prev : []), today])
    toast('太棒了！今天也迈出了一小步 🌿')
  }

  const handleResetCheckins = () => {
    if (!isAdmin) return
    if (!window.confirm('确定要清空所有打卡记录，重新开始吗？')) return
    checkinsCollection.commit(() => [])
    toast('打卡记录已清零，从今天开始积累吧 🌱')
  }

  return (
    <div className="min-h-screen">
      <Navbar checkedIn={checkedIn} onCheckIn={handleCheckIn} streak={streak} onOpenMigration={() => setMigrationOpen(true)} />
      <ConfigNotice />
      {isAdmin && <FocusTimer />}
      {isAdmin && !sessionLoading && <MigrationDialog open={migrationOpen} onClose={() => setMigrationOpen(false)} />}

      <main>
        {isAdmin ? (
          <Dashboard
            checkedIn={checkedIn}
            onCheckIn={handleCheckIn}
            streak={streak}
            checkins={Array.isArray(checkins) ? checkins : []}
            onResetCheckins={handleResetCheckins}
          />
        ) : (
          <VisitorHero />
        )}

        <div className="mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-amber-200/80 to-transparent" />
        <LeetCodeSection />
        {isAdmin && (
          <>
            <div className="mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-rose-200/80 to-transparent" />
            <ProjectLog />
          </>
        )}
        <div className="mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-sky-200/80 to-transparent" />
        <KnowledgeNotebook />
        {isAdmin && (
          <>
            <div className="mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-violet-200/80 to-transparent" />
            <SparklesBoard />
          </>
        )}
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

      <AdminLogin />
      <Toast />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CloudDataProvider>
        <AppShell />
      </CloudDataProvider>
    </AuthProvider>
  )
}
