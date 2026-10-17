import { AlertTriangle, CloudOff, Loader2 } from 'lucide-react'

/**
 * 模块级的云端状态条：加载中 / 保存中 / 保存成功 / 失败。
 * 保存失败时给出明确原因和「重新加载云端」，绝不显示成功。
 * 访客只会看到只读提示，不会看到任何保存相关的 UI。
 */
export default function CloudStatusBar({ collection, isAdmin = false, className = '' }) {
  const { phase, loading, error, saving, saved, saveError, conflict, dirty, reload } = collection

  if (loading || phase === 'idle') {
    return (
      <span className={`flex items-center gap-1.5 text-xs font-semibold text-ink-300 ${className}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        正在读取云端数据…
      </span>
    )
  }

  if (phase === 'offline') {
    // 云端暂时读不到，当前展示的是内置内容（只读，绝不会写回云端）
    return (
      <span className={`flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-400 ${className}`}>
        <CloudOff className="h-3.5 w-3.5" />
        云端暂不可用，正在显示内置内容
        <button type="button" onClick={() => reload()} className="rounded-full bg-cream-100 px-2.5 py-1 text-ink-500 ring-1 ring-cream-200 transition hover:bg-cream-200">
          重试
        </button>
      </span>
    )
  }

  if (phase === 'error') {
    return (
      <span className={`flex flex-wrap items-center gap-2 text-xs font-semibold text-rose-500 ${className}`}>
        <AlertTriangle className="h-3.5 w-3.5" />
        {error || '云端数据读取失败'}
        <button type="button" onClick={() => reload()} className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-100">
          重新加载
        </button>
      </span>
    )
  }

  if (!isAdmin) {
    return <span className={`text-xs text-ink-300 ${className}`}>公开内容 · 访客可读</span>
  }

  if (conflict) {
    return (
      <span className={`flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-600 ${className}`}>
        <AlertTriangle className="h-3.5 w-3.5" />
        云端已有更新的版本，本次修改没有覆盖它
        <button type="button" onClick={() => reload()} className="rounded-full bg-amber-50 px-2.5 py-1 ring-1 ring-amber-200 transition hover:bg-amber-100">
          加载云端最新
        </button>
      </span>
    )
  }

  if (saving) {
    return (
      <span className={`flex items-center gap-1.5 text-xs font-semibold text-amber-600 ${className}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        保存到云端…
      </span>
    )
  }

  if (saveError) {
    return (
      <span className={`flex flex-wrap items-center gap-2 text-xs font-semibold text-rose-500 ${className}`}>
        <AlertTriangle className="h-3.5 w-3.5" />
        {saveError}
        <button type="button" onClick={() => reload()} className="rounded-full bg-rose-50 px-2.5 py-1 ring-1 ring-rose-200 transition hover:bg-rose-100">
          重新加载
        </button>
      </span>
    )
  }

  if (dirty) return <span className={`text-xs text-ink-300 ${className}`}>有修改待保存…</span>
  if (saved) return <span className={`text-xs font-semibold text-emerald-500 ${className}`}>已保存到云端 ✓</span>
  return null
}
