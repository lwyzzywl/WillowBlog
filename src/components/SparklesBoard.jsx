import { useEffect, useState } from 'react'
import { Plus, Sparkles, Star, Trash2, X } from 'lucide-react'
import { INITIAL_SPARKLES, SPARKLE_COLORS, SPARKLE_EMOJIS } from '../data'
import { readStorage, toast, writeStorage } from '../hooks'
import Section from './Section'
import Reveal from './Reveal'

const TILTS = ['-rotate-2', 'rotate-1', 'rotate-2', '-rotate-1']

export default function SparklesBoard() {
  const [notes, setNotes] = useState(() => readStorage('willow:sparkles', INITIAL_SPARKLES))
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [color, setColor] = useState(SPARKLE_COLORS[0].name)
  const [emoji, setEmoji] = useState(SPARKLE_EMOJIS[0])

  useEffect(() => {
    writeStorage('willow:sparkles', notes)
  }, [notes])

  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const openModal = () => {
    setDraft('')
    setEmoji(SPARKLE_EMOJIS[0])
    setColor(SPARKLE_COLORS[0].name)
    setOpen(true)
  }

  const addNote = () => {
    const text = draft.trim()
    if (!text) return
    const now = new Date()
    const selected = SPARKLE_COLORS.find((c) => c.name === color) ?? SPARKLE_COLORS[0]
    setNotes((prev) => [
      {
        id: Date.now(),
        emoji: emoji.trim() || '✨',
        text,
        bg: selected.bg,
        date: `${now.getMonth() + 1} 月 ${now.getDate()} 日`,
      },
      ...prev,
    ])
    setOpen(false)
    toast('又收集到一颗闪光 ✨ 你真的很棒')
  }

  const removeNote = (id) => {
    setNotes((prev) => prev.filter((note) => note.id !== id))
  }

  return (
    <Section
      id="sparkles"
      icon={Sparkles}
      title="闪光点碎片"
      subtitle="把「我真的很不错」的证据，一张一张贴起来 🧡"
    >
      <Reveal>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-amber-100">
            <Star className="h-4 w-4 fill-amber-300 text-amber-400" />
            <span className="text-sm text-ink-700">
              已收集 <b className="font-display text-base text-orange-500">{notes.length}</b> 颗闪光
            </span>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-400 to-orange-300 px-5 py-3 font-bold text-white shadow-lg shadow-rose-200 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
          >
            <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
            记录闪光点
          </button>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note, index) => (
          <Reveal key={note.id} delay={(index % 3) * 70}>
            <div
              className={`group relative rounded-2xl p-5 pb-6 shadow-md ring-1 ring-black/5 transition duration-300 hover:-translate-y-1.5 hover:rotate-0 hover:shadow-xl ${TILTS[index % TILTS.length]}`}
              style={{ backgroundColor: note.bg }}
            >
              <span
                aria-hidden
                className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-2 rounded-sm bg-white/70 shadow-sm backdrop-blur-sm"
              />
              <span className="animate-twinkle inline-block text-2xl" style={{ animationDelay: `${(index % 4) * 0.4}s` }}>
                {note.emoji}
              </span>
              <p className="mt-2 text-sm font-medium leading-relaxed text-ink-800">{note.text}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[11px] text-ink-400">{note.date}</span>
                <button
                  type="button"
                  onClick={() => removeNote(note.id)}
                  aria-label="删除这条闪光点"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-ink-300 opacity-0 transition hover:bg-black/5 hover:text-rose-500 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="animate-pop-in relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-amber-100">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="关闭"
              className="absolute right-4 top-4 rounded-full p-1.5 text-ink-400 transition hover:bg-stone-100"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="flex items-center gap-2 font-display text-lg font-bold">
              <Sparkles className="h-5 w-5 text-amber-400" />
              今天的闪光点
            </h3>
            <p className="mt-1 text-xs text-ink-400">不用谦虚，写下来就是证据 ✍️</p>

            <div className="mt-4 flex gap-2">
              {SPARKLE_EMOJIS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEmoji(item)}
                  aria-label={`选择表情 ${item}`}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition ${
                    emoji === item
                      ? 'scale-110 bg-amber-100 ring-2 ring-amber-300'
                      : 'bg-stone-50 hover:bg-stone-100'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 rounded-2xl border border-stone-200 bg-cream-50 px-3 py-2.5 transition focus-within:border-amber-300 focus-within:ring-4 focus-within:ring-amber-100">
              <span className="shrink-0 text-xs text-ink-400">自定义表情</span>
              <input
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                maxLength={8}
                placeholder="输入任意表情，如 🐣"
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-300"
              />
              <span className="shrink-0 text-2xl">{emoji.trim() || '✨'}</span>
            </label>
            <textarea
              autoFocus
              rows={4}
              maxLength={120}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="例如：今天遇到 Bug 没有烦躁，先深呼吸再排查，我很棒！"
              className="mt-4 w-full resize-none rounded-2xl border border-stone-200 bg-cream-50 p-4 text-sm leading-relaxed outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
            />

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-400">便利贴颜色</span>
                {SPARKLE_COLORS.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    title={item.name}
                    aria-label={item.name}
                    onClick={() => setColor(item.name)}
                    className={`h-7 w-7 rounded-full transition ${
                      color === item.name ? 'scale-110 ring-2 ring-amber-400' : 'ring-1 ring-black/10'
                    }`}
                    style={{ backgroundColor: item.bg }}
                  />
                ))}
              </div>
              <span className="text-[11px] text-ink-300">{draft.length}/120</span>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-2xl border border-stone-200 py-3 font-semibold text-ink-500 transition hover:bg-stone-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={addNote}
                className="flex-1 rounded-2xl bg-gradient-to-r from-rose-400 to-orange-300 py-3 font-bold text-white shadow-lg shadow-rose-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                收下这颗星星 ✨
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}
