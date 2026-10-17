import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/**
 * 知识笔记本编辑器的底座：
 * - 基于 textarea 的选区，把「点按钮」翻译成 Markdown 文本
 * - 撤销 / 重做历史（点按钮插入的格式也能一键撤回）
 * - 光标坐标测量（选中文字时浮出的小工具条）
 */

/* ------------------------------------------------------------------ *
 * 选区小工具
 * ------------------------------------------------------------------ */

const HEADING_RE = /^(#{1,6})\s+/
const QUOTE_RE = /^>\s?/
const TASK_RE = /^(\s*)[-*+]\s+\[[ xX]\]\s+/
const LIST_RE = /^(\s*)(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/

const MAX_HISTORY = 120

const stateOf = (element) => ({
  value: element.value,
  start: element.selectionStart,
  end: element.selectionEnd,
})

/** 选区涉及的行范围（结尾的那个换行不算在内） */
function lineRange(value, start, end) {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  let lineEnd = value.indexOf('\n', end)
  if (lineEnd === -1) lineEnd = value.length
  if (end > start && value[end - 1] === '\n') lineEnd = end - 1
  return { lineStart, lineEnd }
}

/** 把选区扩到整行，格式按钮对「整行」生效更符合直觉 */
function expandToLines({ value, start, end }) {
  const { lineStart, lineEnd } = lineRange(value, start, end)
  return { value, start: lineStart, end: lineEnd }
}

const toLines = (block) =>
  block
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))

const stripBlockPrefix = (line) => line.replace(HEADING_RE, '').replace(QUOTE_RE, '').replace(LIST_RE, '')

/**
 * 切换行前缀：所有行都带 → 去掉；否则 → 统一加上。
 * 必须把「真正改动的整行区间」一起返回，否则 apply 会只替换原始选区。
 */
function toggleLinePrefix({ value, start, end }, regex, prefix) {
  const lines = toLines(value.slice(start, end))
  const allHave = lines.every((line) => regex.test(line))
  const next = lines.map((line) => (allHave ? line.replace(regex, '') : prefix + stripBlockPrefix(line))).join('\n')
  return {
    text: next,
    range: { start, end },
    selectStart: start,
    selectEnd: start + next.length,
  }
}

/**
 * 工具条按钮统一 read 这个：优先用「点击前保存的选区」。
 * range 为 undefined 时退回 textarea 自己的实时选区，方便单元测试直接校验变换。
 */
function targetState(element, range) {
  const live = stateOf(element)
  if (!range || range.start == null) return live
  const max = live.value.length
  const start = Math.max(0, Math.min(range.start, max))
  const end = Math.max(start, Math.min(range.end ?? start, max))
  return { value: live.value, start, end }
}

/* ------------------------------------------------------------------ *
 * 块级格式
 * ------------------------------------------------------------------ */

export function applyHeading(element, level, range) {
  const target = expandToLines(targetState(element, range))
  const lines = toLines(target.value.slice(target.start, target.end))
  const marker = '#'.repeat(level)
  const allHave = lines.every((line) => HEADING_RE.exec(line)?.[1] === marker)
  const next = lines.map((line) => (allHave ? line.replace(HEADING_RE, '') : `${marker} ${stripBlockPrefix(line)}`)).join('\n')
  return {
    text: next,
    range: { start: target.start, end: target.end },
    selectStart: target.start,
    selectEnd: target.start + next.length,
  }
}

export function applyParagraph(element, range) {
  const target = expandToLines(targetState(element, range))
  const lines = toLines(target.value.slice(target.start, target.end))
  const next = lines.map((line) => line.replace(HEADING_RE, '')).join('\n')
  return {
    text: next,
    range: { start: target.start, end: target.end },
    selectStart: target.start,
    selectEnd: target.start + next.length,
  }
}

export function applyQuote(element, range) {
  return toggleLinePrefix(expandToLines(targetState(element, range)), QUOTE_RE, '> ')
}

export function applyBulletList(element, range) {
  return toggleLinePrefix(expandToLines(targetState(element, range)), /^[-*+]\s+/, '- ')
}

export function applyOrderedList(element, range) {
  const target = expandToLines(targetState(element, range))
  const lines = toLines(target.value.slice(target.start, target.end))
  const allHave = lines.every((line) => /^\s*\d+\.\s+/.test(line))
  const next = lines.map((line, index) => (allHave ? stripBlockPrefix(line) : `${index + 1}. ${stripBlockPrefix(line)}`)).join('\n')
  return {
    text: next,
    range: { start: target.start, end: target.end },
    selectStart: target.start,
    selectEnd: target.start + next.length,
  }
}

export function applyTaskList(element, range) {
  const target = expandToLines(targetState(element, range))
  const lines = toLines(target.value.slice(target.start, target.end))
  const allHave = lines.every((line) => TASK_RE.test(line))
  const next = lines.map((line) => (allHave ? stripBlockPrefix(line) : `- [ ] ${stripBlockPrefix(line)}`)).join('\n')
  return {
    text: next,
    range: { start: target.start, end: target.end },
    selectStart: target.start,
    selectEnd: target.start + next.length,
  }
}

export function applyDivider(element, range) {
  const { value, start, end } = targetState(element, range)
  const before = value.slice(0, start)
  const after = value.slice(end)
  const lead = !before || before.endsWith('\n') ? '' : '\n'
  const text = `${lead}---\n`
  const caret = start + text.length
  return { text, selectStart: caret, selectEnd: caret }
}

export function applyCodeBlock(element, range, lang = '') {
  const { value, start, end } = targetState(element, range)
  const selected = value.slice(start, end)
  const fence = '```'

  if (start === end) {
    const body = '// 在这里写代码'
    const text = `${fence}${lang}\n${body}\n${fence}`
    const bodyStart = start + fence.length + lang.length + 1
    return { text, selectStart: bodyStart, selectEnd: bodyStart + body.length, preview: text }
  }

  const text = `${fence}${lang}\n${selected}\n${fence}`
  return {
    text,
    selectStart: start,
    selectEnd: start + text.length,
    preview: `${fence}${lang}\n${selected || '// 你的代码'}\n${fence}`,
    multiline: true,
  }
}

/* ------------------------------------------------------------------ *
 * 行内格式
 * ------------------------------------------------------------------ */

/** 行内标记：有选区就包起来；没选区就插入示例词并选中，直接改写即可 */
function applyInline(element, range, open, close, sample) {
  const { value, start, end } = targetState(element, range)

  if (start === end) {
    const text = open + sample + close
    return {
      text,
      range: { start, end },
      selectStart: start + open.length,
      selectEnd: start + open.length + sample.length,
    }
  }

  const selected = value.slice(start, end)
  // 选区自己就带着这对标记 → 取消
  if (selected.length > open.length + close.length && selected.startsWith(open) && selected.endsWith(close)) {
    const bare = selected.slice(open.length, selected.length - close.length)
    return { text: bare, range: { start, end }, selectStart: start, selectEnd: start + bare.length }
  }
  // 标记在选区外侧 → 连标记一起删掉
  const before = value.slice(Math.max(0, start - open.length), start)
  const after = value.slice(end, end + close.length)
  if (before === open && after === close) {
    const from = start - open.length
    return {
      text: '',
      range: { start: from, end: end + close.length },
      selectStart: from,
      selectEnd: from + (end - start),
    }
  }

  const lead = selected.match(/^\s*/)[0]
  const tail = selected.match(/\s*$/)[0]
  const inner = selected.slice(lead.length, selected.length - tail.length)
  if (!inner) return null
  const text = `${lead}${open}${inner}${close}${tail}`
  // 选中的是「加完标记后的这一段」，接着改字或再点其它样式都符合直觉
  return { text, range: { start, end }, selectStart: start, selectEnd: start + text.length }
}

export function applyBold(element, range) {
  return applyInline(element, range, '**', '**', '加粗文字')
}
export function applyItalic(element, range) {
  return applyInline(element, range, '*', '*', '斜体文字')
}
export function applyStrike(element, range) {
  return applyInline(element, range, '~~', '~~', '要划掉的内容')
}
export function applyInlineCode(element, range) {
  return applyInline(element, range, '`', '`', 'code')
}

const COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^rgba?\([0-9.,%\s]+\)$|^[a-zA-Z]{3,20}$/

export function safeColor(color, fallback) {
  const value = String(color || '').trim()
  return COLOR_RE.test(value) ? value : fallback
}

/** 彩色文字 / 荧光笔：用 <span style> 表达，阅读视图原生支持 */
export function applyColor(element, range, color, type = 'text') {
  const property = type === 'text' ? 'color' : 'background-color'
  const value = safeColor(color, type === 'text' ? '#e11d48' : '#fef08a')
  const open = `<span style="${property}:${value}">`
  const close = '</span>'
  const { value: content, start, end } = targetState(element, range)

  if (start === end) {
    const sample = type === 'text' ? '彩色文字' : '荧光笔标记'
    const text = open + sample + close
    return { text, selectStart: start + open.length, selectEnd: start + open.length + sample.length }
  }

  const selected = content.slice(start, end)
  if (selected.startsWith('<span') && selected.endsWith('</span>')) {
    const bare = selected.replace(/^<span[^>]*>/, '').replace(/<\/span>$/, '')
    return { text: bare, selectStart: start, selectEnd: start + bare.length }
  }

  const lead = selected.match(/^\s*/)[0]
  const tail = selected.match(/\s*$/)[0]
  const inner = selected.slice(lead.length, selected.length - tail.length)
  if (!inner) return null
  const text = `${lead}${open}${inner}${close}${tail}`
  const selectStart = start + lead.length + open.length
  return { text, selectStart, selectEnd: selectStart + inner.length }
}

export function applyLink(element, range) {
  const { value, start, end } = targetState(element, range)
  const placeholder = 'https://'
  if (start === end) {
    const text = `[链接文字](${placeholder})`
    const urlStart = start + text.indexOf(placeholder)
    return {
      text,
      range: { start, end },
      selectStart: urlStart,
      selectEnd: urlStart + placeholder.length,
    }
  }
  const label = value.slice(start, end).replace(/^\s*\[|\]\([^)]*\)\s*$/g, '')
  const text = `[${label}](${placeholder})`
  const urlStart = start + text.indexOf(placeholder)
  return {
    text,
    range: { start, end },
    selectStart: urlStart,
    selectEnd: urlStart + placeholder.length,
  }
}

/** 清掉选中内容里的行内标记，保留纯文字 */
export function applyClearFormat(element, range) {
  const { value, start, end } = targetState(element, range)
  if (start === end) return null
  const lines = toLines(value.slice(start, end))
  const next = lines
    .map((line) =>
      line
        .replace(/<\/?span[^>]*>/gi, '')
        .replace(/\*\*|~~|`|\*|_(?=\S)/g, '')
        .replace(HEADING_RE, '')
        .replace(QUOTE_RE, '')
        .replace(LIST_RE, ''),
    )
    .join('\n')
  return { text: next, range: { start, end }, selectStart: start, selectEnd: start + next.length }
}

/* ------------------------------------------------------------------ *
 * 表格 / 图片
 * ------------------------------------------------------------------ */

export function buildTable(rows, columns, preview = false) {
  const totalRows = Math.min(20, Math.max(1, Number(rows) || 3))
  const totalColumns = Math.min(8, Math.max(1, Number(columns) || 3))
  const header = `| ${Array.from({ length: totalColumns }, (_, index) => (preview ? `表头 ${index + 1}` : `字段 ${index + 1}`)).join(' | ')} |`
  const divider = `| ${Array.from({ length: totalColumns }, () => '---').join(' | ')} |`
  const body = Array.from({ length: totalRows }, (_, rowIndex) =>
    `| ${Array.from({ length: totalColumns }, (_, columnIndex) =>
      preview ? `内容 ${rowIndex + 1}-${columnIndex + 1}` : '　',
    ).join(' | ')} |`,
  )
  return [header, divider, ...body].join('\n')
}

export function applyTable(element, range, rows, columns) {
  const { value, start, end } = targetState(element, range)
  const before = value.slice(0, start)
  const after = value.slice(end)
  const lead = !before || before.endsWith('\n') ? '' : '\n'
  const text = `${lead}${buildTable(rows, columns)}\n`
  const firstCell = start + lead.length + 2
  return {
    text,
    selectStart: firstCell,
    selectEnd: firstCell + '字段 1'.length,
    preview: `${lead}${buildTable(rows, columns, true)}\n`,
    multiline: true,
  }
}

/** 纯函数：给定插入点和图片地址，算出要插入的 Markdown */
export function imageInsertion(value, start, end, src, alt = '笔记配图') {
  const before = value.slice(0, start)
  const lead = !before || before.endsWith('\n') ? '' : '\n'
  const text = `${lead}![${alt}](${src})\n`
  const caret = start + text.length
  return { text, range: { start, end }, selectStart: caret, selectEnd: caret }
}

/* ------------------------------------------------------------------ *
 * 编辑器状态机
 * ------------------------------------------------------------------ */

export function useMarkdownEditor(initialValue = '') {
  const [value, setValue] = useState(initialValue)
  const [, bumpVersion] = useState(0)
  const ref = useRef(null)
  const pending = useRef(null)
  const valueRef = useRef(initialValue)

  /**
   * 历史栈用 ref 直接维护，不走 setState。
   * 原因：一次操作里可能连续产生多个历史点（输入事件 + 落地），
   * 如果用函数式 setState，这些更新会各自基于「同一份旧状态」计算，互相覆盖。
   */
  const historyRef = useRef({
    stack: [{ value: initialValue, start: initialValue.length, end: initialValue.length, at: Date.now() }],
    index: 0,
  })
  /** 打字分组编号：同一段连续打字共用一个编号 */
  const groupRef = useRef(0)

  valueRef.current = value

  const syncHistory = useCallback(() => {
    bumpVersion((prev) => prev + 1)
  }, [])

  /** 记录一个历史点（格式按钮、粘贴等「一次成型」的操作，落地前调用） */
  const pushHistory = useCallback(
    (caret, currentValue) => {
      const element = ref.current
      const current = typeof currentValue === 'string' ? currentValue : valueRef.current
      const start = caret?.start ?? element?.selectionStart ?? current.length
      const end = caret?.end ?? element?.selectionEnd ?? start
      const { stack, index } = historyRef.current
      const previous = stack[index]
      const next = stack.slice(0, index + 1)
      if (!previous || previous.value !== current || previous.start !== start || previous.end !== end) {
        next.push({ value: current, start, end, at: Date.now() })
      }
      const capped = next.slice(-MAX_HISTORY)
      historyRef.current = { stack: capped, index: capped.length - 1 }
      syncHistory()
    },
    [syncHistory],
  )

  /** 当前 textarea 的真实状态（读 DOM，避免闭包里的旧值） */
  const readState = useCallback(() => {
    const element = ref.current
    const current = valueRef.current
    if (!element) return { value: current, start: current.length, end: current.length }
    return stateOf(element)
  }, [])

  const focusAt = useCallback((start, end) => {
    pending.current = { start, end }
    const element = ref.current
    if (element && document.activeElement !== element) element.focus({ preventScroll: true })
  }, [])

  /**
   * 落地一次编辑。
   * result: { text, range?, selectStart?, selectEnd?, cursor? }
   * 返回 false 表示这个操作没有产生任何改动。
   */
  const apply = useCallback(
    (result) => {
      if (!result || typeof result.text !== 'string') return false
      // 先记下「改动之前」的样子，再把新内容压栈
      pushHistory(result.caret)
      const live = readState()
      const range = result.range
        ? {
            start: Math.max(0, Math.min(result.range.start ?? live.start, live.value.length)),
            end: Math.max(0, Math.min(result.range.end ?? live.end, live.value.length)),
          }
        : { start: live.start, end: live.end }
      const nextValue = live.value.slice(0, range.start) + result.text + live.value.slice(range.end)
      const fallback = range.start + result.text.length
      const selection = {
        start: result.selectStart ?? result.cursor ?? fallback,
        end: result.selectEnd ?? result.cursor ?? result.selectStart ?? fallback,
      }
      pending.current = selection
      pushHistory(selection, nextValue)
      setValue(nextValue)
      return true
    },
    [pushHistory, readState],
  )

  /** 读当前 textarea → 跑命令 → 落地 */
  const run = useCallback(
    (command, range) => {
      const element = ref.current
      if (!element) return false
      return apply(command(element, range))
    },
    [apply],
  )

  /** 整段替换（例如把粘贴的富文本转成 Markdown） */
  const replaceAll = useCallback(
    (nextValue) => {
      pushHistory({ start: 0, end: 0 })
      pending.current = { start: nextValue.length, end: nextValue.length }
      pushHistory({ start: nextValue.length, end: nextValue.length }, nextValue)
      setValue(nextValue)
    },
    [pushHistory],
  )

  const restore = useCallback((entry) => {
    if (!entry) return
    pending.current = { start: entry.start, end: entry.end }
    setValue(entry.value)
  }, [])

  /**
   * 撤销：连续打字算作一段，一次撤掉一整段；格式按钮 / 粘贴则一次一步。
   * 分界点是「打字组」：往回找第一格不属于当前打字组的历史点。
   */
  const undo = useCallback(() => {
    const { stack, index } = historyRef.current
    if (index <= 0) return false
    const element = ref.current
    const live = valueRef.current
    const caret = { start: element?.selectionStart ?? live.length, end: element?.selectionEnd ?? live.length }
    const trimmed = stack.slice(0, index + 1)
    trimmed[index] = { ...trimmed[index], ...caret, value: live }

    const headGroup = trimmed[index]?.typing ? trimmed[index].group : null
    let target = -1
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const candidate = trimmed[cursor]
      if (candidate.value === live) continue
      if (headGroup !== null && candidate.group === headGroup) continue
      target = cursor
      break
    }
    if (target < 0) return false

    historyRef.current = { stack: trimmed, index: target }
    restore(trimmed[target])
    syncHistory()
    return true
  }, [restore, syncHistory])

  const redo = useCallback(() => {
    const { stack, index } = historyRef.current
    if (index >= stack.length - 1) return false
    const live = valueRef.current
    let target = -1
    for (let cursor = index + 1; cursor < stack.length; cursor += 1) {
      if (stack[cursor].value !== live) {
        target = cursor
        break
      }
    }
    if (target < 0) return false
    historyRef.current = { stack, index: target }
    restore(stack[target])
    syncHistory()
    return true
  }, [restore, syncHistory])

  /**
   * 连续打字：同一段打字只占一格历史，撤销时整段回退。
   * nextValue 来自 input 事件，此时 React 的 state 还没更新，
   * 必须用它而不是 valueRef，否则历史里留下的是上一个值。
   */
  const noteTyping = useCallback(
    (nextValue) => {
      const element = ref.current
      const incoming = typeof nextValue === 'string' ? nextValue : element?.value ?? valueRef.current
      if (incoming === valueRef.current) return
      const caret = { start: element?.selectionStart ?? incoming.length, end: element?.selectionEnd ?? incoming.length }
      const { stack, index } = historyRef.current
      const top = stack[index]
      const next = stack.slice(0, index + 1)
      // 同一段打字共用一个 group：撤销时整段回退，而不是一个字一个字地退
      if (top && top.typing && top.group === groupRef.current) {
        next[index] = { ...top, ...caret, value: incoming, at: Date.now() }
      } else {
        groupRef.current += 1
        next.push({ value: incoming, ...caret, at: Date.now(), typing: true, group: groupRef.current })
      }
      const capped = next.slice(-MAX_HISTORY)
      historyRef.current = { stack: capped, index: capped.length - 1 }
      syncHistory()
    },
    [syncHistory],
  )

  /** 粘贴 / 拖拽等一次性输入：单独占一格，并作为打字的边界 */
  const noteNativeEdit = useCallback(
    (nextValue) => {
      pushHistory(undefined, nextValue)
    },
    [pushHistory],
  )

  const reset = useCallback(
    (nextValue) => {
      historyRef.current = {
        stack: [{ value: nextValue, start: nextValue.length, end: nextValue.length, at: Date.now() }],
        index: 0,
      }
      syncHistory()
      setValue(nextValue)
    },
    [syncHistory],
  )

  // 落盘后恢复光标：必须在浏览器绘制前完成，否则会看到光标跳一下
  useLayoutEffect(() => {
    const element = ref.current
    const target = pending.current
    if (!element || !target) return
    pending.current = null
    if (document.activeElement !== element) element.focus({ preventScroll: true })
    const max = element.value.length
    const start = Math.max(0, Math.min(target.start ?? max, max))
    const end = Math.max(start, Math.min(target.end ?? start, max))
    try {
      element.setSelectionRange(start, end)
    } catch {
      /* 元素不可见时个别浏览器会抛错，忽略即可 */
    }
  }, [value])

  return {
    value,
    setValue,
    ref,
    apply,
    run,
    readState,
    pushHistory,
    noteNativeEdit,
    noteTyping,
    replaceAll,
    reset,
    undo,
    redo,
    focusAt,
    canUndo: historyRef.current.index > 0,
    canRedo: historyRef.current.index < historyRef.current.stack.length - 1,
  }
}

/* ------------------------------------------------------------------ *
 * 光标坐标测量（浮出小工具条用）
 * ------------------------------------------------------------------ */

const MIRRORED_STYLES = [
  'boxSizing',
  'width',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'letterSpacing',
  'lineHeight',
  'textIndent',
  'textTransform',
  'wordSpacing',
  'wordBreak',
  'overflowWrap',
]

/**
 * 光标在页面上的坐标。
 * 做法：把一个样式（宽度、字体、内边距全部一致）相同的隐藏 div 放到 textarea 的
 * 偏移父元素里，把光标之前的文本塞进去，量一个零宽 span 的位置。
 */
export function useCaretPosition(ref, value) {
  const [position, setPosition] = useState(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      setPosition(null)
      return undefined
    }

    const measure = (kind) => {
      const start = element.selectionStart ?? 0
      const end = element.selectionEnd ?? start
      // 只是光标（没有选中文字）时不浮出，避免打扰
      if (kind === 'selection' && start === end) return
      const host = element.offsetParent
      if (!host || !host.isConnected) {
        setPosition(null)
        return
      }

      const computed = window.getComputedStyle(element)
      const mirror = document.createElement('div')
      MIRRORED_STYLES.forEach((property) => {
        mirror.style[property] = computed[property]
      })
      mirror.style.position = 'absolute'
      mirror.style.left = `${element.offsetLeft}px`
      mirror.style.top = `${element.offsetTop}px`
      mirror.style.height = 'auto'
      mirror.style.minHeight = '0'
      mirror.style.visibility = 'hidden'
      mirror.style.pointerEvents = 'none'
      mirror.style.whiteSpace = 'pre-wrap'
      mirror.textContent = element.value.slice(0, start)
      const marker = document.createElement('span')
      marker.textContent = '\u200b'
      mirror.appendChild(marker)

      const previousPosition = host.style.position
      if (window.getComputedStyle(host).position === 'static') host.style.position = 'relative'
      host.appendChild(mirror)

      const caretTop = marker.offsetTop
      const caretLeft = marker.offsetLeft
      const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.6

      host.removeChild(mirror)
      host.style.position = previousPosition

      const rect = element.getBoundingClientRect()
      setPosition({
        x: rect.left + caretLeft - element.scrollLeft,
        y: rect.top + caretTop - element.scrollTop,
        lineHeight,
      })
    }

    const onSelectionChange = () => {
      if (document.activeElement === element) measure('selection')
    }
    const onFocus = () => measure('force')
    const onBlur = () => setPosition(null)
    const onScroll = () => {
      if (document.activeElement === element) measure('force')
    }

    document.addEventListener('selectionchange', onSelectionChange)
    element.addEventListener('focus', onFocus)
    element.addEventListener('blur', onBlur)
    element.addEventListener('keyup', onSelectionChange)
    element.addEventListener('mouseup', onSelectionChange)
    element.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    let observer = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(onScroll)
      observer.observe(element)
    }

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange)
      element.removeEventListener('focus', onFocus)
      element.removeEventListener('blur', onBlur)
      element.removeEventListener('keyup', onSelectionChange)
      element.removeEventListener('mouseup', onSelectionChange)
      element.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      observer?.disconnect()
    }
  }, [ref, value])

  return position
}
