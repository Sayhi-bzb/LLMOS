import MarkdownIt from "markdown-it"
import type Token from "markdown-it/lib/token.mjs"
import { getTextDisplayWidth } from "@/lib/canvas-text"

export interface RichTextStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  color?: string
  background?: string
  href?: string
}

interface RichTextRun {
  text: string
  style: RichTextStyle
}

export type RichTextLine = RichTextRun[]

type StyleFrame = Partial<RichTextStyle>

type HtmlInlineToken =
  | { kind: "open"; frame: StyleFrame }
  | { kind: "close"; tag: "span" | "u" }
  | { kind: "text"; text: string }

interface TableCell {
  runs: RichTextLine
  header: boolean
}

type TableRow = TableCell[]

const markdown = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
})

const tableColumnGap = 3
const allowedColorPattern = /^#(?:[\da-f]{3}|[\da-f]{6})$/i
const spanOpenPattern = /^<span\s+([^>]*)>$/i
const styleAttributePattern = /\bstyle\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i
const semanticColorAttributePattern = /\b(fg|bg)-([a-z][-_a-z0-9]*)\b/gi

const semanticColorMap: Record<string, string> = {
  foreground: "var(--foreground)",
  background: "var(--background)",
  primary: "var(--primary)",
  secondary: "var(--secondary)",
  muted: "var(--muted)",
  accent: "var(--accent)",
  danger: "var(--destructive)",
  success: "var(--success)",
  warning: "var(--warning)",
  surface: "var(--card)",
  white: "#FFFFFF",
  black: "#000000",
  "primary-fg": "var(--primary-foreground)",
  "secondary-fg": "var(--secondary-foreground)",
  "muted-fg": "var(--muted-foreground)",
  "accent-fg": "var(--accent-foreground)",
  "danger-fg": "var(--destructive-foreground)",
  "success-fg": "var(--success-foreground)",
  "warning-fg": "var(--warning-foreground)",
  "surface-fg": "var(--card-foreground)",
}

const emptyStyle = (): RichTextStyle => ({})

const normalizeColor = (value: string) => {
  const trimmed = value.trim()
  return allowedColorPattern.test(trimmed) ? trimmed : undefined
}

const parseSemanticColorAttributes = (attributes: string): StyleFrame => {
  const frame: StyleFrame = {}

  for (const match of attributes.matchAll(semanticColorAttributePattern)) {
    const [, channel, token] = match
    const color = semanticColorMap[token]

    if (!color) {
      continue
    }

    if (channel.toLowerCase() === "fg") {
      frame.color = color
    }

    if (channel.toLowerCase() === "bg") {
      frame.background = color
    }
  }

  return frame
}

const parseStyleAttribute = (attributes: string): StyleFrame => {
  const match = attributes.match(styleAttributePattern)

  if (!match) {
    return {}
  }

  const styleText = match[2] ?? match[3] ?? match[4] ?? ""
  const frame: StyleFrame = {}

  for (const declaration of styleText.split(";")) {
    const separatorIndex = declaration.indexOf(":")

    if (separatorIndex === -1) {
      continue
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase()
    const value = normalizeColor(declaration.slice(separatorIndex + 1))

    if (!value) {
      continue
    }

    if (property === "color") {
      frame.color = value
    }

    if (property === "background" || property === "background-color") {
      frame.background = value
    }
  }

  return frame
}

const stripHtmlTags = (content: string) => content.replace(/<[^>]*>/g, "")

const parseHtmlInlineToken = (content: string): HtmlInlineToken => {
  const trimmed = content.trim()

  if (/^<u\s*>$/i.test(trimmed)) {
    return { kind: "open", frame: { underline: true } }
  }

  if (/^<\/u\s*>$/i.test(trimmed)) {
    return { kind: "close", tag: "u" }
  }

  const spanOpenMatch = trimmed.match(spanOpenPattern)

  if (spanOpenMatch) {
    return {
      kind: "open",
      frame: {
        ...parseStyleAttribute(spanOpenMatch[1]),
        ...parseSemanticColorAttributes(spanOpenMatch[1]),
      },
    }
  }

  if (/^<\/span\s*>$/i.test(trimmed)) {
    return { kind: "close", tag: "span" }
  }

  return { kind: "text", text: content }
}

const mergeStyles = (stack: StyleFrame[]): RichTextStyle =>
  stack.reduce<RichTextStyle>((merged, frame) => ({ ...merged, ...frame }), emptyStyle())

const stylesEqual = (left: RichTextStyle, right: RichTextStyle) =>
  left.bold === right.bold &&
  left.italic === right.italic &&
  left.underline === right.underline &&
  left.strike === right.strike &&
  left.color === right.color &&
  left.background === right.background &&
  left.href === right.href

const appendText = (lines: RichTextLine[], stack: StyleFrame[], text: string) => {
  const parts = text.split("\n")

  parts.forEach((part, index) => {
    if (index > 0) {
      lines.push([])
    }

    if (!part) {
      return
    }

    const style = mergeStyles(stack)
    const currentLine = lines[lines.length - 1]
    const previous = currentLine[currentLine.length - 1]

    if (previous && stylesEqual(previous.style, style)) {
      previous.text += part
      return
    }

    currentLine.push({ text: part, style })
  })
}

const appendRuns = (line: RichTextLine, runs: RichTextLine) => {
  for (const run of runs) {
    const previous = line[line.length - 1]

    if (previous && stylesEqual(previous.style, run.style)) {
      previous.text += run.text
      continue
    }

    line.push({ text: run.text, style: { ...run.style } })
  }
}

const attrGet = (token: Token, name: string) => token.attrGet(name) ?? undefined

const consumeInlineToken = (
  lines: RichTextLine[],
  stack: StyleFrame[],
  token: Token,
) => {
  switch (token.type) {
    case "text":
    case "code_inline":
      appendText(lines, stack, token.content)
      return
    case "softbreak":
    case "hardbreak":
      appendText(lines, stack, "\n")
      return
    case "strong_open":
      stack.push({ bold: true })
      return
    case "strong_close":
      stack.pop()
      return
    case "em_open":
      stack.push({ italic: true })
      return
    case "em_close":
      stack.pop()
      return
    case "s_open":
      stack.push({ strike: true })
      return
    case "s_close":
      stack.pop()
      return
    case "link_open":
      stack.push({ href: attrGet(token, "href") })
      return
    case "link_close":
      stack.pop()
      return
    case "html_inline": {
      const htmlToken = parseHtmlInlineToken(token.content)

      if (htmlToken.kind === "open") {
        stack.push(htmlToken.frame)
        return
      }

      if (htmlToken.kind === "close") {
        stack.pop()
        return
      }

      appendText(lines, stack, htmlToken.text)
      return
    }
    default:
      if (token.content) {
        appendText(lines, stack, token.content)
      }
  }
}

const consumeInlineTokens = (
  lines: RichTextLine[],
  stack: StyleFrame[],
  tokens: Token[],
) => {
  for (const token of tokens) {
    consumeInlineToken(lines, stack, token)
  }
}

const inlineTokenToRuns = (token: Token, frames: StyleFrame[] = []): RichTextLine => {
  const lines: RichTextLine[] = [[]]
  const stack = frames.map((frame) => ({ ...frame }))

  if (token.children) {
    consumeInlineTokens(lines, stack, token.children)
  }

  return lines[0]
}

const visibleText = (runs: RichTextLine) => runs.map((run) => run.text).join("")
const visibleWidth = (runs: RichTextLine) => getTextDisplayWidth(visibleText(runs))

const withHeaderStyle = (runs: RichTextLine): RichTextLine =>
  runs.map((run) => ({
    text: run.text,
    style: {
      ...run.style,
      bold: true,
    },
  }))

const appendPlainRun = (line: RichTextLine, text: string) => {
  if (!text) {
    return
  }

  line.push({ text, style: emptyStyle() })
}

const tableToLines = (rows: TableRow[]): RichTextLine[] => {
  const columnCount = Math.max(0, ...rows.map((row) => row.length))
  const columnWidths = Array.from({ length: columnCount }, (_, columnIndex) =>
    Math.max(0, ...rows.map((row) => visibleWidth(row[columnIndex]?.runs ?? []))),
  )

  return rows.map((row) => {
    const line: RichTextLine = []

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      if (columnIndex > 0) {
        appendPlainRun(line, " ".repeat(tableColumnGap))
      }

      const cell = row[columnIndex]
      const runs = cell?.header ? withHeaderStyle(cell.runs) : cell?.runs ?? []
      appendRuns(line, runs)

      if (columnIndex < columnCount - 1) {
        appendPlainRun(line, " ".repeat(columnWidths[columnIndex] - visibleWidth(runs)))
      }
    }

    return line
  })
}

const parseTable = (tokens: Token[], startIndex: number) => {
  const rows: TableRow[] = []
  let currentRow: TableRow | undefined
  let currentCell: TableCell | undefined
  let endIndex = startIndex

  for (let index = startIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index]

    if (token.type === "table_close") {
      endIndex = index
      break
    }

    if (token.type === "tr_open") {
      currentRow = []
      continue
    }

    if (token.type === "tr_close") {
      if (currentRow) {
        rows.push(currentRow)
      }
      currentRow = undefined
      continue
    }

    if (token.type === "th_open" || token.type === "td_open") {
      currentCell = { runs: [], header: token.type === "th_open" }
      continue
    }

    if (token.type === "th_close" || token.type === "td_close") {
      if (currentRow && currentCell) {
        currentRow.push(currentCell)
      }
      currentCell = undefined
      continue
    }

    if (token.type === "inline" && currentCell) {
      currentCell.runs = inlineTokenToRuns(token)
    }
  }

  return {
    endIndex,
    lines: tableToLines(rows),
  }
}

const appendLines = (target: RichTextLine[], nextLines: RichTextLine[]) => {
  for (const line of nextLines) {
    if (target.length === 1 && target[0].length === 0) {
      target[0] = line
      continue
    }

    target.push(line)
  }
}

export const parseMarkdownToRichLines = (content: string): RichTextLine[] => {
  const lines: RichTextLine[] = [[]]
  const stack: StyleFrame[] = []
  const tokens = markdown.parse(content, {})

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]

    if (token.type === "table_open") {
      const table = parseTable(tokens, index)
      appendLines(lines, table.lines)
      index = table.endIndex

      if (tokens[index + 1]) {
        lines.push([])
      }
      continue
    }

    if (token.type === "inline" && token.children) {
      consumeInlineTokens(lines, stack, token.children)
      continue
    }

    if (token.type === "html_block") {
      appendText(lines, stack, stripHtmlTags(token.content))
      continue
    }

    if (token.type === "paragraph_close" && tokens[index + 1]) {
      appendText(lines, stack, "\n")
    }
  }

  return lines
}

