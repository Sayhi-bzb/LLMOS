import { useCallback, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from "react"

import type { CanvasCell } from "@/lib/canvas-text"
import { parseCanvasHref } from "@/lib/canvas-href"

import { getSelectedText } from "@/components/ascii-canvas/selection"
import type {
  CellPosition,
  CellSelection,
  TextMetrics,
  ViewportMetrics,
} from "@/components/ascii-canvas/types"

interface UseCanvasInteractionsOptions {
  grid: CanvasCell[][]
  gridCols: number
  metrics: TextMetrics
  onPromptHref?: (prompt: string) => void
  rawContent: string
  rows: number
  viewportMetrics: ViewportMetrics
  viewportRef: RefObject<HTMLDivElement | null>
}

const dragThreshold = 4

export function useCanvasInteractions({
  grid,
  gridCols,
  metrics,
  onPromptHref,
  rawContent,
  rows,
  viewportMetrics,
  viewportRef,
}: UseCanvasInteractionsOptions) {
  const isDraggingRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const selectionStartRef = useRef<CellSelection | null>(null)
  const didDragRef = useRef(false)
  const [selection, setSelection] = useState<CellSelection | null>(null)

  const eventToCell = useCallback(
    (event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>): CellPosition => {
      const viewport = viewportRef.current

      if (!viewport) {
        return { row: 0, col: 0 }
      }

      const rect = viewport.getBoundingClientRect()
      const x =
        event.clientX -
        rect.left +
        viewport.scrollLeft -
        viewportMetrics.paddingLeft
      const y =
        event.clientY -
        rect.top +
        viewport.scrollTop -
        viewportMetrics.paddingTop
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
    [
      gridCols,
      metrics.charWidth,
      metrics.lineHeight,
      rows,
      viewportMetrics.paddingLeft,
      viewportMetrics.paddingTop,
      viewportRef,
    ],
  )

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.currentTarget.focus()
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }

    if (isLinkTarget(event.target)) {
      return
    }

    const cell = eventToCell(event)
    event.currentTarget.focus()
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    selectionStartRef.current = {
      anchor: cell,
      focus: cell,
      mode: event.altKey ? "block" : "linear",
    }
    didDragRef.current = false
    isDraggingRef.current = true
    setSelection(null)
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) {
      return
    }

    const start = pointerStartRef.current
    const selectionStart = selectionStartRef.current

    if (!start || !selectionStart) {
      return
    }

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)

    if (distance <= dragThreshold && !didDragRef.current) {
      return
    }

    didDragRef.current = true

    const cell = eventToCell(event)
    setSelection({ ...selectionStart, focus: cell })
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false
    pointerStartRef.current = null
    selectionStartRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const cell = eventToCell(event)

    event.currentTarget.focus()
    setSelection({
      anchor: cell,
      focus: cell,
      mode: "word",
    })
    event.preventDefault()
  }

  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (didDragRef.current) {
      event.preventDefault()
      didDragRef.current = false
      return
    }

    const href = event.currentTarget.getAttribute("href") ?? ""
    const canvasHref = parseCanvasHref(href)

    if (canvasHref.kind === "prompt") {
      event.preventDefault()
      didDragRef.current = false
      onPromptHref?.(canvasHref.prompt)
      return
    }

    if (canvasHref.kind !== "external") {
      event.preventDefault()
      didDragRef.current = false
    }
  }

  const canCopyRawContent = rawContent.length > 0

  const handleCopyRawContent = async () => {
    if (canCopyRawContent && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(rawContent)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.currentTarget.blur()
    }
  }

  const handleCopy = (event: ClipboardEvent<HTMLDivElement>) => {
    if (!selection) {
      return
    }

    event.clipboardData.setData("text/plain", getSelectedText(grid, selection))
    event.preventDefault()
  }

  return {
    canCopyRawContent,
    handleContextMenu,
    handleCopy,
    handleCopyRawContent,
    handleDoubleClick,
    handleKeyDown,
    handleLinkClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    selection,
  }
}

function isLinkTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("a[href]"))
}

