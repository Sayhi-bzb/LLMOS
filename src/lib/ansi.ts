import Anser from "anser"

export type AnsiTextDecoration =
  | "bold"
  | "dim"
  | "italic"
  | "underline"
  | "blink"
  | "reverse"
  | "hidden"
  | "strikethrough"

export interface AnsiStyle {
  foreground?: string
  background?: string
  decorations: AnsiTextDecoration[]
  label?: string
}

export interface AnsiRun {
  text: string
  style: AnsiStyle
  sourceText?: string
}

export type AnsiLine = AnsiRun[]

export interface AnsiCell {
  char: string
  style: AnsiStyle
  width?: number
  continuation?: boolean
  sourceText?: string
}


interface OscSegment {
  text: string
  label?: string
}

interface ControlToken {
  end: number
  text?: string
  label?: string
  partial?: boolean
}

interface BareSgrBoundary {
  index: number
  partial: boolean
}

const standardOsc8Prefix = "\x1b]8;"
const standardCsiPrefix = "\x1b["
const bareOsc8Prefix = "]8;"

const isSgrParamChar = (char: string) => /[\d;]/.test(char)

const isCsiFinalByte = (char: string) => {
  const code = char.charCodeAt(0)
  return code >= 0x40 && code <= 0x7e
}

const parseOsc8Payload = (payload: string) => {
  const separatorIndex = payload.indexOf(";")

  if (separatorIndex === -1) {
    return undefined
  }

  return payload.slice(separatorIndex + 1)
}

const findStandardTerminator = (content: string, startIndex: number) => {
  const escapeTerminatorIndex = content.indexOf("\x1b\\", startIndex)
  const bellTerminatorIndex = content.indexOf("\x07", startIndex)

  if (escapeTerminatorIndex === -1) {
    return bellTerminatorIndex === -1
      ? null
      : { index: bellTerminatorIndex, end: bellTerminatorIndex + 1 }
  }

  if (bellTerminatorIndex === -1 || escapeTerminatorIndex < bellTerminatorIndex) {
    return { index: escapeTerminatorIndex, end: escapeTerminatorIndex + 2 }
  }

  return { index: bellTerminatorIndex, end: bellTerminatorIndex + 1 }
}

const parseBareSgrToken = (content: string, index: number): ControlToken | null => {
  if (content[index] !== "[") {
    return null
  }

  let cursor = index + 1

  while (cursor < content.length) {
    const char = content[cursor]

    if (char === "m") {
      return {
        end: cursor + 1,
        text: `\x1b[${content.slice(index + 1, cursor)}m`,
      }
    }

    if (!isSgrParamChar(char)) {
      return null
    }

    cursor += 1
  }

  return { end: content.length, partial: true }
}

const findBareSgrBoundary = (
  content: string,
  startIndex: number,
): BareSgrBoundary | null => {
  let searchIndex = startIndex

  while (searchIndex < content.length) {
    const index = content.indexOf("[", searchIndex)

    if (index === -1) {
      return null
    }

    const token = parseBareSgrToken(content, index)

    if (token?.text) {
      return { index, partial: false }
    }

    if (token?.partial) {
      return { index, partial: true }
    }

    searchIndex = index + 1
  }

  return null
}

const parseStandardCsiToken = (content: string, index: number): ControlToken | null => {
  if (!content.startsWith(standardCsiPrefix, index)) {
    return null
  }

  let cursor = index + standardCsiPrefix.length

  while (cursor < content.length) {
    if (isCsiFinalByte(content[cursor])) {
      return { end: cursor + 1, text: content.slice(index, cursor + 1) }
    }

    cursor += 1
  }

  return { end: content.length, partial: true }
}

const parseStandardOsc8Token = (content: string, index: number): ControlToken | null => {
  if (!content.startsWith(standardOsc8Prefix, index)) {
    return null
  }

  const payloadStart = index + standardOsc8Prefix.length
  const terminator = findStandardTerminator(content, payloadStart)

  if (!terminator) {
    return { end: content.length, partial: true }
  }

  const uri = parseOsc8Payload(content.slice(payloadStart, terminator.index))

  if (uri === undefined) {
    return { end: terminator.end, partial: true }
  }

  return { end: terminator.end, label: uri }
}
const parseBareOsc8CloseToken = (content: string, uriStart: number): ControlToken => {
  if (content.startsWith("[0m]", uriStart)) {
    return { end: uriStart + 4, label: "" }
  }

  if (content.startsWith("[0m", uriStart)) {
    return { end: uriStart + 3, label: "" }
  }

  if (content.startsWith("\\", uriStart) || content.startsWith("]", uriStart)) {
    return { end: uriStart + 1, label: "" }
  }

  return { end: uriStart, label: "" }
}

const parseBareOsc8Token = (
  content: string,
  index: number,
  currentLabel?: string,
): ControlToken | null => {
  if (!content.startsWith(bareOsc8Prefix, index)) {
    return null
  }

  const paramsStart = index + bareOsc8Prefix.length
  const separatorIndex = content.indexOf(";", paramsStart)

  if (separatorIndex === -1) {
    return { end: content.length, partial: true }
  }

  const uriStart = separatorIndex + 1
  const isCloseCandidate = separatorIndex === paramsStart

  if (isCloseCandidate) {
    if (
      uriStart >= content.length ||
      content[uriStart] === "[" ||
      content[uriStart] === "\\" ||
      content[uriStart] === "]" ||
      /\s/.test(content[uriStart]) ||
      (currentLabel && content[uriStart] !== "/")
    ) {
      return parseBareOsc8CloseToken(content, uriStart)
    }
  }

  const backslashIndex = content.indexOf("\\", uriStart)
  const sgrBoundary = findBareSgrBoundary(content, uriStart)

  if (
    backslashIndex !== -1 &&
    (!sgrBoundary || backslashIndex < sgrBoundary.index)
  ) {
    return {
      end: backslashIndex + 1,
      label: content.slice(uriStart, backslashIndex),
    }
  }

  if (sgrBoundary?.partial) {
    return { end: content.length, partial: true }
  }

  if (sgrBoundary) {
    return {
      end: sgrBoundary.index,
      label: content.slice(uriStart, sgrBoundary.index),
    }
  }

  return { end: content.length, partial: true }
}

const parseEscControlToken = (content: string, index: number): ControlToken | null => {
  if (content[index] !== "\x1b") {
    return null
  }

  const tail = content.slice(index)

  if (standardCsiPrefix.startsWith(tail) || standardOsc8Prefix.startsWith(tail)) {
    return { end: content.length, partial: true }
  }

  return null
}

const parseControlToken = (
  content: string,
  index: number,
  currentLabel?: string,
): ControlToken | null =>
  parseStandardCsiToken(content, index) ??
  parseStandardOsc8Token(content, index) ??
  parseEscControlToken(content, index) ??
  parseBareOsc8Token(content, index, currentLabel) ??
  parseBareSgrToken(content, index)

const splitOsc8Segments = (content: string): OscSegment[] => {
  const segments: OscSegment[] = []
  let currentLabel: string | undefined
  let cursor = 0
  let buffer = ""
  let bufferHasText = false
  let trailingControls = ""

  const pushSegment = (keepTrailingControls = false) => {
    if (buffer) {
      segments.push(currentLabel ? { text: buffer, label: currentLabel } : { text: buffer })
    }

    buffer = keepTrailingControls ? trailingControls : ""
    bufferHasText = false

    if (!keepTrailingControls) {
      trailingControls = ""
    }
  }

  const appendControl = (text: string) => {
    buffer += text
    trailingControls += text
  }

  const appendText = (text: string) => {
    buffer += text
    bufferHasText = true
    trailingControls = ""
  }

  while (cursor < content.length) {
    const token = parseControlToken(content, cursor, currentLabel)

    if (token?.partial) {
      break
    }

    if (token?.label !== undefined) {
      if (bufferHasText) {
        pushSegment(true)
      }

      currentLabel = token.label || undefined
      cursor = token.end
      continue
    }

    if (token?.text) {
      appendControl(token.text)
      cursor = token.end
      continue
    }

    const codePoint = content.codePointAt(cursor)
    const text = codePoint === undefined ? content[cursor] : String.fromCodePoint(codePoint)
    appendText(text)
    cursor += text.length
  }

  if (buffer) {
    pushSegment()
  }

  return segments.length > 0 ? segments : [{ text: "" }]
}

const emptyStyle = (): AnsiStyle => ({ decorations: [] })

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

const cloneStyle = (style: AnsiStyle): AnsiStyle => ({
  ...(style.foreground ? { foreground: style.foreground } : {}),
  ...(style.background ? { background: style.background } : {}),
  ...(style.label ? { label: style.label } : {}),
  decorations: [...style.decorations],
})

const toRgb = (value: string | null | undefined) => {
  if (!value) {
    return undefined
  }

  return `rgb(${value})`
}

const toStyle = (entry: Anser.AnserJsonEntry, label?: string): AnsiStyle => {
  const foreground = toRgb(entry.fg_truecolor || entry.fg)
  const background = toRgb(entry.bg_truecolor || entry.bg)
  const decorations = [...new Set(entry.decorations ?? [])] as AnsiTextDecoration[]

  return {
    ...(foreground ? { foreground } : {}),
    ...(background ? { background } : {}),
    ...(label ? { label } : {}),
    decorations,
  }
}

const rgbToSgrValues = (value: string) => {
  const match = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value)

  return match ? [match[1], match[2], match[3]] : null
}

const decorationToSgrCode = (decoration: AnsiTextDecoration) => {
  switch (decoration) {
    case "bold":
      return "1"
    case "dim":
      return "2"
    case "italic":
      return "3"
    case "underline":
      return "4"
    case "blink":
      return "5"
    case "reverse":
      return "7"
    case "hidden":
      return "8"
    case "strikethrough":
      return "9"
  }
}

const styleToSgr = (style: AnsiStyle) => {
  const codes: string[] = style.decorations.map(decorationToSgrCode)
  const foreground = style.foreground ? rgbToSgrValues(style.foreground) : null
  const background = style.background ? rgbToSgrValues(style.background) : null

  if (foreground) {
    codes.push("38", "2", ...foreground)
  }

  if (background) {
    codes.push("48", "2", ...background)
  }

  return codes.length > 0 ? `\x1b[${codes.join(";")}m` : ""
}

const withAnsiSource = (text: string, style: AnsiStyle) => {
  const sgr = styleToSgr(style)
  const labelStart = style.label ? `\x1b]8;;${style.label}\x1b\\` : ""
  const labelEnd = style.label ? "\x1b]8;;\x1b\\" : ""
  const reset = sgr || style.label ? "\x1b[0m" : ""

  return `${labelStart}${sgr}${text}${reset}${labelEnd}`
}
const splitRunIntoLines = (run: AnsiRun): AnsiLine[] => {
  const parts = run.text.split("\n")

  return parts.map((text) =>
    text.length > 0
      ? [
          {
            ...run,
            text,
            sourceText: withAnsiSource(text, run.style),
          },
        ]
      : [],
  )
}

const appendRunToLines = (lines: AnsiLine[], run: AnsiRun) => {
  const runLines = splitRunIntoLines(run)

  runLines.forEach((line, index) => {
    if (index > 0) {
      lines.push([])
    }

    const currentLine = lines[lines.length - 1]
    currentLine.push(...line)
  })
}


export const parseAnsiToLines = (content: string): AnsiLine[] => {
  const lines: AnsiLine[] = [[]]

  for (const segment of splitOsc8Segments(content)) {
    const entries = Anser.ansiToJson(segment.text, { remove_empty: true })

    for (const entry of entries) {
      if (!entry.content) {
        continue
      }

      const style = toStyle(entry, segment.label)

      appendRunToLines(lines, {
        text: entry.content,
        style,
        sourceText: withAnsiSource(entry.content, style),
      })
    }
  }

  return lines
}


export const stripAnsi = (content: string) =>
  splitOsc8Segments(content)
    .map((segment) => Anser.ansiToText(segment.text))
    .join("")

export const ansiLinesToCells = (
  lines: AnsiLine[],
  cols: number,
  minRows = lines.length,
): AnsiCell[][] => {
  const safeCols = Math.max(1, cols)
  const createEmptyRow = (): AnsiCell[] =>
    Array.from({ length: safeCols }, () => ({
      char: " ",
      style: emptyStyle(),
    }))
  const rows: AnsiCell[][] = []

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
        const cellSourceText = withAnsiSource(char, run.style)
        const cellWidth = Math.min(getCellWidth(char), safeCols)

        if (cellWidth === 0) {
          const previousIndex = Math.max(0, colIndex - 1)
          cells[previousIndex] = {
            ...cells[previousIndex],
            char: `${cells[previousIndex].char}${char}`,
            sourceText: `${cells[previousIndex].sourceText ?? ""}${cellSourceText}`,
          }
          continue
        }

        if (colIndex > 0 && colIndex + cellWidth > safeCols) {
          cells = appendRow()
          colIndex = 0
        }

        cells[colIndex] = {
          char,
          style: cloneStyle(run.style),
          width: cellWidth,
          sourceText: cellSourceText,
        }

        for (let offset = 1; offset < cellWidth; offset += 1) {
          cells[colIndex + offset] = {
            char: "",
            style: cloneStyle(run.style),
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

