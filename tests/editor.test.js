import { describe, expect, it } from 'vitest'
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
  buildTable,
  imageInsertion,
  safeColor,
} from '../src/editor'

/** 伪造一个 textarea，只提供这些函数需要的字段 */
function fakeElement(value, start, end = start) {
  return { value, selectionStart: start, selectionEnd: end }
}

const SAMPLE = 'TCP 三次握手是为了确认双方收发能力'

describe('行内格式（有选区）', () => {
  const cases = [
    ['加粗', applyBold, '**三次握手**'],
    ['斜体', applyItalic, '*三次握手*'],
    ['删除线', applyStrike, '~~三次握手~~'],
    ['行内代码', applyInlineCode, '`三次握手`'],
  ]

  it.each(cases)('%s 只包裹选中的文字', (_name, apply, wrapped) => {
    const result = apply(fakeElement(SAMPLE, 4, 8))
    expect(result.text).toBe(wrapped)
    expect(result.range).toEqual({ start: 4, end: 8 })
    // 操作完成后选中「刚加好标记的这一段」，方便继续叠加其它样式
    expect(result.selectStart).toBe(4)
    expect(result.selectEnd).toBe(4 + wrapped.length)
  })

  it('已经加粗过再点一次会取消，而不是叠加', () => {
    const line = 'TCP **三次握手**是'
    const from = line.indexOf('**')
    const to = from + '**三次握手**'.length
    const result = applyBold(fakeElement(line, from, to))
    expect(result.text).toBe('三次握手')
    expect(result.range).toEqual({ start: from, end: to })
    expect(result.selectStart).toBe(from)
    expect(result.selectEnd).toBe(from + '三次握手'.length)
  })

  it('标记在选区外侧时一起删掉', () => {
    const line = 'TCP **三次握手**是'
    const innerStart = line.indexOf('三次握手')
    const result = applyBold(fakeElement(line, innerStart, innerStart + 4))
    expect(result.text).toBe('')
    // 删掉的范围正好覆盖 **三次握手**
    expect(result.range).toEqual({ start: innerStart - 2, end: innerStart + 4 + 2 })
    expect(result.selectStart).toBe(innerStart - 2)
    // 光标停在原选区结束的位置（两个 ** 被删掉后左移了 2）
    expect(result.selectEnd).toBe(innerStart + 4 - 2)
  })

  it('链接用选中文字作标题，并选中占位 URL', () => {
    const append = applyLink(fakeElement(SAMPLE, 4, 8))
    expect(append.text).toBe('[三次握手](https://)')
    expect(append.range).toEqual({ start: 4, end: 8 })
    // selectStart/selectEnd 是「替换后的绝对位置」，直接在新文本上校验
    const replaced = SAMPLE.slice(0, 4) + append.text + SAMPLE.slice(8)
    expect(replaced.slice(append.selectStart, append.selectEnd)).toBe('https://')

    const empty = applyLink(fakeElement('', 0))
    expect(empty.text).toBe('[链接文字](https://)')
    expect(empty.text.slice(empty.selectStart, empty.selectEnd)).toBe('https://')
  })
})

describe('行内格式（无选区）', () => {
  it('插入示例文字并自动选中，直接打字即可替换', () => {
    const result = applyBold(fakeElement('', 0))
    expect(result.text).toBe('**加粗文字**')
    expect(result.selectStart).toBe(2)
    expect(result.selectEnd).toBe(6)
  })

  it('彩色文字插入 span 并选中示例', () => {
    const result = applyColor(fakeElement('', 0), undefined, '#2563eb', 'text')
    expect(result.text).toBe('<span style="color:#2563eb">彩色文字</span>')
    expect(result.selectStart).toBe('<span style="color:#2563eb">'.length)
  })

  it('荧光笔用 background-color', () => {
    const result = applyColor(fakeElement('', 0), undefined, '#fef08a', 'highlight')
    expect(result.text).toBe('<span style="background-color:#fef08a">荧光笔标记</span>')
  })
})

describe('颜色安全处理', () => {
  it('非法颜色值回退到默认色，避免注入任意 HTML 属性', () => {
    const evil = 'red"><script>alert(1)</script>'
    expect(safeColor(evil, '#e11d48')).toBe('#e11d48')
    const result = applyColor(fakeElement('文字', 0, 2), undefined, evil, 'text')
    expect(result.text).toBe('<span style="color:#e11d48">文字</span>')
    expect(result.text).not.toContain('script')
  })

  it('接受合法的 hex / rgb / 颜色名', () => {
    expect(safeColor('#abc', '#000')).toBe('#abc')
    expect(safeColor('rgba(1,2,3,0.5)', '#000')).toBe('rgba(1,2,3,0.5)')
    expect(safeColor('tomato', '#000')).toBe('tomato')
  })
})

describe('块级格式（整行生效）', () => {
  it('标题作用于整行，即使只选中了几个字', () => {
    const result = applyHeading(fakeElement(SAMPLE, 4, 8), 2)
    expect(result.text).toBe(`## ${SAMPLE}`)
    expect(result.range).toEqual({ start: 0, end: SAMPLE.length })
  })

  it('再点一次同一个标题级别会取消', () => {
    const result = applyHeading(fakeElement(`## ${SAMPLE}`, 6, 8), 2)
    expect(result.text).toBe(SAMPLE)
  })

  it('切换标题级别时替换而不是叠加', () => {
    const result = applyHeading(fakeElement(`# ${SAMPLE}`, 4, 6), 3)
    expect(result.text).toBe(`### ${SAMPLE}`)
  })

  it('引用 / 圆点 / 数字 / 待办都能加到整行', () => {
    expect(applyQuote(fakeElement(SAMPLE, 4, 8)).text).toBe(`> ${SAMPLE}`)
    expect(applyBulletList(fakeElement(SAMPLE, 4, 8)).text).toBe(`- ${SAMPLE}`)
    expect(applyOrderedList(fakeElement(SAMPLE, 4, 8)).text).toBe(`1. ${SAMPLE}`)
  })

  it('多行列表会按顺序编号', () => {
    const result = applyOrderedList(fakeElement('甲\n乙\n丙', 0, 5))
    expect(result.text).toBe('1. 甲\n2. 乙\n3. 丙')
  })

  it('取消引用时移除前缀', () => {
    expect(applyQuote(fakeElement(`> ${SAMPLE}`, 2, 4)).text).toBe(SAMPLE)
  })

  it('段落按钮清掉标题前缀', () => {
    expect(applyParagraph(fakeElement(`### ${SAMPLE}`, 0, 5)).text).toBe(SAMPLE)
  })

  it('分隔线另起一行插入', () => {
    const result = applyDivider(fakeElement(SAMPLE, SAMPLE.length))
    expect(result.text).toBe('\n---\n')
  })

  it('清除格式会去掉行内标记与行前缀', () => {
    const result = applyClearFormat(fakeElement('# **加粗** 和 `代码`', 0, 18))
    expect(result.text).toBe('加粗 和 代码')
  })
})

describe('代码块', () => {
  it('把选中内容包进围栏', () => {
    const result = applyCodeBlock(fakeElement(SAMPLE, 4, 8))
    expect(result.text).toBe('```\n三次握手\n```')
  })

  it('无选区时插入空代码块并把光标放进代码行', () => {
    const result = applyCodeBlock(fakeElement('', 0))
    expect(result.text).toBe('```\n// 在这里写代码\n```')
    expect(result.selectStart).toBe(4)
    expect(result.selectEnd).toBe(4 + '// 在这里写代码'.length)
  })
})

describe('表格', () => {
  it('生成表头 + 分隔行 + 指定行数的空表格', () => {
    const table = buildTable(2, 3).split('\n')
    expect(table).toHaveLength(4) // 表头 + 分隔 + 2 行
    expect(table[0]).toBe('| 字段 1 | 字段 2 | 字段 3 |')
    expect(table[1]).toBe('| --- | --- | --- |')
  })

  it('行列数被限制在合理范围，防止生成超大表格', () => {
    expect(buildTable(999, 999).split('\n')).toHaveLength(22) // 表头 + 分隔 + 最多 20 行
    // 非法输入回退到默认 3×3（表头 + 分隔 + 3 行）
    expect(buildTable(0, 0).split('\n')).toHaveLength(5)
  })

  it('插入后选中第一个表头单元格便于直接改写', () => {
    const result = applyTable(fakeElement('', 0), undefined, 3, 3)
    expect(result.text.startsWith('| 字段 1 |')).toBe(true)
    expect(result.text.slice(result.selectStart, result.selectEnd)).toBe('字段 1')
  })
})

describe('图片', () => {
  it('在光标处另起一行插入 Markdown 图片', () => {
    const result = imageInsertion(SAMPLE, SAMPLE.length, SAMPLE.length, 'data:image/png;base64,AAA', '配图')
    expect(result.text).toBe('\n![配图](data:image/png;base64,AAA)\n')
    expect(result.range).toEqual({ start: SAMPLE.length, end: SAMPLE.length })
  })
})

describe('变换结果始终可安全落盘', () => {
  it('所有操作都返回字符串 text，不会返回 undefined', () => {
    const operations = [
      () => applyBold(fakeElement(SAMPLE, 4, 8)),
      () => applyItalic(fakeElement(SAMPLE, 4, 8)),
      () => applyStrike(fakeElement(SAMPLE, 4, 8)),
      () => applyInlineCode(fakeElement(SAMPLE, 4, 8)),
      () => applyQuote(fakeElement(SAMPLE, 4, 8)),
      () => applyHeading(fakeElement(SAMPLE, 4, 8), 1),
      () => applyTable(fakeElement('', 0), undefined, 2, 2),
      () => applyDivider(fakeElement('', 0)),
      () => applyCodeBlock(fakeElement('', 0)),
    ]
    operations.forEach((run) => {
      const result = run()
      expect(typeof result.text).toBe('string')
    })
  })

  it('空选区上的清除格式返回 null（由调用方提示用户先选中）', () => {
    expect(applyClearFormat(fakeElement(SAMPLE, 3, 3))).toBeNull()
  })
})
