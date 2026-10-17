import CodeBlock from './components/CodeBlock'

/**
 * 极简 Markdown 渲染器（配合知识笔记本的格式工具栏）
 *
 * 行内：`代码` / **加粗** / *斜体* / ~~删除线~~ / [链接](url) / ![图片](src)
 *       / <span style="color:#e11d48">彩色文字</span>
 *       / <span style="background-color:#fef08a">荧光笔</span>
 * 块级：# ~ #### 标题 / > 引用 / - 无序 / 1. 有序 / - [ ] 待办 / ``` 代码块 / 表格 / --- 分隔线
 */

const FENCE = '```'

/* ------------------------------------------------------------------ *
 * 行内解析：逐字符扫描，避免复杂正则互相打架
 * ------------------------------------------------------------------ */

function plain(buffer, nodes, key) {
  if (buffer) nodes.push(buffer)
  return { nodes, key }
}

function findClosing(text, from, marker) {
  let index = text.indexOf(marker, from)
  while (index !== -1) {
    if (text[index - 1] !== '\\') return index
    index = text.indexOf(marker, index + marker.length)
  }
  return -1
}

/** 匹配从 index 开始的括号式子串，支持内部嵌套一层 () */
function matchDelimited(text, index, open, close) {
  if (text[index] !== open) return null
  let depth = 0
  for (let scan = index; scan < text.length; scan += 1) {
    const char = text[scan]
    if (char === '\\') {
      scan += 1
      continue
    }
    if (char === open) depth += 1
    else if (char === close) {
      depth -= 1
      if (depth === 0) return { raw: text.slice(index, scan + 1), inner: text.slice(index + 1, scan) }
    }
  }
  return null
}

/** 读取 <span style="color:xxx">…</span> / <span style="background-color:xxx">…</span>，返回内容与外层样式 */
function readSpan(text, index) {
  const openTag = text.slice(index).match(/^<span\s+style\s*=\s*["']\s*(color|background-color)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+)\s*["']\s*>/i)
  if (!openTag) return null
  const style = openTag[1].toLowerCase()
  const value = openTag[2]
  const start = index + openTag[0].length
  const closeIndex = text.toLowerCase().indexOf('</span>', start)
  if (closeIndex === -1) return null
  return {
    raw: text.slice(index, closeIndex + 7),
    inner: text.slice(start, closeIndex),
    style: style === 'background-color' ? { backgroundColor: value } : { color: value },
  }
}

function parseInline(text, depth = 0) {
  const source = String(text ?? '')
  const nodes = []
  let buffer = ''
  let key = 0
  let index = 0

  const flush = () => {
    if (buffer) {
      nodes.push(buffer)
      buffer = ''
    }
  }
  const push = (node) => {
    flush()
    nodes.push(node)
  }

  while (index < source.length) {
    const char = source[index]

    // 反斜杠转义
    if (char === '\\' && index + 1 < source.length) {
      buffer += source[index + 1]
      index += 2
      continue
    }

    // 彩色文字 / 荧光笔
    if (char === '<' && /^<span/i.test(source.slice(index, index + 5))) {
      const span = depth < 12 ? readSpan(source, index) : null
      if (span) {
        const style = span.style
        push(
          <span key={`md-style-${key++}`} style={style}>
            {parseInline(span.inner, depth + 1)}
          </span>,
        )
        index += span.raw.length
        continue
      }
    }

    // `行内代码`
    if (char === '`') {
      const ticks = /^`+/.exec(source.slice(index))[0]
      const closeIndex = source.indexOf(ticks, index + ticks.length)
      if (closeIndex !== -1) {
        push(
          <code key={`md-code-${key++}`} className="rounded-md bg-amber-100/80 px-1.5 py-0.5 font-mono text-[0.9em] text-rose-500">
            {source.slice(index + ticks.length, closeIndex)}
          </code>,
        )
        index = closeIndex + ticks.length
        continue
      }
    }

    // ![图片](src)
    if (char === '!' && source[index + 1] === '[') {
      const alt = matchDelimited(source, index + 1, '[', ']')
      if (alt && source[index + 1 + alt.raw.length] === '(') {
        const src = matchDelimited(source, index + 1 + alt.raw.length, '(', ')')
        if (src) {
          push(
            <img
              key={`md-image-${key++}`}
              src={src.inner.trim()}
              alt={alt.inner}
              loading="lazy"
              className="my-3 max-h-80 w-auto max-w-full rounded-2xl bg-cream-100 object-contain ring-1 ring-cream-200"
            />,
          )
          index += 1 + alt.raw.length + src.raw.length
          continue
        }
      }
    }

    // [链接](url)
    if (char === '[') {
      const label = matchDelimited(source, index, '[', ']')
      if (label && source[index + label.raw.length] === '(') {
        const href = matchDelimited(source, index + label.raw.length, '(', ')')
        if (href) {
          const target = href.inner.trim().split(/\s+/)[0]
          push(
            <a
              key={`md-link-${key++}`}
              href={target}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sky-500 underline decoration-sky-200 underline-offset-2 transition hover:text-sky-600"
            >
              {parseInline(label.inner, depth + 1)}
            </a>,
          )
          index += label.raw.length + href.raw.length
          continue
        }
      }
    }

    // **加粗**
    if (char === '*' && source[index + 1] === '*') {
      const closeIndex = findClosing(source, index + 2, '**')
      if (closeIndex > index + 2) {
        push(
          <strong key={`md-bold-${key++}`} className="font-bold text-ink-900">
            {parseInline(source.slice(index + 2, closeIndex), depth + 1)}
          </strong>,
        )
        index = closeIndex + 2
        continue
      }
    }

    // ~~删除线~~
    if (char === '~' && source[index + 1] === '~') {
      const closeIndex = findClosing(source, index + 2, '~~')
      if (closeIndex > index + 2) {
        push(
          <del key={`md-del-${key++}`} className="text-ink-400 line-through decoration-rose-300">
            {parseInline(source.slice(index + 2, closeIndex), depth + 1)}
          </del>,
        )
        index = closeIndex + 2
        continue
      }
    }

    // *斜体* / _斜体_
    if (char === '*' || char === '_') {
      const closeIndex = findClosing(source, index + 1, char)
      if (closeIndex > index + 1) {
        push(
          <em key={`md-em-${key++}`} className="italic text-ink-500">
            {parseInline(source.slice(index + 1, closeIndex), depth + 1)}
          </em>,
        )
        index = closeIndex + 1
        continue
      }
    }

    buffer += char
    index += 1
  }

  return plain(buffer, nodes, key).nodes
}

/** 供阅读视图使用：把一行行内 Markdown 渲染成 React 节点 */
export function renderInline(text) {
  return parseInline(text, 0)
}

/* ------------------------------------------------------------------ *
 * 表格辅助
 * ------------------------------------------------------------------ */

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isDelimiterRow(line) {
  return /^\|?[\s:|-]+\|[\s:|-]*$/.test(line.trim()) && line.includes('-')
}

function alignmentOf(line) {
  return splitRow(line).map((cell) => {
    const left = cell.startsWith(':')
    const right = cell.endsWith(':')
    if (left && right) return 'center'
    if (right) return 'right'
    return 'left'
  })
}

function renderTable(headerLine, delimiterLine, bodyLines, key) {
  const headers = splitRow(headerLine)
  const aligns = alignmentOf(delimiterLine)
  return (
    <div key={key} className="my-4 overflow-x-auto rounded-2xl ring-1 ring-cream-200">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-cream-100">
          <tr>
            {headers.map((cell, index) => (
              <th
                key={index}
                className="border-b border-cream-200 px-3 py-2 text-left font-semibold text-ink-700"
                style={{ textAlign: aligns[index] || 'left' }}
              >
                {parseInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyLines.map((line, rowIndex) => (
            <tr key={rowIndex} className="even:bg-cream-50/60">
              {splitRow(line).map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="border-b border-cream-100 px-3 py-2 align-top text-ink-700 last:border-b-0"
                  style={{ textAlign: aligns[cellIndex] || 'left' }}
                >
                  {parseInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 块级解析
 * ------------------------------------------------------------------ */

/** 把一段 Markdown 渲染成阅读视图 */
export function renderMarkdown(markdown) {
  const lines = String(markdown || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    const key = `md-block-${blocks.length}`

    if (trimmed.startsWith(FENCE)) {
      const lang = trimmed.slice(3).trim() || 'text'
      const code = []
      const fenceIndent = line.match(/^\s*/)[0]
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith(FENCE)) {
        code.push(lines[i].startsWith(fenceIndent) ? lines[i].slice(fenceIndent.length) : lines[i])
        i += 1
      }
      i += 1
      blocks.push(<CodeBlock key={key} lang={lang} code={code.join('\n')} />)
      continue
    }

    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length
      const text = line.replace(/^#+\s*/, '')
      const headingClass =
        level === 1
          ? 'mb-3 mt-7 font-display text-xl font-bold text-ink-900 md:text-2xl'
          : level === 2
            ? 'mb-2.5 mt-6 font-display text-lg font-bold text-ink-900'
            : 'mb-2 mt-5 font-display text-base font-bold text-ink-800'
      blocks.push(
        <h3 key={key} className={`${headingClass} first:mt-0`}>
          {parseInline(text)}
        </h3>,
      )
      i += 1
      continue
    }

    if (trimmed.startsWith('>')) {
      const items = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        items.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push(
        <blockquote
          key={key}
          className="my-4 rounded-r-2xl border-l-4 border-amber-300 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-ink-500"
        >
          {items.map((item, itemIndex) => (
            <span key={itemIndex} className="block">
              {parseInline(item)}
            </span>
          ))}
        </blockquote>,
      )
      continue
    }

    // 表格：表头 + 分隔行
    if (line.includes('|') && i + 1 < lines.length && isDelimiterRow(lines[i + 1])) {
      const headerLine = line
      const delimiterLine = lines[i + 1]
      const bodyLines = []
      i += 2
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        bodyLines.push(lines[i])
        i += 1
      }
      blocks.push(renderTable(headerLine, delimiterLine, bodyLines, key))
      continue
    }

    const task = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/)
    if (task) {
      const items = []
      while (i < lines.length) {
        const match = lines[i].trim().match(/^[-*]\s+\[([ xX])\]\s+(.*)$/)
        if (!match) break
        items.push({ done: match[1].toLowerCase() === 'x', text: match[2] })
        i += 1
      }
      blocks.push(
        <ul key={key} className="my-3 space-y-2">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="flex items-start gap-2 text-sm leading-relaxed text-ink-700">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                  item.done ? 'bg-leaf-500 text-white' : 'bg-cream-100 text-transparent ring-1 ring-cream-300'
                }`}
              >
                ✓
              </span>
              <span className={item.done ? 'text-ink-400 line-through decoration-ink-300' : ''}>{parseInline(item.text)}</span>
            </li>
          ))}
        </ul>,
      )
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i += 1
      }
      blocks.push(
        <ul key={key} className="my-3 space-y-2">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="flex gap-2 text-sm leading-relaxed text-ink-700">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span>{parseInline(item)}</span>
            </li>
          ))}
        </ul>,
      )
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i += 1
      }
      blocks.push(
        <ol key={key} className="my-3 list-decimal space-y-2 pl-5 marker:text-amber-400">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="text-sm leading-relaxed text-ink-700">
              {parseInline(item)}
            </li>
          ))}
        </ol>,
      )
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={key} className="my-5 border-t border-dashed border-cream-300" />)
      i += 1
      continue
    }

    // 独占一行的图片：单独居中展示
    const soloImage = line.match(/^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/)
    if (soloImage) {
      blocks.push(
        <img
          key={key}
          src={soloImage[2]}
          alt={soloImage[1]}
          loading="lazy"
          className="mx-auto my-4 max-h-96 w-auto max-w-full rounded-2xl bg-cream-100 object-contain ring-1 ring-cream-200"
        />,
      )
      i += 1
      continue
    }

    if (!trimmed) {
      i += 1
      continue
    }

    blocks.push(
      <p key={key} className="my-3 text-sm leading-relaxed text-ink-700">
        {parseInline(line)}
      </p>,
    )
    i += 1
  }

  return <div className="md-body">{blocks}</div>
}

/* ------------------------------------------------------------------ *
 * 其他
 * ------------------------------------------------------------------ */

/** 列表卡片上的一行摘要：去掉所有 Markdown 记号 */
export function excerptOf(note) {
  const first = String(note.content || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#') && !line.startsWith(FENCE) && !/^\|?[\s:|-]+\|/.test(line) && !/^!\[/.test(line))
  const text = (first || note.title || '')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`>#]/g, '')
    .replace(/^\s*[-+]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 96)
}

/** 颜色预设：正文文字色 */
export const TEXT_COLORS = [
  { value: '#e11d48', label: '玫瑰红' },
  { value: '#ea580c', label: '暖橙' },
  { value: '#ca8a04', label: '姜黄' },
  { value: '#16a34a', label: '草绿' },
  { value: '#0891b2', label: '青蓝' },
  { value: '#2563eb', label: '海蓝' },
  { value: '#7c3aed', label: '葡萄紫' },
  { value: '#db2777', label: '桃粉' },
  { value: '#78716c', label: '石墨灰' },
]

/** 颜色预设：荧光笔底色 */
export const HIGHLIGHT_COLORS = [
  { value: '#fef08a', label: '柠檬黄' },
  { value: '#bbf7d0', label: '薄荷绿' },
  { value: '#bfdbfe', label: '天蓝' },
  { value: '#fbcfe8', label: '樱粉' },
  { value: '#fed7aa', label: '蜜桃橙' },
  { value: '#e9d5ff', label: '丁香紫' },
  { value: '#fecaca', label: '珊瑚红' },
  { value: '#e7e5e4', label: '浅灰' },
]
