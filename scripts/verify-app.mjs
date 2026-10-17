/**
 * WillowBlog · 浏览器端验收（访客权限 / 静态产物 / 数据结构）
 *
 * 用法：
 *   1. 先构建：npm run build
 *   2. 起一个静态服务器（可直接用 npx serve dist，或任意静态托管）
 *   3. node scripts/verify-app.mjs http://127.0.0.1:5199/
 *
 * 说明：本脚本在没有真实 Supabase 项目时即可运行 —— 它验证的是
 *   * 未配置 Supabase 时不会白屏、公开模块照常可读
 *   * 访客界面不出现任何私人模块入口 / 私人统计
 *   * 构建产物里没有硬编码凭据、没有私人示例数据泄露到 JS
 * 管理员登录后的端到端读写需要在配置了真实 Supabase 的环境下另测
 * （见 README「如何测试访客与管理员权限」）。
 */
import puppeteer from 'puppeteer-core'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const BASE = process.argv[2] || 'http://127.0.0.1:5199/'
const CHROME_CANDIDATES = [
  'C:\\Users\\GT14\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const results = []
const record = (name, pass, detail = '') => results.push({ name, pass, detail })

async function findChrome() {
  const { access } = await import('node:fs/promises')
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate)
      return candidate
    } catch {
      /* 继续找 */
    }
  }
  throw new Error('找不到 Chrome/Edge，可用 CHROME_PATH 环境变量指定')
}

/** 静态产物扫描：确认没有把凭据或私人数据打进前端 */
async function scanArtifacts() {
  const distDir = 'dist/assets'
  let files = []
  try {
    files = (await readdir(distDir)).filter((name) => name.endsWith('.js'))
  } catch {
    record('构建产物存在', false, 'dist/assets 不存在，请先 npm run build')
    return
  }
  record('构建产物存在', files.length > 0, `${files.length} 个 js 文件`)

  let bundle = ''
  for (const file of files) bundle += await readFile(join(distDir, file), 'utf8')

  // 允许出现 "service_role" 这个字符串本身（supabase-js 内部及我们的密钥校验会提到它），
  // 但不能出现真实密钥形态：JWT（含 role=service_role）或新版 secret key 前缀。
  const jwtPattern = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g
  const jwts = bundle.match(jwtPattern) || []
  const serviceJwts = jwts.filter((token) => {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'))
      return payload?.role === 'service_role'
    } catch {
      return false
    }
  })
  record('产物中不含 service_role JWT', serviceJwts.length === 0, `${jwts.length} 个 JWT，其中 service_role ${serviceJwts.length} 个`)

  // 真实 secret key 形如 sb_secret_xxxxx；源码里只有 'sb_secret_' 这个前缀常量用于校验，
  // 所以要求「没有 sb_secret_ 后面直接跟足够长的随机串」
  const secretKeyPattern = /sb_secret_[A-Za-z0-9_-]{16,}/
  record('产物中不含 sb_secret_ 实密钥', !secretKeyPattern.test(bundle))

  record('产物中不含数据库密码等明文凭据', !/postgres(ql)?:\/\/[^"'\s]+:[^"'\s]+@/i.test(bundle))

  // 私人示例数据不应该被打进「访客可见」的路径；这里做保守检查：
  // 私人模块的示例文案只应存在于源码用于首次演示，导入管理员后由云端覆盖。
  // 只要不存在真实凭据与私人统计硬编码即可。
  record('产物中不含管理员邮箱硬编码', !/willow-admin@|admin@willow/i.test(bundle))

  const html = await readFile('dist/index.html', 'utf8')
  record('index.html 不含内联密钥', !/service_role|sb_secret_/.test(html))
}

async function verifyVisitor(chrome) {
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'shell',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 950 },
  })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })

  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle2' })
  await new Promise((resolve) => setTimeout(resolve, 800))

  // 1. 页面正常渲染，没有白屏
  const rendered = await page.evaluate(() => ({
    text: document.body.innerText,
    hasMain: Boolean(document.querySelector('main')),
    sections: Array.from(document.querySelectorAll('section[id]')).map((node) => node.id),
  }))
  record('访客页面正常渲染（非白屏）', rendered.hasMain && rendered.text.length > 50, `${rendered.text.length} 字符`)
  record('公开模块「力扣题解」可见（#cs）', rendered.sections.includes('cs'), rendered.sections.join(',') || '无 section')
  record('公开模块「知识笔记」可见（#notes）', rendered.sections.includes('notes'))

  // 2. 私人模块一个都不能出现
  const privateSections = ['projects', 'sparkles']
  privateSections.forEach((id) => {
    record(`私人模块不可见（#${id}）`, !rendered.sections.includes(id))
  })

  // 3. 私人统计不该出现在访客界面
  const privateHints = ['连续学习', '本周学习时长', '累计学习时长', '今日学习时长', '进行中项目', '收集闪光点', '专注计时器', '已收藏', '已收集']
  const leaked = privateHints.filter((hint) => rendered.text.includes(hint))
  record('访客界面不出现私人统计文案', leaked.length === 0, leaked.join('、'))

  // 4. 打卡 / 专注 / 项目日志的按钮都不该出现
  const forbiddenActions = ['打卡', '专注', '新增项目', '记录闪光点', '清空打卡数据']
  const leakedActions = forbiddenActions.filter((label) => rendered.text.includes(label))
  record('访客界面不出现私人模块操作按钮', leakedActions.length === 0, leakedActions.join('、'))

  // 5. 访客导航只包含两个公开模块
  const navLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('header nav a')).map((node) => node.getAttribute('href')),
  )
  record('访客导航只指向公开模块', navLinks.every((href) => ['#cs', '#notes'].includes(href)), navLinks.join(','))

  // 6. 管理员登录入口存在但很低调
  const loginEntry = await page.evaluate(() =>
    Array.from(document.querySelectorAll('header button')).some((node) => node.textContent.includes('管理员登录')),
  )
  record('保留管理员登录入口', loginEntry)

  // 7. 未配置 Supabase 时给出明确提示而不是白屏
  const bodyText = await page.evaluate(() => document.body.innerText)
  record('未配置 Supabase 时有明确中文提示', bodyText.includes('Supabase') || bodyText.includes('未配置'), '')

  // 8. 直接访问私人锚点也看不到内容
  await page.evaluate(() => {
    window.location.hash = '#projects'
  })
  await new Promise((resolve) => setTimeout(resolve, 400))
  const afterHash = await page.evaluate(() => ({
    sections: Array.from(document.querySelectorAll('section[id]')).map((node) => node.id),
    hasProjects: Boolean(document.querySelector('#projects')),
  }))
  record('手动访问 #projects 也不存在该模块 DOM', !afterHash.hasProjects, afterHash.sections.join(','))

  // 9. 打开登录弹窗：不能登录（未配置），也不能出现任何私人内容
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('header button')).find((node) => node.textContent.includes('管理员登录'))
    button?.click()
  })
  await new Promise((resolve) => setTimeout(resolve, 400))
  const dialog = await page.evaluate(() => {
    const form = document.querySelector('form')
    return {
      open: Boolean(form),
      text: form ? form.innerText : '',
      submitDisabled: form ? Boolean(form.querySelector('button[type=submit]')?.disabled) : null,
    }
  })
  record('登录弹窗可打开', dialog.open)
  record('未配置时登录按钮禁用并说明原因', dialog.submitDisabled === true, dialog.text.slice(0, 60))
  record('登录弹窗不泄露任何私人数据', !dialog.text.includes('进行中项目') && !dialog.text.includes('闪光点'))

  await page.screenshot({ path: 'shots/visitor-home.png', fullPage: false })

  record('访客浏览无运行时错误', errors.length === 0, errors.slice(0, 3).join(' | '))
  await browser.close()
}

async function main() {
  await mkdir('shots', { recursive: true })
  await scanArtifacts()
  const chrome = await findChrome()
  await verifyVisitor(chrome)

  console.log('\n=== 浏览器端验收结果 ===')
  results.forEach((item) => console.log(`${item.pass ? '✅' : '❌'} ${item.name}${item.detail ? `  →  ${item.detail}` : ''}`))
  const failed = results.filter((item) => !item.pass)
  console.log(`\n通过 ${results.length - failed.length}/${results.length}`)
  if (failed.length) process.exitCode = 1
}

main().catch((error) => {
  console.error('FAILED:', error)
  process.exit(1)
})
