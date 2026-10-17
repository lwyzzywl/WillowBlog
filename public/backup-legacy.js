/* eslint-disable no-console */
/**
 * WillowBlog · 旧数据导出脚本（方式 A 的控制台版本）
 * ----------------------------------------------------------------------------
 * 使用场景：在「原本保存数据的那台浏览器 + 原来的域名」上导出 localStorage。
 *
 * 使用方法（二选一）：
 *   1. 把本文件内容整段复制到浏览器控制台（F12 → Console）执行；
 *   2. 或执行：fetch('/backup-legacy.js').then(r=>r.text()).then(eval)
 *      （前提是把本文件放到了站点根目录，本项目已放在 public/ 下）
 *
 * 执行后会下载一个 willow-backup-YYYY-MM-DD.json，
 * 再回到新的 WillowBlog → 管理员登录 → 旧数据迁移 → 选择该文件导入。
 *
 * 本脚本只读取 localStorage，不做任何写入或删除。
 */
;(function willowLegacyBackup() {
  var LEGACY_KEYS = {
    leetcode: 'willow:leetcode',
    notes: 'willow:notes',
    checkins: 'willow:checkins',
    studyLog: 'willow:studyLog',
    projects: 'willow:projects',
    sparkles: 'willow:sparkles',
    weekHours: 'willow:weekHours',
  }
  var IGNORED_KEYS = {
    'willow:subjects': '代码里只读取、从不写入，无需迁移',
    'willow:checkin': '历史遗留键，现有代码会自动清理，无需迁移',
  }

  var sections = {}
  var missing = []
  var counts = {}

  Object.keys(LEGACY_KEYS).forEach(function (section) {
    var key = LEGACY_KEYS[section]
    var raw = window.localStorage.getItem(key)
    if (raw === null) {
      missing.push(key)
      sections[section] = null
      counts[section] = 0
      return
    }
    try {
      var value = JSON.parse(raw)
      sections[section] = value
      counts[section] = Array.isArray(value) ? value.length : value === null ? 0 : 1
    } catch (error) {
      missing.push(key + '（JSON 解析失败）')
      sections[section] = null
      counts[section] = 0
    }
  })

  var backup = {
    format: 'willow-blog-local-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    origin: window.location.origin,
    userAgent: navigator.userAgent,
    legacyKeys: LEGACY_KEYS,
    ignoredKeys: IGNORED_KEYS,
    sections: sections,
  }

  var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  var filename = 'willow-backup-' + stamp + '.json'
  var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  var url = URL.createObjectURL(blob)
  var link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  console.log('%cWillowBlog 旧数据导出完成', 'color:#49a96b;font-weight:bold')
  console.table(counts)
  if (missing.length) console.warn('以下键为空或无法解析：', missing)
  console.log('已下载：' + filename)
  console.log('下一步：在新的 WillowBlog 里用管理员登录 → 旧数据迁移 → 选择这个文件。')
  console.log('注意：旧数据没有被删除，确认迁移成功后再自行清理。')
})()
