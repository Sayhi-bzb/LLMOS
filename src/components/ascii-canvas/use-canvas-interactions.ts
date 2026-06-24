import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from "react"

import type { CanvasCell } from "@/lib/canvas-text"

import { getSelectedSourceText, getSelectedText } from "@/components/ascii-canvas/selection"
import type {
  CellPosition,
  CellSelection,
  ContextMenuState,
  TextMetrics,
  ViewportMetrics,
} from "@/components/ascii-canvas/types"

interface UseCanvasInteractionsOptions {
  grid: CanvasCell[][]
  gridCols: number
  metrics: TextMetrics
  rows: number
  viewportMetrics: ViewportMetrics
  viewportRef: RefObject<HTMLDivElement | null>
}

const dragThreshold = 4

export function useCanvasInteractions({
  grid,
  gridCols,
  metrics,
  rows,
  viewportMetrics,
  viewportRef,
}: UseCanvasInteractionsOptions) {
  const isDraggingRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const didDragRef = useRef(false)
  const [selection, setSelection] = useState<CellSelection | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

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

  const selectedSourceText = getSelectedSourceText(grid, selection)
  const canCopySourceText = selectedSourceText.length > 0

  const handleCopySourceText = async () => {
    if (canCopySourceText && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(selectedSourceText)
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

  return {
    canCopySourceText,
    contextMenu,
    handleContextMenu,
    handleCopy,
    handleCopySourceText,
    handleKeyDown,
    handleLinkClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    selection,
  }
}

function isUnmodifiedPointer(event: PointerEvent<HTMLElement>) {
  return !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey
}

function isLinkTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("a[href]"))
}

