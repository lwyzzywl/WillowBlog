import { useEffect, useState } from 'react'
import { ChevronDown, Code2, ExternalLink, Link2, Pencil, Plus, Trash2, Trophy, X } from 'lucide-react'
import { CODE_LANGS, COMPLEXITY_OPTIONS, DIFFICULTIES } from '../data'
import { toast } from '../hooks'
import { useCollection } from '../context/CloudDataProvider'
import { useAuth } from '../hooks/useAuth'
import CloudStatusBar from './CloudStatusBar'
import CodeBlock from './CodeBlock'
import Reveal from './Reveal'
import Section from './Section'

const emptyProblemForm = { title: '', link: '', difficulty: 'easy', tags: '' }
const emptySolutionForm = {
  title: '',
  lang: 'C++',
  approach: '',
  process: '',
  timeComplexity: 'n',
  spaceComplexity: '1',
  code: '',
}

const difficultyOf = (id) => DIFFICULTIES.find((item) => item.id === id) ?? DIFFICULTIES[0]

export default function LeetCodeSection() {
  const { isAdmin } = useAuth()
  // 公开模块：任何人都能读；写操作只对管理员渲染，且数据库 RLS 会二次校验
  const collection = useCollection('leetcode')
  const problems = Array.isArray(collection.data) ? collection.data : []
  const commitProblems = collection.commit
  const [problemModal, setProblemModal] = useState(null)
  const [solutionModal, setSolutionModal] = useState(null)
  const [problemForm, setProblemForm] = useState(emptyProblemForm)
  const [solutionForm, setSolutionForm] = useState(emptySolutionForm)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    if (!problemModal && !solutionModal) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setProblemModal(null)
        setSolutionModal(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [problemModal, solutionModal])

  const solutionCount = problems.reduce((acc, problem) => acc + (problem.solutions?.length || 0), 0)

  const toggleSolution = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  const openProblemModal = (problem) => {
    if (!isAdmin) return
    setProblemForm(
      problem
        ? { title: problem.title, link: problem.link || '', difficulty: problem.difficulty || 'easy', tags: (problem.tags || []).join(' ') }
        : emptyProblemForm,
    )
    setProblemModal({ id: problem?.id ?? null })
  }

  const openSolutionModal = (problemId, solution) => {
    if (!isAdmin) return
    setSolutionForm(
      solution
        ? {
            title: solution.title,
            lang: solution.lang || 'C++',
            approach: solution.approach || '',
            process: solution.process || '',
            timeComplexity: solution.timeComplexity || 'n',
            spaceComplexity: solution.spaceComplexity || '1',
            code: solution.code || '',
          }
        : emptySolutionForm,
    )
    setSolutionModal({ problemId, id: solution?.id ?? null })
  }

  const saveProblem = () => {
    const title = problemForm.title.trim()
    const link = problemForm.link.trim()
    if (!title) {
      toast('题目名称不能为空哦')
      return
    }
    if (link && !/^https?:\/\//i.test(link)) {
      toast('题目链接要以 http(s):// 开头，才能一键跳转')
      return
    }
    const payload = {
      title,
      link,
      difficulty: problemForm.difficulty || 'easy',
      tags: problemForm.tags
        .split(/[,，\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8),
    }
    if (problemModal.id) {
      commitProblems((prev) => prev.map((problem) => (problem.id === problemModal.id ? { ...problem, ...payload } : problem)))
    } else {
      commitProblems((prev) => [...prev, { id: `lc-${Date.now()}`, ...payload, solutions: [] }])
    }
    setProblemModal(null)
    toast(problemModal.id ? '题目信息已更新 ✏️' : '新题目已加入题解清单 🏆')
  }

  const saveSolution = () => {
    const f = solutionForm
    if (!f.title.trim()) {
      toast('给这个解法起个名字吧，比如「解法一：哈希表」')
      return
    }
    if (!f.approach.trim() && !f.process.trim()) {
      toast('思路或解题过程至少写一点哦')
      return
    }
    if (!f.code.trim()) {
      toast('把代码粘贴进来，题解才算完整')
      return
    }
    const payload = {
      title: f.title.trim(),
      lang: f.lang,
      approach: f.approach.trim(),
      process: f.process.trim(),
      timeComplexity: f.timeComplexity,
      spaceComplexity: f.spaceComplexity,
      code: f.code,
    }
    const newId = solutionModal.id || `sol-${Date.now()}`
    commitProblems((prev) =>
      prev.map((problem) => {
        if (problem.id !== solutionModal.problemId) return problem
        const solutions = solutionModal.id
          ? problem.solutions.map((solution) => (solution.id === solutionModal.id ? { ...solution, ...payload } : solution))
          : [...problem.solutions, { id: newId, ...payload }]
        return { ...problem, solutions }
      }),
    )
    if (!solutionModal.id) {
      setExpanded((prev) => ({ ...prev, [newId]: true }))
    }
    setSolutionModal(null)
    toast(solutionModal.id ? '解法已更新 ✏️' : '新解法已保存，继续加油 💪')
  }

  const removeProblem = (id) => {
    if (!window.confirm('确定删除这道题吗？里面的所有解法会一起删除')) return
    commitProblems((prev) => prev.filter((problem) => problem.id !== id))
    toast('题目已移除 🗑️')
  }

  const removeSolution = (problemId, solutionId) => {
    if (!window.confirm('确定删除这个解法吗？')) return
    commitProblems((prev) =>
      prev.map((problem) =>
        problem.id === problemId
          ? { ...problem, solutions: problem.solutions.filter((solution) => solution.id !== solutionId) }
          : problem,
      ),
    )
    setExpanded((prev) => {
      const next = { ...prev }
      delete next[solutionId]
      return next
    })
    toast('解法已删除 🗑️')
  }

  return (
    <Section id="cs" icon={Trophy} title="力扣题解 · 解题记录" subtitle="一道题，多种解法：把思路、过程与复杂度都沉淀下来 🧠">
      <Reveal>
        <div className="mx-auto mb-8 flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-ink-400">
              已收录 <span className="font-bold text-ink-700">{problems.length}</span> 题 ·{' '}
              <span className="font-bold text-ink-700">{solutionCount}</span> 个解法
            </p>
            <CloudStatusBar collection={collection} isAdmin={isAdmin} className="mt-1" />
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => openProblemModal(null)}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              添加题目
            </button>
          )}
        </div>
      </Reveal>

      <div className="mx-auto max-w-4xl space-y-5">
        {problems.map((problem, index) => {
          const difficulty = difficultyOf(problem.difficulty)
          return (
            <Reveal key={problem.id} delay={index * 60}>
              <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-100 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${difficulty.badge}`}>{difficulty.label}</span>
                    <h3 className="font-display text-lg font-bold leading-snug text-ink-900">{problem.title}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {problem.link && (
                      <a
                        href={problem.link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-600 ring-1 ring-sky-100 transition hover:-translate-y-0.5 hover:bg-sky-100"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        题目链接
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openProblemModal(problem)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-300 transition hover:bg-amber-50 hover:text-wood-600"
                          aria-label="编辑题目"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeProblem(problem.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-300 transition hover:bg-rose-50 hover:text-rose-500"
                          aria-label="删除题目"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {(problem.tags?.length > 0 || problem.solutions?.length > 0) && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {(problem.tags || []).map((tag) => (
                      <span key={tag} className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-medium text-ink-500">
                        #{tag}
                      </span>
                    ))}
                    <span className="ml-auto text-xs text-ink-300">{problem.solutions?.length || 0} 个解法</span>
                  </div>
                )}

                <div className="mt-4 space-y-2.5">
                  {(problem.solutions || []).map((solution) => {
                    const open = !!expanded[solution.id]
                    return (
                      <div key={solution.id} className="overflow-hidden rounded-2xl bg-cream-50 ring-1 ring-cream-200">
                        <button
                          type="button"
                          onClick={() => toggleSolution(solution.id)}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                        >
                          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-300 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-700">{solution.title}</span>
                          <span className="hidden rounded-md bg-white px-2 py-0.5 font-mono text-xs text-ink-400 ring-1 ring-cream-200 sm:inline">
                            {solution.lang}
                          </span>
                          <span className="hidden text-xs text-ink-400 md:inline">
                            O({solution.timeComplexity}) / O({solution.spaceComplexity})
                          </span>
                        </button>
                        {open && (
                          <div className="space-y-4 border-t border-cream-200 px-4 pb-4 pt-3">
                            <div>
                              <p className="mb-1 text-xs font-bold text-ink-400">💡 思路</p>
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{solution.approach}</p>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-bold text-ink-400">📝 解题过程</p>
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{solution.process}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-600 ring-1 ring-sky-100">
                                时间 O({solution.timeComplexity})
                              </span>
                              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600 ring-1 ring-violet-100">
                                空间 O({solution.spaceComplexity})
                              </span>
                              <span className="rounded-full bg-cream-100 px-3 py-1 font-mono text-xs text-ink-400">{solution.lang}</span>
                            </div>
                            <CodeBlock lang={solution.lang} code={solution.code} />
                            {isAdmin && (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openSolutionModal(problem.id, solution)}
                                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-wood-600 transition hover:bg-amber-50 hover:text-wood-700"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  编辑解法
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeSolution(problem.id, solution.id)}
                                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-50 hover:text-rose-500"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  删除解法
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => openSolutionModal(problem.id, null)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 px-4 py-3 text-sm font-semibold text-wood-600 transition hover:border-amber-300 hover:bg-amber-50"
                  >
                    <Plus className="h-4 w-4" />
                    为这道题添加一种解法
                  </button>
                )}
              </article>
            </Reveal>
          )
        })}

        {problems.length === 0 && (
          <Reveal>
            <div className="flex flex-col items-center rounded-3xl bg-white py-16 text-center shadow-sm ring-1 ring-amber-100">
              <span className="text-4xl">🏆</span>
              <p className="mt-3 font-display text-base font-bold text-ink-700">题解清单还是空的</p>
              <p className="mt-1 text-sm text-ink-400">
                {isAdmin ? '从一道最近刷过的题开始记录吧' : '站长还没有公开题解，稍后再来看看吧'}
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => openProblemModal(null)}
                  className="mt-5 flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-400 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5"
                >
                  <Plus className="h-4 w-4" />
                  添加第一道题目
                </button>
              )}
            </div>
          </Reveal>
        )}
      </div>

      {problemModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm">
          <div className="animate-pop-in max-h-[86vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-amber-100">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold text-ink-700">{problemModal.id ? '✏️ 编辑题目' : '🏆 添加题目'}</p>
              <button
                type="button"
                onClick={() => setProblemModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-cream-100 hover:text-ink-700"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-semibold text-ink-500">题目名称</span>
              <input
                autoFocus
                type="text"
                value={problemForm.title}
                onChange={(event) => setProblemForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="例如：两数之和"
                className="mt-1.5 w-full rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700 ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-ink-500">题目链接</span>
              <input
                type="url"
                value={problemForm.link}
                onChange={(event) => setProblemForm((prev) => ({ ...prev, link: event.target.value }))}
                placeholder="https://leetcode.cn/problems/xxx/"
                className="mt-1.5 w-full rounded-xl bg-cream-50 px-3.5 py-2.5 font-mono text-sm text-ink-700 ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <span className="mt-1 block text-[11px] text-ink-300">粘贴力扣题目页地址，卡片上的「题目链接」按钮就能一键跳转</span>
            </label>

            <div className="mt-4">
              <span className="text-xs font-semibold text-ink-500">难度</span>
              <div className="mt-1.5 flex gap-2">
                {DIFFICULTIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setProblemForm((prev) => ({ ...prev, difficulty: item.id }))}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
                      problemForm.difficulty === item.id ? `${item.badge} ring-2` : 'bg-cream-100 text-ink-400 hover:text-ink-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-ink-500">标签（用逗号或空格隔开）</span>
              <input
                type="text"
                value={problemForm.tags}
                onChange={(event) => setProblemForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="例如：数组, 哈希表, 双指针"
                className="mt-1.5 w-full rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700 ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </label>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setProblemModal(null)}
                className="flex-1 rounded-2xl bg-cream-100 px-4 py-3 text-sm font-bold text-ink-500 transition hover:bg-cream-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveProblem}
                className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 active:scale-[0.98]"
              >
                {problemModal.id ? '保存修改' : '加入清单'}
              </button>
            </div>
          </div>
        </div>
      )}

      {solutionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm">
          <div className="animate-pop-in max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-amber-100">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold text-ink-700">{solutionModal.id ? '✏️ 编辑解法' : '🧩 添加解法'}</p>
              <button
                type="button"
                onClick={() => setSolutionModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-cream-100 hover:text-ink-700"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-semibold text-ink-500">解法名称</span>
              <input
                autoFocus
                type="text"
                value={solutionForm.title}
                onChange={(event) => setSolutionForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="例如：解法一 · 哈希表"
                className="mt-1.5 w-full rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700 ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-ink-500">语言</span>
              <select
                value={solutionForm.lang}
                onChange={(event) => setSolutionForm((prev) => ({ ...prev, lang: event.target.value }))}
                className="mt-1.5 w-full rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700 ring-1 ring-cream-200 transition focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {CODE_LANGS.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-ink-500">💡 思路</span>
              <textarea
                rows={3}
                value={solutionForm.approach}
                onChange={(event) => setSolutionForm((prev) => ({ ...prev, approach: event.target.value }))}
                placeholder="这题的核心想法是什么？为什么这么想？"
                className="mt-1.5 w-full resize-y rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm leading-relaxed text-ink-700 ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-ink-500">📝 解题过程</span>
              <textarea
                rows={4}
                value={solutionForm.process}
                onChange={(event) => setSolutionForm((prev) => ({ ...prev, process: event.target.value }))}
                placeholder="一步一步怎么写：初始化什么、循环怎么走、边界怎么处理…"
                className="mt-1.5 w-full resize-y rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm leading-relaxed text-ink-700 ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </label>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-ink-500">时间复杂度</span>
                <select
                  value={solutionForm.timeComplexity}
                  onChange={(event) => setSolutionForm((prev) => ({ ...prev, timeComplexity: event.target.value }))}
                  className="mt-1.5 w-full rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700 ring-1 ring-cream-200 transition focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {COMPLEXITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-ink-500">空间复杂度</span>
                <select
                  value={solutionForm.spaceComplexity}
                  onChange={(event) => setSolutionForm((prev) => ({ ...prev, spaceComplexity: event.target.value }))}
                  className="mt-1.5 w-full rounded-xl bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700 ring-1 ring-cream-200 transition focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {COMPLEXITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-ink-500">代码</span>
              <textarea
                rows={10}
                value={solutionForm.code}
                onChange={(event) => setSolutionForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder={'把 LeetCode 上的代码直接粘贴到这里…'}
                className="mt-1.5 w-full resize-y rounded-xl bg-[#2d2720] px-3.5 py-2.5 font-mono text-sm leading-relaxed text-cream-100/90 ring-1 ring-black/10 transition placeholder:text-cream-100/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </label>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setSolutionModal(null)}
                className="flex-1 rounded-2xl bg-cream-100 px-4 py-3 text-sm font-bold text-ink-500 transition hover:bg-cream-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveSolution}
                className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 active:scale-[0.98]"
              >
                {solutionModal.id ? '保存修改' : '保存解法'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}
