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
  href?: string
}

export interface AnsiRun {
  text: string
  style: AnsiStyle
}

export type AnsiLine = AnsiRun[]

export interface AnsiCell {
  char: string
  style: AnsiStyle
}

interface OscSegment {
  text: string
  href?: string
}

const osc8Pattern = /\x1b\]8;[^;]*;([^\x1b\x07]*)(?:\x1b\\|\x07)([\s\S]*?)\x1b\]8;[^;]*;(?:\x1b\\|\x07)/g

const emptyStyle = (): AnsiStyle => ({ decorations: [] })

const cloneStyle = (style: AnsiStyle): AnsiStyle => ({
  ...(style.foreground ? { foreground: style.foreground } : {}),
  ...(style.background ? { background: style.background } : {}),
  ...(style.href ? { href: style.href } : {}),
  decorations: [...style.decorations],
})

const toRgb = (value: string | null | undefined) => {
  if (!value) {
    return undefined
  }

  return `rgb(${value})`
}

const toStyle = (entry: Anser.AnserJsonEntry, href?: string): AnsiStyle => {
  const foreground = toRgb(entry.fg_truecolor || entry.fg)
  const background = toRgb(entry.bg_truecolor || entry.bg)
  const decorations = [...new Set(entry.decorations ?? [])] as AnsiTextDecoration[]

  return {
    ...(foreground ? { foreground } : {}),
    ...(background ? { background } : {}),
    ...(href ? { href } : {}),
    decorations,
  }
}

const splitOsc8Segments = (content: string): OscSegment[] => {
  const segments: OscSegment[] = []
  let lastIndex = 0

  for (const match of content.matchAll(osc8Pattern)) {
    const matchIndex = match.index ?? 0

    if (matchIndex > lastIndex) {
      segments.push({ text: content.slice(lastIndex, matchIndex) })
    }

    segments.push({ href: match[1], text: match[2] })
    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < content.length) {
    segments.push({ text: content.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ text: content }]
}

const splitRunIntoLines = (run: AnsiRun): AnsiLine[] => {
  const parts = run.text.split("\n")

  return parts.map((text) => (text.length > 0 ? [{ ...run, text }] : []))
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

      appendRunToLines(lines, {
        text: entry.content,
        style: toStyle(entry, segment.href),
      })
    }
  }

  return lines
}

export const stripAnsi = (content: string) => Anser.ansiToText(content)

export const ansiLinesToCells = (
  lines: AnsiLine[],
  cols: number,
  minRows = lines.length,
): AnsiCell[][] => {
  const rowCount = Math.max(minRows, lines.length, 1)

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const cells: AnsiCell[] = Array.from({ length: cols }, () => ({
      char: " ",
      style: emptyStyle(),
    }))
    let colIndex = 0

    for (const run of lines[rowIndex] ?? []) {
      for (const char of Array.from(run.text)) {
        if (colIndex >= cols) {
          break
        }

        cells[colIndex] = {
          char,
          style: cloneStyle(run.style),
        }
        colIndex += 1
      }

      if (colIndex >= cols) {
        break
      }
    }

    return cells
  })
}
