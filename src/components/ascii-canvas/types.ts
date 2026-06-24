import type { CanvasStyle } from "@/lib/canvas-text"

export interface AsciiCanvasProps {
  content: string
  className?: string
  autoScroll?: boolean
  isStreaming?: boolean
  cols?: number
  minRows?: number
  maxColumns?: number
}

export interface CellPosition {
  row: number
  col: number
}

export type SelectionMode = "linear" | "block"
export type OscFieldKind = "link" | "note" | "label"

export interface CellSelection {
  anchor: CellPosition
  focus: CellPosition
  mode: SelectionMode
}

export interface TextMetrics {
  charWidth: number
  lineHeight: number
}

export interface ViewportMetrics {
  width: number
  height: number
  paddingLeft: number
  paddingRight: number
  paddingTop: number
  paddingBottom: number
}

export interface CellRun {
  text: string
  style: CanvasStyle
  startCol: number
}

export interface RowSelectionRange {
  row: number
  fromCol: number
  toCol: number
}

export interface ContextMenuState {
  x: number
  y: number
}