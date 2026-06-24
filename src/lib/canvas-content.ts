import { parseAnsiToLines } from "@/lib/ansi"
import type { CanvasLine, CanvasStyle } from "@/lib/canvas-text"
import { stabilizeMarkdownStream } from "@/lib/markdown-stream"
import { parseMarkdownToRichLines, type RichTextLine, type RichTextStyle } from "@/lib/rich-markup"

export interface CanvasContentParseOptions {
  streaming?: boolean
}

const markdownProtocolPattern = /(?:\*\*|~~|<\/?(?:span|u)\b|\[[^\]]+\]\([^)]*\))/i
const ansiProtocolPattern = /(?:\x1b\[|\x1b\]8;|\]8;|\[(?:\d{1,3};)+\d{0,3}m?)/

const hexToRgb = (value: string) => {
  const hex = value.slice(1)
  const expanded = hex.length === 3
    ? hex.split("").map((char) => `${char}${char}`).join("")
    : hex
  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)

  return `rgb(${red}, ${green}, ${blue})`
}

const richStyleToCanvasStyle = (style: RichTextStyle): CanvasStyle => ({
  ...(style.color ? { foreground: hexToRgb(style.color) } : {}),
  ...(style.background ? { background: hexToRgb(style.background) } : {}),
  ...(style.href ? { label: style.href } : {}),
  decorations: [
    ...(style.bold ? ["bold" as const] : []),
    ...(style.italic ? ["italic" as const] : []),
    ...(style.underline ? ["underline" as const] : []),
    ...(style.strike ? ["strikethrough" as const] : []),
  ],
})

export const richTextLinesToCanvasLines = (lines: RichTextLine[]): CanvasLine[] =>
  lines.map((line) =>
    line.map((run) => ({
      text: run.text,
      style: richStyleToCanvasStyle(run.style),
      sourceText: run.text,
    })),
  )

export const parseMarkdownToCanvasLines = (content: string): CanvasLine[] =>
  richTextLinesToCanvasLines(parseMarkdownToRichLines(content))

export const parseAnsiToCanvasLines = (content: string): CanvasLine[] => parseAnsiToLines(content)

export const parseCanvasContent = (
  content: string,
  options: CanvasContentParseOptions = {},
): CanvasLine[] => {
  if (markdownProtocolPattern.test(content) || !ansiProtocolPattern.test(content)) {
    return parseMarkdownToCanvasLines(stabilizeMarkdownStream(content, options).stable)
  }

  return parseAnsiToCanvasLines(content)
}