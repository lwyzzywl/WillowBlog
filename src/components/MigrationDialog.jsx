import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Database, Download, FlaskConical, HardDriveDownload, Loader2, Upload, X } from 'lucide-react'
import { toast } from '../hooks'
import { PRIVATE_SECTIONS, PUBLIC_SECTIONS, SECTIONS } from '../services/cloudStorage'
import { MODE, buildBackupFromLocalStorage, buildCloudBackup, buildMigrationPlan, downloadBackup, runMigration, verifyMigration } from '../services/migration'
import { privacyNotes } from '../services/legacyBackup'
import { useCloudData } from '../context/CloudDataProvider'

const STEP = { PICK: 'pick', REVIEW: 'review', DONE: 'done' }

const STATUS_STYLE = {
  created: 'text-emerald-600',
  overwritten: 'text-sky-600',
  skipped: 'text-ink-400',
  conflict: 'text-amber-600',
  failed: 'text-rose-500',
}

const STATUS_LABEL = {
  created: '已写入',
  overwritten: '已覆盖',
  skipped: '已跳过',
  conflict: '版本冲突',
  failed: '失败',
}

const MODE_LABEL = {
  [MODE.SKIP]: '跳过（推荐）',
  [MODE.FILL_EMPTY]: '写入云端',
  [MODE.OVERWRITE]: '覆盖云端',
}

/**
 * 一次性数据迁移向导（仅管理员可用）。
 * 流程：选择备份 → 校验并预览 → 逐模块确认 → 执行 → 结果报告。
 */
export default function MigrationDialog({ open, onClose }) {
  const { collections } = useCloudData()
  const [step, setStep] = useState(STEP.PICK)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [backup, setBackup] = useState(null)
  const [plan, setPlan] = useState(null)
  const [decisions, setDecisions] = useState({})
  const [report, setReport] = useState(null)
  const [verify, setVerify] = useState(null)
  const [progress, setProgress] = useState([])
  const fileRef = useRef(null)

  const notes = useMemo(() => (plan ? privacyNotes(plan.validation) : []), [plan])

  if (!open) return null

  const reset = () => {
    setStep(STEP.PICK)
    setBusy(false)
    setError(null)
    setBackup(null)
    setPlan(null)
    setDecisions({})
    setReport(null)
    setVerify(null)
    setProgress([])
  }

  const close = () => {
    // 迁移不会删除任何本地数据，所以关闭是安全的
    reset()
    onClose()
  }

  const handleFile = async (file) => {
    setError(null)
    if (!file) return
    setBusy(true)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      await preparePlan(parsed, file.name)
    } catch (parseError) {
      setError(`读取备份失败：${parseError.message}`)
      setBusy(false)
    }
  }

  const preparePlan = async (parsed, sourceName) => {
    setBusy(true)
    try {
      const nextPlan = await buildMigrationPlan(parsed)
      const initial = {}
      nextPlan.items.forEach((item) => {
        initial[item.section] = item.suggested
      })
      setBackup({ data: parsed, name: sourceName })
      setPlan(nextPlan)
      setDecisions(initial)
      setStep(STEP.REVIEW)
      if (!nextPlan.versionsOk) {
        setError(`无法读取云端版本号：${nextPlan.versionsError || '请检查数据库是否已初始化'}`)
      }
    } catch (planError) {
      setError(`生成迁移计划失败：${planError.message}`)
    } finally {
      setBusy(false)
    }
  }

  /** 方式 A：在原浏览器里导出旧数据 */
  const exportFromBrowser = () => {
    try {
      const { backup: localBackup, missing } = buildBackupFromLocalStorage()
      const total = Object.values(localBackup.sections).reduce(
        (sum, value) => sum + (Array.isArray(value) ? value.length : value == null ? 0 : 1),
        0,
      )
      if (total === 0) {
        toast('这个浏览器里没有读到旧数据，请确认是在原来那个浏览器/域名下打开')
      }
      const name = downloadBackup(localBackup)
      toast(`已导出备份 ${name}${missing.length ? `（${missing.length} 个键为空）` : ''}`)
    } catch (exportError) {
      toast(`导出失败：${exportError.message}`)
    }
  }

  /** 导出当前云端数据，作为覆盖操作之前的回滚备份 */
  const exportCloud = () => {
    const cloudBackup = buildCloudBackup(collections)
    const name = downloadBackup(cloudBackup)
    toast(`已导出云端备份 ${name}`)
  }

  const execute = async () => {
    setBusy(true)
    setError(null)
    setProgress([])
    try {
      const result = await runMigration(plan, decisions, backup.data, (record) => {
        setProgress((prev) => [...prev, record])
      })
      setReport(result)
      const verified = await verifyMigration(result, plan)
      setVerify(verified)
      setStep(STEP.DONE)
      if (result.ok) toast('迁移完成，请按报告核对各模块 ✅')
      else toast('迁移结束，但有未能完成的模块，请看报告')
    } catch (runError) {
      setError(`迁移执行失败：${runError.message}`)
    } finally {
      setBusy(false)
    }
  }

  const overwriteCount = Object.values(decisions).filter((mode) => mode === MODE.OVERWRITE).length

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={close} />
      <div className="animate-pop-in relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-amber-100">
        <div className="flex items-center justify-between border-b border-cream-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-emerald-300 text-white">
              <Database className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-ink-700">旧数据迁移</p>
              <p className="text-[11px] text-ink-400">把浏览器里存的学习记录搬到 Supabase 云端</p>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="关闭" className="rounded-full p-1.5 text-ink-400 transition hover:bg-cream-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <p className="mb-4 flex items-start gap-2 rounded-2xl bg-rose-50 px-3 py-2.5 text-[12px] leading-relaxed text-rose-600 ring-1 ring-rose-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          {step === STEP.PICK && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-cream-50 p-4 ring-1 ring-cream-200">
                <p className="text-sm font-bold text-ink-700">方式 A · 在原浏览器导出旧数据</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                  必须回到「原本保存数据的那个浏览器 + 同一个域名」上执行。不同域名的 localStorage 不共享，
                  在新站点里读不到旧数据。
                </p>
                <button
                  type="button"
                  onClick={exportFromBrowser}
                  className="mt-3 flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-wood-600 shadow-sm ring-1 ring-amber-200 transition hover:-translate-y-0.5"
                >
                  <HardDriveDownload className="h-4 w-4" />
                  导出本机备份 JSON
                </button>
                <p className="mt-2 text-[11px] text-ink-400">
                  导出的文件包含全部 7 个模块原始数据；也可以在旧站点的控制台里执行{' '}
                  <code className="rounded bg-white px-1 font-mono">backup-legacy.js</code> 获取同样的文件。
                </p>
              </div>

              <div className="rounded-2xl bg-cream-50 p-4 ring-1 ring-cream-200">
                <p className="text-sm font-bold text-ink-700">方式 B · 导入备份到云端</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                  选择上面导出的 JSON 文件，先预览再决定每个模块是否写入。默认不会覆盖云端已有数据。
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="mt-3 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-400 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-200 transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  选择备份文件
                </button>
              </div>

              <div className="rounded-2xl border border-dashed border-cream-300 p-4">
                <p className="flex items-center gap-2 text-[12px] font-bold text-ink-500">
                  <Download className="h-3.5 w-3.5" />
                  安全提示
                </p>
                <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-ink-400">
                  <li>· 迁移只写云端，不会删除或修改浏览器里的旧数据。</li>
                  <li>· 你可以重复执行迁移，已存在的模块默认跳过，不会产生重复记录。</li>
                  <li>· 覆盖云端数据前，建议先点下面的按钮导出一份云端备份。</li>
                </ul>
                <button
                  type="button"
                  onClick={exportCloud}
                  className="mt-3 rounded-xl bg-cream-100 px-3 py-1.5 text-[11px] font-semibold text-ink-500 transition hover:bg-cream-200"
                >
                  导出当前云端数据（回滚备份）
                </button>
              </div>
            </div>
          )}

          {step === STEP.REVIEW && plan && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-400">
                <span className="rounded-full bg-cream-100 px-2.5 py-1 font-semibold">
                  来源：{backup?.name || '本机 localStorage'}
                </span>
                {plan.validation.exportedAt && <span>导出时间 {plan.validation.exportedAt}</span>}
                <span>共 {plan.validation.counts7} 条记录</span>
              </div>

              {plan.validation.problems.length > 0 && (
                <div className="rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-200">
                  <p className="text-[12px] font-bold text-rose-600">备份结构有问题，建议先修正再迁移</p>
                  <ul className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-rose-500">
                    {plan.validation.problems.map((problem) => (
                      <li key={problem}>· {problem}</li>
                    ))}
                  </ul>
                </div>
              )}

              {plan.validation.warnings.length > 0 && (
                <div className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
                  <ul className="space-y-0.5 text-[11px] leading-relaxed text-amber-700">
                    {plan.validation.warnings.map((warning) => (
                      <li key={warning}>· {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {notes.length > 0 && (
                <div className="rounded-2xl bg-sky-50 p-3 ring-1 ring-sky-200">
                  <p className="flex items-center gap-1.5 text-[12px] font-bold text-sky-700">
                    <FlaskConical className="h-3.5 w-3.5" />
                    导入前请检查
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-sky-700">
                    {notes.map((note) => (
                      <li key={note}>· {note}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-hidden rounded-2xl ring-1 ring-cream-200">
                <table className="w-full text-[12px]">
                  <thead className="bg-cream-100 text-ink-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">模块</th>
                      <th className="px-3 py-2 text-left font-semibold">可见性</th>
                      <th className="px-3 py-2 text-right font-semibold">备份</th>
                      <th className="px-3 py-2 text-right font-semibold">云端</th>
                      <th className="px-3 py-2 text-left font-semibold">本次动作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.items.map((item) => (
                      <tr key={item.section} className="border-t border-cream-100">
                        <td className="px-3 py-2 font-semibold text-ink-700">
                          {SECTIONS[item.section].label}
                          <span className="ml-1 font-mono text-[10px] text-ink-300">{item.section}</span>
                        </td>
                        <td className="px-3 py-2">
                          {item.isPublic ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 ring-1 ring-emerald-200">公开</span>
                          ) : (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-ink-500 ring-1 ring-cream-300">私人</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-ink-500">{item.localCount}</td>
                        <td className="px-3 py-2 text-right text-ink-500">
                          {item.cloudExists ? `v${item.cloudVersion}` : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={decisions[item.section] ?? MODE.SKIP}
                            onChange={(event) => setDecisions((prev) => ({ ...prev, [item.section]: event.target.value }))}
                            className="w-full rounded-lg bg-cream-50 px-2 py-1 text-[11px] text-ink-700 ring-1 ring-cream-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
                          >
                            {item.cloudExists ? (
                              <>
                                <option value={MODE.SKIP}>{MODE_LABEL[MODE.SKIP]}</option>
                                <option value={MODE.OVERWRITE}>{MODE_LABEL[MODE.OVERWRITE]}</option>
                              </>
                            ) : (
                              <>
                                <option value={MODE.FILL_EMPTY}>{MODE_LABEL[MODE.FILL_EMPTY]}</option>
                                <option value={MODE.SKIP}>{MODE_LABEL[MODE.SKIP]}</option>
                              </>
                            )}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {overwriteCount > 0 && (
                <p className="rounded-2xl bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-700 ring-1 ring-amber-200">
                  你选择了覆盖 {overwriteCount} 个模块的云端数据。覆盖前请确认已经导出「当前云端数据（回滚备份）」，
                  并且其它设备上没有更新的改动。
                </p>
              )}

              {progress.length > 0 && (
                <ul className="space-y-1 text-[11px]">
                  {progress.map((record) => (
                    <li key={record.section} className={STATUS_STYLE[record.status]}>
                      {SECTIONS[record.section].label}：{STATUS_LABEL[record.status]} · {record.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === STEP.DONE && report && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-cream-50 p-4 ring-1 ring-cream-200">
                <p className="text-sm font-bold text-ink-700">迁移结果</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-5">
                  <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-cream-200">写入 {report.summary.created}</span>
                  <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-cream-200">覆盖 {report.summary.overwritten}</span>
                  <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-cream-200">跳过 {report.summary.skipped}</span>
                  <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-cream-200">冲突 {report.summary.conflict}</span>
                  <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-cream-200">失败 {report.summary.failed}</span>
                </div>
              </div>

              <ul className="space-y-1.5 text-[12px]">
                {report.items.map((item) => (
                  <li key={item.section} className={`flex items-start gap-2 ${STATUS_STYLE[item.status]}`}>
                    {item.status === 'created' || item.status === 'overwritten' ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>
                      <b>{SECTIONS[item.section].label}</b> · {STATUS_LABEL[item.status]}：{item.message}
                    </span>
                  </li>
                ))}
              </ul>

              {verify && verify.length > 0 && (
                <div className="rounded-2xl bg-emerald-50/60 p-3 ring-1 ring-emerald-200">
                  <p className="text-[12px] font-bold text-emerald-700">云端复核</p>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-emerald-700">
                    {verify.map((row) => (
                      <li key={row.section}>
                        · {SECTIONS[row.section].label}：备份 {row.expected} 条 · {row.note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="rounded-2xl bg-cream-50 px-3 py-2.5 text-[11px] leading-relaxed text-ink-500 ring-1 ring-cream-200">
                浏览器里的旧数据没有被改动。请你在网站上逐项确认内容无误之后，再自行清理旧的 localStorage。
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportCloud}
                  className="flex items-center gap-2 rounded-2xl bg-cream-100 px-4 py-2.5 text-sm font-bold text-ink-600 transition hover:bg-cream-200"
                >
                  <Download className="h-4 w-4" />
                  导出迁移后的云端数据
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-2xl bg-cream-100 px-4 py-2.5 text-sm font-bold text-ink-600 transition hover:bg-cream-200"
                >
                  再迁移一份备份
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-cream-200 px-6 py-4">
          <p className="text-[11px] text-ink-400">
            {step === STEP.REVIEW ? '确认无误后点右侧按钮开始写入云端' : '迁移随时可以安全中断，不会破坏本地数据'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-2xl bg-cream-100 px-4 py-2.5 text-sm font-bold text-ink-500 transition hover:bg-cream-200"
            >
              {step === STEP.DONE ? '关闭' : '稍后再说'}
            </button>
            {step === STEP.REVIEW && (
              <button
                type="button"
                disabled={busy || plan.validation.problems.length > 0}
                onClick={execute}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-400 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                开始迁移
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export { PUBLIC_SECTIONS, PRIVATE_SECTIONS }
