import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { configProblem, describeError, getSupabase } from '../lib/supabase'

/**
 * 管理员登录状态。
 *
 * - 未登录访客不需要注册，公开模块照常可读。
 * - 只有 willow_admins 表里的账号才算管理员；「已登录」不等于「管理员」。
 * - sessionLoading 为 true 时不要渲染私人内容，避免先闪一下私人数据再隐藏。
 */

const AuthContext = createContext(null)

const configured = () => Boolean(getSupabase())

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(() => configProblem())
  const [loginOpen, setLoginOpen] = useState(false)
  const mounted = useRef(true)

  const checkAdmin = useCallback(async (currentUser) => {
    if (!currentUser) return false
    const supabase = getSupabase()
    if (!supabase) return false
    // 只查自己那一行（willow_admins 的 RLS 也只放行自己的行）
    const { data, error } = await supabase
      .from('willow_admins')
      .select('user_id')
      .eq('user_id', currentUser.id)
      .maybeSingle()
    if (error) {
      // 表不存在或权限问题时，安全地按「非管理员」处理，并把原因告诉用户
      if (mounted.current) setNotice(`无法确认管理员身份：${describeError(error, '请检查是否已执行 SQL Migration')}`)
      return false
    }
    return Boolean(data)
  }, [])

  const applySession = useCallback(
    async (session) => {
      const currentUser = session?.user ?? null
      if (!mounted.current) return
      setUser(currentUser)
      if (!currentUser) {
        setIsAdmin(false)
        setSessionLoading(false)
        return
      }
      const admin = await checkAdmin(currentUser)
      if (!mounted.current) return
      setIsAdmin(admin)
      setSessionLoading(false)
    },
    [checkAdmin],
  )

  useEffect(() => {
    mounted.current = true
    const supabase = getSupabase()
    if (!supabase) {
      setSessionLoading(false)
      return undefined
    }

    let cancelled = false
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setNotice(`读取登录状态失败：${describeError(error, '请稍后重试')}`)
          setSessionLoading(false)
          return
        }
        return applySession(data?.session ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setNotice('读取登录状态失败：网络异常，请稍后重试')
          setSessionLoading(false)
        }
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsAdmin(false)
        setSessionLoading(false)
        return
      }
      // 其它事件（登录、刷新令牌、User 更新）统一重新确认身份
      setSessionLoading(true)
      supabase.auth
        .getSession()
        .then(({ data }) => applySession(data?.session ?? null))
        .catch(() => {
          if (!cancelled) {
            setNotice('刷新登录状态失败：网络异常')
            setSessionLoading(false)
          }
        })
    })

    return () => {
      cancelled = true
      subscription?.subscription?.unsubscribe?.()
    }
  }, [applySession])

  const signIn = useCallback(async (email, password) => {
    const supabase = getSupabase()
    if (!supabase) {
      return { ok: false, error: configProblem() || '未配置 Supabase' }
    }
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(email || '').trim(),
        password: String(password || ''),
      })
      if (error) return { ok: false, error: describeError(error, '登录失败，请检查邮箱和密码') }

      const admin = await checkAdmin(data?.user ?? null)
      if (!admin) {
        // 登录成功但不是管理员：立刻退出，避免留下一个能读公开表却无权的会话
        await supabase.auth.signOut()
        return { ok: false, error: '这个账号不是 WillowBlog 管理员，已自动退出登录' }
      }
      setNotice(null)
      setLoginOpen(false)
      return { ok: true }
    } catch {
      return { ok: false, error: '登录失败：网络异常，请稍后重试' }
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [checkAdmin])

  const signOut = useCallback(async () => {
    const supabase = getSupabase()
    setBusy(true)
    try {
      if (supabase) await supabase.auth.signOut()
    } catch {
      /* 网络异常也要在本地清空登录态 */
    } finally {
      if (mounted.current) {
        setUser(null)
        setIsAdmin(false)
        setBusy(false)
      }
    }
  }, [])

  const value = useMemo(
    () => ({
      configured: configured(),
      user,
      isAdmin,
      sessionLoading,
      busy,
      notice,
      dismissNotice: () => setNotice(null),
      loginOpen,
      openLogin: () => setLoginOpen(true),
      closeLogin: () => setLoginOpen(false),
      signIn,
      signOut,
      /** 是否允许渲染私人模块：必须「已加载完 + 是管理员」 */
      canViewPrivate: !sessionLoading && isAdmin,
    }),
    [user, isAdmin, sessionLoading, busy, notice, loginOpen, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 必须在 <AuthProvider> 内部使用')
  return context
}
