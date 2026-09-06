import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, BookOpen, Clock, Flame, Hourglass, Medal, PartyPopper, Quote, Rocket, RotateCw, Star, Timer } from 'lucide-react'
import { formatDateCN, getGreeting, getQuoteIndex, INITIAL_SPARKLES, PROJECTS, QUOTES, SUBJECTS } from '../data'
import { readStorage, toast, todayKey, useNow, writeStorage } from '../hooks'
import { formatMinutes, getStudyLog, lastNDaysStudy, todayStudyMinutes, totalStudyMinutes } from '../studyTime'
import Reveal from './Reveal'
import Heatmap from './Heatmap'

const BADGE_GOALS = [7, 14, 30, 100]

export default function Dashboard({ checkedIn, onCheckIn, streak, checkins, onResetCheckins }) {
  const now = useNow(60000)
  const greeting = getGreeting(now)
  
  const streakPct = Math.min(100, (streak / 30) * 100)
  const [quoteIndex, setQuoteIndex] = useState(() => getQuoteIndex(new Date()))
  const [statsVersion, setStatsVersion] = useState(0)
  const [editingHours, setEditingHours] = useState(false)
  const [hoursDraft, setHoursDraft] = useState('')

  useEffect(() => {
    const refresh = () => setStatsVersion((version) => version + 1)
    window.addEventListener('willow:data', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('willow:data', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const weekDays = useMemo(() => {
    const set = new Set(checkins)
    const cursor = new Date()
    let count = 0
    for (let i = 0; i < 7; i++) {
      if (set.has(todayKey(cursor))) count += 1
      cursor.setDate(cursor.getDate() - 1)
    }
    return count
  }, [checkins])

  const studyToday = useMemo(() => todayStudyMinutes(getStudyLog()), [statsVersion])
  const studyTotal = useMemo(() => totalStudyMinutes(getStudyLog()), [statsVersion])
  const studySeries = useMemo(() => lastNDaysStudy(getStudyLog(), 7), [statsVersion])

  const quickStats = useMemo(() => {
    const subjects = readStorage('willow:subjects', SUBJECTS) || []
    const chapters = subjects.flatMap((subject) => subject.chapters || [])
    const mastered = chapters.filter((chapter) => chapter.status === 'done').length
    const projects = readStorage('willow:projects', PROJECTS) || []
    const ongoing = projects.filter((project) => project.status === '进行中').length
    const sparkles = readStorage('willow:sparkles', INITIAL_SPARKLES) || []
    const hours = Math.min(168, Math.max(0, Number(readStorage('willow:weekHours', 0)) || 0))
    return [
      {
        id: 'time',
        label: '本周学习时长',
        value: `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`,
        sub: `本周打卡 ${weekDays} 天`,
        icon: Clock,
        tint: 'bg-sky-100',
        color: 'text-sky-500',
        editable: true,
      },
      {
        id: 'today',
        label: '今日学习时长',
        value: formatMinutes(studyToday),
        sub: '专注计时自动累计',
        icon: Timer,
        tint: 'bg-teal-100',
        color: 'text-teal-500',
      },
      {
        id: 'total',
        label: '累计学习时长',
        value: formatMinutes(studyTotal),
        sub: '积跬步以至千里',
        icon: Hourglass,
        tint: 'bg-emerald-100',
        color: 'text-emerald-500',
      },
      { id: 'chapter', label: '已掌握章节', value: `${mastered} 个`, sub: `共 ${chapters.length} 个章节`, icon: BookOpen, tint: 'bg-emerald-100', color: 'text-emerald-500' },
      { id: 'project', label: '进行中项目', value: `${ongoing} 个`, sub: `共 ${projects.length} 个项目`, icon: Rocket, tint: 'bg-amber-100', color: 'text-amber-500' },
      { id: 'star', label: '收集闪光点', value: `${sparkles.length} 颗`, sub: '每一颗都算数 ✨', icon: Star, tint: 'bg-rose-100', color: 'text-rose-400' },
    ]
  }, [statsVersion, weekDays, studyToday, studyTotal])

  const commitHours = () => {
    const value = Math.min(168, Math.max(0, Number(hoursDraft) || 0))
    writeStorage('willow:weekHours', value)
    setEditingHours(false)
    toast('本周学习时长已更新 ⏱️')
  }

  return (
    <section id="dashboard" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-rose-200/30 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-4 pt-10 sm:px-6 md:pt-16">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* 左侧：问候 + 每日一句 */}
          <Reveal>
            <div className="flex h-full flex-col">
              <p className="text-sm font-medium text-ink-400">{formatDateCN(now)}</p>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
                {greeting.emoji} {greeting.text}
              </h1>
              <p className="mt-1.5 text-ink-500">「{greeting.sub}」</p>

              <div className="relative mt-6 flex-1 overflow-hidden rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-amber-100 backdrop-blur">
                <Quote className="absolute right-4 top-4 h-8 w-8 text-amber-200" aria-hidden />
                <p key={quoteIndex} className="animate-fade-up pr-8 text-base font-medium leading-relaxed text-ink-700">
                  {QUOTES[quoteIndex]}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-ink-300">每日一句 · 为你充电</span>
                  <button
                    type="button"
                    onClick={() => setQuoteIndex((i) => (i + 1) % QUOTES.length)}
                    className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-wood-600 transition hover:bg-amber-100"
                  >
                    <RotateCw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180" />
                    换一句
                  </button>
                </div>
              </div>
            </div>
          </Reveal>

          {/* 右侧：连续打卡 + 打卡按钮 */}
          <Reveal delay={100}>
            <div className="relative h-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-amber-100">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-100/70 blur-2xl"
              />
              <div className="flex items-center gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-300 shadow-lg shadow-orange-200">
                  <Flame className={`h-10 w-10 text-white ${checkedIn ? 'animate-wiggle' : ''}`} />
                </div>
                <div>
                  <div key={streak} className="animate-fade-up flex items-baseline gap-1">
                    <span className="font-display text-5xl font-bold text-orange-500">{streak}</span>
                    <span className="font-display text-lg font-bold text-ink-500">天</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-400">已连续学习，继续保持！</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-400">距离 30 天徽章</span>
                  <span className="font-bold text-orange-500">还差 {Math.max(0, 30 - streak)} 天</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-orange-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-700"
                    style={{ width: `${streakPct}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {BADGE_GOALS.map((goal) => {
                  const achieved = streak >= goal
                  return (
                    <div
                      key={goal}
                      className={`flex flex-col items-center rounded-xl py-2 transition ${
                        achieved ? 'bg-orange-50 text-orange-500 ring-1 ring-orange-200' : 'bg-stone-50 text-stone-300'
                      }`}
                    >
                      <Medal className={`h-5 w-5 ${achieved ? '' : 'opacity-60'}`} />
                      <span className="mt-1 text-[10px] font-bold">{goal} 天</span>
                    </div>
                  )
                })}
              </div>

              {checkedIn ? (
                <button
                  type="button"
                  disabled
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3.5 font-bold text-emerald-600 ring-1 ring-emerald-200"
                >
                  <BadgeCheck className="h-5 w-5" />
                  今日已打卡 · 明天见！
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCheckIn}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-400 to-rose-400 px-4 py-3.5 font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
                >
                  <PartyPopper className="h-5 w-5" />
                  今日打卡 · 收集好心情
                </button>
              )}
              <button type="button" onClick={onResetCheckins} className="mx-auto mt-1 flex items-center gap-1 text-[11px] font-medium text-ink-300 transition hover:text-rose-400">
              <RotateCw className="h-3 w-3" /> 清空打卡数据，重新开始
            </button>
            <p className="mt-2 text-center text-[11px] text-ink-300">
                点一下，就会下起彩色的「纸屑雨」哦 ✨
              </p>
            </div>
          </Reveal>
        </div>

        {/* 速览统计 */}
        <Reveal delay={60}>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {quickStats.map((stat) => (
              <div
                key={stat.id}
                onClick={
                  stat.editable
                    ? () => {
                        setHoursDraft(String(Number(readStorage('willow:weekHours', 0)) || 0))
                        setEditingHours(true)
                      }
                    : undefined
                }
                className={`flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 transition hover:-translate-y-1 hover:shadow-md ${
                  stat.editable ? 'cursor-pointer ring-sky-200/80' : 'ring-amber-100/70'
                }`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.tint}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-400">{stat.label}</p>
                  {stat.editable && editingHours ? (
                    <input
                      autoFocus
                      type="number"
                      min={0}
                      max={168}
                      step={0.5}
                      value={hoursDraft}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setHoursDraft(event.target.value)}
                      onBlur={commitHours}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitHours()
                        if (event.key === 'Escape') setEditingHours(false)
                      }}
                      className="mt-0.5 w-full rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 font-display text-lg font-bold text-ink-700 outline-none ring-2 ring-sky-100"
                    />
                  ) : (
                    <p className="truncate font-display text-xl font-bold">
                      {stat.value}
                      <span className="ml-1 text-xs font-semibold text-emerald-500">{stat.sub}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-100/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-base font-bold text-ink-700">近 7 天专注时长</p>
                <p className="mt-0.5 text-xs text-ink-400">每天专注一点点，成长看得见 🌱</p>
              </div>
              <span className="shrink-0 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-500 ring-1 ring-sky-100">
                今日 {formatMinutes(studyToday)}
              </span>
            </div>
            <div className="mt-5 flex h-36 items-end gap-2 sm:gap-3">
              {studySeries.map((day) => {
                const max = Math.max(1, ...studySeries.map((item) => item.minutes))
                const height = day.minutes === 0 ? '5%' : `${Math.max(8, Math.round((day.minutes / max) * 100))}%`
                return (
                  <div key={day.key} className="group flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-ink-400 opacity-0 transition group-hover:opacity-100">
                      {day.minutes ? formatMinutes(day.minutes) : '0 分钟'}
                    </span>
                    <div
                      title={`${day.label} · ${formatMinutes(day.minutes)}`}
                      className={`w-full max-w-8 rounded-t-lg transition-all duration-500 ${
                        day.minutes ? 'bg-gradient-to-t from-sky-400 to-sky-200' : 'bg-cream-200'
                      }`}
                      style={{ height }}
                    />
                    <span className="text-[10px] text-ink-300">{day.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Reveal>

        <Reveal delay={180}>
          <Heatmap checkins={checkins} today={now} />
        </Reveal>
      </div>
    </section>
  )
}
