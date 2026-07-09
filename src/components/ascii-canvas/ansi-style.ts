import type { CSSProperties } from "react"

import type { CanvasCell, CanvasStyle } from "@/lib/canvas-text"
import { isCanvasLinkHref } from "@/lib/screen-protocol/href"

import type { CellRun, OscFieldKind } from "@/components/ascii-canvas/types"

export function getStyleKey(style: CanvasStyle) {
  return [
    style.foreground ?? "",
    style.background ?? "",
    style.label ?? "",
    ...style.decorations,
  ].join("|")
}

export function cellsToRuns(cells: CanvasCell[]): CellRun[] {
  const runs: CellRun[] = []

  for (const [index, cell] of cells.entries()) {
    if (cell.continuation) {
      continue
    }

    const previous = runs[runs.length - 1]

    if (previous && stylesEqual(previous.style, cell.style)) {
      previous.text += cell.char
      continue
    }

    runs.push({ text: cell.char, style: cell.style, startCol: index })
  }

  return runs
}

export function getCanvasTextStyle(style: CanvasStyle): CSSProperties {
  const decorations = new Set(style.decorations)
  const isReverse = decorations.has("reverse")
  const color = isReverse ? style.background : style.foreground

  return {
    display: "inline-block",
    height: "100%",
    lineHeight: "inherit",
    verticalAlign: "top",
    position: "relative",
    zIndex: 1,
    ...(color ? { color } : {}),
    fontWeight: decorations.has("bold") ? 700 : undefined,
    fontStyle: decorations.has("italic") ? "italic" : undefined,
    opacity: decorations.has("dim") ? 0.72 : undefined,
    textDecoration: [
      decorations.has("underline") ? "underline" : "",
      decorations.has("strikethrough") ? "line-through" : "",
    ]
      .filter(Boolean)
      .join(" "),
    visibility: decorations.has("hidden") ? "hidden" : undefined,
  }
}

export function getCanvasBackgroundColor(style: CanvasStyle) {
  const decorations = new Set(style.decorations)

  return decorations.has("reverse") ? style.foreground : style.background
}

export function classifyOscField(value: string): OscFieldKind {
  if (isCanvasLinkHref(value)) {
    return "link"
  }

  if (value.startsWith("@")) {
    return "label"
  }

  return "note"
}

function stylesEqual(left: CanvasStyle, right: CanvasStyle) {
  return (
    left.foreground === right.foreground &&
    left.background === right.background &&
    left.label === right.label &&
    left.decorations.join("|") === right.decorations.join("|")
  )
}

