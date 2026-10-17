import { PUBLIC_SECTIONS } from '../services/cloudStorage'

/**
 * 旧版 localStorage 数据的键名与结构定义。
 *
 * 这 7 个键来自对现有代码的逐行审计（hooks.js / App.jsx / studyTime.js /
 * 各业务组件），不是猜测：
 *   willow:leetcode  LeetCodeSection  Problem[]（solutions 为嵌套数组）
 *   willow:notes     KnowledgeNotebook Note[]（content 为 Markdown）
 *   willow:checkins  App.jsx          string[]（"年-月-日" 且不补零）
 *   willow:studyLog  studyTime.js     {id,date,minutes,endedAt}[]
 *   willow:projects  ProjectLog       Project[]
 *   willow:sparkles  SparklesBoard    Sparkle[]（id 为数字）
 *   willow:weekHours Dashboard        纯数字（不是数组）
 *
 * 另外两个键刻意「不迁移」，只做说明：
 *   willow:subjects  代码只读不写，永远等于 data.js 的默认值，迁移没有意义
 *   willow:checkin   历史遗留键，现有代码只做 removeItem 清理
 */

export const LEGACY_KEYS = {
  leetcode: 'willow:leetcode',
  notes: 'willow:notes',
  checkins: 'willow:checkins',
  studyLog: 'willow:studyLog',
  projects: 'willow:projects',
  sparkles: 'willow:sparkles',
  weekHours: 'willow:weekHours',
}

/** 不在迁移范围内、但需要在报告里说明的键 */
export const IGNORED_KEYS = {
  'willow:subjects': '代码里只读取、从不写入，始终等于 data.js 的默认值，无需迁移',
  'willow:checkin': '历史遗留键，现有代码启动时会主动删除',
}

export const BACKUP_FORMAT = 'willow-blog-local-backup'
export const BACKUP_VERSION = 1

export const isPublicSection = (section) => PUBLIC_SECTIONS.includes(section)

/** 依据字段结构判断那个模块应该是数组还是标量 */
export function expectedShape(section) {
  return section === 'weekHours' ? 'number' : 'array'
}

/** 结构校验 + 记录计数，用于导入前的「文件是否完整」检查 */
export function validateBackup(backup) {
  const problems = []
  const warnings = []
  const counts = {}

  if (!backup || typeof backup !== 'object') {
    return { ok: false, problems: ['文件内容不是合法的 JSON 对象'], warnings, counts, sections: {} }
  }
  if (backup.format && backup.format !== BACKUP_FORMAT) {
    warnings.push(`备份格式标记为「${backup.format}」，不是预期的 ${BACKUP_FORMAT}，请确认文件来源`)
  }

  const sections = {}

  Object.entries(LEGACY_KEYS).forEach(([section, key]) => {
    // 允许两种写法：新备份的 {sections:{...}}，以及直接 {willow:xxx: ...} 的原样导出
    let value
    let present = false
    if (backup.sections && Object.prototype.hasOwnProperty.call(backup.sections, section)) {
      value = backup.sections[section]
      present = true
    } else if (Object.prototype.hasOwnProperty.call(backup, key)) {
      value = backup[key]
      present = true
    }

    if (!present) {
      problems.push(`缺少模块「${section}」（localStorage 键 ${key}）：可能是备份不完整`)
      counts[section] = 0
      sections[section] = { present: false, value: undefined, count: 0, shape: expectedShape(section), issues: ['未提供'] }
      return
    }

    const shape = expectedShape(section)
    const issues = []
    if (shape === 'array') {
      if (!Array.isArray(value)) {
        issues.push(`应为数组，实际是 ${value === null ? 'null' : typeof value}`)
      }
    } else if (typeof value !== 'number' && value !== null) {
      issues.push(`应为数字，实际是 ${Array.isArray(value) ? 'array' : typeof value}`)
    }

    // 数组元素的 id 重复会提示（不阻断，只提醒）
    if (Array.isArray(value)) {
      const ids = value.map((item) => item?.id).filter((id) => id !== undefined)
      const unique = new Set(ids.map((id) => String(id)))
      if (unique.size !== ids.length) warnings.push(`模块「${section}」存在重复 id，导入时会原样保留`)
    }

    issues.forEach((issue) => problems.push(`模块「${section}」${issue}`))
    counts[section] = Array.isArray(value) ? value.length : value === null || value === undefined ? 0 : 1
    sections[section] = { present: true, value, count: counts[section], shape, issues, key }
  })

  return {
    ok: problems.length === 0,
    problems,
    warnings,
    counts,
    sections,
    exportedAt: backup.exportedAt || null,
    origin: backup.origin || null,
    counts7: Object.values(counts).reduce((a, b) => a + b, 0),
  }
}

/** 备份文件里的私人内容提醒（导入前给管理员一次检查机会） */
export function privacyNotes(validation) {
  const notes = []
  const publicCount = PUBLIC_SECTIONS.reduce((sum, section) => sum + (validation.counts[section] || 0), 0)
  if (publicCount > 0) {
    notes.push(`即将公开的模块（力扣题解、知识笔记）共 ${publicCount} 条 —— 导入后访客即可看到，请确认其中没有草稿或敏感内容。`)
  }
  const privateCount = Object.entries(validation.counts)
    .filter(([section]) => !isPublicSection(section))
    .reduce((sum, [, count]) => sum + count, 0)
  if (privateCount > 0) {
    notes.push(`私人模块共 ${privateCount} 条记录，只会写进 willow_private，访客无法读取。`)
  }
  return notes
}
