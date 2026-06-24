import { useCallback, useEffect, useMemo, useRef } from "react"

import { parseCanvasContent } from "@/lib/canvas-content"
import { canvasLinesToCells } from "@/lib/canvas-text"
import { cn } from "@/lib/utils"

import { AsciiContextMenu } from "@/components/ascii-canvas/ascii-context-menu"
import { AsciiGrid } from "@/components/ascii-canvas/ascii-grid"
import { getSelectionRanges } from "@/components/ascii-canvas/selection"
import type { AsciiCanvasProps } from "@/components/ascii-canvas/types"
import { useCanvasInteractions } from "@/components/ascii-canvas/use-canvas-interactions"
import { useCanvasMetrics } from "@/components/ascii-canvas/use-canvas-metrics"

const bottomThreshold = 24
const horizontalOverflowBuffer = 2

export function AsciiCanvas({
  content,
  className,
  autoScroll = true,
  isStreaming = false,
  onPromptHref,
  cols,
  minRows = 18,
  maxColumns,
}: AsciiCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const shouldStickToBottomRef = useRef(true)
  const { metrics, viewportMetrics } = useCanvasMetrics(measureRef, viewportRef)

  const availableWidth = Math.max(
    0,
    viewportMetrics.width - viewportMetrics.paddingLeft - viewportMetrics.paddingRight,
  )
  const availableHeight = Math.max(
    0,
    viewportMetrics.height - viewportMetrics.paddingTop - viewportMetrics.paddingBottom,
  )
  const measuredCols = Math.max(
    1,
    Math.floor((availableWidth - horizontalOverflowBuffer) / metrics.charWidth),
  )
  const gridCols = cols ?? (maxColumns ? Math.min(maxColumns, measuredCols) : measuredCols)
  const viewportMinRows = Math.max(1, Math.floor(availableHeight / metrics.lineHeight))
  const gridMinRows = Math.max(minRows, viewportMinRows)

  const grid = useMemo(() => {
    const lines = parseCanvasContent(content, { streaming: isStreaming })

    return canvasLinesToCells(lines, gridCols, gridMinRows)
  }, [content, gridCols, gridMinRows, isStreaming])

  const rows = grid.length
  const {
    canCopyRawContent,
    contextMenu,
    handleContextMenu,
    handleCopy,
    handleCopyRawContent,
    handleDoubleClick,
    handleKeyDown,
    handleLinkClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isCtrlPressed,
    selection,
  } = useCanvasInteractions({
    grid,
    gridCols,
    metrics,
    onPromptHref,
    rawContent: content,
    rows,
    viewportMetrics,
    viewportRef,
  })
  const selectionRanges = useMemo(
    () => getSelectionRanges(grid, selection),
    [grid, selection],
  )

  useEffect(() => {
    if (!autoScroll || !shouldStickToBottomRef.current) {
      return
    }

    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight
  }, [autoScroll, content, rows])

  const updateStickToBottom = useCallback(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    shouldStickToBottomRef.current = distanceFromBottom <= bottomThreshold
  }, [])

  return (
    <div
      className={cn(
        "relative overflow-auto bg-white p-4 text-[13px] leading-[1.45] text-slate-950 outline-none select-none",
        className,
      )}
      onContextMenu={handleContextMenu}
      onCopy={handleCopy}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onScroll={updateStickToBottom}
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

      <AsciiGrid
        grid={grid}
        gridCols={gridCols}
        metrics={metrics}
        rows={rows}
        selectionRanges={selectionRanges}
        isCtrlPressed={isCtrlPressed}
        onLinkClick={handleLinkClick}
      />

      {contextMenu ? (
        <AsciiContextMenu
          contextMenu={contextMenu}
          copyRawContentDisabled={!canCopyRawContent}
          onCopyRawContent={handleCopyRawContent}
        />
      ) : null}
    </div>
  )
}

export type { AsciiCanvasProps }


