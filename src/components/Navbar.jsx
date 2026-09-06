import { useState } from 'react'
import { BadgeCheck, Flame, Leaf, Menu, Sparkles, X } from 'lucide-react'

const NAV_ITEMS = [
  { href: '#dashboard', label: '首页' },
  { href: '#cs', label: '学习记录' },
  { href: '#projects', label: '项目日志' },
  { href: '#notes', label: '知识笔记' },
  { href: '#sparkles', label: '闪光点' },
]

export default function Navbar({ checkedIn, onCheckIn, streak }) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-amber-900/5 bg-cream-50/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#dashboard" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-300 text-white shadow-md shadow-amber-200/60 transition-transform duration-300 group-hover:rotate-6">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-wide">
            柳树小屋
            <span className="ml-2 hidden text-xs font-semibold text-ink-300 sm:inline">Willow Blog</span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
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
          <span className="hidden items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-bold text-orange-500 ring-1 ring-orange-200 sm:flex">
            <Flame className={`h-4 w-4 ${checkedIn ? 'animate-wiggle' : ''}`} />
            {streak} 天
          </span>
          {checkedIn ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-600 ring-1 ring-emerald-200">
              <BadgeCheck className="h-4 w-4" />
              已打卡
            </span>
          ) : (
            <button
              type="button"
              onClick={onCheckIn}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-amber-300/50 transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
            >
              <Sparkles className="h-4 w-4" />
              打卡
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
            {NAV_ITEMS.map((item) => (
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
