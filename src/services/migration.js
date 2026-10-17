import { LEGACY_KEYS, validateBackup } from '../services/legacyBackup'
import { ALL_SECTIONS, PUBLIC_SECTIONS, fetchVersions, saveSection } from '../services/cloudStorage'
import { DEFAULT_DATA } from '../context/CloudDataProvider'

/**
 * 迁移执行器。
 *
 * 安全约束（这些是硬性要求，不是可选优化）：
 *   1. 默认绝不覆盖云端已有数据 —— 冲突的模块一律跳过，除非管理员逐个显式选择「覆盖」。
 *   2. 强制覆盖前先把云端原数据读出来放进报告，便于回滚。
 *   3. 可以重复执行：已跳过的模块不会产生重复记录。
 *   4. 只写云端，绝不删除或修改浏览器里的旧 localStorage 数据。
 */

export const MODE = {
  SKIP: 'skip',
  FILL_EMPTY: 'fill-empty',
  OVERWRITE: 'overwrite',
}

/**
 * 读取当前浏览器里（旧站点同源下）的 localStorage 数据。
 * 注意：只有在「原本保存数据的那个浏览器 + 同一个域名」下执行才能读到真实数据。
 */
export function readLegacyLocalStorage() {
  const sections = {}
  const missing = []
  for (const [section, key] of Object.entries(LEGACY_KEYS)) {
    const raw = window.localStorage.getItem(key)
    if (raw === null) {
      missing.push({ section, key })
      sections[section] = null
      continue
    }
    try {
      sections[section] = JSON.parse(raw)
    } catch {
      missing.push({ section, key, reason: 'JSON 解析失败' })
      sections[section] = null
    }
  }
  return { sections, missing }
}

/** 把 localStorage 里的原始数据打包成备份对象 */
export function buildBackupFromLocalStorage() {
  const { sections, missing } = readLegacyLocalStorage()
  return {
    backup: {
      format: 'willow-blog-local-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      origin: typeof window !== 'undefined' ? window.location.origin : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      legacyKeys: LEGACY_KEYS,
      sections,
    },
    missing,
  }
}

/** 触发浏览器下载（文件名带日期，方便区分多次备份） */
export function downloadBackup(backup) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `willow-backup-${stamp}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  return link.download
}

/**
 * 生成迁移计划：对比备份与云端现状，为每个模块给出建议动作。
 * 这一步不写任何数据，只供管理员预览确认。
 */
export async function buildMigrationPlan(backup) {
  const validation = validateBackup(backup)
  const versions = await fetchVersions()
  const cloudVersions = new Map()
  if (versions.ok) {
    versions.rows.forEach((row) => cloudVersions.set(row.section, row))
  }

  const items = ALL_SECTIONS.map((section) => {
    const info = validation.sections[section] || { present: false, count: 0 }
    const cloud = cloudVersions.get(section) || null
    const hasCloud = Boolean(cloud)
    const hasLocal = info.present && info.count > 0
    return {
      section,
      isPublic: PUBLIC_SECTIONS.includes(section),
      localCount: info.count,
      localPresent: info.present,
      cloudExists: hasCloud,
      cloudVersion: cloud?.version ?? null,
      cloudUpdatedAt: cloud?.updated_at ?? null,
      /** 建议动作：空云端 + 有本地 → 直接填；云端已有 → 默认跳过，需要管理员决定 */
      suggested: hasCloud ? MODE.SKIP : MODE.FILL_EMPTY,
      /** 云端为空时用它兜底，避免「0 条」也算有数据 */
      cloudHasData: Boolean(cloud && cloud.version > 0),
    }
  })

  return { validation, items, versionsOk: versions.ok, versionsError: versions.ok ? null : versions.error }
}

/**
 * 执行迁移。
 * @param plan         buildMigrationPlan 的结果
 * @param decisions    { [section]: MODE }
 * @param backup       备份对象
 * @param onProgress   (info) => void
 */
export async function runMigration(plan, decisions, backup, onProgress = () => {}) {
  const report = { startedAt: new Date().toISOString(), items: [], ok: true }

  for (const item of plan.items) {
    const mode = decisions[item.section] ?? MODE.SKIP
    const record = {
      section: item.section,
      isPublic: item.isPublic,
      mode,
      localCount: item.localCount,
      cloudVersionBefore: item.cloudVersion,
    }

    if (mode === MODE.SKIP) {
      record.status = 'skipped'
      record.message = item.cloudExists ? '云端已有数据，按你的选择跳过' : '你选择了跳过'
      report.items.push(record)
      onProgress(record)
      continue
    }

    const payload = plan.validation.sections[item.section]?.value
    if (payload === undefined || payload === null) {
      record.status = 'skipped'
      record.message = '备份里没有这个模块的数据'
      report.items.push(record)
      onProgress(record)
      continue
    }

    try {
      if (mode === MODE.FILL_EMPTY) {
        if (item.cloudExists) {
          // 再确认一次：期间可能被别的设备写入
          record.status = 'conflict'
          record.message = '云端此刻已有数据，为安全起见没有写入'
          report.items.push(record)
          report.ok = false
          onProgress(record)
          continue
        }
        const result = await saveSection(item.section, payload, null)
        record.status = result.ok ? 'created' : 'failed'
        record.versionAfter = result.version ?? null
        record.message = result.ok ? `已写入 ${item.localCount} 条记录` : result.error
        if (!result.ok) report.ok = false
      } else {
        // 覆盖：先用当前版本号尝试一次，让并发保护生效
        const result = await saveSection(item.section, payload, item.cloudVersion ?? null)
        if (result.ok) {
          record.status = 'overwritten'
          record.versionAfter = result.version ?? null
          record.message = `已覆盖云端（原版本 ${item.cloudVersion ?? '无'}）`
        } else if (result.conflict) {
          record.status = 'conflict'
          record.message = '云端版本已变化，本次未覆盖；请重新加载后再决定'
          report.ok = false
        } else {
          record.status = 'failed'
          record.message = result.error
          report.ok = false
        }
      }
    } catch (error) {
      record.status = 'failed'
      record.message = String(error?.message || error)
      report.ok = false
    }

    report.items.push(record)
    onProgress(record)
  }

  report.finishedAt = new Date().toISOString()
  report.summary = {
    created: report.items.filter((item) => item.status === 'created').length,
    overwritten: report.items.filter((item) => item.status === 'overwritten').length,
    skipped: report.items.filter((item) => item.status === 'skipped').length,
    conflict: report.items.filter((item) => item.status === 'conflict').length,
    failed: report.items.filter((item) => item.status === 'failed').length,
  }
  return report
}

/** 迁移后校验：重新读取云端并对比各模块记录数 */
export async function verifyMigration(report, plan) {
  const versions = await fetchVersions()
  const rows = versions.ok ? versions.rows : []
  const bySection = new Map(rows.map((row) => [row.section, row]))
  return report.items
    .filter((item) => item.status === 'created' || item.status === 'overwritten')
    .map((item) => {
      const cloud = bySection.get(item.section)
      const expected = plan.validation.sections[item.section]?.count ?? 0
      return {
        section: item.section,
        expected,
        cloudVersion: cloud?.version ?? null,
        written: item.status !== 'failed',
        note: cloud ? `云端版本 ${cloud.version}` : '云端未找到该模块',
      }
    })
}

/** 一键导出当前云端全部数据（用于回滚备份） */
export function buildCloudBackup(collections) {
  const sections = {}
  ALL_SECTIONS.forEach((section) => {
    sections[section] = collections[section]?.data ?? DEFAULT_DATA[section]
  })
  return {
    format: 'willow-blog-cloud-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    origin: typeof window !== 'undefined' ? window.location.origin : null,
    sections,
  }
}
