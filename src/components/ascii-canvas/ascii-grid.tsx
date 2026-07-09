import type { MouseEvent } from "react"

import type { CanvasCell } from "@/lib/canvas-text"

import {
  cellsToRuns,
  classifyOscField,
  getCanvasBackgroundColor,
  getCanvasTextStyle,
  getStyleKey,
} from "@/components/ascii-canvas/ansi-style"
import type { RowSelectionRange, TextMetrics } from "@/components/ascii-canvas/types"

interface BackgroundRun {
  color: string
  startCol: number
  length: number
}

interface AsciiGridProps {
  grid: CanvasCell[][]
  gridCols: number
  metrics: TextMetrics
  rows: number
  selectionRanges: RowSelectionRange[]
  onLinkClick: (event: MouseEvent<HTMLAnchorElement>) => void
}

function cellsToBackgroundRuns(cells: CanvasCell[]): BackgroundRun[] {
  const runs: BackgroundRun[] = []

  for (const [index, cell] of cells.entries()) {
    const color = getCanvasBackgroundColor(cell.style)

    if (!color) {
      continue
    }

    const previous = runs[runs.length - 1]

    if (previous && previous.color === color && previous.startCol + previous.length === index) {
      previous.length += 1
      continue
    }

    runs.push({ color, startCol: index, length: 1 })
  }

  return runs
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
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        {grid.map((row, rowIndex) =>
          cellsToBackgroundRuns(row).map((run) => (
            <div
              className="absolute"
              key={`${rowIndex}-${run.startCol}-${run.length}-${run.color}`}
              style={{
                backgroundColor: run.color,
                height: metrics.lineHeight,
                left: run.startCol * metrics.charWidth,
                top: rowIndex * metrics.lineHeight,
                width: run.length * metrics.charWidth,
              }}
            />
          )),
        )}
      </div>

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
              const style = getCanvasTextStyle(run.style)

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
                    className="no-underline hover:underline"
                    href={run.style.label}
                    key={key}
                    onClick={onLinkClick}
                    rel="noreferrer"
                    style={{ ...style, cursor: "pointer" }}
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

