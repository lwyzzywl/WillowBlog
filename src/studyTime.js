import { todayKey } from './hooks'

/**
 * 专注时长的纯计算工具。
 *
 * 这里刻意不碰任何存储：数据由云端集合（willow_private / studyLog）持有，
 * 计时器只在「一次专注结束」时提交一次，避免每秒写数据库。
 */

export const STUDY_LOG_SECTION = 'studyLog'

/** 清洗脏数据：只保留结构正确的会话 */
export function sanitizeStudyLog(log) {
  if (!Array.isArray(log)) return []
  return log.filter((session) => session && session.date && typeof session.minutes === 'number')
}

/** 构造一条新的专注记录（不写入任何地方，由调用方提交到云端） */
export function createStudySession(minutes, now = new Date()) {
  return {
    id: `focus-${now.getTime()}`,
    date: todayKey(now),
    minutes: Math.max(1, Math.round(Number(minutes) || 0)),
    endedAt: now.toISOString(),
  }
}

/** 今日累计专注分钟数 */
export function todayStudyMinutes(log) {
  const key = todayKey()
  return sumSessions(sanitizeStudyLog(log).filter((session) => session.date === key))
}

/** 累计专注分钟数 */
export function totalStudyMinutes(log) {
  return sumSessions(sanitizeStudyLog(log))
}

/** 最近 N 天（含今天）的每日专注分钟序列，用于小柱状图 */
export function lastNDaysStudy(log, days = 7) {
  const byDay = {}
  sanitizeStudyLog(log).forEach((session) => {
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
