import { useEffect, useMemo, useState } from 'react'
import { BookMarked, ChevronLeft, FileText, FolderOpen, Pencil, Plus, Rocket, Search, Trash2, X } from 'lucide-react'
import { INITIAL_NOTES, SUBJECTS, SUBJECT_COLOR_SCHEMES, SUBJECT_ICON_OPTIONS } from '../data'
import { readStorage, toast, writeStorage } from '../hooks'
import Reveal from './Reveal'
import Section from './Section'

/** 与「学习记录」模块保持一致：把存储中的图标/配色 key 还原成组件 */
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

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast('复制失败，请手动选择复制')
    }
  }

  return (
    <div className="my-4 overflow-hidden rounded-2xl bg-[#2d2720] shadow-inner ring-1 ring-black/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-xs text-amber-200/80">{lang}</span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md px-2 py-1 text-xs text-cream-100/70 transition hover:bg-white/10 hover:text-cream-50"
        >
          {copied ? '已复制 ✓' : '复制'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-cream-100/90">
        <code className="font-mono">{highlightCode(code)}</code>
      </pre>
    </div>
  )
}

/** 轻量代码高亮：注释 / 字符串 / 关键字 / 数字 */
function highlightCode(code) {
  const pattern =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(?:const|let|var|function|return|if|else|for|while|class|new|import|export|from|async|await|def|print|True|False|None)\b|\b\d+(?:\.\d+)?\b)/g
  return String(code)
    .split(pattern)
    .map((token, index) => {
      if (!token) return null
      if (token.startsWith('//') || token.startsWith('/*')) {
        return (
          <span key={index} className="italic text-emerald-400/70">
            {token}
          </span>
        )
      }
      if (/^["'`]/.test(token)) {
        return (
          <span key={index} className="text-amber-300">
            {token}
          </span>
        )
      }
      if (/^(const|let|var|function|return|if|else|for|while|class|new|import|export|from|async|await|def|print|True|False|None)\b/.test(token)) {
        return (
          <span key={index} className="text-rose-300">
            {token}
          </span>
        )
      }
      if (/^\d/.test(token)) {
        return (
          <span key={index} className="text-sky-300">
            {token}
          </span>
        )
      }
      return token
    })
}

/** 行内 Markdown：`code` / **bold** / *italic* / [link](url) */
function renderInline(text) {
  return String(text)
    .split(/(<span\s+style\s*=\s*["']color:\s*[^"']+["']>[^<]*<\/span>|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g)
    .map((part, index) => {
      if (!part) return null
      const colorSpan = part.match(/^<span\s+style\s*=\s*["']color:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+)["']>([^<]*)<\/span>$/i)
      if (colorSpan) {
        return (
          <span key={index} style={{ color: colorSpan[1] }}>
            {renderInline(colorSpan[2])}
          </span>
        )
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="rounded-md bg-amber-100/80 px-1.5 py-0.5 font-mono text-[0.9em] text-rose-500">
            {part.slice(1, -1)}
          </code>
        )
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-ink-900">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={index} className="italic text-ink-500">
            {part.slice(1, -1)}
          </em>
        )
      }
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link) {
        return (
          <a
            key={index}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-500 underline decoration-sky-200 underline-offset-2 transition hover:text-sky-600"
          >
            {link[1]}
          </a>
        )
      }
      return part
    })
}

/** 极简 Markdown 渲染：标题 / 引用 / 列表 / 代码块 / 分隔线 */
function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim() || 'text'
      const code = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i])
        i += 1
      }
      i += 1
      blocks.push(<CodeBlock key={`b${blocks.length}`} lang={lang} code={code.join('\n')} />)
      continue
    }

    if (/^#{1,4}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length
      const text = line.replace(/^#+\s*/, '')
      const headingClass = level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base'
      blocks.push(
        <h3 key={`b${blocks.length}`} className={`mb-2 mt-6 font-display font-bold text-ink-900 first:mt-0 ${headingClass}`}>
          {renderInline(text)}
        </h3>,
      )
      i += 1
      continue
    }

    if (line.trim().startsWith('>')) {
      const items = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        items.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push(
        <blockquote key={`b${blocks.length}`} className="my-4 rounded-r-2xl border-l-4 border-amber-300 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-ink-500">
          {items.map((item, index) => (
            <span key={index} className="block">
              {renderInline(item)}
            </span>
          ))}
        </blockquote>,
      )
      continue
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i += 1
      }
      blocks.push(
        <ul key={`b${blocks.length}`} className="my-3 space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2 text-sm leading-relaxed text-ink-700">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>,
      )
      continue
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i += 1
      }
      blocks.push(
        <ol key={`b${blocks.length}`} className="my-3 list-decimal space-y-2 pl-5 marker:text-amber-400">
          {items.map((item, index) => (
            <li key={index} className="text-sm leading-relaxed text-ink-700">
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      )
      continue
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(<hr key={`b${blocks.length}`} className="my-5 border-t border-dashed border-cream-300" />)
      i += 1
      continue
    }

    if (!line.trim()) {
      i += 1
      continue
    }

    blocks.push(
      <p key={`b${blocks.length}`} className="my-3 text-sm leading-relaxed text-ink-700">
        {renderInline(line)}
      </p>,
    )
    i += 1
  }

  return <div>{blocks}</div>
}

function excerptOf(note) {
  const first = String(note.content || '')
    .split('\n')
    .find((line) => line.trim() && !line.trim().startsWith('#') && !line.trim().startsWith('```'))
  return (first || note.title || '').replace(/[*#>`[\]]/g, '').slice(0, 96)
}

function todayLabel() {
  const now = new Date()
  return `${now.getMonth() + 1} 月 ${now.getDate()} 日`
}

export default function KnowledgeNotebook() {
  const [notes, setNotes] = useState(() => readStorage('willow:notes', INITIAL_NOTES))
  const [activeCategory, setActiveCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [capTitle, setCapTitle] = useState('')
  const [capCategory, setCapCategory] = useState('')
  const [capKeywords, setCapKeywords] = useState('')
  const [capContent, setCapContent] = useState('')

  useEffect(() => {
    writeStorage('willow:notes', notes)
  }, [notes])

  const subjects = useMemo(() => readStorage('willow:subjects', SUBJECTS).map(resolveSubject), [])

  const categories = useMemo(() => {
    return [
      { id: 'all', name: '全部笔记', icon: FolderOpen, iconBox: 'bg-amber-100 text-amber-500' },
      ...subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        icon: subject.icon,
        iconBox: subject.color.iconBox,
      })),
      { id: 'projects', name: '项目实战', icon: Rocket, iconBox: 'bg-orange-100 text-orange-500' },
      { id: 'other', name: '未分类', icon: FileText, iconBox: 'bg-stone-100 text-stone-400' },
    ]
  }, [subjects])

  const categoryOf = (note) => {
    const id = note.category && categories.some((category) => category.id === note.category) ? note.category : 'other'
    return categories.find((category) => category.id === id) ?? categories[categories.length - 1]
  }

  const filteredNotes = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return notes.filter((note) => {
      const categoryOk = activeCategory === 'all' || categoryOf(note).id === activeCategory
      if (!categoryOk) return false
      if (!keyword) return true
      const haystack = [note.title, note.content, ...(note.keywords || [])].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, activeCategory, query, categories])

  const selectedNote = notes.find((note) => note.id === selectedId)
  const selectedCategory = selectedNote ? categoryOf(selectedNote) : null

  const openCapture = () => {
    setEditingNote(null)
    setCapTitle('')
    setCapCategory(activeCategory === 'all' ? subjects[0]?.id ?? 'other' : activeCategory)
    setCapKeywords('')
    setCapContent('')
    setCaptureOpen(true)
  }

  const openEdit = (note) => {
    setEditingNote(note)
    setCapTitle(note.title)
    setCapCategory(categoryOf(note).id)
    setCapKeywords((note.keywords || []).join(' '))
    setCapContent(note.content)
    setCaptureOpen(true)
  }

  const saveNote = () => {
    const title = capTitle.trim()
    const content = capContent.trim()
    if (!title || !content) {
      toast('标题和内容都要写一点哦 ✍️')
      return
    }
    const note = {
      id: `note-${Date.now()}`,
      category: capCategory || 'other',
      title,
      keywords: capKeywords
        .split(/[,，\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6),
      content,
      updatedAt: '刚刚',
    }
    if (editingNote) {
      setNotes((prev) =>
        prev.map((item) =>
          item.id === editingNote.id
            ? { ...item, title, category: note.category, keywords: note.keywords, content, updatedAt: todayLabel() }
            : item,
        ),
      )
    } else {
      setNotes((prev) => [note, ...prev])
    }
    setActiveCategory('all')
    setCaptureOpen(false)
    toast(editingNote ? '笔记已更新 ✏️' : '已收进知识笔记本 📝')
  }

  const removeNote = (id) => {
    if (!window.confirm('确定删除这条笔记吗？删除后无法恢复哦')) return
    setNotes((prev) => prev.filter((note) => note.id !== id))
    setSelectedId(null)
    toast('笔记已删除 🗑️')
  }

  return (
    <Section id="notes" icon={BookMarked} title="知识笔记本" subtitle="把零散的知识点，收进一个温暖的小书房，随时回来翻一翻">
      <Reveal>
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-amber-100">
          <div className="grid lg:grid-cols-[264px_1fr]">
            {/* 左侧：目录树 + 全局搜索 */}
            <aside className="border-b border-cream-200 bg-cream-100/50 p-4 lg:border-b-0 lg:border-r">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setSelectedId(null)
                  }}
                  placeholder="搜索标题或关键词…"
                  className="w-full rounded-xl bg-white py-2.5 pl-9 pr-3 text-sm text-ink-700 shadow-sm ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              <nav className="mt-3 space-y-1">
                {categories.map((category) => {
                  const count = notes.filter((note) => categoryOf(note).id === category.id).length
                  const active = activeCategory === category.id
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory(category.id)
                        setSelectedId(null)
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        active ? 'bg-white font-semibold text-wood-700 shadow-sm ring-1 ring-amber-100' : 'text-ink-500 hover:bg-white/70 hover:text-ink-700'
                      }`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${category.iconBox}`}>
                        <category.icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 truncate">{category.name}</span>
                      <span className={`text-xs ${active ? 'text-amber-500' : 'text-ink-300'}`}>{count}</span>
                    </button>
                  )
                })}
              </nav>
            </aside>

            {/* 右侧：内容区 */}
            <div className="flex min-h-[520px] flex-col p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-400">
                  共 <span className="font-bold text-ink-700">{filteredNotes.length}</span> 条笔记
                  {query && <span> · 搜索「{query}」</span>}
                </p>
                <button
                  type="button"
                  onClick={openCapture}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 active:scale-[0.97]"
                >
                  <Plus className="h-4 w-4" />
                  记一笔
                </button>
              </div>

              <div className="mt-4 flex-1">
                {selectedNote ? (
                  <article className="animate-fade-up">
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="mb-4 flex items-center gap-1 rounded-full bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:bg-cream-200 hover:text-ink-700"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      返回笔记列表
                    </button>
                    <header className="border-b border-cream-200 pb-4">
                      <h3 className="font-display text-xl font-bold leading-snug text-ink-900 md:text-2xl">{selectedNote.title}</h3>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${selectedCategory.iconBox}`}>
                          <selectedCategory.icon className="h-3.5 w-3.5" />
                          {selectedCategory.name}
                        </span>
                        {(selectedNote.keywords || []).map((keyword) => (
                          <span key={keyword} className="rounded-full bg-cream-100 px-2.5 py-1 text-xs text-ink-400">
                            #{keyword}
                          </span>
                        ))}
                        <span className="ml-auto text-xs text-ink-300">更新于 {selectedNote.updatedAt}</span>
                      </div>
                    </header>
                    <div className="py-2">{renderMarkdown(selectedNote.content)}</div>
                    <div className="mt-2 flex justify-end gap-2 border-t border-cream-200 pt-4">
                      <button
                        type="button"
                        onClick={() => openEdit(selectedNote)}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-wood-600 transition hover:bg-amber-50 hover:text-wood-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        编辑笔记
                      </button>
                      <button
                        type="button"
                        onClick={() => removeNote(selectedNote.id)}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除这条笔记
                      </button>
                    </div>
                  </article>
                ) : filteredNotes.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredNotes.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => setSelectedId(note.id)}
                        className="group flex flex-col rounded-2xl bg-cream-50 p-4 text-left ring-1 ring-transparent transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:ring-amber-100"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold leading-snug text-ink-800 group-hover:text-wood-700">{note.title}</p>
                          <span className="shrink-0 text-[11px] text-ink-300">{note.updatedAt}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-400">{excerptOf(note)}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${categoryOf(note).iconBox}`}>
                            {categoryOf(note).name}
                          </span>
                          {(note.keywords || []).slice(0, 3).map((keyword) => (
                            <span key={keyword} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-ink-400 ring-1 ring-cream-200">
                              #{keyword}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center text-center">
                    <span className="text-4xl">🔍</span>
                    <p className="mt-3 text-sm font-semibold text-ink-500">没有找到相关笔记</p>
                    <p className="mt-1 text-xs text-ink-300">换个关键词试试，或点右上角「记一笔」写下新收获</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {captureOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm">
          <div className="animate-pop-in max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-amber-100">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold text-ink-700">{editingNote ? '✏️ 编辑笔记' : '✍️ 记一笔'}</p>
              <button
                type="button"
                onClick={() => setCaptureOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-cream-100 hover:text-ink-700"
                aria-label="关闭速记弹窗"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-400">
              {editingNote ? '随时修正和补充，改完点保存即可' : '学习或写代码时的灵光一闪，先记下来，分类可以之后慢慢补'}
            </p>

            <label className="mt-5 block">
              <span className="text-xs font-semibold text-ink-500">标题</span>
              <input
                type="text"
                value={capTitle}
                onChange={(event) => setCapTitle(event.target.value)}
                placeholder="比如：一次搞懂 TCP 三次握手"
                className="mt-1.5 w-full rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700 ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-ink-500">分类</span>
              <select
                value={capCategory}
                onChange={(event) => setCapCategory(event.target.value)}
                className="mt-1.5 w-full rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700 ring-1 ring-cream-200 transition focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {categories
                  .filter((category) => category.id !== 'all')
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-ink-500">关键词（用逗号或空格隔开）</span>
              <input
                type="text"
                value={capKeywords}
                onChange={(event) => setCapKeywords(event.target.value)}
                placeholder="比如：网络, TCP, 握手"
                className="mt-1.5 w-full rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700 ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-ink-500">
                内容支持：`代码`、**加粗**、{'>'} 引用、- 列表、```代码块```，以及 {'<span style="color:#e11d48">彩色文字</span>'}
              </span>
              <textarea
                value={capContent}
                onChange={(event) => setCapContent(event.target.value)}
                rows={7}
                placeholder={'把想记的东西写在这里…\n\n> 比如：三次握手是为了确认双方收发能力'}
                className="mt-1.5 w-full resize-y rounded-xl bg-cream-50 px-3.5 py-2.5 font-mono text-sm leading-relaxed text-ink-700 ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </label>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setCaptureOpen(false)}
                className="flex-1 rounded-2xl bg-cream-100 px-4 py-3 text-sm font-bold text-ink-500 transition hover:bg-cream-200"
              >
                先不记了
              </button>
              <button
                type="button"
                onClick={saveNote}
                className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 active:scale-[0.98]"
              >
                {editingNote ? '保存修改' : '收进笔记本'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}
