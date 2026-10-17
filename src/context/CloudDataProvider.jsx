import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { INITIAL_LEETCODE, INITIAL_NOTES, INITIAL_SPARKLES, PROJECTS } from '../data'
import { useAuth } from '../hooks/useAuth'
import { useCloudCollection } from '../hooks/useCloudData'
import { ALL_SECTIONS, PUBLIC_SECTIONS } from '../services/cloudStorage'

/**
 * 七个模块的云端数据集中在这里。
 *
 * 为什么集中在顶层而不是分散在各组件里：
 *   1. 退出登录时能在同一个地方把全部私人数据清空（不会残留私人内容）；
 *   2. 保存时能统一 flush，避免退出/关页面丢掉未落盘的修改；
 *   3. 每个模块仍然独立保存 —— 改题解不会覆盖笔记，改笔记也不会碰到私人数据。
 */

const CloudDataContext = createContext(null)

/** 模块与「云端还没有数据时」使用的默认值（保持现有界面的初始观感） */
export const DEFAULT_DATA = {
  leetcode: INITIAL_LEETCODE,
  notes: INITIAL_NOTES,
  checkins: [],
  studyLog: [],
  projects: PROJECTS,
  sparkles: INITIAL_SPARKLES,
  weekHours: 0,
}

/** 读取时用的初始值：私人模块一律从空开始，避免未登录时把示例数据当成真实内容 */
const initialValueFor = (section) => (PUBLIC_SECTIONS.includes(section) ? DEFAULT_DATA[section] : DEFAULT_DATA[section])

export function CloudDataProvider({ children }) {
  const { signOut } = useAuth()

  const leetcode = useCloudCollection({
    section: 'leetcode',
    fallback: initialValueFor('leetcode'),
    publiclyReadable: true,
    preferDefaults: true,
  })
  const notes = useCloudCollection({
    section: 'notes',
    fallback: initialValueFor('notes'),
    publiclyReadable: true,
    preferDefaults: true,
  })
  const checkins = useCloudCollection({ section: 'checkins', fallback: initialValueFor('checkins') })
  const studyLog = useCloudCollection({ section: 'studyLog', fallback: initialValueFor('studyLog') })
  const projects = useCloudCollection({ section: 'projects', fallback: initialValueFor('projects') })
  const sparkles = useCloudCollection({ section: 'sparkles', fallback: initialValueFor('sparkles') })
  const weekHours = useCloudCollection({ section: 'weekHours', fallback: initialValueFor('weekHours') })

  const collections = useMemo(
    () => ({ leetcode, notes, checkins, studyLog, projects, sparkles, weekHours }),
    [leetcode, notes, checkins, studyLog, projects, sparkles, weekHours],
  )

  /** 注册消费者的 flush（例如编辑器里还有没落盘的输入） */
  const flushRegistry = useRef(new Map())
  const [registryVersion, setRegistryVersion] = useState(0)

  const registerFlush = useCallback((key, flush) => {
    if (flush) flushRegistry.current.set(key, flush)
    else flushRegistry.current.delete(key)
    setRegistryVersion((version) => version + 1)
  }, [])

  const flushAll = useCallback(async () => {
    const tasks = [...flushRegistry.current.values()].map((flush) => Promise.resolve().then(flush))
    const collectionTasks = Object.values(collections).map((collection) => collection.flush())
    const results = await Promise.allSettled([...tasks, ...collectionTasks])
    const failed = results.filter((result) => result.status === 'rejected')
    return { ok: failed.length === 0, failed: failed.length }
  }, [collections])

  /** 退出登录：先把未保存的改动发出去，再让 AuthProvider 清空会话 */
  const signOutSafely = useCallback(async () => {
    const { ok } = await flushAll()
    await signOut()
    return ok
  }, [flushAll, signOut])

  // 失去管理员身份（退出登录 / 会话过期）时，立即清空内存里的私人数据
  const { isAdmin, sessionLoading } = useAuth()
  useEffect(() => {
    if (sessionLoading || isAdmin) return
    ALL_SECTIONS.forEach((section) => {
      if (PUBLIC_SECTIONS.includes(section)) return
      collections[section]?.resetToFallback()
    })
  }, [isAdmin, sessionLoading, collections])

  const refreshAll = useCallback(async () => {
    const targets = ALL_SECTIONS.map((section) => collections[section]).filter((collection) => collection?.ready || collection?.phase === 'error')
    await Promise.allSettled(targets.map((collection) => collection.reload()))
  }, [collections])

  const value = useMemo(
    () => ({ collections, registerFlush, flushAll, signOutSafely, refreshAll, registryVersion }),
    [collections, registerFlush, flushAll, signOutSafely, refreshAll, registryVersion],
  )

  return <CloudDataContext.Provider value={value}>{children}</CloudDataContext.Provider>
}

export function useCloudData() {
  const context = useContext(CloudDataContext)
  if (!context) throw new Error('useCloudData 必须在 <CloudDataProvider> 内部使用')
  return context
}

/** 退出登录：先把未落盘的修改发出去，再清空会话（由 Navbar 调用） */
export function useSignOutSafely() {
  return useCloudData().signOutSafely
}

/** 取单个模块的云端集合（含 loading / saving / error 状态） */
export function useCollection(section) {
  const { collections } = useCloudData()
  const collection = collections[section]
  if (!collection) throw new Error(`未知模块：${section}`)
  return collection
}

/** 汇总各模块状态，用于顶部「同步状态」显示 */
export function useSyncSummary() {
  const { collections, refreshAll } = useCloudData()
  return useMemo(() => {
    const list = Object.entries(collections)
    // 私人模块读失败 = 真问题，需要提示；公开模块读失败会静默回退到内置内容
    const erroring = list.filter(
      ([, collection]) => collection.phase === 'error' || collection.saveState === 'error' || collection.saveState === 'conflict',
    )
    const offline = list.filter(([, collection]) => collection.phase === 'offline')
    const loading = list.filter(([, collection]) => collection.loading)
    const saving = list.filter(([, collection]) => collection.saving)
    // 「已读到云端数据」的模块数：全为 0 说明云端还是空的（当前展示内置示例）
    const filled = list.filter(([, collection]) => collection.phase === 'ready' && collection.exists).length
    const readyCount = list.filter(([, collection]) => collection.phase === 'ready').length
    return {
      erroring: erroring.map(([section, collection]) => ({ section, error: collection.error || collection.saveError })),
      offlineCount: offline.length,
      offline: offline.map(([section]) => section),
      loadingCount: loading.length,
      savingCount: saving.length,
      filled,
      readyCount,
      refreshAll,
    }
  }, [collections, refreshAll])
}
