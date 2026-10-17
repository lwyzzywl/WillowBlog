/**
 * WillowBlog · 体检（Doctor）
 * ----------------------------------------------------------------------------
 * 用途：在你把页面发给别人之前，先用一条命令确认「后台到底通不通」。
 *
 * 它会检查：
 *   1. .env.local 里的 Project URL 格式（自动纠正 /rest/v1/ 这类粘贴错误）
 *   2. 密钥类型（publishable / 旧版 anon 正常；误填 service_role / secret 会报警）
 *   3. 网络连通性与数据表是否存在（migration 有没有执行）
 *   4. 公开模块能不能读（访客视角）
 *   5. 私人模块能不能被匿名读取（必须不能）
 *   6. 匿名能不能写（必须不能）
 *   7. 各模块当前条数（确认是不是空的）
 *
 * 用法：npm run doctor
 */
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { classifyKey, normalizeSupabaseUrl, urlHasServicePath } from '../src/lib/supabaseUrl.js'

const PUBLIC_TABLE = 'willow_public'
const PRIVATE_TABLE = 'willow_private'

const problems = []
const hints = []
const record = (ok, name, detail = '') => {
  console.log(`${ok === true ? '✅' : ok === 'warn' ? '⚠️ ' : '❌'} ${name}${detail ? `  →  ${detail}` : ''}`)
  if (ok === false) problems.push(name)
  if (ok === 'warn') hints.push(name)
}

async function readEnvLocal() {
  const env = {}
  try {
    const text = await readFile('.env.local', 'utf8')
    text.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (!match) return
      env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '').trim()
    })
  } catch {
    /* 没有就返回空 */
  }
  return env
}

async function main() {
  console.log('=== WillowBlog 体检 ===\n')

  /* ---------- 1. 配置 ---------- */
  console.log('— 配置 —')
  const env = await readEnvLocal()
  const rawUrl = env.VITE_SUPABASE_URL || ''
  const url = normalizeSupabaseUrl(rawUrl)
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || ''
  const keyType = classifyKey(key)

  if (!rawUrl) {
    record(false, 'VITE_SUPABASE_URL 已填写', '未读到 .env.local 或变量为空')
  } else if (urlHasServicePath(rawUrl)) {
    record('warn', 'VITE_SUPABASE_URL 格式', `带了服务路径，已自动纠正为 ${url}（建议直接改 .env.local）`)
  } else {
    record(true, 'VITE_SUPABASE_URL 格式正确', url)
  }

  if (!key) {
    record(false, 'VITE_SUPABASE_PUBLISHABLE_KEY 已填写', '未读到密钥')
  } else if (keyType === 'secret') {
    record(false, '密钥类型', '这是 service_role / secret key！会绕过 RLS，请改用 publishable key 并立刻轮换')
  } else {
    record(true, '密钥类型可用', keyType === 'publishable' ? 'publishable key（新版）' : 'anon public key（旧版 JWT）')
  }

  if (!url || !key || keyType === 'secret') {
    console.log('\n配置不完整，后面的网络检查跳过。请先修好 .env.local。')
    return finish()
  }

  /* ---------- 2. 连通性 ---------- */
  console.log('\n— 连通性 —')
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const started = Date.now()
  const ping = await sb.from(PUBLIC_TABLE).select('section').limit(1)
  const elapsed = Date.now() - started

  if (ping.error) {
    const code = ping.error.code || ''
    const message = String(ping.error.message || '')
    if (code === 'PGRST205' || message.includes('Could not find the table') || message.includes('does not exist')) {
      record(false, '数据表存在', `表还没建：请先在 SQL Editor 执行 supabase/migrations 下的两个 SQL`)
    } else if (message.includes('Failed to fetch') || code === '') {
      record(false, '网络可达', `连不上 ${url}：检查 URL 是否正确、项目是否已暂停（免费项目闲置会暂停）`)
    } else {
      record(false, '查询公开表', `${code} ${message.slice(0, 80)}`)
    }
  } else {
    record(true, '网络可达且数据表已创建', `响应 ${elapsed}ms`)
  }

  /* ---------- 3. 公开数据 ---------- */
  console.log('\n— 公开模块（访客应能读）—')
  const publicRows = await sb.from(PUBLIC_TABLE).select('section, version, payload')
  if (publicRows.error) {
    record(false, '匿名读取公开表', `${publicRows.error.code || ''} ${String(publicRows.error.message).slice(0, 80)}`)
  } else {
    record(true, '匿名可以读取公开表', `${publicRows.data.length} 个模块`)
    if (publicRows.data.length === 0) {
      record(
        'warn',
        '公开模块还是空的',
        '访客会看到内置示例内容（页面会标注「示例内容 · 云端还没有数据」）。想展示真实内容，先导入旧数据或手动添加几条再发布',
      )
    } else {
      publicRows.data.forEach((row) => {
        const count = Array.isArray(row.payload) ? `${row.payload.length} 条` : `标量 ${JSON.stringify(row.payload)}`
        console.log(`     · ${row.section}  v${row.version}  ${count}`)
      })
    }
  }

  /* ---------- 4. 私人数据必须读不到 ---------- */
  console.log('\n— 私人模块（匿名必须读不到）—')
  const privateRead = await sb.from(PRIVATE_TABLE).select('section')
  if (privateRead.error) {
    const denied = ['42501', 'PGRST301'].includes(privateRead.error.code || '')
    record(denied ? true : false, '匿名读取私人表被拒绝', `${privateRead.error.code || ''} ${String(privateRead.error.message).slice(0, 70)}`)
  } else {
    record(privateRead.data.length === 0, '匿名读取私人表返回 0 行', `${privateRead.data.length} 行`)
  }

  const anonWrite = await sb.from(PUBLIC_TABLE).insert({ section: 'notes', payload: [] })
  record(Boolean(anonWrite.error), '匿名写入被拒绝', anonWrite.error ? `code=${anonWrite.error.code}` : '没有报错（危险！）')

  const anonRpc = await sb.rpc('willow_put', { p_section: 'notes', p_payload: [], p_expected_version: null, p_is_public: true })
  record(Boolean(anonRpc.error), '匿名调用 willow_put 被拒绝', anonRpc.error ? `code=${anonRpc.error.code}` : '没有报错（危险！）')

  /* ---------- 5. 管理员名单 ---------- */
  console.log('\n— 管理员名单 —')
  const admins = await sb.from('willow_admins').select('user_id')
  if (admins.error) {
    record(true, '匿名读不到管理员名单', `code=${admins.error.code}`)
  } else {
    record(admins.data.length === 0, '匿名读不到管理员名单', `${admins.data.length} 行`)
  }

  finish()
}

function finish() {
  console.log('\n=== 结论 ===')
  if (problems.length === 0 && hints.length === 0) {
    console.log('🎉 一切正常，可以发布了。')
  } else if (problems.length === 0) {
    console.log('基本可用，但有几条提醒：')
    hints.forEach((item) => console.log(`  ⚠️  ${item}`))
  } else {
    console.log('有必须先解决的问题：')
    problems.forEach((item) => console.log(`  ❌ ${item}`))
    console.log('\n排错顺序：')
    console.log('  1. 先在 Supabase SQL Editor 执行 supabase/migrations/0001 与 0002')
    console.log('  2. 再执行 supabase/sql/setup_admin.sql（填入你的管理员 UID）')
    console.log('  3. 重新运行 npm run doctor')
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('体检脚本自身出错：', error)
  process.exitCode = 1
})
