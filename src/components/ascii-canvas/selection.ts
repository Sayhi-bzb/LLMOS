import type { AnsiCell } from "@/lib/ansi"

import type { CellSelection, RowSelectionRange } from "@/components/ascii-canvas/types"

export function getSelectionRanges(
  grid: AnsiCell[][],
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

  const { start, end } = normalizeLinearSelection(selection)

  return Array.from({ length: end.row - start.row + 1 }, (_, index) => {
    const row = start.row + index
    const cells = grid[row]
    const fromCol = row === start.row ? start.col : 0
    const toCol = row === end.row ? end.col : (cells?.length ?? 1) - 1

    return { row, fromCol, toCol }
  }).filter((range) => grid[range.row])
}

export function getSelectedText(grid: AnsiCell[][], selection: CellSelection) {
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

export function getSelectedAnsiSource(
  grid: AnsiCell[][],
  selection: CellSelection | null,
) {
  if (!selection) {
    return ""
  }

  return getSelectedCellsByRange(grid, selection)
    .map((cells) =>
      trimTrailingEmptyCells(cells)
        .filter((cell) => !cell.continuation)
        .map((cell) => cell.sourceText ?? cell.char)
        .join(""),
    )
    .join("\n")
}

function getSelectedCellsByRange(grid: AnsiCell[][], selection: CellSelection) {
  return getSelectionRanges(grid, selection).map((range) =>
    grid[range.row].slice(range.fromCol, range.toCol + 1),
  )
}

function trimTrailingEmptyCells(cells: AnsiCell[]) {
  let endIndex = cells.length

  while (endIndex > 0) {
    const cell = cells[endIndex - 1]

    if (cell.continuation || cell.sourceText || cell.char.trimEnd()) {
      break
    }

    endIndex -= 1
  }

  return cells.slice(0, endIndex)
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
