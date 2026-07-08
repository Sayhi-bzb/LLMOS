import type { CanvasLine, CanvasStyle, CanvasTextDecoration } from "@/lib/canvas-text"
import type { ScreenLine, ScreenStyle } from "@/lib/screen-protocol/types"

const hexColorPattern = /^#(?:[\da-f]{3}|[\da-f]{6})$/i

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

const toCanvasColor = (value: string) => hexColorPattern.test(value) ? hexToRgb(value) : value

const screenStyleToCanvasStyle = (style: ScreenStyle): CanvasStyle => {
  const decorations: CanvasTextDecoration[] = [
    ...(style.bold ? ["bold" as const] : []),
    ...(style.dim ? ["dim" as const] : []),
    ...(style.italic ? ["italic" as const] : []),
    ...(style.underline ? ["underline" as const] : []),
    ...(style.strike ? ["strikethrough" as const] : []),
    ...(style.blink ? ["blink" as const] : []),
    ...(style.reverse ? ["reverse" as const] : []),
    ...(style.hidden ? ["hidden" as const] : []),
  ]

  return {
    ...(style.foreground ? { foreground: toCanvasColor(style.foreground) } : {}),
    ...(style.background ? { background: toCanvasColor(style.background) } : {}),
    ...(style.href ? { label: style.href } : {}),
    decorations,
  }
}

export const screenLinesToCanvasLines = (lines: ScreenLine[]): CanvasLine[] =>
  lines.map((line) =>
    line.map((run) => ({
      text: run.text,
      style: screenStyleToCanvasStyle(run.style),
      sourceText: run.text,
    })),
  )
