export type CanvasTextDecoration =
  | "bold"
  | "dim"
  | "italic"
  | "underline"
  | "blink"
  | "reverse"
  | "hidden"
  | "strikethrough"

export interface CanvasStyle {
  foreground?: string
  background?: string
  decorations: CanvasTextDecoration[]
  label?: string
}

export interface CanvasRun {
  text: string
  style: CanvasStyle
  sourceText?: string
}

export type CanvasLine = CanvasRun[]

export interface CanvasCell {
  char: string
  style: CanvasStyle
  width?: number
  continuation?: boolean
  sourceText?: string
}

const emptyCanvasStyle = (): CanvasStyle => ({ decorations: [] })

const cloneCanvasStyle = (style: CanvasStyle): CanvasStyle => ({
  ...(style.foreground ? { foreground: style.foreground } : {}),
  ...(style.background ? { background: style.background } : {}),
  ...(style.label ? { label: style.label } : {}),
  decorations: [...style.decorations],
})

const isCombiningCodePoint = (codePoint: number) =>
  (codePoint >= 0x0300 && codePoint <= 0x036f) ||
  (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
  (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
  (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
  (codePoint >= 0xfe20 && codePoint <= 0xfe2f)

const isWideCodePoint = (codePoint: number) =>
  codePoint >= 0x1100 &&
  (codePoint <= 0x115f ||
    codePoint === 0x2329 ||
    codePoint === 0x232a ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd))

const getCellWidth = (char: string) => {
  const codePoint = char.codePointAt(0) ?? 0

  if (isCombiningCodePoint(codePoint)) {
    return 0
  }

  return isWideCodePoint(codePoint) ? 2 : 1
}

export const canvasLinesToCells = (
  lines: CanvasLine[],
  cols: number,
  minRows = lines.length,
): CanvasCell[][] => {
  const safeCols = Math.max(1, cols)
  const createEmptyRow = (): CanvasCell[] =>
    Array.from({ length: safeCols }, () => ({
      char: " ",
      style: emptyCanvasStyle(),
    }))
  const rows: CanvasCell[][] = []

  const appendRow = () => {
    const nextRow = createEmptyRow()
    rows.push(nextRow)
    return nextRow
  }

  for (const line of lines) {
    let cells = appendRow()
    let colIndex = 0

    for (const run of line) {
      for (const char of Array.from(run.text)) {
        const cellWidth = Math.min(getCellWidth(char), safeCols)

        if (cellWidth === 0) {
          const previousIndex = Math.max(0, colIndex - 1)
          cells[previousIndex] = {
            ...cells[previousIndex],
            char: `${cells[previousIndex].char}${char}`,
            sourceText: `${cells[previousIndex].sourceText ?? ""}${char}`,
          }
          continue
        }

        if (colIndex > 0 && colIndex + cellWidth > safeCols) {
          cells = appendRow()
          colIndex = 0
        }

        cells[colIndex] = {
          char,
          style: cloneCanvasStyle(run.style),
          width: cellWidth,
          sourceText: run.sourceText ? char : undefined,
        }

        for (let offset = 1; offset < cellWidth; offset += 1) {
          cells[colIndex + offset] = {
            char: "",
            style: cloneCanvasStyle(run.style),
            continuation: true,
          }
        }

        colIndex += cellWidth

        if (colIndex >= safeCols) {
          cells = appendRow()
          colIndex = 0
        }
      }
    }

    if (colIndex === 0 && rows.length > 1 && line.length > 0) {
      rows.pop()
    }
  }

  while (rows.length < Math.max(minRows, 1)) {
    rows.push(createEmptyRow())
  }

  return rows
}


