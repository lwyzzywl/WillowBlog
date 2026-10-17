import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw, Square, Timer, X } from 'lucide-react'
import fireConfetti from '../confetti'
import { toast } from '../hooks'
import { useCollection } from '../context/CloudDataProvider'
import { createStudySession, formatMinutes, sanitizeStudyLog, todayStudyMinutes, totalStudyMinutes } from '../studyTime'
import CircularProgress from './CircularProgress'

const POMODORO_PRESETS = [15, 25, 45]

function formatClock(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

export default function FocusTimer() {
  const studyLog = useCollection('studyLog')
  const [panelOpen, setPanelOpen] = useState(false)
  const [mode, setMode] = useState('countup')
  const [pomodoroMin, setPomodoroMin] = useState(25)
  const [status, setStatus] = useState('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [settlement, setSettlement] = useState(null)

  const totalSec = mode === 'pomodoro' ? pomodoroMin * 60 : elapsedSec
  const remainingSec = mode === 'pomodoro' ? Math.max(0, totalSec - elapsedSec) : elapsedSec

  useEffect(() => {
    if (status !== 'running') return undefined
    // 计时状态只留在内存里，每秒 setState 不会碰数据库
    const id = setInterval(() => setElapsedSec((sec) => sec + 1), 1000)
    return () => clearInterval(id)
  }, [status])

  const finishSession = (message, completed) => {
    const minutes = Math.round(elapsedSec / 60)
    setStatus('idle')
    setElapsedSec(0)
    if (minutes < 1) {
      toast('这次专注还不到 1 分钟，不记录时长，再来一次呀 🌱')
      return
    }
    // 一次专注只写一次云端；本地先算好累计值给弹窗展示
    const session = createStudySession(minutes)
    const log = [...sanitizeStudyLog(studyLog.data), session]
    studyLog.commit(log)
    setSettlement({
      minutes,
      completed: !!completed,
      message:
        message ||
        `辛苦啦！本次专注学习了 ${minutes} 分钟，离大牛又近了一步！`,
      today: todayStudyMinutes(log),
      total: totalStudyMinutes(log),
    })
    fireConfetti()
  }

  useEffect(() => {
    if (mode === 'pomodoro' && status === 'running' && elapsedSec >= pomodoroMin * 60) {
      finishSession('🍅 一颗番茄完成！休息 5 分钟再出发吧～', true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, mode, status, pomodoroMin])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setSettlement(null)
        setPanelOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const switchMode = (next) => {
    if (next === mode) return
    if (status !== 'idle' && elapsedSec > 0 && !window.confirm('切换模式会放弃当前计时，确定吗？')) return
    setMode(next)
    setStatus('idle')
    setElapsedSec(0)
  }

  const reset = () => {
    setStatus('idle')
    setElapsedSec(0)
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {panelOpen && (
          <div className="animate-pop-in w-[min(22rem,calc(100vw-3rem))] rounded-2xl bg-white p-5 shadow-2xl shadow-amber-900/10 ring-1 ring-amber-100">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-bold text-ink-700">🌿 专注计时器</p>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-cream-100 hover:text-ink-700"
                aria-label="关闭专注面板"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-cream-100 p-1">
              {[
                { key: 'countup', label: '正向计时' },
                { key: 'pomodoro', label: '番茄钟' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => switchMode(item.key)}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${
                    mode === item.key
                      ? 'bg-white text-wood-700 shadow-sm'
                      : 'text-ink-400 hover:text-ink-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {mode === 'pomodoro' && status === 'idle' && (
              <div className="mt-3 flex gap-2">
                {POMODORO_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setPomodoroMin(preset)
                      setElapsedSec(0)
                    }}
                    className={`flex-1 rounded-xl py-1.5 text-xs font-semibold transition ${
                      pomodoroMin === preset
                        ? 'bg-rose-50 text-rose-500 ring-1 ring-rose-200'
                        : 'bg-cream-100 text-ink-400 hover:text-ink-700'
                    }`}
                  >
                    {preset} 分钟
                  </button>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-col items-center">
              {mode === 'pomodoro' ? (
                <CircularProgress
                  value={totalSec ? (remainingSec / totalSec) * 100 : 100}
                  size={168}
                  stroke={12}
                  color="#fb7185"
                  colorEnd="#f59e0b"
                  center={
                    <>
                      <span className="font-display text-3xl font-bold text-ink-700">{formatClock(remainingSec)}</span>
                      <span className="mt-1 text-[10px] text-ink-400">{status === 'running' ? '保持专注呀' : '剩余时间'}</span>
                    </>
                  }
                />
              ) : (
                <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-8 border-sky-100 bg-white">
                  <span className="font-display text-3xl font-bold text-ink-700">{formatClock(elapsedSec)}</span>
                  <span className="mt-1 text-xs text-ink-400">{status === 'running' ? '专注进行中…' : '正向计时'}</span>
                </div>
              )}
              <p className="mt-3 text-center text-xs text-ink-400">
                {mode === 'pomodoro'
                  ? '专注 25 分钟，休息 5 分钟，劳逸结合效率更高'
                  : '结束后会自动累加到首页的今日与累计学习时长'}
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              {status === 'idle' && (
                <button
                  type="button"
                  onClick={() => setStatus('running')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
                >
                  <Play className="h-4 w-4" />
                  {elapsedSec > 0 ? '重新开始' : '开始专注'}
                </button>
              )}
              {status === 'running' && (
                <>
                  <button
                    type="button"
                    onClick={() => setStatus('paused')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-cream-100 px-4 py-3 font-bold text-ink-700 transition hover:bg-cream-200"
                  >
                    <Pause className="h-4 w-4" />
                    暂停
                  </button>
                  <button
                    type="button"
                    onClick={() => finishSession()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 font-bold text-rose-500 ring-1 ring-rose-200 transition hover:bg-rose-100"
                  >
                    <Square className="h-4 w-4" />
                    结束
                  </button>
                </>
              )}
              {status === 'paused' && (
                <>
                  <button
                    type="button"
                    onClick={() => setStatus('running')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5"
                  >
                    <Play className="h-4 w-4" />
                    继续
                  </button>
                  <button
                    type="button"
                    onClick={() => finishSession()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 font-bold text-rose-500 ring-1 ring-rose-200 transition hover:bg-rose-100"
                  >
                    <Square className="h-4 w-4" />
                    结束
                  </button>
                </>
              )}
              {status === 'idle' && elapsedSec > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center justify-center gap-1.5 rounded-2xl bg-cream-100 px-4 py-3 text-sm font-semibold text-ink-400 transition hover:bg-cream-200 hover:text-ink-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  清零
                </button>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 font-bold text-white shadow-xl shadow-orange-300/40 transition hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.97]"
        >
          {status === 'running' ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
          ) : (
            <Timer className="h-4 w-4" />
          )}
          {status === 'running' ? formatClock(remainingSec) : '专注'}
        </button>
      </div>

      {settlement && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm">
          <div className="animate-pop-in w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl ring-1 ring-amber-100">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
              {settlement.completed ? '🍅' : '🎉'}
            </div>
            <p className="mt-4 font-display text-lg font-bold leading-relaxed text-ink-700">{settlement.message}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-cream-100 px-2 py-3">
                <p className="font-display text-base font-bold text-ink-700">{settlement.minutes}</p>
                <p className="mt-0.5 text-[10px] text-ink-400">本次(分钟)</p>
              </div>
              <div className="rounded-2xl bg-sky-50 px-2 py-3">
                <p className="truncate font-display text-sm font-bold text-sky-500">{formatMinutes(settlement.today)}</p>
                <p className="mt-0.5 text-[10px] text-ink-400">今日累计</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-2 py-3">
                <p className="truncate font-display text-sm font-bold text-emerald-500">{formatMinutes(settlement.total)}</p>
                <p className="mt-0.5 text-[10px] text-ink-400">历史累计</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettlement(null)}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 active:scale-[0.98]"
            >
              收下鼓励，继续前进
            </button>
          </div>
        </div>
      )}
    </>
  )
}
