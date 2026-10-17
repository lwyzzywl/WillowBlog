import { createClient } from '@supabase/supabase-js'
import { normalizeSupabaseUrl, urlHasServicePath } from './supabaseUrl'

export { normalizeSupabaseUrl } from './supabaseUrl'

/**
 * Supabase 客户端。
 *
 * 只使用「公开密钥」（publishable key / 旧版 anon public key）——
 * 它会被打包进前端，这是设计如此；真正的权限边界在 PostgreSQL 的 RLS 上，
 * 不依赖前端隐藏按钮。
 *
 * 严禁在前端出现 service_role / secret key：那会直接绕过 RLS。
 */

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const url = normalizeSupabaseUrl(rawUrl)
// 新项目叫 publishable key，老项目叫 anon key；两个变量都支持，避免用户配错就白屏
const publicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim()

/** 用户填的 URL 里是否带了不应有的服务路径（用于给出提示） */
const urlHadServicePath = urlHasServicePath(rawUrl)

if (import.meta.env.DEV && urlHadServicePath) {
  console.warn(
    `[WillowBlog] VITE_SUPABASE_URL 里带了服务路径，已自动修正为 ${url}。` +
      '建议直接把 .env.local 里的值改成这个（Project Settings → Data API → Project URL）。',
  )
}

/** 密钥是否像 service_role / secret（配错会直接泄露整个数据库，必须拦住） */
function looksLikeSecretKey(key) {
  if (!key) return false
  if (key.startsWith('sb_secret_')) return true
  // 旧版 JWT：解析 payload 看 role
  const parts = key.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

export const supabaseConfig = {
  url,
  publicKey,
  hasUrl: Boolean(url),
  hasKey: Boolean(publicKey),
  /** URL 里带了 /rest/v1 之类的服务路径（已被自动修正） */
  urlHadServicePath,
  /** 误填 service_role / secret key */
  keyLooksSecret: looksLikeSecretKey(publicKey),
  get ok() {
    return Boolean(url && publicKey) && !looksLikeSecretKey(publicKey)
  },
}

/** 配置问题的中文说明；已配置好时返回 null。可传入配置对象以便单独测试。 */
export function configProblem(config = supabaseConfig) {
  if (!config.hasUrl && !config.hasKey) {
    return '尚未配置 Supabase：请复制 .env.example 为 .env.local，填入 VITE_SUPABASE_URL 与 VITE_SUPABASE_PUBLISHABLE_KEY 后重启开发服务器。'
  }
  if (!config.hasUrl) return '缺少 VITE_SUPABASE_URL，请检查 .env.local 并重启开发服务器。'
  if (!config.hasKey) {
    return '缺少 VITE_SUPABASE_PUBLISHABLE_KEY（旧项目可填 VITE_SUPABASE_ANON_KEY），请检查 .env.local 并重启开发服务器。'
  }
  if (config.keyLooksSecret) {
    return '检测到前端配置里填入了 service_role / secret key，这会让数据库失去保护。请改用 publishable key（或旧版 anon public key）。'
  }
  return null
}

let client = null

/** 取 Supabase 客户端；未配置时返回 null（调用方负责给出友好提示） */
export function getSupabase() {
  if (!supabaseConfig.ok) return null
  if (client) return client
  client = createClient(url, publicKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-application-name': 'willow-blog' },
    },
  })
  return client
}

/* ------------------------------------------------------------------ *
 * 统一的错误文案：不要把完整 payload / token 打进日志
 * ------------------------------------------------------------------ */

const POSTGRES_MESSAGES = {
  '42501': '没有权限执行该操作（数据库拒绝了这次请求）',
  P0001: '云端数据已被其他设备更新，为避免覆盖较新的内容，本次保存已停止',
  '22023': '模块名不合法，数据库拒绝了这次写入',
  '22004': '要保存的内容为空，数据库拒绝了这次写入',
  '23514': '数据不符合数据库约束（例如把私人模块写进了公开表）',
  '42P01': '找不到数据表，请先在 Supabase 执行 SQL Migration',
}

/**
 * 把 Supabase / PostgREST 错误转成可读中文。
 * 只返回简短描述，绝不带出 payload 或密钥。
 */
export function describeError(error, fallback = '操作失败，请稍后重试') {
  if (!error) return fallback
  const code = error.code || ''
  if (POSTGRES_MESSAGES[code]) return POSTGRES_MESSAGES[code]

  const message = String(error.message || '')
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || error.name === 'TypeError') {
    return '网络连接失败，请检查网络后重试（本次内容尚未保存到云端）'
  }
  if (code === 'PGRST301' || message.includes('JWT')) {
    return '登录状态已失效，请重新登录后再操作'
  }
  if (code === 'PGRST205' || message.includes('does not exist')) {
    return '数据库里还没有对应的表，请先执行 supabase/migrations 下的 SQL'
  }
  if (message.includes('Invalid login credentials')) return '邮箱或密码不正确'
  if (message.includes('Email not confirmed')) return '该邮箱尚未确认，请在 Supabase 后台确认后重试'
  return fallback
}

/** 版本冲突判定（willow_put 抛 P0001） */
export function isVersionConflict(error) {
  return error?.code === 'P0001' || String(error?.message || '').includes('版本冲突')
}
