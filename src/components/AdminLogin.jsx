import { useEffect, useState } from 'react'
import { KeyRound, Loader2, LockKeyhole, LogIn, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

/**
 * 管理员登录弹窗。
 * 样式沿用项目的圆角奶油风卡片，不改动原有视觉语言。
 * 访客不需要登录即可浏览公开模块，因此这里刻意做得很低调。
 */
export default function AdminLogin() {
  const { loginOpen, closeLogin, signIn, busy, configured, notice } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!loginOpen) {
      setPassword('')
      setError(null)
    }
  }, [loginOpen])

  useEffect(() => {
    if (!loginOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') closeLogin()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loginOpen, closeLogin])

  if (!loginOpen) return null

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('请填写邮箱和密码')
      return
    }
    const result = await signIn(email, password)
    if (!result.ok) setError(result.error)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" onClick={closeLogin} />
      <form
        onSubmit={submit}
        className="animate-pop-in relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-amber-100"
      >
        <button
          type="button"
          onClick={closeLogin}
          aria-label="关闭登录窗口"
          className="absolute right-4 top-4 rounded-full p-1.5 text-ink-400 transition hover:bg-stone-100"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-300 text-white shadow-md shadow-amber-200/60">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-ink-700">管理员登录</h3>
            <p className="text-[11px] text-ink-400">只有站长本人可以编辑内容</p>
          </div>
        </div>

        {!configured && (
          <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-700 ring-1 ring-amber-200">
            {notice || '当前还没有配置 Supabase，暂时无法登录。请先按 README 配置 .env.local。'}
          </p>
        )}

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink-500">邮箱</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700 ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-ink-500">密码</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="mt-1.5 w-full rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700 ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[11px] leading-relaxed text-rose-600 ring-1 ring-rose-200">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy || !configured}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {busy ? '登录中…' : '登录'}
        </button>

        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-300">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          权限由数据库行级安全（RLS）强制校验，前端只负责展示。未登录访客仍可浏览力扣题解与知识笔记。
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-300">
          <KeyRound className="h-3.5 w-3.5" />
          账号需在 Supabase Dashboard 手动创建，站点不提供注册入口。
        </p>
      </form>
    </div>
  )
}
