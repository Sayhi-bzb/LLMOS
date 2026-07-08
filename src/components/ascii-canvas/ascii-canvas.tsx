import { useCallback, useEffect, useMemo, useRef } from "react"

import { repairBoxDrawingLines } from "@/lib/box-repair"
import { parseCanvasContent } from "@/lib/canvas-content"
import { canvasLinesToCells } from "@/lib/canvas-text"
import { cn } from "@/lib/utils"

import { AsciiContextMenu } from "@/components/ascii-canvas/ascii-context-menu"
import { AsciiGrid } from "@/components/ascii-canvas/ascii-grid"
import { getSelectionRanges } from "@/components/ascii-canvas/selection"
import type { AsciiCanvasProps } from "@/components/ascii-canvas/types"
import { useCanvasInteractions } from "@/components/ascii-canvas/use-canvas-interactions"
import { useCanvasMetrics } from "@/components/ascii-canvas/use-canvas-metrics"
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

const bottomThreshold = 24
const horizontalOverflowBuffer = 2

export function AsciiCanvas({
  content,
  className,
  autoHeight = false,
  autoScroll = true,
  isStreaming = false,
  maxHeight,
  onPromptHref,
  cols,
  minRows = 18,
  maxColumns,
}: AsciiCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const shouldStickToBottomRef = useRef(true)
  const previousContentRef = useRef(content)
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
  const viewportMinRows = autoHeight
    ? minRows
    : Math.max(1, Math.floor(availableHeight / metrics.lineHeight))
  const gridMinRows = Math.max(minRows, viewportMinRows)

  const grid = useMemo(() => {
    const frame = parseCanvasContent(content, { streaming: isStreaming })
    const repairedLines = repairBoxDrawingLines(frame.lines, gridCols)

    return canvasLinesToCells(
      { ...frame, lines: repairedLines },
      gridCols,
      gridMinRows,
    )
  }, [content, gridCols, gridMinRows, isStreaming])

  const rows = grid.length
  const contentHeight =
    rows * metrics.lineHeight + viewportMetrics.paddingTop + viewportMetrics.paddingBottom
  const canvasStyle = autoHeight
    ? {
        height: `${contentHeight}px`,
        maxHeight,
        tabSize: 2,
      }
    : { tabSize: 2 }
  const {
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
    if (content.length < previousContentRef.current.length) {
      shouldStickToBottomRef.current = true
    }

    previousContentRef.current = content
  }, [content])

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
    <ContextMenu>
      <ContextMenuTrigger asChild>
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
          style={canvasStyle}
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
            onLinkClick={handleLinkClick}
          />
        </div>
      </ContextMenuTrigger>
      <AsciiContextMenu
        copyRawContentDisabled={!canCopyRawContent}
        onCopyRawContent={handleCopyRawContent}
      />
    </ContextMenu>
  )
}

export type { AsciiCanvasProps }

