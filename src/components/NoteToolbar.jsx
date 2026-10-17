import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bold,
  Code,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Palette,
  Quote,
  Redo2,
  Sparkles,
  Strikethrough,
  Table2,
  Undo2,
} from 'lucide-react'
import { HIGHLIGHT_COLORS, TEXT_COLORS } from '../markdown'

/**
 * 笔记格式工具栏。
 * variant：
 *   'full'    弹窗顶部常驻的完整工具栏
 *   'bubble'  选中文字后浮出的小工具条
 *   'palette' 颜色 / 荧光笔取色面板
 */

const GROUP_LABELS = {
  history: '撤销重做',
  block: '段落与标题',
  inline: '文字样式',
  color: '颜色标注',
  list: '列表与引用',
  insert: '插入',
}

const GROUPS = [
  {
    id: 'history',
    items: [
      { id: 'undo', label: '撤销', title: '撤销（Ctrl+Z）', icon: Undo2 },
      { id: 'redo', label: '重做', title: '重做（Ctrl+Shift+Z）', icon: Redo2 },
    ],
  },
  {
    id: 'block',
    items: [
      { id: 'h1', label: '大标题', title: '一级标题（Ctrl+1）', icon: Heading1 },
      { id: 'h2', label: '中标题', title: '二级标题（Ctrl+2）', icon: Heading2 },
      { id: 'h3', label: '小标题', title: '三级标题（Ctrl+3）', icon: Heading3 },
    ],
  },
  {
    id: 'inline',
    items: [
      { id: 'bold', label: '加粗', title: '加粗（Ctrl+B）', icon: Bold },
      { id: 'italic', label: '斜体', title: '斜体（Ctrl+I）', icon: Italic },
      { id: 'strike', label: '删除线', title: '删除线（Ctrl+Shift+X）', icon: Strikethrough },
      { id: 'code', label: '行内代码', title: '行内代码（Ctrl+E）', icon: Code },
    ],
  },
  {
    id: 'color',
    items: [
      { id: 'palette', label: '文字颜色', title: '给文字选个颜色', icon: Palette, popover: 'text' },
      { id: 'highlight', label: '荧光笔', title: '像荧光笔一样划重点', icon: Highlighter, popover: 'highlight' },
    ],
  },
  {
    id: 'list',
    items: [
      { id: 'quote', label: '引用', title: '引用（Ctrl+Shift+Q）', icon: Quote },
      { id: 'bullet', label: '圆点列表', title: '圆点列表（Ctrl+Shift+8）', icon: List },
      { id: 'ordered', label: '数字列表', title: '数字列表（Ctrl+Shift+7）', icon: ListOrdered },
      { id: 'todo', label: '待办清单', title: '待办清单（Ctrl+Shift+9）', icon: ListTodo },
    ],
  },
  {
    id: 'insert',
    items: [
      { id: 'codeblock', label: '代码块', title: '插入代码块（Ctrl+Shift+C）', icon: Sparkles },
      { id: 'table', label: '表格', title: '插入表格', icon: Table2 },
      { id: 'image', label: '图片', title: '插入图片（Ctrl+Shift+P）', icon: ImageIcon },
      { id: 'link', label: '链接', title: '插入链接（Ctrl+K）', icon: Link },
      { id: 'divider', label: '分隔线', title: '插入分隔线', icon: Minus },
    ],
  },
]

const ALL_ITEMS = GROUPS.flatMap((group) => group.items)

const BUBBLE_IDS = ['bold', 'italic', 'strike', 'palette', 'highlight', 'code', 'quote', 'link', 'clear']

const BUBBLE_ITEMS = BUBBLE_IDS.map((id) => ALL_ITEMS.find((item) => item.id === id)).filter(Boolean)

const DISABLED = { undo: 'canUndo', redo: 'canRedo' }

export function ToolbarButton({ item, active, disabled, compact, onMouseDown, onClick }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      title={item.title || item.label}
      aria-label={item.label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault()
        onMouseDown?.(event)
      }}
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center rounded-xl transition ${
        compact ? 'h-8 w-8' : 'h-9 w-9'
      } ${
        disabled
          ? 'cursor-not-allowed text-ink-300'
          : active
            ? 'bg-amber-100 text-wood-700 ring-1 ring-amber-200'
            : 'text-ink-500 hover:bg-amber-50 hover:text-wood-700 active:scale-95'
      }`}
    >
      <Icon className={compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
    </button>
  )
}

function ToolbarShell({ children, className = '', variant }) {
  return (
    <div
      data-note-toolbar={variant}
      className={`flex items-center gap-0.5 rounded-2xl bg-white/95 px-2 py-1.5 shadow-sm ring-1 ring-cream-200 backdrop-blur ${className}`}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 取色面板
 * ------------------------------------------------------------------ */

export function ColorPalette({ type, onPick, onClose, className = '' }) {
  const isHighlight = type === 'highlight'
  const presets = isHighlight ? HIGHLIGHT_COLORS : TEXT_COLORS
  const boxRef = useRef(null)

  useEffect(() => {
    const onPointerDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [onClose])

  return (
    <div ref={boxRef} className={`w-[268px] rounded-2xl bg-white p-3 shadow-xl ring-1 ring-cream-200 ${className}`}>
      <div className="flex items-center justify-between px-0.5">
        <p className="text-xs font-bold text-ink-600">{isHighlight ? '🖍️ 荧光笔底色' : '🎨 文字颜色'}</p>
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault()
            onPick('')
          }}
          className="rounded-md px-1.5 py-0.5 text-[11px] text-ink-400 transition hover:bg-cream-100 hover:text-ink-700"
        >
          取消颜色
        </button>
      </div>
      <div className="mt-2 grid grid-cols-9 gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            title={preset.label}
            aria-label={preset.label}
            onPointerDown={(event) => {
              // 用 pointerdown 立即生效：按下之后布局可能变化，click 会丢
              event.preventDefault()
              onPick(preset.value)
            }}
            className="h-6 w-6 rounded-full ring-1 ring-inset ring-black/10 transition hover:scale-110 active:scale-95"
            style={{ backgroundColor: preset.value }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2 border-t border-cream-200 pt-2.5">
        <label className="flex flex-1 items-center gap-2 rounded-xl bg-cream-50 px-2 py-1.5 text-[11px] text-ink-500 ring-1 ring-cream-200">
          <span className="shrink-0 font-semibold">自定义颜色</span>
          <input
            type="color"
            defaultValue={isHighlight ? '#fef08a' : '#e11d48'}
            onInput={(event) => onPick(event.target.value)}
            className="h-6 w-9 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
            aria-label={isHighlight ? '自定义荧光笔底色' : '自定义文字颜色'}
          />
        </label>
        {!isHighlight && (
          <p className="hidden shrink-0 text-[10px] leading-tight text-ink-300 sm:block">
            选中文字
            <br />
            再点颜色
          </p>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 弹窗顶部：常驻完整工具栏
 * ------------------------------------------------------------------ */

export default function NoteToolbar({
  onCommand,
  onOpenImagePicker,
  onSaveRange,
  canUndo = true,
  canRedo = true,
  activePopover = null,
  popoverOwner = null,
  onTogglePopover,
  className = '',
}) {
  const [paletteStyle, setPaletteStyle] = useState(null)
  const paletteAnchor = useRef(null)
  const showPalette = Boolean(activePopover) && popoverOwner === 'bar'
  const openPalette = (type) => () => {
    onTogglePopover?.(activePopover === type && popoverOwner === 'bar' ? null : type, 'bar')
  }

  useLayoutEffect(() => {
    if (!showPalette) return
    const rect = paletteAnchor.current?.getBoundingClientRect()
    if (!rect) return
    const width = 268
    const margin = 12
    let left = rect.right - width
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
    setPaletteStyle({ left, top: rect.bottom + 8 })
  }, [showPalette])

  return (
    <div className="relative">
      <ToolbarShell variant="bar" className={`flex-wrap ${className}`}>
        {GROUPS.map((group, groupIndex) => (
          <div key={group.id} className="flex shrink-0 items-center">
            {groupIndex > 0 && <span className="mx-1 h-5 w-px shrink-0 bg-cream-200" />}
            <div ref={group.id === 'color' ? paletteAnchor : null} className="flex shrink-0 items-center" title={GROUP_LABELS[group.id]}>
              {group.items.map((item) => (
                <ToolbarButton
                  key={item.id}
                  item={item}
                  disabled={DISABLED[item.id] ? !(DISABLED[item.id] === 'canUndo' ? canUndo : canRedo) : false}
                  active={Boolean(item.popover) && showPalette && activePopover === item.popover}
                  onMouseDown={onSaveRange}
                  onClick={() => (item.popover ? openPalette(item.popover)() : item.id === 'image' ? onOpenImagePicker?.() : onCommand(item.id))}
                />
              ))}
            </div>
          </div>
        ))}
      </ToolbarShell>

      {showPalette &&
        paletteStyle &&
        createPortal(
          <div className="fixed z-[90]" style={{ left: paletteStyle.left, top: paletteStyle.top }}>
            <ColorPalette
              type={activePopover}
              onPick={(color) => {
                onCommand(activePopover === 'highlight' ? 'highlight' : 'color', color)
                onTogglePopover?.(null, null)
              }}
              onClose={() => onTogglePopover?.(null, null)}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 选中文字后浮出的小工具条
 * ------------------------------------------------------------------ */

export function SelectionBubble({
  position,
  onCommand,
  onSaveRange,
  activePopover = null,
  popoverOwner = null,
  onTogglePopover,
  onClose,
}) {
  const ref = useRef(null)
  const [style, setStyle] = useState(null)
  const showPalette = Boolean(activePopover) && popoverOwner === 'bubble'

  useLayoutEffect(() => {
    if (!position || !ref.current) {
      setStyle(null)
      return
    }
    const rect = ref.current.getBoundingClientRect()
    const width = rect.width || 300
    const height = rect.height || 44
    const margin = 12
    let left = position.x - width / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
    const lineBottom = position.y + (position.lineHeight || 22)
    const top = lineBottom + height + 8 < window.innerHeight ? lineBottom + 4 : Math.max(margin, position.y - height - 8)
    setStyle({ left, top })
  }, [position])

  useEffect(() => {
    if (!position) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [position, onClose])

  if (!position) return null

  // 渲染到 body：弹窗有 pop-in 动画，带 transform 的祖先会让 position:fixed 失效
  return createPortal(
    <div ref={ref} data-note-bubble="" className="note-bubble fixed z-[70]" style={style || { left: -9999, top: -9999 }}>
      <ToolbarShell variant="bubble" className="!shadow-xl">
        {BUBBLE_ITEMS.map((item) => (
          <ToolbarButton
            key={item.id}
            item={item}
            compact
            active={Boolean(item.popover) && showPalette && activePopover === item.popover}
            onMouseDown={onSaveRange}
            onClick={() =>
              item.popover
                ? onTogglePopover?.(activePopover === item.popover && popoverOwner === 'bubble' ? null : item.popover, 'bubble')
                : onCommand(item.id)
            }
          />
        ))}
        <span className="mx-1 h-5 w-px bg-cream-200" />
        <ToolbarButton
          item={{ id: 'clear', label: '清除样式', title: '清除选中文字的格式', icon: Eraser }}
          compact
          onMouseDown={onSaveRange}
          onClick={() => onCommand('clear')}
        />
      </ToolbarShell>
      {showPalette && (
        <ColorPalette
          type={activePopover}
          className="absolute left-0 top-full mt-2"
          onPick={(color) => {
            onCommand(activePopover === 'highlight' ? 'highlight' : 'color', color)
            onTogglePopover?.(null, null)
          }}
          onClose={() => onTogglePopover?.(null, null)}
        />
      )}
    </div>,
    document.body,
  )
}
