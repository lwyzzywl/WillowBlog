import { useState } from 'react'
import { BadgeCheck, DatabaseZap, Flame, Leaf, LockKeyhole, LogOut, Menu, Sparkles, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useSignOutSafely } from '../context/CloudDataProvider'
import SyncStatus from './SyncStatus'

/** 访客可见的导航：只包含两个公开模块 */
const PUBLIC_NAV_ITEMS = [
  { href: '#cs', label: '力扣题解' },
  { href: '#notes', label: '知识笔记' },
]

/** 管理员可见的完整导航 */
const ADMIN_NAV_ITEMS = [
  { href: '#dashboard', label: '首页' },
  { href: '#cs', label: '力扣题解' },
  { href: '#projects', label: '项目日志' },
  { href: '#notes', label: '知识笔记' },
  { href: '#sparkles', label: '闪光点' },
]

export default function Navbar({ checkedIn, onCheckIn, streak, onOpenMigration }) {
  const { isAdmin, sessionLoading, user, openLogin, busy } = useAuth()
  const signOutSafely = useSignOutSafely()
  const [open, setOpen] = useState(false)
  const navItems = isAdmin ? ADMIN_NAV_ITEMS : PUBLIC_NAV_ITEMS

  return (
    <header className="sticky top-0 z-50 border-b border-amber-900/5 bg-cream-50/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href={isAdmin ? '#dashboard' : '#cs'} className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-300 text-white shadow-md shadow-amber-200/60 transition-transform duration-300 group-hover:rotate-6">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-wide">
            柳树小屋
            <span className="ml-2 hidden text-xs font-semibold text-ink-300 sm:inline">Willow Blog</span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group relative rounded-full px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-amber-100/70 hover:text-wood-700"
            >
              {item.label}
              <span className="absolute inset-x-4 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-amber-400 transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          {/* 私人统计（连续打卡 / 打卡按钮）只对管理员显示，访客看不到任何私人数据摘要 */}
          {isAdmin && !sessionLoading && (
            <>
              <span className="hidden items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-bold text-orange-500 ring-1 ring-orange-200 sm:flex">
                <Flame className={`h-4 w-4 ${checkedIn ? 'animate-wiggle' : ''}`} />
                {streak} 天
              </span>
              {checkedIn ? (
                <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-600 ring-1 ring-emerald-200 sm:flex">
                  <BadgeCheck className="h-4 w-4" />
                  已打卡
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onCheckIn}
                  className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-amber-300/50 transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 sm:flex"
                >
                  <Sparkles className="h-4 w-4" />
                  打卡
                </button>
              )}
            </>
          )}

          <SyncStatus />

          {isAdmin && !sessionLoading ? (
            <div className="flex items-center gap-1.5">
              <span
                className="hidden max-w-[9rem] truncate rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-500 ring-1 ring-cream-200 lg:block"
                title={user?.email || ''}
              >
                管理员 · {user?.email}
              </span>
              <button
                type="button"
                onClick={onOpenMigration}
                className="hidden items-center gap-1.5 rounded-full bg-cream-100 px-3 py-2 text-xs font-semibold text-ink-500 ring-1 ring-cream-200 transition hover:bg-sky-50 hover:text-sky-600 sm:flex"
                title="把浏览器里的旧数据迁移到云端"
              >
                <DatabaseZap className="h-3.5 w-3.5" />
                旧数据迁移
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => signOutSafely()}
                className="flex items-center gap-1.5 rounded-full bg-cream-100 px-3 py-2 text-xs font-semibold text-ink-500 ring-1 ring-cream-200 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                title="退出登录（退出后立即恢复访客权限）"
              >
                <LogOut className="h-3.5 w-3.5" />
                退出
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openLogin}
              className="flex items-center gap-1.5 rounded-full bg-cream-100 px-3 py-2 text-xs font-semibold text-ink-400 ring-1 ring-cream-200 transition hover:bg-amber-100/70 hover:text-wood-700"
              title="管理员登录"
            >
              <LockKeyhole className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">管理员登录</span>
            </button>
          )}

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-700 transition hover:bg-amber-100/70 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="打开菜单"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="animate-fade-up border-t border-amber-900/5 bg-cream-50/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-amber-100/70 hover:text-wood-700"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
