/**
 * 把用户在 .env.local 里填的 Project URL 规范化。
 *
 * 最常见的粘贴错误：把 Dashboard「API Docs」里的 REST endpoint
 * `https://xxx.supabase.co/rest/v1/` 当成 Project URL 填进来。
 * supabase-js 会自己在末尾拼 `/rest/v1`，于是请求变成
 * `/rest/v1/rest/v1/...` → 全部 404，而且报错完全看不出原因。
 *
 * 这个函数是纯函数，前端与 Node 脚本共用，避免两边各写一份。
 */
export function normalizeSupabaseUrl(raw) {
  let value = String(raw || '').trim()
  if (!value) return ''
  // 去掉包裹的引号与末尾多余斜杠
  value = value.replace(/^["']|["']$/g, '').trim()
  value = value.replace(/\/+$/, '')
  // 剥掉 Supabase 各服务的路径尾巴（顺序从长到短，避免只剥一半）
  for (const suffix of ['/rest/v1', '/auth/v1', '/storage/v1', '/functions/v1', '/realtime/v1', '/graphql/v1']) {
    if (value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length)
      break
    }
  }
  return value.replace(/\/+$/, '')
}

/** URL 里是否带了不应有的服务路径（用于提示用户去改 .env.local） */
export function urlHasServicePath(raw) {
  const original = String(raw || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '')
  return Boolean(original) && original !== normalizeSupabaseUrl(original)
}

/** 密钥类型判断：publishable / 旧版 anon / 误填的 secret */
export function classifyKey(key) {
  const value = String(key || '').trim()
  if (!value) return 'empty'
  if (value.startsWith('sb_secret_')) return 'secret'
  if (value.startsWith('sb_publishable_')) return 'publishable'
  const parts = value.split('.')
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload?.role === 'service_role') return 'secret'
      if (payload?.role === 'anon') return 'anon-jwt'
      return 'jwt-other'
    } catch {
      return 'unknown'
    }
  }
  return 'unknown'
}
