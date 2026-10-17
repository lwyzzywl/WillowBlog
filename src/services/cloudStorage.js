import { describeError, getSupabase, isVersionConflict, supabaseConfig } from '../lib/supabase'

/**
 * 云端数据访问层。
 *
 * 所有模块共用两张表（willow_public / willow_private），按 section 分行、
 * payload 原样保存 JSONB —— 现有组件的数据结构完全不动。
 *
 * 权限不在这里判断：写操作最终由数据库的 RLS + willow_put() 把关，
 * 前端这里的 public/private 区分只影响「请求哪张表」，不影响安全性。
 */

export const SECTIONS = {
  leetcode: { table: 'willow_public', isPublic: true, label: '力扣题解' },
  notes: { table: 'willow_public', isPublic: true, label: '知识笔记' },
  checkins: { table: 'willow_private', isPublic: false, label: '打卡记录' },
  studyLog: { table: 'willow_private', isPublic: false, label: '专注时长' },
  projects: { table: 'willow_private', isPublic: false, label: '项目日志' },
  sparkles: { table: 'willow_private', isPublic: false, label: '闪光点' },
  weekHours: { table: 'willow_private', isPublic: false, label: '每周学习时长' },
}

export const PUBLIC_SECTIONS = ['leetcode', 'notes']
export const PRIVATE_SECTIONS = ['checkins', 'studyLog', 'projects', 'sparkles', 'weekHours']
export const ALL_SECTIONS = [...PUBLIC_SECTIONS, ...PRIVATE_SECTIONS]

const missingConfig = () => ({ ok: false, configured: false, error: describeError(null, '未配置 Supabase'), row: null })
const failed = (error, fallback) => ({ ok: false, configured: true, error: describeError(error, fallback), row: null, cause: error })

/**
 * 读取单个模块。
 * @returns {{ok: boolean, configured: boolean, row: {payload: any, version: number, updated_at: string} | null, error?: string, cause?: any}}
 *   row 为 null 表示云端还没有这个模块（不是错误），调用方应回退到默认值。
 */
export async function fetchSection(section) {
  const supabase = getSupabase()
  if (!supabase) return missingConfig()

  const meta = SECTIONS[section]
  if (!meta) return failed(null, `未知模块：${section}`)

  const { data, error } = await supabase
    .from(meta.table)
    .select('section, payload, version, updated_at')
    .eq('section', section)
    .maybeSingle()

  if (error) return failed(error, `读取「${meta.label}」失败`)
  if (!data) return { ok: true, configured: true, row: null, error: null }
  return { ok: true, configured: true, row: data }
}

/**
 * 一次性读取多个模块（各自独立，任一失败不影响其它）。
 * @returns {Record<string, {ok, row, error}>}
 */
export async function fetchSections(sections) {
  const supabase = getSupabase()
  if (!supabase) return Object.fromEntries(sections.map((section) => [section, missingConfig()]))

  const results = await Promise.all(sections.map((section) => fetchSection(section)))
  return Object.fromEntries(sections.map((section, index) => [section, results[index]]))
}

/**
 * 各模块当前版本号（用于导入前的冲突预检）。
 * 受 RLS 限制：访客只会拿到公开模块的版本。
 */
export async function fetchVersions() {
  const supabase = getSupabase()
  if (!supabase) return missingConfig()

  const { data, error } = await supabase.rpc('willow_versions')
  if (error) return failed(error, '读取云端版本号失败')
  return { ok: true, configured: true, rows: data || [], error: null }
}

/**
 * 保存单个模块。
 * @param section   模块名
 * @param payload   原始数据结构（数组 / 对象 / 数字都行）
 * @param expectedVersion  上次读到的版本号；传 null 表示强制覆盖（仅用于管理员确认过的导入）
 * @returns {{ok, version?, updatedAt?, conflict?, error?}}
 */
export async function saveSection(section, payload, expectedVersion = null) {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, configured: false, error: describeError(null, '未配置 Supabase') }

  const meta = SECTIONS[section]
  if (!meta) return { ok: false, configured: true, error: `未知模块：${section}` }

  const { data, error } = await supabase.rpc('willow_put', {
    p_section: section,
    p_payload: payload,
    p_expected_version: expectedVersion,
    p_is_public: meta.isPublic,
  })

  if (error) {
    const conflict = isVersionConflict(error)
    return {
      ok: false,
      configured: true,
      conflict,
      error: describeError(error, conflict ? '版本冲突：云端数据较新' : `保存「${meta.label}」失败`),
      cause: error,
    }
  }

  const row = Array.isArray(data) ? data[0] : data
  return { ok: true, configured: true, version: row?.version ?? null, updatedAt: row?.updated_at ?? null }
}

/**
 * 连通性自检：确认表存在、密钥可用。
 * 未配置时直接返回 configured: false，避免开发者看到白屏。
 */
export async function checkConnection() {
  if (!supabaseConfig.ok) {
    return { ok: false, configured: false, error: describeError(null, '未配置 Supabase') }
  }
  const result = await fetchSection('leetcode')
  if (!result.ok) return { ok: false, configured: true, error: result.error }
  return { ok: true, configured: true }
}

export { isVersionConflict }
