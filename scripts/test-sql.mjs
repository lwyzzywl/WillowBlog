/**
 * WillowBlog · 在本地真实 PostgreSQL 引擎里执行 SQL 并验证权限
 * ----------------------------------------------------------------------------
 * 为什么需要它：
 *   `supabase/sql/verify_rls.sql` 是一条「读系统目录」的审计查询，
 *   只有连上数据库才能执行。在没有你的 Supabase 项目凭据之前，
 *   本脚本用 PGlite（PostgreSQL 编译成 WASM，跑在本机）真实执行：
 *     · 两个 migration 文件（原样执行，不裁剪）
 *     · verify_rls.sql（原样执行，检查 13 项结论）
 *     · 用 SET ROLE + JWT 声明模拟 anon / 非管理员 / 管理员三种角色，
 *       逐条验证「该读的能读、该拦的拦住」
 *
 * 它能证明什么：
 *   SQL 语法有效、表/约束/策略/函数确实建起来了、RLS 行为符合设计。
 * 它不能替代什么：
 *   Supabase 的 auth.users / auth.uid() / PostgREST 在这里是我写的替身，
 *   最终仍需在你的真实项目上跑一次 `npm run verify:rls`（用真实 JWT 发 HTTP 请求）。
 *
 * 用法：npm run test:sql
 */
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

const MIGRATIONS = [
  'supabase/migrations/0001_init_willow_tables.sql',
  'supabase/migrations/0002_willow_put_rpc.sql',
]

const ADMIN_UID = '11111111-1111-4111-8111-111111111111'
const MEMBER_UID = '22222222-2222-4222-8222-222222222222'

const results = []
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? `  →  ${detail}` : ''}`)
}
const section = (title) => console.log(`\n— ${title} —`)

const db = new PGlite()

/** 切换「请求身份」：角色 + JWT 里的 sub（模拟 Supabase 的 auth.uid()） */
async function asRole(role, uid, fn) {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  if (role) await db.exec(`set role ${role}`)
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
  }
}

/** 断言某条语句会失败，并检查错误码 */
async function expectFail(name, sql, params, codes) {
  try {
    await db.query(sql, params)
    record(name, false, '没有报错（说明权限没拦住）')
  } catch (error) {
    const code = error.code || ''
    record(name, codes.includes(code), code ? `code=${code} ${String(error.message).slice(0, 70)}` : String(error.message).slice(0, 90))
  }
}

async function expectOk(name, sql, params, check) {
  try {
    const result = await db.query(sql, params)
    const pass = check ? check(result) : true
    record(name, pass, pass ? `${result.rows?.length ?? 0} 行` : '结果不符合预期')
    return result
  } catch (error) {
    record(name, false, `意外报错：${String(error.message).slice(0, 90)}`)
    return null
  }
}

async function main() {
  /* ================================================================
   * 0. 搭出 Supabase 里本来就存在的环境（本项目 SQL 依赖它们）
   * ================================================================ */
  section('0. 准备本地 PostgreSQL 环境（模拟 Supabase 自带的 auth / roles）')
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key,
      email text unique
    );

    -- Supabase 的 auth.uid()：从 JWT 声明里取当前用户
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `)
  for (const role of ['anon', 'authenticated']) {
    try {
      await db.exec(`create role ${role} nologin`)
    } catch (error) {
      if (!String(error.message).includes('already exists')) throw error
    }
    await db.exec(`grant ${role} to current_user`)
  }
  await db.exec(`
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `)
  record('auth 替身与 anon / authenticated 角色就绪', true, `admin=${ADMIN_UID.slice(0, 8)}… member=${MEMBER_UID.slice(0, 8)}…`)

  /* ================================================================
   * 1. 原样执行两个 migration
   * ================================================================ */
  section('1. 执行 migration（文件原样执行）')
  for (const file of MIGRATIONS) {
    const sql = await readFile(file, 'utf8')
    try {
      await db.exec(sql)
      record(`${file} 执行成功`, true)
    } catch (error) {
      record(`${file} 执行成功`, false, String(error.message).slice(0, 160))
      throw error
    }
  }

  const tableCount = await db.query(`
    select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('willow_public','willow_private','willow_admins')
  `)
  record('三张表已创建', tableCount.rows[0].n === 3, `${tableCount.rows[0].n} 张`)

  /* ================================================================
   * 2. 执行 verify_rls.sql（原样）
   * ================================================================ */
  section('2. 执行 supabase/sql/verify_rls.sql（原样执行）')
  const verifySql = await readFile('supabase/sql/verify_rls.sql', 'utf8')
  let report = null
  try {
    // 此时管理员名单还是空的：第 13 项应为 WARN
    report = await db.query(verifySql)
    record('verify_rls.sql 可被数据库接受并返回报告', report.rows.length === 13, `${report.rows.length} 项检查`)
    const fails = report.rows.filter((row) => String(row.结论).startsWith('FAIL'))
    record('管理员名单为空时没有误报 FAIL', fails.length === 0, fails.map((row) => `${row.序号}${row.检查项}`).join(', ') || '无 FAIL')
    const warn13 = report.rows.find((row) => row.序号 === 13)
    record('第 13 项正确提示「还没填管理员 UID」', String(warn13?.结论).startsWith('WARN'), warn13?.详情)
  } catch (error) {
    record('verify_rls.sql 可被数据库接受并返回报告', false, String(error.message).slice(0, 200))
    throw error
  }

  /* ================================================================
   * 3. 写入测试数据（管理员 / 普通用户 / 各模块）
   * ================================================================ */
  section('3. 准备测试数据')
  await db.query(`insert into auth.users (id, email) values ($1, $2), ($3, $4)`, [
    ADMIN_UID,
    'admin@willow.test',
    MEMBER_UID,
    'member@willow.test',
  ])
  await db.query(`insert into public.willow_admins (user_id, note) values ($1, '站长')`, [ADMIN_UID])
  await db.query(`insert into public.willow_public (section, payload) values ('leetcode', $1), ('notes', $2)`, [
    JSON.stringify([{ id: 'lc-two-sum', title: '两数之和' }]),
    JSON.stringify([{ id: 'note-1', title: '笔记', content: '# 标题' }]),
  ])
  await db.query(`insert into public.willow_private (section, payload) values ('checkins', $1), ('weekHours', $2)`, [
    JSON.stringify(['2026-1-1']),
    JSON.stringify(12.5),
  ])
  record('测试数据写入完成', true, '2 个公开模块 + 2 个私人模块')

  const reportAfter = await db.query(verifySql)
  const failsAfter = reportAfter.rows.filter((row) => String(row.结论).startsWith('FAIL'))
  record('填好管理员后 13 项全部无 FAIL', failsAfter.length === 0, failsAfter.map((row) => `${row.序号}${row.检查项}`).join(', ') || '无 FAIL')
  record('第 13 项变为 PASS', String(reportAfter.rows.find((row) => row.序号 === 13)?.结论) === 'PASS', reportAfter.rows.find((row) => row.序号 === 13)?.详情)

  console.log('\n  ── verify_rls.sql 实际输出 ──')
  reportAfter.rows.forEach((row) => {
    console.log(`  ${String(row.结论).padEnd(4)}  ${String(row.序号).padStart(2)}. ${row.检查项}`)
    if (row.详情) console.log(`        ${String(row.详情).slice(0, 150)}`)
  })

  /* ================================================================
   * 4. 匿名访客（anon）
   * ================================================================ */
  section('4. 匿名访客 anon')

  await asRole('anon', null, async () => {
    await expectOk('匿名可读公开表（题解/笔记）', `select section, payload from public.willow_public order by section`, [], (r) => r.rows.length === 2)
    await expectFail('匿名不可读私人表', `select section from public.willow_private`, [], ['42501'])
    await expectFail('匿名不可写公开表', `insert into public.willow_public (section, payload) values ('notes', '[]')`, [], ['42501'])
    await expectFail('匿名不可改公开表', `update public.willow_public set payload = '[]' where section = 'notes'`, [], ['42501'])
    await expectFail('匿名不可写私人表', `insert into public.willow_private (section, payload) values ('checkins', '[]')`, [], ['42501'])
    await expectFail('匿名不可读管理员名单', `select user_id from public.willow_admins`, [], ['42501'])
    await expectFail('匿名不可调用 willow_put', `select * from public.willow_put('notes', '[]', null, true)`, [], ['42501'])
    await expectFail('匿名不可调用 willow_versions（管理员功能）', `select * from public.willow_versions()`, [], ['42501'])
  })

  /* ================================================================
   * 5. 非管理员已登录用户（authenticated 但不在名单里）
   * ================================================================ */
  section('5. 非管理员 authenticated')

  await asRole('authenticated', MEMBER_UID, async () => {
    await expectOk('非管理员读私人表得到 0 行', `select section from public.willow_private`, [], (r) => r.rows.length === 0)
    await expectOk('非管理员读不到别人管理员行', `select user_id from public.willow_admins`, [], (r) => r.rows.length === 0)
    await expectOk('非管理员改公开表影响 0 行', `update public.willow_public set payload = '[]' where section = 'notes' returning section`, [], (r) => r.rows.length === 0)
    await expectOk('非管理员删公开表影响 0 行', `delete from public.willow_public where section = 'notes' returning section`, [], (r) => r.rows.length === 0)
    await expectFail('非管理员写公开表被 RLS 拒绝', `insert into public.willow_public (section, payload) values ('whatever-测试', '[]')`, [], ['42501'])
    await expectFail('非管理员调用 willow_put 被拒绝', `select * from public.willow_put('notes', '[]', null, true)`, [], ['42501'])
    await expectFail('非管理员调用 willow_put 写私人模块被拒绝', `select * from public.willow_put('checkins', '[]', null, false)`, [], ['42501'])
    await expectOk(
      '非管理员看到的版本列表只含公开模块',
      `select section, is_public from public.willow_versions()`,
      [],
      (r) => r.rows.length === 2 && r.rows.every((row) => row.is_public === true),
    )
  })

  /* ================================================================
   * 6. 管理员
   * ================================================================ */
  section('6. 管理员 authenticated + 在管理员名单内')

  await asRole('authenticated', ADMIN_UID, async () => {
    await expectOk('管理员可读私人表', `select section, payload from public.willow_private order by section`, [], (r) => r.rows.length === 2)
    await expectOk('管理员可读公开表', `select section from public.willow_public`, [], (r) => r.rows.length === 2)
    await expectOk(
      '管理员看到的版本列表含公开 + 私人全部模块',
      `select section, is_public from public.willow_versions()`,
      [],
      (r) => r.rows.length === 4,
    )

    // 用一个尚未存在的模块（sparkles）验证完整生命周期，避免和预置数据混淆
    const first = await db.query(`select * from public.willow_put('sparkles', $1, 1, false)`, [
      JSON.stringify([{ id: 1, text: '第一颗' }]),
    ])
    record('首次写入使用传入的版本号（新建）', Number(first.rows[0]?.version) === 1, `version=${first.rows[0]?.version}`)

    const second = await db.query(`select * from public.willow_put('sparkles', $1, 1, false)`, [
      JSON.stringify([
        { id: 1, text: '第一颗' },
        { id: 2, text: '第二颗' },
      ]),
    ])
    record('再次写入同版本 → 版本 +1', Number(second.rows[0]?.version) === 2, `version=${second.rows[0]?.version}`)

    await expectFail('过期版本号写入被拒绝（P0001）', `select * from public.willow_put('sparkles', '[]', 1, false)`, [], ['P0001'])

    // 对已存在模块、用正确版本号写入也应成功
    const checkinsVersion = (await db.query(`select version from public.willow_private where section = 'checkins'`)).rows[0].version
    const bumped = await db.query(`select * from public.willow_put('checkins', $1, $2, false)`, [
      JSON.stringify(['2026-1-1', '2026-1-2']),
      checkinsVersion,
    ])
    record(
      '对已有模块用正确版本号写入成功',
      Number(bumped.rows[0]?.version) === Number(checkinsVersion) + 1,
      `v${checkinsVersion} → v${bumped.rows[0]?.version}`,
    )

    // 强制覆盖（版本号传 null）
    const forced = await db.query(`select * from public.willow_put('weekHours', '20', null, false)`)
    record('强制覆盖模式可用（传 null 不用版本号）', Number(forced.rows[0]?.version) >= 2, `version=${forced.rows[0]?.version}`)

    await expectOk('管理员可直接 UPDATE 公开表', `update public.willow_public set payload = payload where section = 'notes' returning section`, [], (r) => r.rows.length === 1)

    await expectFail('管理员也不能通过 API 改管理员名单', `insert into public.willow_admins (user_id) values ('${MEMBER_UID}')`, [], ['42501'])
  })

  /* ================================================================
   * 7. 跨表 / 脏数据约束
   * ================================================================ */
  section('7. section 约束（防止模块写错表）')
  await expectFail('私人模块不能写进公开表', `insert into public.willow_public (section, payload) values ('projects', '[]')`, [], ['23514'])
  await expectFail('公开模块不能写进私人表', `insert into public.willow_private (section, payload) values ('notes', '[]')`, [], ['23514'])
  await expectFail('未知模块名被拒绝', `insert into public.willow_public (section, payload) values ('whatever', '[]')`, [], ['23514'])
  await expectFail(
    'willow_put 也拦住跨表写入（管理员也不行）',
    `select * from public.willow_put('projects', '[]', null, true)`,
    [],
    ['22023'],
  )

  /* ================================================================
   * 8. payload 形态保持不变（数组 / 标量原样）
   * ================================================================ */
  section('8. payload 原样保存（不强制数组）')
  const shapes = await db.query(`
    select section, jsonb_typeof(payload) as t from public.willow_private order by section
  `)
  record('weekHours 以标量（number）保存', shapes.rows.find((r) => r.section === 'weekHours')?.t === 'number', JSON.stringify(shapes.rows))
  record('checkins 以数组保存', shapes.rows.find((r) => r.section === 'checkins')?.t === 'array')

  /* ================================================================
   * 汇总
   * ================================================================ */
  const failed = results.filter((item) => !item.pass)
  console.log(`\n=== SQL / RLS 本地验证：通过 ${results.length - failed.length}/${results.length} ===`)
  if (failed.length) {
    console.log('未通过项：')
    failed.forEach((item) => console.log(`  · ${item.name} — ${item.detail}`))
    process.exitCode = 1
  }
  await db.close()
}

main().catch(async (error) => {
  console.error('\nFAILED:', error)
  process.exitCode = 1
})
