import type { CSSProperties } from "react"

import type { AnsiCell, AnsiStyle } from "@/lib/ansi"

import type { CellRun, OscFieldKind } from "@/components/ascii-canvas/types"

export function getStyleKey(style: AnsiStyle) {
  return [
    style.foreground ?? "",
    style.background ?? "",
    style.label ?? "",
    ...style.decorations,
  ].join("|")
}

export function cellsToRuns(cells: AnsiCell[]): CellRun[] {
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

export function getAnsiStyle(style: AnsiStyle): CSSProperties {
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
      decorations.has("underline") || style.label ? "underline" : "",
      decorations.has("strikethrough") ? "line-through" : "",
    ]
      .filter(Boolean)
      .join(" "),
    visibility: decorations.has("hidden") ? "hidden" : undefined,
  }
}

export function classifyOscField(value: string): OscFieldKind {
  if (/^(https?:|mailto:|tel:)/i.test(value)) {
    return "link"
  }

  if (value.startsWith("@")) {
    return "label"
  }

  return "note"
}

function stylesEqual(left: AnsiStyle, right: AnsiStyle) {
  return (
    left.foreground === right.foreground &&
    left.background === right.background &&
    left.label === right.label &&
    left.decorations.join("|") === right.decorations.join("|")
  )
}
