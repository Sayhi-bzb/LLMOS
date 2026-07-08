import type { CanvasStyle } from "@/lib/canvas-text"

export interface AsciiCanvasProps {
  content: string
  className?: string
  autoHeight?: boolean
  autoScroll?: boolean
  isStreaming?: boolean
  maxHeight?: string
  onPromptHref?: (prompt: string) => void
  cols?: number
  minRows?: number
  maxColumns?: number
}

export interface CellPosition {
  row: number
  col: number
}

export type OscFieldKind = "link" | "note" | "label"

export interface CellSelection {
  anchor: CellPosition
  focus: CellPosition
  mode: "linear" | "block" | "word"
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
