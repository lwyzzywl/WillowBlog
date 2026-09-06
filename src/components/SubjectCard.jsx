import { useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import { STATUS_LABELS } from '../data'
import CircularProgress from './CircularProgress'

const STATUS_CHIP = {
  done: 'bg-emerald-50 text-emerald-600',
  doing: 'bg-amber-50 text-amber-600',
  todo: 'bg-stone-100 text-stone-400',
}

export default function SubjectCard({ subject, onToggle, onAddChapter, onRemoveChapter, onRemoveSubject }) {
  const [draft, setDraft] = useState('')
  const total = subject.chapters.length
  const doneCount = subject.chapters.filter((c) => c.status === 'done').length
  const progress = total ? Math.round((doneCount / total) * 100) : 0

  const submitChapter = (event) => {
    event.preventDefault()
    const title = draft.trim()
    if (!title) return
    onAddChapter(subject.id, title)
    setDraft('')
  }

  return (
    <article className="group flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-100/70 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-100/50 md:p-6">
      <header className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${subject.color.iconBox}`}>
          <subject.icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-bold md:text-lg">{subject.name}</h3>
          <p className="truncate font-display text-[11px] tracking-wide text-ink-300">{subject.en}</p>
        </div>
        {subject.userAdded && (
          <button
            type="button"
            onClick={() => onRemoveSubject(subject.id)}
            aria-label="删除这个科目"
            title="删除这个科目"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
        <CircularProgress
          value={progress}
          color={subject.color.ring}
          colorEnd={subject.color.ringEnd}
          label="掌握度"
        />
        <ul className="w-full space-y-1">
          {subject.chapters.map((chapter) => {
            const isDone = chapter.status === 'done'
            return (
              <li key={chapter.id} className="group/row flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggle(subject.id, chapter.id)}
                  className={`task-row flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${subject.color.rowHover} ${
                    isDone ? 'is-done' : ''
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                      isDone ? 'border-emerald-400 bg-emerald-400 text-white' : 'border-stone-300 bg-white'
                    }`}
                  >
                    {isDone && <Check className="animate-check-pop h-3 w-3" strokeWidth={3.5} />}
                  </span>
                  <span className="task-text truncate text-sm font-medium">{chapter.title}</span>
                  <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CHIP[chapter.status]}`}>
                    {chapter.status === 'doing' ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                        {STATUS_LABELS[chapter.status]}
                      </span>
                    ) : (
                      STATUS_LABELS[chapter.status]
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveChapter(subject.id, chapter.id)}
                  aria-label="删除这个任务"
                  title="删除这个任务"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover/row:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}

          {subject.chapters.length === 0 && (
            <li className="rounded-xl border border-dashed border-stone-200 px-3 py-3 text-center text-xs text-ink-400">
              还没有任务，从第一个小目标开始吧 🌱
            </li>
          )}
        </ul>
      </div>

      <form onSubmit={submitChapter} className="mt-4 flex items-center gap-2 border-t border-dashed border-stone-100 pt-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={40}
          placeholder="添加新任务，回车确认"
          className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-cream-50 px-3 py-2 text-sm outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="添加任务"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 transition hover:bg-amber-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      <p className="mt-3 text-xs text-ink-400">
        {doneCount}/{total} 个章节已点亮 · {subject.desc}
      </p>
    </article>
  )
}