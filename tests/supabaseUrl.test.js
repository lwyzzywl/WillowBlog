import { describe, expect, it } from 'vitest'
import { normalizeSupabaseUrl } from '../src/lib/supabase'

/**
 * 这一组测试对应一个真实踩到的坑：
 * 用户把 Dashboard「API Docs」里的 REST endpoint 当成 Project URL 填进去，
 * 导致所有请求变成 /rest/v1/rest/v1/... 而 404，且报错完全看不出原因。
 */
describe('Supabase Project URL 规范化', () => {
  it('原样保留标准 Project URL', () => {
    expect(normalizeSupabaseUrl('https://abcdefghijklmn.supabase.co')).toBe('https://abcdefghijklmn.supabase.co')
  })

  it('去掉末尾多余斜杠', () => {
    expect(normalizeSupabaseUrl('https://abcdefghijklmn.supabase.co/')).toBe('https://abcdefghijklmn.supabase.co')
    expect(normalizeSupabaseUrl('https://abcdefghijklmn.supabase.co///')).toBe('https://abcdefghijklmn.supabase.co')
  })

  it('剥掉被误填的 /rest/v1/ 之类服务路径', () => {
    const base = 'https://abcdefghijklmn.supabase.co'
    expect(normalizeSupabaseUrl(`${base}/rest/v1`)).toBe(base)
    expect(normalizeSupabaseUrl(`${base}/rest/v1/`)).toBe(base)
    expect(normalizeSupabaseUrl(`${base}/auth/v1/`)).toBe(base)
    expect(normalizeSupabaseUrl(`${base}/storage/v1`)).toBe(base)
    expect(normalizeSupabaseUrl(`${base}/functions/v1`)).toBe(base)
    expect(normalizeSupabaseUrl(`${base}/realtime/v1`)).toBe(base)
  })

  it('去掉包裹的引号与首尾空格（.env 里常见）', () => {
    expect(normalizeSupabaseUrl('  "https://abcdefghijklmn.supabase.co"  ')).toBe('https://abcdefghijklmn.supabase.co')
    expect(normalizeSupabaseUrl("'https://abcdefghijklmn.supabase.co/rest/v1/'")).toBe('https://abcdefghijklmn.supabase.co')
  })

  it('空值/空白保持为空，不会凭空造出 URL', () => {
    expect(normalizeSupabaseUrl('')).toBe('')
    expect(normalizeSupabaseUrl('   ')).toBe('')
    expect(normalizeSupabaseUrl(undefined)).toBe('')
    expect(normalizeSupabaseUrl(null)).toBe('')
  })

  it('自定义域名与带路径前缀的自建网关不被破坏', () => {
    expect(normalizeSupabaseUrl('https://api.example.com')).toBe('https://api.example.com')
    // 只有已知的 Supabase 服务尾巴才会被剥掉
    expect(normalizeSupabaseUrl('https://example.com/supabase')).toBe('https://example.com/supabase')
  })
})
