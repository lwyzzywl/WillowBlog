import { useEffect, useState } from 'react'
import { BookMarked, Check, Github, Hammer, Lightbulb, Pencil, Plus, Rocket, Trash2, X } from 'lucide-react'
import { PROJECT_EMOJIS } from '../data'
import { toast } from '../hooks'
import { useCollection } from '../context/CloudDataProvider'
import { useAuth } from '../hooks/useAuth'
import CloudStatusBar from './CloudStatusBar'
import Section from './Section'
import Reveal from './Reveal'

function normalizeGithub(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://github.com/${trimmed.replace(/^\/+/, '')}`
}

function StatusBadge({ status }) {
  const ongoing = status === '进行中'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
        ongoing
          ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
          : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
      }`}
    >
      {ongoing && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />}
      {status}
    </span>
  )
}

export default function ProjectLog() {
  const { isAdmin } = useAuth()
  const collection = useCollection('projects')
  const projects = Array.isArray(collection.data) ? collection.data : []
  const setProjects = collection.commit
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(PROJECT_EMOJIS[0])
  const [status, setStatus] = useState('进行中')
  const [period, setPeriod] = useState('')
  const [stackText, setStackText] = useState('')
  const [pitfall, setPitfall] = useState('')
  const [review, setReview] = useState('')
  const [github, setGithub] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const openModal = () => {
    if (!isAdmin) return
    setEditingId(null)
    setName('')
    setEmoji(PROJECT_EMOJIS[0])
    setStatus('进行中')
    setPeriod('')
    setStackText('')
    setPitfall('')
    setReview('')
    setGithub('')
    setOpen(true)
  }

  const openEdit = (project) => {
    if (!isAdmin) return
    setEditingId(project.id)
    setName(project.name)
    setEmoji(project.emoji || PROJECT_EMOJIS[0])
    setStatus(project.status === '已完成' ? '已完成' : '进行中')
    setPeriod(project.period && project.period !== '——' ? project.period : '')
    setStackText((project.stack || []).join(' '))
    setPitfall(project.pitfall || '')
    setReview(project.review || '')
    setGithub(project.github || '')
    setOpen(true)
  }

  const saveProject = (event) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const stack = stackText
      .split(/[,，、\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8)
    const payload = {
      emoji: emoji.trim() || '💻',
      name: trimmed,
      status,
      period: period.trim() || '——',
      stack: stack.length ? stack : ['未标注'],
      pitfall: pitfall.trim() || (editingId ? '' : '灵感还在路上，遇到坑记得回来记一笔 ✍️'),
      review: review.trim(),
      github: normalizeGithub(github),
    }
    if (editingId) {
      setProjects((prev) => prev.map((project) => (project.id === editingId ? { ...project, ...payload } : project)))
      toast('项目方案已更新 ✏️')
    } else {
      setProjects((prev) => [{ id: `project-${Date.now()}`, ...payload }, ...prev])
      toast('新项目已挂上时间轴 🚀 祝开工顺利')
    }
    setOpen(false)
    setEditingId(null)
  }

  const removeProject = (id) => {
    if (!isAdmin) return
    setProjects((prev) => prev.filter((project) => project.id !== id))
  }

  return (
    <Section
      id="projects"
      icon={Hammer}
      title="项目实战日志"
      subtitle="每一次踩坑，都是经验的伏笔；每一次复盘，都是成长的存款 💡"
    >
      <Reveal>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <CloudStatusBar collection={collection} isAdmin={isAdmin} />
          <button
            type="button"
            onClick={openModal}
            className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 font-semibold text-wood-600 shadow-sm ring-1 ring-amber-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
          >
            <Plus className="h-4 w-4" />
            新增项目
          </button>
        </div>
      </Reveal>

      <div className="relative">
        <div
          aria-hidden
          className="absolute bottom-2 left-[13px] top-2 w-px bg-gradient-to-b from-amber-200 via-rose-200 to-sky-200"
        />
        {projects.map((project, index) => {
          const ongoing = project.status === '进行中'
          return (
            <Reveal key={project.id} delay={index * 80}>
              <article className="relative pb-8 pl-12 last:pb-0">
                <span
                  className={`absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-cream-50 ${
                    ongoing ? 'bg-amber-100 text-amber-500' : 'bg-emerald-100 text-emerald-600'
                  }`}
                >
                  {ongoing ? <Rocket className="h-3.5 w-3.5" /> : <Check className="h-4 w-4" />}
                </span>

                <div className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-100/70 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-100/60 md:p-6">
                  <header className="flex flex-wrap items-center gap-3">
                    <span className="text-2xl" aria-hidden>{project.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-base font-bold md:text-lg">{project.name}</h3>
                      <p className="mt-0.5 text-xs text-ink-300">{project.period}</p>
                      {project.github && (
                        <a
                          href={project.github}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-stone-700"
                        >
                          <Github className="h-3.5 w-3.5" />
                          GitHub 仓库
                        </a>
                      )}
                    </div>
                    <StatusBadge status={project.status} />
                    <button
                      type="button"
                      onClick={() => openEdit(project)}
                      aria-label="编辑这个项目"
                      title="编辑这个项目"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-300 opacity-100 transition hover:bg-amber-50 hover:text-wood-600 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeProject(project.id)}
                      aria-label="删除这个项目"
                      title="删除这个项目"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-300 opacity-100 transition hover:bg-rose-50 hover:text-rose-500 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </header>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.stack.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-ink-500 ring-1 ring-stone-200/70"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl bg-amber-50/80 p-3.5 ring-1 ring-amber-100">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                      <Lightbulb className="h-3.5 w-3.5" />
                      踩坑与灵感
                    </p>
                    {project.pitfall ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{project.pitfall}</p>
                    ) : (
                      <p className="mt-1.5 text-sm italic text-ink-400">灵感还在路上，遇到坑记得回来记一笔 ✍️</p>
                    )}
                  </div>

                  <div className="mt-3 rounded-xl bg-sky-50/80 p-3.5 ring-1 ring-sky-100">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-sky-600">
                      <BookMarked className="h-3.5 w-3.5" />
                      复盘总结
                    </p>
                    {project.review ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{project.review}</p>
                    ) : (
                      <p className="mt-1.5 text-sm italic text-ink-400">
                        项目还在路上，复盘待解锁… 完成后记得回来写下成长 ✍️
                      </p>
                    )}
                  </div>
                </div>
              </article>
            </Reveal>
          )
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <form onSubmit={saveProject} className="animate-pop-in relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-amber-100">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="关闭"
              className="absolute right-4 top-4 rounded-full p-1.5 text-ink-400 transition hover:bg-stone-100"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="flex items-center gap-2 font-display text-lg font-bold">
              <Hammer className="h-5 w-5 text-wood-500" />
              {editingId ? '编辑项目方案' : '挂上新的项目'}
            </h3>
            <p className="mt-1 text-xs text-ink-400">
              {editingId ? '随时修改方案细节，改完点保存即可' : '记录下名字，坑和灵感随时回来补充 🛠️'}
            </p>

            <div className="mt-5 space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-semibold text-ink-500">项目名称</label>
                  <input
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={30}
                    placeholder="例如：个人博客后端"
                    className="w-full rounded-2xl border border-stone-200 bg-cream-50 px-4 py-3 text-sm outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
                <div className="w-28">
                  <label className="mb-1.5 block text-xs font-semibold text-ink-500">表情</label>
                  <input
                    value={emoji}
                    onChange={(event) => setEmoji(event.target.value)}
                    maxLength={8}
                    placeholder="💻"
                    className="w-full rounded-2xl border border-stone-200 bg-cream-50 px-4 py-3 text-center text-xl outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {PROJECT_EMOJIS.map((item) => (
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

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-500">项目状态</label>
                <div className="flex gap-2">
                  {['进行中', '已完成'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setStatus(item)}
                      className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                        status === item
                          ? item === '进行中'
                            ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-300'
                            : 'bg-emerald-100 text-emerald-600 ring-2 ring-emerald-300'
                          : 'bg-stone-50 text-ink-400 hover:bg-stone-100'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-500">时间周期（可选）</label>
                  <input
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    maxLength={30}
                    placeholder="2026.08 — 至今"
                    className="w-full rounded-2xl border border-stone-200 bg-cream-50 px-4 py-3 text-sm outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-500">技术栈（用逗号隔开）</label>
                  <input
                    value={stackText}
                    onChange={(event) => setStackText(event.target.value)}
                    placeholder="React, Tailwind, Node"
                    className="w-full rounded-2xl border border-stone-200 bg-cream-50 px-4 py-3 text-sm outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-500">GitHub 仓库链接（可选）</label>
                  <input
                    value={github}
                    onChange={(event) => setGithub(event.target.value)}
                    placeholder="https://github.com/username/repo"
                    className="w-full rounded-2xl border border-stone-200 bg-cream-50 px-4 py-3 text-sm outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-500">踩坑与灵感</label>
                <textarea
                  rows={3}
                  value={pitfall}
                  onChange={(event) => setPitfall(event.target.value)}
                  placeholder="写下让你「原来如此」的瞬间…"
                  className="w-full resize-none rounded-2xl border border-stone-200 bg-cream-50 p-4 text-sm leading-relaxed outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-500">复盘总结（可选）</label>
                <textarea
                  rows={3}
                  value={review}
                  onChange={(event) => setReview(event.target.value)}
                  placeholder="完成后回头看看，这次学到了什么…"
                  className="w-full resize-none rounded-2xl border border-stone-200 bg-cream-50 p-4 text-sm leading-relaxed outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-2xl border border-stone-200 py-3 font-semibold text-ink-500 transition hover:bg-stone-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-300 py-3 font-bold text-white shadow-lg shadow-amber-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                {editingId ? '保存修改' : '挂上时间轴 🚀'}
              </button>
            </div>
          </form>
        </div>
      )}
    </Section>
  )
}
