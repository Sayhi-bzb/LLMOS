import type { CanvasCell } from "@/lib/canvas-text"

import type { CellPosition, CellSelection, RowSelectionRange } from "@/components/ascii-canvas/types"

const wordCharacterPattern = /[\p{L}\p{N}_\-./:@#?=&%+~]/u

export function getSelectionRanges(
  grid: CanvasCell[][],
  selection: CellSelection | null,
): RowSelectionRange[] {
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

  const normalizedSelection =
    selection.mode === "word" ? expandWordSelection(grid, selection) : selection
  const { start, end } = normalizeLinearSelection(normalizedSelection)

  return Array.from({ length: end.row - start.row + 1 }, (_, index) => {
    const row = start.row + index
    const cells = grid[row]
    const fromCol = row === start.row ? start.col : 0
    const toCol = row === end.row ? end.col : (cells?.length ?? 1) - 1

    return { row, fromCol, toCol }
  }).filter((range) => grid[range.row])
}

export function getSelectedText(grid: CanvasCell[][], selection: CellSelection) {
  return getSelectedCellsByRange(grid, selection)
    .map((cells) =>
      cells
        .filter((cell) => !cell.continuation)
        .map((cell) => cell.char)
        .join("")
        .trimEnd(),
    )
    .join("\n")
}

function getSelectedCellsByRange(grid: CanvasCell[][], selection: CellSelection) {
  return getSelectionRanges(grid, selection).map((range) =>
    grid[range.row].slice(range.fromCol, range.toCol + 1),
  )
}

function expandWordSelection(
  grid: CanvasCell[][],
  selection: CellSelection,
): CellSelection {
  const { start, end } = normalizeLinearSelection(selection)
  const expandedStart = expandWordBoundary(grid, start)
  const expandedEnd = expandWordBoundary(grid, end)

  return {
    ...selection,
    anchor: expandedStart.start,
    focus: expandedEnd.end,
  }
}

function expandWordBoundary(grid: CanvasCell[][], position: CellPosition) {
  const row = grid[position.row]

  if (!row) {
    return { start: position, end: position }
  }

  const col = normalizeCharacterCol(row, position.col)
  const cell = row[col]

  if (!isWordCell(cell)) {
    return {
      start: { row: position.row, col },
      end: { row: position.row, col: getCharacterEndCol(row, col) },
    }
  }

  let startCol = col
  let endCol = col

  while (true) {
    const previousCol = getPreviousCharacterCol(row, startCol)

    if (previousCol === null || !isWordCell(row[previousCol])) {
      break
    }

    startCol = previousCol
  }

  while (true) {
    const nextCol = getNextCharacterCol(row, endCol)

    if (nextCol === null || !isWordCell(row[nextCol])) {
      break
    }

    endCol = nextCol
  }

  return {
    start: { row: position.row, col: startCol },
    end: { row: position.row, col: getCharacterEndCol(row, endCol) },
  }
}

function normalizeCharacterCol(row: CanvasCell[], col: number) {
  let normalizedCol = Math.max(0, Math.min(col, row.length - 1))

  while (normalizedCol > 0 && row[normalizedCol]?.continuation) {
    normalizedCol -= 1
  }

  return normalizedCol
}

function getPreviousCharacterCol(row: CanvasCell[], col: number) {
  let previousCol = col - 1

  while (previousCol >= 0 && row[previousCol]?.continuation) {
    previousCol -= 1
  }

  return previousCol >= 0 ? previousCol : null
}

function getNextCharacterCol(row: CanvasCell[], col: number) {
  let nextCol = getCharacterEndCol(row, col) + 1

  while (nextCol < row.length && row[nextCol]?.continuation) {
    nextCol += 1
  }

  return nextCol < row.length ? nextCol : null
}

function getCharacterEndCol(row: CanvasCell[], col: number) {
  let endCol = Math.max(0, Math.min(col, row.length - 1))

  while (endCol + 1 < row.length && row[endCol + 1]?.continuation) {
    endCol += 1
  }

  return endCol
}

function isWordCell(cell: CanvasCell | undefined) {
  return Boolean(cell && !cell.continuation && wordCharacterPattern.test(cell.char))
}

function normalizeLinearSelection(selection: CellSelection) {
  const startBeforeEnd =
    selection.anchor.row < selection.focus.row ||
    (selection.anchor.row === selection.focus.row &&
      selection.anchor.col <= selection.focus.col)

  return startBeforeEnd
    ? { start: selection.anchor, end: selection.focus }
    : { start: selection.focus, end: selection.anchor }
}

