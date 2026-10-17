/**
 * WillowBlog · RLS 权限真实验证
 * ----------------------------------------------------------------------------
 * 为什么需要这个脚本：光看 SQL 不能证明权限真的生效。
 * 这里用「真实受限角色」发请求来验证，全程不使用 service_role 冒充访客：
 *
 *   A. anon（未登录，只用 publishable key）
 *        · 读 willow_public   → 必须成功
 *        · 读 willow_private  → 必须拿到 0 行
 *        · 写 willow_public   → 必须失败
 *        · 写 willow_private  → 必须失败
 *        · 调 willow_put()    → 必须失败
 *        · 读 willow_admins   → 必须失败
 *   B. 非管理员 authenticated（脚本用 service_role 临时建一个测试账号，用完即删）
 *        · 读私人表、改公开表都必须失败；willow_put() 必须失败
 *        · 注意：service_role 只用于「创建/删除测试账号」这一件事，
 *          所有权限断言都用该账号真实登录后的 JWT 发起
 *   C. 管理员（用你已有的管理员账号登录）
 *        · 读公开表 / 私人表成功
 *        · willow_put 写入 → 版本 +1 → 恢复原数据
 *
 * 用法：
 *   node scripts/rls-check.mjs
 * 需要的环境变量（可以放在 .env.local，脚本会自己读取）：
 *   VITE_SUPABASE_URL                 项目地址
 *   VITE_SUPABASE_PUBLISHABLE_KEY     公开密钥（或 VITE_SUPABASE_ANON_KEY）
 *   SUPABASE_SERVICE_ROLE_KEY         仅用于建/删测试账号，不会用于权限断言
 *   WILLOW_ADMIN_EMAIL / WILLOW_ADMIN_PASSWORD   你的管理员账号
 *
 * 如果没有管理员密码，可以只跑 A + B 两部分（脚本会跳过 C 并明确标注）。
 * 绝对不要把 SUPABASE_SERVICE_ROLE_KEY 写进任何 VITE_ 开头的变量。
 */
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const PUBLIC_TABLE = 'willow_public'
const PRIVATE_TABLE = 'willow_private'

/** 读取 .env.local（不依赖 dotenv） */
async function loadEnvFile() {
  const env = {}
  try {
    const text = await readFile('.env.local', 'utf8')
    text.split('\n').forEach((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match) return
      env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    })
  } catch {
    /* 没有 .env.local 就只用 process.env */
  }
  return env
}

const results = []
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? `  →  ${detail}` : ''}`)
}

const section = (title) => console.log(`\n— ${title} —`)

/** 把 Supabase 错误整理成短描述，绝不打印 payload 或密钥 */
const shortError = (error) => (error ? `${error.code || ''} ${String(error.message || '').slice(0, 90)}`.trim() : '无错误')

/** 判断错误是否为「权限被拒绝」类 */
function isDenied(error) {
  if (!error) return false
  const code = error.code || ''
  const message = String(error.message || '')
  return (
    code === '42501' ||
    code === 'P0001' ||
    code === '42P01' ||
    message.includes('permission denied') ||
    message.includes('violates row-level security') ||
    message.includes('不是 WillowBlog 管理员') ||
    message.includes('需要登录')
  )
}

async function main() {
  const fileEnv = await loadEnvFile()
  const url = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL
  const publicKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    fileEnv.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY
  const adminEmail = process.env.WILLOW_ADMIN_EMAIL || fileEnv.WILLOW_ADMIN_EMAIL
  const adminPassword = process.env.WILLOW_ADMIN_PASSWORD || fileEnv.WILLOW_ADMIN_PASSWORD

  if (!url || !publicKey) {
    console.error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY：请先按 SUPABASE_SETUP.md 配置 .env.local')
    console.error('没有真实 Project URL 时无法执行权限测试，这部分测试属于「尚未验证」。')
    process.exitCode = 2
    return
  }

  console.log(`项目：${url}`)
  console.log(`管理员账号：${adminEmail ? '已提供' : '未提供（将跳过管理员部分）'}`)
  console.log(`service_role：${serviceKey ? '已提供（仅用于建/删测试账号）' : '未提供（将跳过非管理员部分）'}`)

  /* ---------------------------------------------------------------- *
   * A. 匿名访客
   * ---------------------------------------------------------------- */
  section('A. 匿名访客（anon key，无 JWT）')
  const anon = createClient(url, publicKey, { auth: { persistSession: false } })

  const publicRead = await anon.from(PUBLIC_TABLE).select('section, version')
  record('匿名单读公开表成功（访客可见题解/笔记）', !publicRead.error, publicRead.error ? shortError(publicRead.error) : `${publicRead.data?.length ?? 0} 个模块`)

  const privateRead = await anon.from(PRIVATE_TABLE).select('section')
  const privateRows = privateRead.data?.length ?? 0
  // 两种「拒绝」都算通过：
  //   · 没有表级 GRANT → 报 42501（本项目的设计）
  //   · 有 GRANT 但没有 RLS 策略 → 返回 0 行
  const privateDenied = (privateRead.error && isDenied(privateRead.error)) || (!privateRead.error && privateRows === 0)
  record('匿名读私人表被拒绝（0 行或权限错误）', privateDenied, privateRead.error ? shortError(privateRead.error) : `${privateRows} 行`)

  const anonVersions = await anon.rpc('willow_versions')
  record('匿名不可调用 willow_versions（管理员功能）', Boolean(anonVersions.error), shortError(anonVersions.error))

  const anonInsert = await anon.from(PUBLIC_TABLE).insert({ section: 'leetcode', payload: [], version: 1 })
  record('匿名写入公开表被拒绝', Boolean(anonInsert.error) && isDenied(anonInsert.error), shortError(anonInsert.error))

  const anonPrivateInsert = await anon.from(PRIVATE_TABLE).insert({ section: 'checkins', payload: [], version: 1 })
  record('匿名写入私人表被拒绝', Boolean(anonPrivateInsert.error) && isDenied(anonPrivateInsert.error), shortError(anonPrivateInsert.error))

  const anonRpc = await anon.rpc('willow_put', { p_section: 'notes', p_payload: [], p_expected_version: null, p_is_public: true })
  record('匿名调用 willow_put 被拒绝', Boolean(anonRpc.error) && isDenied(anonRpc.error), shortError(anonRpc.error))

  const anonAdmins = await anon.from('willow_admins').select('user_id')
  record('匿名读管理员名单被拒绝或为空', Boolean(anonAdmins.error) || (anonAdmins.data?.length ?? 0) === 0, shortError(anonAdmins.error) || '0 行')

  // 匿名尝试把私人模块写进公开表（用 section 约束挡）
  const anonWrongSection = await anon.rpc('willow_put', { p_section: 'projects', p_payload: [], p_expected_version: null, p_is_public: true })
  record('匿名跨表写私人模块被拒绝', Boolean(anonWrongSection.error), shortError(anonWrongSection.error))

  /* ---------------------------------------------------------------- *
   * B. 非管理员 authenticated
   * ---------------------------------------------------------------- */
  const tempEmail = `willow-rls-test-${Date.now()}@example.com`
  const tempPassword = `Rls-${Math.random().toString(36).slice(2)}-Test9!`
  let tempUserId = null

  if (serviceKey) {
    section('B. 非管理员已登录用户')
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const created = await admin.auth.admin.createUser({ email: tempEmail, password: tempPassword, email_confirm: true })
    if (created.error) {
      record('创建临时测试账号', false, shortError(created.error))
    } else {
      tempUserId = created.data?.user?.id ?? null
      record('创建临时测试账号（用 service_role，仅此一步）', Boolean(tempUserId), tempUserId ? '已创建' : '未知')

      const member = createClient(url, publicKey, { auth: { persistSession: false } })
      const signedIn = await member.auth.signInWithPassword({ email: tempEmail, password: tempPassword })
      record('非管理员账号可以登录（但不应获得权限）', !signedIn.error, shortError(signedIn.error))

      if (!signedIn.error) {
        const memberPrivate = await member.from(PRIVATE_TABLE).select('section')
        const memberRows = memberPrivate.data?.length ?? 0
        const memberDenied = (memberPrivate.error && isDenied(memberPrivate.error)) || (!memberPrivate.error && memberRows === 0)
        record('非管理员读私人表被拒绝（0 行或权限错误）', memberDenied, memberPrivate.error ? shortError(memberPrivate.error) : `${memberRows} 行`)

        const memberPublicWrite = await member.from(PUBLIC_TABLE).update({ payload: [] }).eq('section', 'notes')
        record('非管理员改公开表被拒绝（0 行受影响或报错）', Boolean(memberPublicWrite.error) || (memberPublicWrite.data?.length ?? 0) === 0, shortError(memberPublicWrite.error) || '0 行受影响')

        const memberRpc = await member.rpc('willow_put', { p_section: 'notes', p_payload: [], p_expected_version: null, p_is_public: true })
        record('非管理员调用 willow_put 被拒绝', Boolean(memberRpc.error) && isDenied(memberRpc.error), shortError(memberRpc.error))

        const memberAdmins = await member.from('willow_admins').select('user_id')
        record('非管理员读不到别人的管理员行', (memberAdmins.data?.length ?? 0) === 0, shortError(memberAdmins.error) || '0 行')

        const memberVersions = await member.rpc('willow_versions')
        const visibleSections = (memberVersions.data || []).map((row) => row.is_public)
        record(
          '非管理员的版本列表只含公开模块',
          !memberVersions.error && visibleSections.length > 0 && visibleSections.every((isPublic) => isPublic === true),
          memberVersions.error ? shortError(memberVersions.error) : `${memberVersions.data?.length ?? 0} 个模块`,
        )

        await member.auth.signOut()
      }
    }
  } else {
    section('B. 非管理员已登录用户')
    console.log('⏭  跳过：未提供 SUPABASE_SERVICE_ROLE_KEY（无法创建临时账号）。这部分属于「尚未验证」。')
  }

  /* ---------------------------------------------------------------- *
   * C. 管理员读写
   * ---------------------------------------------------------------- */
  if (adminEmail && adminPassword) {
    section('C. 管理员（真实登录）')
    const boss = createClient(url, publicKey, { auth: { persistSession: false } })
    const login = await boss.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
    record('管理员登录成功', !login.error, shortError(login.error))

    if (!login.error) {
      const bossPublic = await boss.from(PUBLIC_TABLE).select('section, version')
      record('管理员读公开表成功', !bossPublic.error, shortError(bossPublic.error))

      const bossPrivate = await boss.from(PRIVATE_TABLE).select('section, version')
      record('管理员读私人表成功', !bossPrivate.error, bossPrivate.error ? shortError(bossPrivate.error) : `${bossPrivate.data?.length ?? 0} 个模块`)

      const bossAdmins = await boss.from('willow_admins').select('user_id')
      record('管理员能确认自己的身份', (bossAdmins.data?.length ?? 0) >= 1, `${bossAdmins.data?.length ?? 0} 行`)

      // 谨慎的写测试：先读原值，用当前版本写回同样的内容，再确认成功
      const current = await boss.from(PUBLIC_TABLE).select('section, payload, version').eq('section', 'notes').maybeSingle()
      if (current.error) {
        record('读取 notes 当前版本', false, shortError(current.error))
      } else if (!current.data) {
        console.log('⏭  跳过管理员写入测试：云端还没有 notes 模块（可先在网站上收藏一条笔记再跑）')
      } else {
        const before = current.data
        const write = await boss.rpc('willow_put', {
          p_section: 'notes',
          p_payload: before.payload,
          p_expected_version: before.version,
          p_is_public: true,
        })
        record('管理员写入成功且版本 +1', !write.error && (write.data?.[0]?.version ?? 0) === before.version + 1, write.error ? shortError(write.error) : `v${before.version} → v${write.data?.[0]?.version}`)

        // 并发保护：故意用过期的版本号再写一次，必须被拒绝
        const stale = await boss.rpc('willow_put', {
          p_section: 'notes',
          p_payload: before.payload,
          p_expected_version: before.version,
          p_is_public: true,
        })
        record('过期版本号写入被拒绝（防止静默覆盖）', Boolean(stale.error), shortError(stale.error))
      }

      await boss.auth.signOut()
    }
  } else {
    section('C. 管理员（真实登录）')
    console.log('⏭  跳过：未提供 WILLOW_ADMIN_EMAIL / WILLOW_ADMIN_PASSWORD。这部分属于「尚未验证」。')
  }

  /* ---------------------------------------------------------------- *
   * 清理：删除临时测试账号
   * ---------------------------------------------------------------- */
  if (serviceKey && tempUserId) {
    section('清理')
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const removed = await admin.auth.admin.deleteUser(tempUserId)
    record('删除临时测试账号', !removed.error, shortError(removed.error))
  }

  const failed = results.filter((item) => !item.pass)
  console.log(`\n=== RLS 验证结果：通过 ${results.length - failed.length}/${results.length} ===`)
  if (failed.length) {
    console.log('未通过项：')
    failed.forEach((item) => console.log(`  · ${item.name} — ${item.detail}`))
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('FAILED:', error)
  process.exit(1)
})
