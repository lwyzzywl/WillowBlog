import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  BACKUP_FORMAT,
  LEGACY_KEYS,
  expectedShape,
  privacyNotes,
  validateBackup,
} from '../src/services/legacyBackup'
import { readLegacyLocalStorage } from '../src/services/migration'
import { configProblem, describeError, isVersionConflict, supabaseConfig } from '../src/lib/supabase'
import { PUBLIC_SECTIONS, PRIVATE_SECTIONS, SECTIONS, ALL_SECTIONS } from '../src/services/cloudStorage'

/** 造一个最小的 localStorage 替身 */
function installLocalStorage(entries) {
  const store = new Map(Object.entries(entries))
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  vi.stubGlobal('localStorage', localStorage)
  vi.stubGlobal('window', { localStorage, location: { origin: 'http://localhost:5173' } })
  return store
}

/** 一份结构与真实代码一致的完整备份 */
function buildFullBackup() {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    origin: 'http://localhost:5173',
    sections: {
      leetcode: [{ id: 'lc-two-sum', title: '两数之和', solutions: [{ id: 's1', code: 'x' }] }],
      notes: [{ id: 'note-1', title: '笔记', content: '# 标题\n**粗体**', category: 'os' }],
      checkins: ['2026-1-1', '2026-1-2'],
      studyLog: [{ id: 'focus-1', date: '2026-1-1', minutes: 25, endedAt: '2026-01-01T01:00:00.000Z' }],
      projects: [{ id: 'p1', name: '项目', status: '进行中', stack: ['C'] }],
      sparkles: [{ id: 1767225600000, emoji: '✨', text: '很棒', bg: '#fff3d6', date: '1 月 1 日' }],
      weekHours: 12.5,
    },
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('模块权限划分', () => {
  it('公开模块只有 leetcode 与 notes', () => {
    expect(PUBLIC_SECTIONS).toEqual(['leetcode', 'notes'])
  })

  it('私人模块是其余五个，且与公开模块不重叠', () => {
    expect(PRIVATE_SECTIONS).toEqual(['checkins', 'studyLog', 'projects', 'sparkles', 'weekHours'])
    expect(PUBLIC_SECTIONS.filter((section) => PRIVATE_SECTIONS.includes(section))).toEqual([])
  })

  it('七个模块全部有表归属，且公开/私人与表名一致', () => {
    expect(ALL_SECTIONS).toHaveLength(7)
    ALL_SECTIONS.forEach((section) => {
      const meta = SECTIONS[section]
      expect(meta, section).toBeTruthy()
      expect(meta.table).toBe(meta.isPublic ? 'willow_public' : 'willow_private')
      expect(PUBLIC_SECTIONS.includes(section)).toBe(meta.isPublic)
    })
  })
})

describe('备份结构校验', () => {
  it('完整备份通过校验并给出各模块条数', () => {
    const result = validateBackup(buildFullBackup())
    expect(result.ok).toBe(true)
    expect(result.problems).toEqual([])
    expect(result.counts).toEqual({
      leetcode: 1,
      notes: 1,
      checkins: 2,
      studyLog: 1,
      projects: 1,
      sparkles: 1,
      weekHours: 1,
    })
  })

  it('缺少模块时明确指出是哪个键', () => {
    const backup = buildFullBackup()
    delete backup.sections.sparkles
    const result = validateBackup(backup)
    expect(result.ok).toBe(false)
    expect(result.problems.join()).toContain('sparkles')
    expect(result.problems.join()).toContain(LEGACY_KEYS.sparkles)
  })

  it('weekHours 是数字而不是数组，类型不符会报错', () => {
    expect(expectedShape('weekHours')).toBe('number')
    expect(expectedShape('notes')).toBe('array')

    const backup = buildFullBackup()
    backup.sections.weekHours = [1, 2, 3]
    const result = validateBackup(backup)
    expect(result.ok).toBe(false)
    expect(result.problems.join()).toContain('应为数字')
  })

  it('数组模块收到对象也会报错', () => {
    const backup = buildFullBackup()
    backup.sections.projects = { id: 'p1' }
    const result = validateBackup(backup)
    expect(result.ok).toBe(false)
    expect(result.problems.join()).toContain('应为数组')
  })

  it('支持原样 localStorage 键名（不套 sections 外壳）', () => {
    const flat = {
      [LEGACY_KEYS.leetcode]: [],
      [LEGACY_KEYS.notes]: [],
      [LEGACY_KEYS.checkins]: [],
      [LEGACY_KEYS.studyLog]: [],
      [LEGACY_KEYS.projects]: [],
      [LEGACY_KEYS.sparkles]: [],
      [LEGACY_KEYS.weekHours]: 0,
    }
    const result = validateBackup(flat)
    expect(result.ok).toBe(true)
    expect(result.counts.weekHours).toBe(1)
  })

  it('重复 id 只警告不阻断', () => {
    const backup = buildFullBackup()
    backup.sections.projects = [{ id: 'p1' }, { id: 'p1' }]
    const result = validateBackup(backup)
    expect(result.ok).toBe(true)
    expect(result.warnings.join()).toContain('重复 id')
  })

  it('非对象内容直接判定失败', () => {
    expect(validateBackup(null).ok).toBe(false)
    expect(validateBackup('not json').ok).toBe(false)
  })

  it('提醒哪些内容会公开、哪些保持私人', () => {
    const notes = privacyNotes(validateBackup(buildFullBackup()))
    expect(notes.some((note) => note.includes('即将公开'))).toBe(true)
    expect(notes.some((note) => note.includes('私人模块'))).toBe(true)
  })
})

describe('从 localStorage 读取旧数据', () => {
  it('读出全部七个键的原始结构', () => {
    installLocalStorage({
      [LEGACY_KEYS.leetcode]: JSON.stringify([{ id: 'lc-1' }]),
      [LEGACY_KEYS.weekHours]: JSON.stringify(9),
    })
    const { sections, missing } = readLegacyLocalStorage()
    expect(sections.leetcode).toEqual([{ id: 'lc-1' }])
    expect(sections.weekHours).toBe(9)
    expect(sections.notes).toBeNull()
    expect(missing.map((item) => item.section).sort()).toEqual(['checkins', 'notes', 'projects', 'sparkles', 'studyLog'])
  })

  it('损坏的 JSON 不会抛错，只记入 missing', () => {
    installLocalStorage({ [LEGACY_KEYS.notes]: '{坏掉的 json' })
    const { sections, missing } = readLegacyLocalStorage()
    expect(sections.notes).toBeNull()
    expect(missing.find((item) => item.section === 'notes')?.reason).toBe('JSON 解析失败')
  })
})

describe('Supabase 配置与错误文案', () => {
  // 注意：configProblem 依赖模块导入时的环境变量，所以这里显式传入配置对象来测，
  // 避免测试结果被本机 .env.local 干扰。
  const none = { hasUrl: false, hasKey: false, keyLooksSecret: false }

  it('完全没配置时给出可操作的中文提示', () => {
    expect(configProblem(none)).toContain('.env.local')
  })

  it('只填了 URL 时提示缺少密钥', () => {
    expect(configProblem({ hasUrl: true, hasKey: false, keyLooksSecret: false })).toContain('VITE_SUPABASE_PUBLISHABLE_KEY')
  })

  it('只填了密钥时提示缺少 URL', () => {
    expect(configProblem({ hasUrl: false, hasKey: true, keyLooksSecret: false })).toContain('VITE_SUPABASE_URL')
  })

  it('误填 service_role 时优先警告密钥类型错误', () => {
    const message = configProblem({ hasUrl: true, hasKey: true, keyLooksSecret: true })
    expect(message).toContain('service_role')
  })

  it('配置齐全时没有问题', () => {
    expect(configProblem({ hasUrl: true, hasKey: true, keyLooksSecret: false })).toBeNull()
  })

  it('把 PostgREST/Postgres 错误码翻译成中文', () => {
    expect(describeError({ code: '42501' })).toContain('没有权限')
    expect(describeError({ code: 'P0001' })).toContain('已被其他设备更新')
    expect(describeError({ code: '23514' })).toContain('约束')
    expect(describeError({ message: 'Failed to fetch' })).toContain('网络')
  })

  it('能识别版本冲突', () => {
    expect(isVersionConflict({ code: 'P0001' })).toBe(true)
    expect(isVersionConflict({ code: '42501' })).toBe(false)
    expect(isVersionConflict(null)).toBe(false)
  })

  it('错误文案不会回显原始 payload 或密钥', () => {
    const secretish = 'service_role_key_abcdef123456'
    const message = describeError({ code: '42501', message: secretish })
    expect(message).not.toContain(secretish)
  })
})
