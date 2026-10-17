import { AlertTriangle, Check, CloudOff, CloudUpload, Loader2, RefreshCw } from 'lucide-react'
import { useSyncSummary } from '../context/CloudDataProvider'

/**
 * 顶部同步状态：如实反映「加载中 / 有未解决问题 / 已同步」。
 * 保存失败时绝不显示成功，而是明确提示并提供「重新加载」。
 * 「显示内置内容」表示云端不可用时的只读回退，不是错误。
 */
export default function SyncStatus() {
  const { erroring, offlineCount, loadingCount, savingCount, refreshAll } = useSyncSummary()

  if (loadingCount > 0) {
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink-400 ring-1 ring-cream-200 sm:flex">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        读取云端…
      </span>
    )
  }

  if (erroring.length) {
    return (
      <button
        type="button"
        onClick={() => refreshAll()}
        title={erroring.map((item) => item.error).filter(Boolean).join('\n')}
        className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-500 ring-1 ring-rose-200 transition hover:bg-rose-100"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {erroring.length} 个模块同步异常 · 点此重试
      </button>
    )
  }

  if (savingCount > 0) {
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-600 ring-1 ring-amber-200 sm:flex">
        <CloudUpload className="h-3.5 w-3.5" />
        同步中…
      </span>
    )
  }

  if (offlineCount > 0) {
    return (
      <span
        className="hidden items-center gap-1.5 rounded-full bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink-400 ring-1 ring-cream-200 sm:flex"
        title="云端暂时不可用，当前显示的是内置内容（只读，不会写回云端）"
      >
        <CloudOff className="h-3.5 w-3.5" />
        显示内置内容
      </span>
    )
  }

  return (
    <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-200 sm:flex">
      <Check className="h-3.5 w-3.5" />
      云端已同步
    </span>
  )
}

/** 「重新加载云端数据」按钮，供管理员手动拉取其它设备的更新 */
export function RefreshButton() {
  const { refreshAll, loadingCount } = useSyncSummary()
  return (
    <button
      type="button"
      onClick={() => refreshAll()}
      className="flex items-center gap-1.5 rounded-full bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink-500 ring-1 ring-cream-200 transition hover:bg-cream-200 hover:text-ink-700"
      title="从云端重新读取全部模块（在别的设备改过之后点一下）"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loadingCount ? 'animate-spin' : ''}`} />
      刷新云端数据
    </button>
  )
}
