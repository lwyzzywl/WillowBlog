import { useEffect, useState } from 'react'
import { GraduationCap, Plus, X } from 'lucide-react'
import { SUBJECTS, SUBJECT_COLOR_SCHEMES, SUBJECT_ICON_OPTIONS } from '../data'
import { readStorage, toast, writeStorage } from '../hooks'
import Section from './Section'
import Reveal from './Reveal'
import SubjectCard from './SubjectCard'

/** 把内置科目中的图标/配色还原成可序列化的 key */
function toStoredKey(subject) {
  return {
    ...subject,
    icon:
      typeof subject.icon === 'string'
        ? subject.icon
        : SUBJECT_ICON_OPTIONS.find((option) => option.icon === subject.icon)?.id ?? 'binary',
    color:
      typeof subject.color === 'string'
        ? subject.color
        : SUBJECT_COLOR_SCHEMES.find((scheme) => scheme.ring === subject.color.ring)?.id ?? 'rose',
  }
}

/** 把存储中的 key 还原成可直接渲染的图标组件与配色 */
function resolveSubject(subject) {
  return {
    ...subject,
    icon:
      typeof subject.icon === 'string'
        ? SUBJECT_ICON_OPTIONS.find((option) => option.id === subject.icon)?.icon ?? SUBJECT_ICON_OPTIONS[0].icon
        : subject.icon,
    color:
      typeof subject.color === 'string'
        ? SUBJECT_COLOR_SCHEMES.find((scheme) => scheme.id === subject.color) ?? SUBJECT_COLOR_SCHEMES[0]
        : subject.color,
  }
}

export default function CsFundamentals() {
  const [subjects, setSubjects] = useState(() => readStorage('willow:subjects', SUBJECTS).map(resolveSubject))
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [iconKey, setIconKey] = useState(SUBJECT_ICON_OPTIONS[0].id)
  const [colorKey, setColorKey] = useState(SUBJECT_COLOR_SCHEMES[0].id)

  useEffect(() => {
    writeStorage('willow:subjects', subjects.map(toStoredKey))
  }, [subjects])

  useEffect(() => {
    if (!modalOpen) return
    const onKey = (event) => {
      if (event.key === 'Escape') setModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen])

  const handleToggle = (subjectId, chapterId) => {
    setSubjects((prev) =>
      prev.map((subject) => {
        if (subject.id !== subjectId) return subject
        return {
          ...subject,
          chapters: subject.chapters.map((chapter) => {
            if (chapter.id !== chapterId) return chapter
            const next = chapter.status === 'done' ? 'todo' : 'done'
            if (next === 'done') toast(`点亮「${chapter.title}」，内功 +1 💪`)
            return { ...chapter, status: next }
          }),
        }
      }),
    )
  }

  const handleAddChapter = (subjectId, title) => {
    setSubjects((prev) =>
      prev.map((subject) =>
        subject.id === subjectId
          ? { ...subject, chapters: [...subject.chapters, { id: `chapter-${Date.now()}`, title, status: 'todo' }] }
          : subject,
      ),
    )
    toast('新任务已加入清单，加油 🌱')
  }

  const handleRemoveChapter = (subjectId, chapterId) => {
    setSubjects((prev) =>
      prev.map((subject) =>
        subject.id === subjectId
          ? { ...subject, chapters: subject.chapters.filter((chapter) => chapter.id !== chapterId) }
          : subject,
      ),
    )
  }

  const handleRemoveSubject = (subjectId) => {
    setSubjects((prev) => prev.filter((subject) => subject.id !== subjectId))
  }

  const openModal = () => {
    setName('')
    setDesc('')
    setIconKey(SUBJECT_ICON_OPTIONS[0].id)
    setColorKey(SUBJECT_COLOR_SCHEMES[0].id)
    setModalOpen(true)
  }

  const handleAddSubject = (event) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSubjects((prev) => [
      ...prev,
      {
        id: `subject-${Date.now()}`,
        name: trimmed,
        en: desc.trim() || '自定义科目',
        desc: desc.trim() || '记录你自己的学习进度',
        icon: iconKey,
        color: colorKey,
        chapters: [],
        userAdded: true,
      },
    ])
    setModalOpen(false)
    toast('新的任务栏建好啦 📚 从第一个小目标开始吧')
  }

  return (
    <Section
      id="cs"
      icon={GraduationCap}
      title="计算机四大件 · 学习记录"
      subtitle="慢慢啃，稳稳进 —— 每一个打勾，都是内功的增长 ✊"
    >
      <div className="grid gap-5 md:grid-cols-2">
        {subjects.map((subject, index) => (
          <Reveal key={subject.id} delay={index * 80}>
            <SubjectCard
              subject={resolveSubject(subject)}
              onToggle={handleToggle}
              onAddChapter={handleAddChapter}
              onRemoveChapter={handleRemoveChapter}
              onRemoveSubject={handleRemoveSubject}
            />
          </Reveal>
        ))}
      </div>

      <Reveal>
        <button
          type="button"
          onClick={openModal}
          className="mx-auto mt-8 flex items-center gap-2 rounded-2xl border-2 border-dashed border-amber-200 bg-white/70 px-6 py-3.5 font-semibold text-wood-600 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50 hover:shadow-md active:scale-95"
        >
          <Plus className="h-4 w-4" />
          新增科目 / 任务栏
        </button>
      </Reveal>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <form onSubmit={handleAddSubject} className="animate-pop-in relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-amber-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="关闭"
              className="absolute right-4 top-4 rounded-full p-1.5 text-ink-400 transition hover:bg-stone-100"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="flex items-center gap-2 font-display text-lg font-bold">
              <GraduationCap className="h-5 w-5 text-wood-500" />
              新建科目任务栏
            </h3>
            <p className="mt-1 text-xs text-ink-400">想学什么都可以记下来，这里不限「四大件」 📖</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-500">科目名称</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={20}
                  placeholder="例如：数据库系统"
                  className="w-full rounded-2xl border border-stone-200 bg-cream-50 px-4 py-3 text-sm outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-500">英文名 / 一句话描述（可选）</label>
                <input
                  value={desc}
                  onChange={(event) => setDesc(event.target.value)}
                  maxLength={30}
                  placeholder="例如：Database System"
                  className="w-full rounded-2xl border border-stone-200 bg-cream-50 px-4 py-3 text-sm outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-500">选一个图标</label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_ICON_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setIconKey(option.id)}
                      aria-label={`选择图标 ${option.id}`}
                      className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                        iconKey === option.id
                          ? 'scale-110 bg-amber-100 text-amber-600 ring-2 ring-amber-300'
                          : 'bg-stone-50 text-ink-400 hover:bg-stone-100'
                      }`}
                    >
                      <option.icon className="h-5 w-5" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-500">挑一个配色</label>
                <div className="flex flex-wrap gap-3">
                  {SUBJECT_COLOR_SCHEMES.map((scheme) => (
                    <button
                      key={scheme.id}
                      type="button"
                      title={scheme.label}
                      aria-label={scheme.label}
                      onClick={() => setColorKey(scheme.id)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                        colorKey === scheme.id ? 'scale-110 ring-2 ring-amber-400 ring-offset-2' : 'ring-1 ring-black/10'
                      }`}
                      style={{ backgroundColor: scheme.ring }}
                    >
                      {colorKey === scheme.id && <span className="h-2 w-2 rounded-full bg-white/90" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-2xl border border-stone-200 py-3 font-semibold text-ink-500 transition hover:bg-stone-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-300 py-3 font-bold text-white shadow-lg shadow-amber-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                建好这个任务栏 📚
              </button>
            </div>
          </form>
        </div>
      )}
    </Section>
  )
}