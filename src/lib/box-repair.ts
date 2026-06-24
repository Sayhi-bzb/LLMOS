import type { CanvasLine, CanvasRun } from "@/lib/canvas-text"
import { getTextDisplayWidth } from "@/lib/canvas-text"

const boxChars = new Set("┌┐└┘─│├┤┬┴┼")
const horizontalChars = new Set("─┌┐└┘├┤┬┴┼")
const leftBorderChars = new Set("┌└├│")
const rightBorderChars = new Set("┐┘┤│")
const topLeftChars = new Set("┌├")
const topRightChars = new Set("┐┤")
const bottomLeftChars = new Set("└├")
const bottomRightChars = new Set("┘┤")

interface TextPart {
  char: string
  run: CanvasRun
}

interface RepairRow {
  line: CanvasLine
  parts: TextPart[]
  text: string
  width: number
  hasBox: boolean
  boxCount: number
  horizontalCount: number
  firstBoxIndex: number
  lastBoxIndex: number
}

interface BoxBlock {
  start: number
  end: number
}

const createEmptyStyle = () => ({ decorations: [] })

const cloneRun = (run: CanvasRun, text: string): CanvasRun => ({
  text,
  style: {
    ...(run.style.foreground ? { foreground: run.style.foreground } : {}),
    ...(run.style.background ? { background: run.style.background } : {}),
    ...(run.style.label ? { label: run.style.label } : {}),
    decorations: [...run.style.decorations],
  },
  ...(run.sourceText ? { sourceText: text } : {}),
})

const pushText = (line: CanvasLine, run: CanvasRun, text: string) => {
  if (!text) {
    return
  }

  const previous = line[line.length - 1]
  if (previous && previous.style === run.style && previous.sourceText === run.sourceText) {
    previous.text += text
    return
  }

  line.push(cloneRun(run, text))
}

const flattenLine = (line: CanvasLine): TextPart[] =>
  line.flatMap((run) => Array.from(run.text).map((char) => ({ char, run })))

const analyzeLine = (line: CanvasLine): RepairRow => {
  const parts = flattenLine(line)
  const text = parts.map((part) => part.char).join("")
  let boxCount = 0
  let horizontalCount = 0
  let firstBoxIndex = -1
  let lastBoxIndex = -1

  parts.forEach((part, index) => {
    if (!boxChars.has(part.char)) {
      return
    }

    boxCount += 1
    if (horizontalChars.has(part.char)) {
      horizontalCount += 1
    }
    if (firstBoxIndex === -1) {
      firstBoxIndex = index
    }
    lastBoxIndex = index
  })

  return {
    line,
    parts,
    text,
    width: getTextDisplayWidth(text),
    hasBox: boxCount > 0,
    boxCount,
    horizontalCount,
    firstBoxIndex,
    lastBoxIndex,
  }
}

const charAt = (row: RepairRow, index: number) => row.parts[index]?.char ?? ""

const isHorizontalBorderRow = (row: RepairRow) => {
  if (!row.hasBox || row.horizontalCount < 2) {
    return false
  }

  const nonSpaceChars = Array.from(row.text).filter((char) => char !== " ")
  const boxRatio = nonSpaceChars.length === 0 ? 0 : row.boxCount / nonSpaceChars.length

  return boxRatio >= 0.6
}

const isMiddleBorderRow = (row: RepairRow) => {
  if (!row.hasBox) {
    return false
  }

  const firstChar = charAt(row, row.firstBoxIndex)
  const lastChar = charAt(row, row.lastBoxIndex)

  return leftBorderChars.has(firstChar) || rightBorderChars.has(lastChar) || row.text.includes("│")
}

const findBoxBlocks = (rows: RepairRow[]): BoxBlock[] => {
  const blocks: BoxBlock[] = []
  let index = 0

  while (index < rows.length) {
    if (!isHorizontalBorderRow(rows[index])) {
      index += 1
      continue
    }

    const start = index
    let end = index
    index += 1

    while (index < rows.length && (isMiddleBorderRow(rows[index]) || isHorizontalBorderRow(rows[index]))) {
      end = index
      index += 1
    }

    if (end - start >= 2 && isHorizontalBorderRow(rows[end])) {
      blocks.push({ start, end })
    }
  }

  return blocks
}

const getTemplateRun = (row: RepairRow): CanvasRun => {
  const boxPart = row.parts.find((part) => boxChars.has(part.char))
  return boxPart?.run ?? { text: "", style: createEmptyStyle() }
}

const lineFromText = (text: string, run: CanvasRun): CanvasLine => [cloneRun(run, text)]

const normalizeBorderLine = (
  row: RepairRow,
  targetWidth: number,
  leftChar: string,
  rightChar: string,
) => {
  const run = getTemplateRun(row)
  const safeWidth = Math.max(2, targetWidth)
  return lineFromText(`${leftChar}${"─".repeat(safeWidth - 2)}${rightChar}`, run)
}

const replaceEdgeChar = (char: string, fallback: string, allowed: Set<string>) =>
  allowed.has(char) ? char : fallback

const normalizeMiddleLine = (row: RepairRow, targetWidth: number): CanvasLine => {
  const line: CanvasLine = []
  const templateRun = getTemplateRun(row)
  const parts = [...row.parts]
  const firstBoxIndex = row.firstBoxIndex
  const lastBoxIndex = row.lastBoxIndex
  const firstBoxChar = charAt(row, firstBoxIndex)
  const lastBoxChar = charAt(row, lastBoxIndex)

  const hasLeft = firstBoxIndex === 0 && leftBorderChars.has(firstBoxChar)
  const hasRight = lastBoxIndex > 0 && rightBorderChars.has(lastBoxChar)

  if (!hasLeft) {
    pushText(line, templateRun, "│")
  }

  const rightPart = hasRight ? parts[lastBoxIndex] : undefined

  parts.forEach((part, index) => {
    if (hasRight && index === lastBoxIndex) {
      return
    }

    let char = part.char

    if (index === firstBoxIndex && hasLeft) {
      char = replaceEdgeChar(char, "│", leftBorderChars)
    }

    pushText(line, part.run, char)
  })

  const currentWidth = getTextDisplayWidth(line.map((run) => run.text).join(""))
  const paddingWidth = Math.max(0, targetWidth - currentWidth - 1)

  if (paddingWidth > 0) {
    pushText(line, templateRun, " ".repeat(paddingWidth))
  }

  if (rightPart) {
    pushText(line, rightPart.run, replaceEdgeChar(rightPart.char, "│", rightBorderChars))
    return line
  }

  pushText(line, templateRun, "│")

  return line
}

const repairBlock = (rows: RepairRow[], block: BoxBlock, maxWidth: number) => {
  const blockRows = rows.slice(block.start, block.end + 1)
  const widestRow = Math.max(...blockRows.map((row) => row.width))
  const targetWidth = Math.max(2, Math.min(widestRow, maxWidth))

  return blockRows.map((row, offset) => {
    const isFirst = offset === 0
    const isLast = offset === blockRows.length - 1

    if (isFirst) {
      const left = replaceEdgeChar(charAt(row, row.firstBoxIndex), "┌", topLeftChars)
      const right = replaceEdgeChar(charAt(row, row.lastBoxIndex), "┐", topRightChars)
      return normalizeBorderLine(row, targetWidth, left, right)
    }

    if (isLast) {
      const left = replaceEdgeChar(charAt(row, row.firstBoxIndex), "└", bottomLeftChars)
      const right = replaceEdgeChar(charAt(row, row.lastBoxIndex), "┘", bottomRightChars)
      return normalizeBorderLine(row, targetWidth, left, right)
    }

    if (isHorizontalBorderRow(row)) {
      const left = replaceEdgeChar(charAt(row, row.firstBoxIndex), "├", new Set(["├", "┌", "└"]))
      const right = replaceEdgeChar(charAt(row, row.lastBoxIndex), "┤", new Set(["┤", "┐", "┘"]))
      return normalizeBorderLine(row, targetWidth, left, right)
    }

    return normalizeMiddleLine(row, targetWidth)
  })
}

export const repairBoxDrawingLines = (lines: CanvasLine[], maxWidth: number): CanvasLine[] => {
  const rows = lines.map(analyzeLine)
  const blocks = findBoxBlocks(rows)

  if (blocks.length === 0) {
    return lines
  }

  const repaired = [...lines]

  for (const block of blocks) {
    const repairedBlock = repairBlock(rows, block, maxWidth)

    repairedBlock.forEach((line, offset) => {
      repaired[block.start + offset] = line
    })
  }

  return repaired
}

