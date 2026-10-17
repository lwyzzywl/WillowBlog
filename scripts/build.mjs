/**
 * 构建入口。
 *
 * 为什么不让 `npm run build` 直接调用 vite：
 * 某些 Windows 环境下 esbuild 无法删除系统临时目录里的中间文件
 * （报 "remove ... Access is denied"，属于本机 TEMP 权限问题，不是代码问题）。
 * 这里把 TEMP/TMP 指到项目内的 .tmp 目录并先确保可写，
 * 构建成功后清理，失败时保留现场并把日志原样打出来。
 */
import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const projectRoot = process.cwd()
const tempDir = join(projectRoot, '.tmp', 'build-temp')

async function ensureWritableTemp() {
  try {
    await mkdir(tempDir, { recursive: true })
    return tempDir
  } catch (error) {
    // 项目目录不可写时退回系统临时目录，让 vite 自己去报错
    console.warn(`[build] 无法使用项目内临时目录（${error.message}），改用系统临时目录`)
    return undefined
  }
}

async function run(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env, shell: process.platform === 'win32' })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
      process.stdout.write(chunk)
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
      process.stderr.write(chunk)
    })
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
    child.on('error', (error) => resolve({ code: 1, output: `${output}\n${error.message}` }))
  })
}

const viteBin = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
if (!existsSync(viteBin)) {
  console.error('[build] 找不到 vite，请先执行 npm install')
  process.exit(1)
}

const temp = await ensureWritableTemp()
const env = { ...process.env }
if (temp) {
  env.TEMP = temp
  env.TMP = temp
}

const { code, output } = await run(process.execPath, [viteBin, 'build', ...process.argv.slice(2)], env)

if (code === 0 && temp) {
  await rm(temp, { recursive: true, force: true }).catch(() => {})
} else if (code !== 0) {
  const hint = output.includes('Access is denied')
    ? '\n提示：这是本机 TEMP 目录权限问题。可以设置中把 用户变量 TEMP/TMP 指到一个可写目录，或直接用管理员身份运行一次磁盘清理。'
    : ''
  console.error(`[build] 构建失败（退出码 ${code}）${hint}`)
}

process.exit(code)
