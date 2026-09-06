import { readStorage, todayKey, writeStorage } from './hooks'

export const STUDY_LOG_KEY = 'willow:studyLog'

/** 读取全部专注记录（清洗掉脏数据） */
export function getStudyLog() {
  const log = readStorage(STUDY_LOG_KEY, [])
  if (!Array.isArray(log)) return []
  return log.filter((session) => session && session.date && typeof session.minutes === 'number')
}

/**
 * 记录一次专注时长（分钟）。
 * 写入 localStorage 并通过 writeStorage 广播 'willow:data' 事件，
 * 首页 Dashboard 监听该事件后自动刷新今日/累计学习时长。
 */
export function addStudySession(minutes) {
  const session = {
    id: `focus-${Date.now()}`,
    date: todayKey(),
    minutes: Math.max(1, Math.round(Number(minutes) || 0)),
    endedAt: new Date().toISOString(),
  }
  writeStorage(STUDY_LOG_KEY, [...getStudyLog(), session])
  return session
}

/** 今日累计专注分钟数 */
export function todayStudyMinutes(log) {
  const key = todayKey()
  return sumSessions(log.filter((session) => session.date === key))
}

/** 累计专注分钟数 */
export function totalStudyMinutes(log) {
  return sumSessions(log)
}

/** 最近 N 天（含今天）的每日专注分钟序列，用于小柱状图 */
export function lastNDaysStudy(log, days = 7) {
  const byDay = {}
  log.forEach((session) => {
    byDay[session.date] = (byDay[session.date] || 0) + session.minutes
  })
  const series = []
  const cursor = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(cursor)
    date.setDate(date.getDate() - i)
    const key = todayKey(date)
    series.push({
      key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      minutes: byDay[key] || 0,
    })
  }
  return series
}

/** 分钟 → 可读文案：45 分钟 / 1 小时 5 分 */
export function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0))
  if (total < 60) return `${total} 分钟`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`
}

function sumSessions(list) {
  return list.reduce((acc, session) => acc + session.minutes, 0)
}
