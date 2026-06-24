import type { MouseEvent } from "react"

import type { CanvasCell } from "@/lib/canvas-text"

import {
  cellsToRuns,
  classifyOscField,
  getCanvasStyle,
  getStyleKey,
} from "@/components/ascii-canvas/ansi-style"
import type { RowSelectionRange, TextMetrics } from "@/components/ascii-canvas/types"

interface AsciiGridProps {
  grid: CanvasCell[][]
  gridCols: number
  metrics: TextMetrics
  rows: number
  selectionRanges: RowSelectionRange[]
  onLinkClick: (event: MouseEvent<HTMLAnchorElement>) => void
}

export function AsciiGrid({
  grid,
  gridCols,
  metrics,
  rows,
  selectionRanges,
  onLinkClick,
}: AsciiGridProps) {
  return (
    <div
      className="relative font-mono"
      style={{
        height: rows * metrics.lineHeight,
        width: gridCols * metrics.charWidth,
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
        {selectionRanges.map((range) => (
          <div
            className="absolute rounded-[1px] bg-blue-500/28 mix-blend-multiply"
            key={`${range.row}-${range.fromCol}-${range.toCol}`}
            style={{
              height: metrics.lineHeight,
              left: range.fromCol * metrics.charWidth,
              top: range.row * metrics.lineHeight,
              width: (range.toCol - range.fromCol + 1) * metrics.charWidth,
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        {grid.map((row, rowIndex) => (
          <div
            aria-label={`Line ${rowIndex + 1}`}
            className="whitespace-pre"
            key={rowIndex}
            style={{
              height: metrics.lineHeight,
              lineHeight: `${metrics.lineHeight}px`,
            }}
          >
            {cellsToRuns(row).map((run) => {
              const key = `${rowIndex}-${run.startCol}-${getStyleKey(run.style)}`
              const style = getCanvasStyle(run.style)

              if (!run.style.label) {
                return (
                  <span key={key} style={style}>
                    {run.text}
                  </span>
                )
              }

              const fieldKind = classifyOscField(run.style.label)

              if (fieldKind === "link") {
                return (
                  <a
                    href={run.style.label}
                    key={key}
                    onClick={onLinkClick}
                    rel="noreferrer"
                    style={style}
                    target="_blank"
                  >
                    {run.text}
                  </a>
                )
              }

              return (
                <span key={key} style={style} title={run.style.label}>
                  {run.text}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
