import { useState } from 'react'
import { toast } from '../hooks'

/** 轻量代码高亮：注释 / 字符串 / 关键字 / 数字 */
export function highlightCode(code) {
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

export default function CodeBlock({ lang = 'text', code }) {
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
