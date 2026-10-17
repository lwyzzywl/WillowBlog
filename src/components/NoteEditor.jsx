import { useEffect, useMemo, useState } from 'react'
import { toast } from '../hooks'
import {
  applyBold,
  applyBulletList,
  applyClearFormat,
  applyCodeBlock,
  applyColor,
  applyDivider,
  applyHeading,
  applyInlineCode,
  applyItalic,
  applyLink,
  applyOrderedList,
  applyParagraph,
  applyQuote,
  applyStrike,
  applyTable,
  applyTaskList,
  imageInsertion,
  useCaretPosition,
  useMarkdownEditor,
} from '../editor'
import { renderMarkdown } from '../markdown'
import NoteToolbar, { SelectionBubble } from './NoteToolbar'

/** 一次读入的图片上限：存进 localStorage，太大就存不下了 */
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024

const PREVIEW_MODES = [
  { id: 'edit', label: '编写' },
  { id: 'split', label: '对照' },
  { id: 'preview', label: '预览' },
]

const SHORTCUTS = [
  ['Ctrl + B', '加粗'],
  ['Ctrl + I', '斜体'],
  ['Ctrl + E', '行内代码'],
  ['Ctrl + K', '链接'],
  ['Ctrl + Shift + C', '代码块'],
  ['Ctrl + 1 / 2 / 3', '标题级别'],
  ['Ctrl + Shift + Q', '引用'],
  ['Ctrl + Shift + 8 / 7', '圆点 / 数字列表'],
  ['Ctrl + Shift + 9', '待办清单'],
  ['Ctrl + Z / Ctrl + Shift + Z', '撤销 / 重做'],
]

/** 把粘贴进来的富文本降级成轻量 Markdown，尽量不打断写作 */
function htmlToMarkdown(html) {
  return html
    .replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, (match, tag, text) => `\n${'#'.repeat(Number(tag[1]))} ${text.trim()}\n\n`)
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<(del|s|strike)[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '\n![]($1)\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<\/(p|div|li|ul|ol|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 预览；稍微防抖一下，避免每敲一个字就重排整篇 */
function PreviewBody({ value }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(false)
    const timer = setTimeout(() => setReady(true), 240)
    return () => clearTimeout(timer)
  }, [value])
  if (!ready) return <p className="text-sm text-ink-300">排版中…</p>
  return renderMarkdown(value)
}

function PreviewPane({ value, className = '' }) {
  return (
    <div className={`overflow-y-auto rounded-2xl bg-cream-50/70 p-4 ring-1 ring-cream-200 ${className}`}>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-300">预览效果</p>
      {value.trim() ? (
        <PreviewBody value={value} />
      ) : (
        <p className="text-sm text-ink-300">左边写点什么，这里就会变成排版好的样子 ✨</p>
      )}
    </div>
  )
}

export default function NoteEditor({ initialValue = '', onContentChange }) {
  const editor = useMarkdownEditor(initialValue)
  const { value, ref: textareaRef, run } = editor
  const [mode, setMode] = useState('edit')
  const [fullscreen, setFullscreen] = useState(false)
  const [popover, setPopover] = useState(null)
  const [popoverOwner, setPopoverOwner] = useState(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [savedRange, setSavedRange] = useState(null)
  const caret = useCaretPosition(textareaRef, value)

  useEffect(() => {
    onContentChange?.(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  /**
   * 同步「上次看到的选区」。
   * 键盘、鼠标、粘贴等操作都会移动光标，必须随时跟上；否则格式按钮会作用到旧位置。
   */
  useEffect(() => {
    const onSelectionChange = () => {
      const element = textareaRef.current
      if (!element || document.activeElement !== element) return
      setSavedRange((prev) =>
        prev && prev.start === element.selectionStart && prev.end === element.selectionEnd
          ? prev
          : { start: element.selectionStart ?? 0, end: element.selectionEnd ?? 0 },
      )
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [textareaRef])

  const rememberSelection = () => {
    const element = textareaRef.current
    if (!element) return
    setSavedRange({ start: element.selectionStart ?? 0, end: element.selectionEnd ?? 0 })
  }

  const commandRange = () => savedRange

  const insertImageFromFile = (file, range) => {
    const element = textareaRef.current
    if (!element || !file) return
    if (!file.type.startsWith('image/')) {
      toast('这个文件不是图片哦，换一张试试 🖼️')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast('图片有点大（超过 1.5MB），先压缩一下再放进来吧')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const target = range ?? { start: element.selectionStart ?? 0, end: element.selectionEnd ?? 0 }
      const alt = file.name.replace(/\.[^.]+$/, '') || '笔记配图'
      editor.apply(imageInsertion(element.value, target.start, target.end, String(reader.result), alt))
      toast('图片已插入 ✨')
    }
    reader.onerror = () => toast('图片读取失败，请重试')
    reader.readAsDataURL(file)
  }

  const runCommand = (id, payload) => {
    const element = textareaRef.current
    if (!element) return
    const range = commandRange()
    switch (id) {
      case 'undo':
        if (!editor.undo()) toast('已经是最早的状态啦')
        break
      case 'redo':
        if (!editor.redo()) toast('没有可以重做的内容')
        break
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
        run((el, r) => applyHeading(el, Number(id[1]), r), range)
        break
      case 'paragraph':
        run((el, r) => applyParagraph(el, r), range)
        break
      case 'bold':
        run((el, r) => applyBold(el, r), range)
        break
      case 'italic':
        run((el, r) => applyItalic(el, r), range)
        break
      case 'strike':
        run((el, r) => applyStrike(el, r), range)
        break
      case 'code':
        run((el, r) => applyInlineCode(el, r), range)
        break
      case 'quote':
        run((el, r) => applyQuote(el, r), range)
        break
      case 'bullet':
        run((el, r) => applyBulletList(el, r), range)
        break
      case 'ordered':
        run((el, r) => applyOrderedList(el, r), range)
        break
      case 'todo':
        run((el, r) => applyTaskList(el, r), range)
        break
      case 'codeblock':
        run((el, r) => applyCodeBlock(el, r), range)
        break
      case 'divider':
        run((el, r) => applyDivider(el, r), range)
        break
      case 'table':
        run((el, r) => applyTable(el, r, 3, 3), range)
        break
      case 'link':
        run((el, r) => applyLink(el, r), range)
        break
      case 'color':
        if (!payload) {
          run((el, r) => applyClearFormat(el, r), range)
          toast('已恢复默认颜色')
          break
        }
        run((el, r) => applyColor(el, r, payload, 'text'), range)
        break
      case 'highlight':
        if (!payload) {
          run((el, r) => applyClearFormat(el, r), range)
          toast('已去掉荧光笔标记')
          break
        }
        run((el, r) => applyColor(el, r, payload, 'highlight'), range)
        break
      case 'clear':
        if (!run((el, r) => applyClearFormat(el, r), range)) toast('先选中一段文字，再清除样式')
        break
      default:
        break
    }
    setPopover(null)
    setPopoverOwner(null)
  }

  const openImagePicker = () => {
    const element = textareaRef.current
    const range = element ? { start: element.selectionStart ?? 0, end: element.selectionEnd ?? 0 } : { start: 0, end: 0 }
    setSavedRange(range)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) insertImageFromFile(file, range)
    }
    input.click()
  }

  useEffect(() => {
    if (!showShortcuts) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowShortcuts(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showShortcuts])

  useEffect(() => {
    if (mode === 'preview') {
      setPopover(null)
      setPopoverOwner(null)
    }
  }, [mode])

  const onKeyDown = (event) => {
    const meta = event.ctrlKey || event.metaKey
    if (!meta) return
    rememberSelection()
    const range = { start: event.currentTarget.selectionStart ?? 0, end: event.currentTarget.selectionEnd ?? 0 }
    setSavedRange(range)
    const lower = event.key.toLowerCase()
    const combo = (fn, condition = true) => {
      if (!condition) return false
      event.preventDefault()
      fn()
      return true
    }

    if (!event.shiftKey && !event.altKey) {
      if (lower === 'b') return combo(() => run((el, r) => applyBold(el, r), range))
      if (lower === 'i') return combo(() => run((el, r) => applyItalic(el, r), range))
      if (lower === 'e') return combo(() => run((el, r) => applyInlineCode(el, r), range))
      if (lower === 'k') return combo(() => run((el, r) => applyLink(el, r), range))
      if (event.key === '1' || event.key === '2' || event.key === '3' || event.key === '4') {
        const level = Number(event.key)
        return combo(() => run((el, r) => applyHeading(el, level, r), range))
      }
      if (event.key === '0') return combo(() => run((el, r) => applyParagraph(el, r), range))
    }

    if (event.shiftKey && !event.altKey) {
      if (lower === 'c') return combo(() => run((el, r) => applyCodeBlock(el, r), range))
      if (lower === 'x') return combo(() => run((el, r) => applyStrike(el, r), range))
      if (lower === 'q') return combo(() => run((el, r) => applyQuote(el, r), range))
      if (lower === 'p') return combo(() => openImagePicker())
      if (event.key === '8' || event.key === '*') return combo(() => run((el, r) => applyBulletList(el, r), range))
      if (event.key === '7' || event.key === '&') return combo(() => run((el, r) => applyOrderedList(el, r), range))
      if (event.key === '9' || event.key === '(') return combo(() => run((el, r) => applyTaskList(el, r), range))
    }
    return undefined
  }

  const onPaste = (event) => {
    const html = event.clipboardData?.getData('text/html')
    const image = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'))
    if (image) {
      const file = image.getAsFile()
      if (file) {
        event.preventDefault()
        const element = textareaRef.current
        insertImageFromFile(file, { start: element?.selectionStart ?? 0, end: element?.selectionEnd ?? 0 })
        return
      }
    }
    if (!html) {
      editor.noteNativeEdit()
      return
    }
    event.preventDefault()
    const markdown = htmlToMarkdown(html)
    editor.apply({ text: markdown })
    toast('已把粘贴的富文本转成 Markdown 🪄')
  }

  const bubbleVisible = mode !== 'preview' && Boolean(caret) && savedRange && savedRange.start !== savedRange.end

  const preview = useMemo(() => <PreviewPane value={value} className="min-h-[220px] flex-1" />, [value])

  return (
    <div className={fullscreen ? 'fixed inset-0 z-[70] flex flex-col gap-3 bg-cream-50 p-3 sm:p-5' : 'mt-1.5 flex flex-col gap-2'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-cream-100 p-1 ring-1 ring-cream-200">
          {PREVIEW_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                mode === item.id ? 'bg-white text-wood-700 shadow-sm' : 'text-ink-400 hover:text-ink-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden text-[11px] text-ink-300 xl:inline">选中文字 → 点按钮 → 立刻套上样式</span>
          <button
            type="button"
            onClick={() => setFullscreen((prev) => !prev)}
            className="rounded-full bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink-500 ring-1 ring-cream-200 transition hover:bg-cream-200 hover:text-ink-700"
          >
            {fullscreen ? '退出全屏' : '全屏编写'}
          </button>
          {fullscreen && (
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-600"
            >
              完成
            </button>
          )}
        </div>
      </div>

      {mode !== 'preview' && (
        <div className="sticky top-0 z-30">
          <NoteToolbar
            onCommand={runCommand}
            onOpenImagePicker={openImagePicker}
            onSaveRange={rememberSelection}
            canUndo={editor.canUndo}
            canRedo={editor.canRedo}
            activePopover={popover}
            popoverOwner={popoverOwner}
            onTogglePopover={(type, owner) => {
              setPopover(type)
              setPopoverOwner(owner ?? null)
            }}
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setShowShortcuts((prev) => !prev)}
            className="absolute right-0 top-full mt-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-ink-300 transition hover:bg-cream-100 hover:text-ink-700"
          >
            格式说明 / 快捷键
          </button>
          {showShortcuts && (
            <div className="absolute right-0 top-full z-[80] mt-2 w-80 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-cream-200">
              <p className="font-display text-sm font-bold text-ink-700">不用记语法，点按钮就行</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
                选中文字再点按钮 → 直接给这段文字套样式；不选文字 → 插入示例内容，接着打字就会替换它。
              </p>
              <ul className="mt-3 space-y-1">
                {SHORTCUTS.map(([keys, label]) => (
                  <li key={keys} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-ink-500">{keys}</span>
                    <span className="text-ink-400">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className={`flex gap-3 ${mode === 'split' ? 'flex-col xl:flex-row' : ''} ${fullscreen ? 'min-h-0 flex-1' : ''}`}>
        {mode !== 'preview' && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              rememberSelection()
              editor.setValue(event.target.value)
            }}
            onInput={(event) => {
              if (event.nativeEvent?.inputType !== 'insertFromPaste') editor.noteTyping(event.currentTarget.value)
            }}
            onBeforeInput={(event) => {
              // 浏览器原生撤销也走我们这套历史，保证「点按钮插入的格式」能被撤掉
              const type = event.nativeEvent?.inputType
              if (type !== 'historyUndo' && type !== 'historyRedo') return
              event.preventDefault()
              if (type === 'historyUndo') {
                if (!editor.undo()) toast('已经回到最早的状态啦')
              } else if (!editor.redo()) {
                toast('没有可以重做的内容')
              }
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onSelect={(event) => {
              setSavedRange({ start: event.currentTarget.selectionStart ?? 0, end: event.currentTarget.selectionEnd ?? 0 })
            }}
            onKeyUp={(event) => {
              setSavedRange({ start: event.currentTarget.selectionStart ?? 0, end: event.currentTarget.selectionEnd ?? 0 })
            }}
            onMouseUp={(event) => {
              setSavedRange({ start: event.currentTarget.selectionStart ?? 0, end: event.currentTarget.selectionEnd ?? 0 })
            }}
            rows={fullscreen ? undefined : 10}
            data-note-input=""
            placeholder={'把想记的东西写在这里…\n\n选中文字后，上面点一下就能加粗、上色、变引用或转成代码。'}
            spellCheck={false}
            className={`w-full resize-y rounded-2xl bg-cream-50 px-3.5 py-3 font-mono text-sm leading-relaxed text-ink-700 ring-1 ring-cream-200 transition placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-amber-300 ${
              mode === 'split' ? 'xl:w-1/2' : ''
            } ${fullscreen ? 'min-h-0 flex-1 resize-none' : ''}`}
          />
        )}
        {mode === 'split' && preview}
        {mode === 'preview' && <PreviewPane value={value} className={fullscreen ? 'min-h-0 flex-1' : 'min-h-[220px]'} />}
      </div>

      {mode !== 'preview' && bubbleVisible && (
        <SelectionBubble
          position={caret}
          onCommand={runCommand}
          onSaveRange={rememberSelection}
          activePopover={popover}
          popoverOwner={popoverOwner}
          onTogglePopover={(type, owner) => {
            setPopover(type)
            setPopoverOwner(owner ?? null)
          }}
          onClose={() => setSavedRange(null)}
        />
      )}
    </div>
  )
}
