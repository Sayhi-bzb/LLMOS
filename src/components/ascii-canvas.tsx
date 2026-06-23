import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type CSSProperties,
  type PointerEvent,
} from "react"

import {
  ansiLinesToCells,
  parseAnsiToLines,
  type AnsiCell,
  type AnsiStyle,
} from "@/lib/ansi"
import { cn } from "@/lib/utils"

export interface AsciiCanvasProps {
  content: string
  className?: string
  autoScroll?: boolean
  cols?: number
  minRows?: number
  maxColumns?: number
}

interface CellPosition {
  row: number
  col: number
}

type SelectionMode = "linear" | "block"

interface CellSelection {
  anchor: CellPosition
  focus: CellPosition
  mode: SelectionMode
}

interface TextMetrics {
  charWidth: number
  lineHeight: number
}

interface CellRun {
  text: string
  style: AnsiStyle
  startCol: number
}

interface RowSelectionRange {
  row: number
  fromCol: number
  toCol: number
}

interface ContextMenuState {
  x: number
  y: number
}

const defaultMetrics: TextMetrics = {
  charWidth: 8,
  lineHeight: 18,
}

const stylesEqual = (left: AnsiStyle, right: AnsiStyle) =>
  left.foreground === right.foreground &&
  left.background === right.background &&
  left.href === right.href &&
  left.decorations.join("|") === right.decorations.join("|")

const getStyleKey = (style: AnsiStyle) =>
  [style.foreground ?? "", style.background ?? "", style.href ?? "", ...style.decorations].join("|")

const cellsToRuns = (cells: AnsiCell[]): CellRun[] => {
  const runs: CellRun[] = []

  for (const [index, cell] of cells.entries()) {
    const previous = runs[runs.length - 1]

    if (previous && stylesEqual(previous.style, cell.style)) {
      previous.text += cell.char
      continue
    }

    runs.push({ text: cell.char, style: cell.style, startCol: index })
  }

  return runs
}

const getAnsiStyle = (style: AnsiStyle): CSSProperties => {
  const decorations = new Set(style.decorations)
  const isReverse = decorations.has("reverse")
  const color = isReverse ? style.background : style.foreground
  const backgroundColor = isReverse ? style.foreground : style.background

  return {
    ...(color ? { color } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    fontWeight: decorations.has("bold") ? 700 : undefined,
    fontStyle: decorations.has("italic") ? "italic" : undefined,
    opacity: decorations.has("dim") ? 0.72 : undefined,
    textDecoration: [
      decorations.has("underline") || style.href ? "underline" : "",
      decorations.has("strikethrough") ? "line-through" : "",
    ]
      .filter(Boolean)
      .join(" "),
    visibility: decorations.has("hidden") ? "hidden" : undefined,
  }
}

const normalizeLinearSelection = (selection: CellSelection) => {
  const startBeforeEnd =
    selection.anchor.row < selection.focus.row ||
    (selection.anchor.row === selection.focus.row &&
      selection.anchor.col <= selection.focus.col)

  return startBeforeEnd
    ? { start: selection.anchor, end: selection.focus }
    : { start: selection.focus, end: selection.anchor }
}

const getSelectionRanges = (
  grid: AnsiCell[][],
  selection: CellSelection | null,
): RowSelectionRange[] => {
  if (!selection) {
    return []
  }

  if (selection.mode === "block") {
    const fromRow = Math.min(selection.anchor.row, selection.focus.row)
    const toRow = Math.max(selection.anchor.row, selection.focus.row)
    const fromCol = Math.min(selection.anchor.col, selection.focus.col)
    const toCol = Math.max(selection.anchor.col, selection.focus.col)

    return Array.from({ length: toRow - fromRow + 1 }, (_, index) => ({
      row: fromRow + index,
      fromCol,
      toCol,
    })).filter((range) => grid[range.row])
  }

  const { start, end } = normalizeLinearSelection(selection)

  return Array.from({ length: end.row - start.row + 1 }, (_, index) => {
    const row = start.row + index
    const cells = grid[row]
    const fromCol = row === start.row ? start.col : 0
    const toCol = row === end.row ? end.col : (cells?.length ?? 1) - 1

    return { row, fromCol, toCol }
  }).filter((range) => grid[range.row])
}

const getSelectedText = (grid: AnsiCell[][], selection: CellSelection) =>
  getSelectionRanges(grid, selection)
    .map((range) =>
      grid[range.row]
        .slice(range.fromCol, range.toCol + 1)
        .map((cell) => cell.char)
        .join("")
        .trimEnd(),
    )
    .join("\n")

const dragThreshold = 4

const isUnmodifiedPointer = (event: PointerEvent<HTMLElement>) =>
  !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey

const isLinkTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest("a[href]"))

const isNavigableHref = (href: string) => /^(https?:|mailto:|tel:)/i.test(href)

export function AsciiCanvas({
  content,
  className,
  cols,
  minRows = 18,
  maxColumns = 96,
}: AsciiCanvasProps) {
  const gridCols = cols ?? maxColumns
  const viewportRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const isDraggingRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const didDragRef = useRef(false)
  const [metrics, setMetrics] = useState<TextMetrics>(defaultMetrics)
  const [selection, setSelection] = useState<CellSelection | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const grid = useMemo(() => {
    const lines = parseAnsiToLines(content)
    return ansiLinesToCells(lines, gridCols, minRows)
  }, [content, gridCols, minRows])

  const rows = grid.length
  const selectionRanges = useMemo(
    () => getSelectionRanges(grid, selection),
    [grid, selection],
  )

  useEffect(() => {
    const measure = () => {
      const element = measureRef.current

      if (!element) {
        return
      }

      const rect = element.getBoundingClientRect()
      setMetrics({
        charWidth: rect.width / 10 || defaultMetrics.charWidth,
        lineHeight: rect.height || defaultMetrics.lineHeight,
      })
    }

    measure()
    const resizeObserver = new ResizeObserver(measure)

    if (measureRef.current) {
      resizeObserver.observe(measureRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (!contextMenu) {
      return
    }

    const closeContextMenu = () => setContextMenu(null)
    document.addEventListener("pointerdown", closeContextMenu)

    return () => document.removeEventListener("pointerdown", closeContextMenu)
  }, [contextMenu])

  const eventToCell = useCallback(
    (event: PointerEvent<HTMLDivElement>): CellPosition => {
      const viewport = viewportRef.current

      if (!viewport) {
        return { row: 0, col: 0 }
      }

      const rect = viewport.getBoundingClientRect()
      const x = event.clientX - rect.left + viewport.scrollLeft - 16
      const y = event.clientY - rect.top + viewport.scrollTop - 16
      const col = Math.max(
        0,
        Math.min(gridCols - 1, Math.floor(x / metrics.charWidth)),
      )
      const row = Math.max(
        0,
        Math.min(rows - 1, Math.floor(y / metrics.lineHeight)),
      )

      return { row, col }
    },
    [gridCols, metrics.charWidth, metrics.lineHeight, rows],
  )

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.focus()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      setContextMenu(null)
      return
    }

    setContextMenu(null)

    const isUnmodifiedLink = isUnmodifiedPointer(event) && isLinkTarget(event.target)
    const cell = eventToCell(event)
    event.currentTarget.focus()
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    didDragRef.current = false
    isDraggingRef.current = true
    setSelection({
      anchor: cell,
      focus: cell,
      mode: event.altKey ? "block" : "linear",
    })
    event.currentTarget.setPointerCapture(event.pointerId)

    if (!isUnmodifiedLink) {
      event.preventDefault()
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) {
      return
    }

    const start = pointerStartRef.current

    if (start) {
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
      didDragRef.current = didDragRef.current || distance > dragThreshold
    }

    const cell = eventToCell(event)
    setSelection((current) => (current ? { ...current, focus: cell } : null))
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false
    pointerStartRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (didDragRef.current) {
      event.preventDefault()
      didDragRef.current = false
    }
  }

  const handleCopyAnsiSource = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content)
    }

    setContextMenu(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setContextMenu(null)
    }
  }

  const handleCopy = (event: ClipboardEvent<HTMLDivElement>) => {
    if (!selection) {
      return
    }

    event.clipboardData.setData("text/plain", getSelectedText(grid, selection))
    event.preventDefault()
  }

  return (
    <div
      className={cn(
        "relative overflow-auto rounded-md border border-slate-200 bg-white text-[13px] leading-[1.45] text-slate-950 shadow-sm outline-none select-none",
        className,
      )}
      onContextMenu={handleContextMenu}
      onCopy={handleCopy}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={viewportRef}
      role="application"
      style={{ tabSize: 2 }}
      tabIndex={0}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none invisible fixed left-0 top-0 font-mono text-[13px] leading-[1.45] whitespace-pre"
        ref={measureRef}
      >
        0000000000
      </span>

      <div className="min-w-max p-4 font-mono">
        <div
          className="relative"
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
                  const style = getAnsiStyle(run.style)

                  if (!run.style.href) {
                    return (
                      <span key={key} style={style}>
                        {run.text}
                      </span>
                    )
                  }

                  return isNavigableHref(run.style.href) ? (
                    <a
                      href={run.style.href}
                      key={key}
                      onClick={handleLinkClick}
                      rel="noreferrer"
                      style={style}
                      target="_blank"
                    >
                      {run.text}
                    </a>
                  ) : (
                    <span key={key} style={style} title={run.style.href}>
                      {run.text}
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {contextMenu ? (
        <div
          className="fixed z-50 min-w-40 rounded-md border border-slate-200 bg-white p-1 text-sm text-slate-950 shadow-lg"
          onPointerDownCapture={(event) => event.stopPropagation()}
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="flex w-full items-center rounded px-2.5 py-1.5 text-left hover:bg-slate-100"
            onClick={handleCopyAnsiSource}
            role="menuitem"
            type="button"
          >
            复制 ANSI 源码
          </button>
        </div>
      ) : null}
    </div>
  )
}
