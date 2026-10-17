import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSection, saveSection } from '../services/cloudStorage'
import { useAuth } from './useAuth'

/**
 * 单个云端模块的读写状态机。
 *
 * 关键安全行为（避免把云端真实数据覆盖成空数组）：
 *   1. 只有「云端读取成功」之后才允许保存；读取失败或未加载完成时一律不写。
 *   2. 组件挂载不再自动回写 —— 只有管理员调用 commit() 才会保存。
 *   3. 保存带版本号（乐观并发控制），云端版本前进时不覆盖，改为抛出冲突让管理员决定。
 *   4. 退出登录 / 失去管理员权限时立刻把内存数据恢复成默认值，私人内容不残留。
 */

const SAVE_DEBOUNCE_MS = 600

export function useCloudCollection({ section, fallback, enabled = true, publiclyReadable = false, preferDefaults = false }) {
  const { isAdmin, sessionLoading } = useAuth()
  /**
   * 公开模块（力扣题解 / 知识笔记）任何访客都能读；
   * 私人模块必须「session 检查结束 + 确认是管理员」才去请求，
   * 这样未登录访客根本不会向私人表发请求，也不会在界面上闪出私人内容。
   */
  const canRead = enabled && !sessionLoading && (publiclyReadable || isAdmin)
  const canWrite = !sessionLoading && isAdmin
  const active = canRead

  const [data, setData] = useState(fallback)
  const [phase, setPhase] = useState('idle') // idle | loading | ready | error
  const [error, setError] = useState(null)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error | conflict
  const [saveError, setSaveError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [dirty, setDirty] = useState(false)

  const versionRef = useRef(null)
  const dataRef = useRef(fallback)
  const loadedRef = useRef(false)
  const timerRef = useRef(null)
  const mountedRef = useRef(true)
  const saveSeqRef = useRef(0)

  dataRef.current = data

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /* ---------------------------------------------------------------- *
   * 加载
   * ---------------------------------------------------------------- */
  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!active) return { ok: false, reason: 'inactive' }
      if (!silent) {
        setPhase('loading')
        setError(null)
      }
      const result = await fetchSection(section)
      if (!mountedRef.current) return { ok: false, reason: 'unmounted' }

      if (!result.ok) {
        if (preferDefaults) {
          // 公开模块（且允许离线展示）：读取失败时回退到内置内容，
          // 但状态标记成 offline，并在界面上说明「正在展示内置内容」，
          // 绝不会把这份回退数据写回云端。
          versionRef.current = null
          setData(fallback)
          loadedRef.current = false
          setPhase('offline')
          setError(null)
          return { ok: false, offline: true, error: result.error }
        }
        // 私人模块读取失败：绝不写回云端，保持原有内存数据并暴露错误
        setPhase('error')
        setError(result.error || '读取失败')
        loadedRef.current = false
        return { ok: false, error: result.error }
      }

      if (result.row) {
        versionRef.current = result.row.version
        setData(result.row.payload)
        setUpdatedAt(result.row.updated_at ?? null)
      } else {
        // 云端还没有这个模块：用默认值渲染，但此时仍然「已加载」，
        // 管理员一旦编辑就会以 version null → 首次插入的方式写入。
        versionRef.current = null
        setData(fallback)
        setUpdatedAt(null)
      }
      loadedRef.current = true
      setPhase('ready')
      setError(null)
      setSaveState('idle')
      setSaveError(null)
      setDirty(false)
      return { ok: true, exists: Boolean(result.row) }
    },
    // fallback 只在初始渲染时使用，故意不进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, section, preferDefaults],
  )

  useEffect(() => {
    if (!active) {
      clearTimer()
      loadedRef.current = false
      versionRef.current = null
      setData(fallback)
      setPhase('idle')
      setError(null)
      setSaveState('idle')
      setSaveError(null)
      setUpdatedAt(null)
      setDirty(false)
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, section])

  /* ---------------------------------------------------------------- *
   * 保存
   * ---------------------------------------------------------------- */
  const persist = useCallback(
    async (nextData, { force = false } = {}) => {
      if (!canWrite) return { ok: false, error: '当前账号没有编辑权限' }
      if (!active) return { ok: false, error: '云端数据尚未就绪，已取消本次保存' }
      if (!loadedRef.current) {
        // 还没读到云端真实数据就写，等于用本地空值覆盖数据库 —— 直接拒绝
        return { ok: false, error: '云端数据尚未加载完成，为避免覆盖已取消本次保存' }
      }
      const seq = ++saveSeqRef.current
      setSaveState('saving')
      setSaveError(null)

      const expected = force ? null : versionRef.current
      const result = await saveSection(section, nextData, expected)
      if (!mountedRef.current || seq !== saveSeqRef.current) return result

      if (result.ok) {
        versionRef.current = result.version
        setUpdatedAt(result.updatedAt ?? null)
        setSaveState('saved')
        setDirty(false)
        setSaveError(null)
        return result
      }

      setSaveState(result.conflict ? 'conflict' : 'error')
      setSaveError(result.error || '保存失败')
      return result
    },
    [active, canWrite, section],
  )

  /**
   * 管理员提交修改：先更新界面，再防抖保存。
   * 云端的错误会如实反映在 saveState / saveError 上，绝不假装成功。
   */
  const commit = useCallback(
    (updater) => {
      if (!active) return
      const current = dataRef.current
      const next = typeof updater === 'function' ? updater(current) : updater
      dataRef.current = next
      setData(next)
      setDirty(true)
      clearTimer()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        persist(dataRef.current)
      }, SAVE_DEBOUNCE_MS)
    },
    [active, clearTimer, persist],
  )

  /** 立即保存（用于退出登录 / 页面关闭 / 切换分支前） */
  const flush = useCallback(async () => {
    if (!active || !dirty) return { ok: true, skipped: true }
    clearTimer()
    return persist(dataRef.current)
  }, [active, clearTimer, dirty, persist])

  /** 强制覆盖云端（仅在管理员明确确认过冲突后调用） */
  const overwrite = useCallback(async () => {
    if (!canWrite) return { ok: false, error: '当前账号没有编辑权限' }
    clearTimer()
    return persist(dataRef.current, { force: true })
  }, [canWrite, clearTimer, persist])

  /** 丢弃本机修改，重新拉取云端 */
  const reload = useCallback(async () => {
    clearTimer()
    setDirty(false)
    return load()
  }, [clearTimer, load])

  // 页面被关闭 / 切到后台时，把未保存的改动立刻发出去，减少丢失
  useEffect(() => {
    if (!active) return undefined
    const onHide = () => {
      if (!dirty) return
      clearTimer()
      persist(dataRef.current)
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [active, clearTimer, dirty, persist])

  /**
   * 立即清空内存数据（退出登录时调用）。
   * 只改内存，不动云端，确保私人内容不会残留在界面上。
   */
  const resetToFallback = useCallback(() => {
    clearTimer()
    loadedRef.current = false
    versionRef.current = null
    dataRef.current = fallback
    setData(fallback)
    setPhase('idle')
    setError(null)
    setSaveState('idle')
    setSaveError(null)
    setUpdatedAt(null)
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimer])

  return {
    data,
    setData,
    commit,
    flush,
    overwrite,
    reload,
    resetToFallback,
    phase,
    loading: phase === 'loading',
    ready: phase === 'ready',
    error,
    saveState,
    saving: saveState === 'saving',
    saveError,
    saved: saveState === 'saved',
    conflict: saveState === 'conflict',
    dirty,
    updatedAt,
    version: versionRef.current,
    exists: versionRef.current !== null,
  }
}
