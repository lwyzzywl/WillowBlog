import { useMemo, useState } from 'react'
import { buildHeatmap, HEAT_COLORS } from '../data'

const CELL = 11
const GAP = 3
const STRIDE = CELL + GAP

export default function Heatmap({ checkins, today }) {
  const { weeks, labels, activeDays } = useMemo(
    () => buildHeatmap(today, checkins),
    [today, checkins],
  )
  const [hovered, setHovered] = useState(null)

  const infoText = hovered
    ? `${hovered.date.getFullYear()} 年 ${hovered.date.getMonth() + 1} 月 ${hovered.date.getDate()} 日 · 学习 ${hovered.count} 次 ${
        hovered.level > 0 ? '✨' : '💤'
      }`
    : `过去 365 天里，你一共打卡了 ${activeDays} 天 ✨`

  return (
    <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-100 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">学习热力图</h3>
          <p className="mt-0.5 text-xs text-ink-400">最近一年的学习打卡频率，越绿越勤奋</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-ink-400">
          少
          {HEAT_COLORS.map((color) => (
            <span
              key={color}
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ backgroundColor: color }}
            />
          ))}
          多
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="inline-block">
          <div className="flex gap-2">
            <div
              className="relative w-6 shrink-0 text-[10px] leading-none text-ink-400"
              style={{ height: 7 * CELL + 6 * GAP }}
            >
              <span className="absolute left-0" style={{ top: 1 * STRIDE + 2 }}>一</span>
              <span className="absolute left-0" style={{ top: 3 * STRIDE + 2 }}>三</span>
              <span className="absolute left-0" style={{ top: 5 * STRIDE + 2 }}>五</span>
            </div>
            <div>
              <div className="relative h-4 text-[10px] text-ink-400">
                {labels.map((label) => (
                  <span key={label.index} className="absolute top-0" style={{ left: label.index * STRIDE }}>
                    {label.label}
                  </span>
                ))}
              </div>
              <div className="flex" style={{ gap: GAP }}>
                {weeks.map((week, w) => (
                  <div key={w} className="flex flex-col" style={{ gap: GAP }}>
                    {week.map((cell, d) =>
                      cell ? (
                        <button
                          key={d}
                          type="button"
                          aria-label={`${cell.date.toLocaleDateString('zh-CN')}，学习 ${cell.count} 次`}
                          onMouseEnter={() => setHovered(cell)}
                          onMouseLeave={() => setHovered(null)}
                          onFocus={() => setHovered(cell)}
                          onBlur={() => setHovered(null)}
                          className={`rounded-[3px] transition-transform duration-150 hover:scale-125 ${
                            cell.isToday ? 'ring-1 ring-amber-400/80' : ''
                          }`}
                          style={{
                            width: CELL,
                            height: CELL,
                            backgroundColor: HEAT_COLORS[cell.level],
                          }}
                        />
                      ) : (
                        <span key={d} style={{ width: CELL, height: CELL }} />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 h-5 text-center text-xs text-ink-400">
        {hovered ? infoText : `把鼠标悬停在小格子上，看看那一天的努力 · ${infoText}`}
      </p>
    </div>
  )
}
