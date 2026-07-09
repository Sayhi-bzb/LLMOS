import Anser from "anser"
import { parseAnsiToLines } from "@/lib/ansi"
import { resolveAnsiColor } from "@/lib/ansi-theme"
import type { CanvasLine, CanvasTextDecoration } from "@/lib/canvas-text"
import type { ScreenFrame, ScreenLine, ScreenProtocol, ScreenStyle } from "@/lib/screen-protocol/types"

const ansiProtocolPattern = /(?:\x1b\[|\x1b\]8;|\]8;|\[(?:\d{1,3};)+\d{0,3}m?)/
const tailSearchLimit = 512
const bareOsc8Prefix = "]8;"
const standardOsc8Prefix = "\x1b]8;"
const standardCsiPrefix = "\x1b["
const standardSgrPrefix = "\x1b["

const splitAt = (content: string, index: number) => ({
  stable: content.slice(0, index),
  pending: content.slice(index),
})

const findIncompleteBareSgrStart = (content: string) => {
  const searchStart = Math.max(0, content.length - tailSearchLimit)
  const openIndex = content.lastIndexOf("[")

  if (openIndex < searchStart) {
    return -1
  }

  const tail = content.slice(openIndex)

  return /^\[\d[\d;]*$/.test(tail) ? openIndex : -1
}

const findIncompleteStandardCsiStart = (content: string) => {
  const searchStart = Math.max(0, content.length - tailSearchLimit)
  const openIndex = content.lastIndexOf(standardCsiPrefix)

  if (openIndex < searchStart) {
    return -1
  }

  const tail = content.slice(openIndex + standardCsiPrefix.length)

  return /^[\d;]*$/.test(tail) ? openIndex : -1
}

const findIncompleteBareOsc8Start = (content: string) => {
  const searchStart = Math.max(0, content.length - tailSearchLimit)
  const openIndex = content.lastIndexOf(bareOsc8Prefix)

  if (openIndex < searchStart) {
    return -1
  }

  const tail = content.slice(openIndex)

  if (/^\]8;(?:;[^\r\n\\]*)?$/.test(tail)) {
    return openIndex
  }

  const separatorIndex = tail.indexOf(";")
  const uriStart = separatorIndex === -1 ? -1 : separatorIndex + 1

  if (uriStart === -1) {
    return -1
  }

  return tail.slice(uriStart).includes("\\") ? -1 : openIndex
}

const findIncompleteStandardOsc8Start = (content: string) => {
  const searchStart = Math.max(0, content.length - tailSearchLimit)
  const openIndex = content.lastIndexOf(standardOsc8Prefix)

  if (openIndex < searchStart) {
    return -1
  }

  const tail = content.slice(openIndex + standardOsc8Prefix.length)
  const hasTerminator = tail.includes("\x1b\\") || tail.includes("\x07")

  return hasTerminator ? -1 : openIndex
}

const findFirstPendingStart = (content: string) => {
  const starts = [
    findIncompleteBareSgrStart(content),
    findIncompleteStandardCsiStart(content),
    findIncompleteBareOsc8Start(content),
    findIncompleteStandardOsc8Start(content),
  ].filter((index) => index !== -1)

  return starts.length > 0 ? Math.min(...starts) : -1
}

const stabilizeAnsiStream = (content: string, streaming?: boolean) => {
  if (!streaming || !ansiProtocolPattern.test(content)) {
    return { stable: content, pending: "" }
  }

  const pendingStart = findFirstPendingStart(content)

  return pendingStart === -1 ? { stable: content, pending: "" } : splitAt(content, pendingStart)
}

const canvasDecorationsToScreenStyle = (
  decorations: CanvasTextDecoration[],
): Pick<
  ScreenStyle,
  "bold" | "dim" | "italic" | "underline" | "strike" | "blink" | "reverse" | "hidden"
> => ({
  ...(decorations.includes("bold") ? { bold: true } : {}),
  ...(decorations.includes("dim") ? { dim: true } : {}),
  ...(decorations.includes("italic") ? { italic: true } : {}),
  ...(decorations.includes("underline") ? { underline: true } : {}),
  ...(decorations.includes("strikethrough") ? { strike: true } : {}),
  ...(decorations.includes("blink") ? { blink: true } : {}),
  ...(decorations.includes("reverse") ? { reverse: true } : {}),
  ...(decorations.includes("hidden") ? { hidden: true } : {}),
})

const anserDecorationsToScreenStyle = (
  decorations?: string[],
): Pick<
  ScreenStyle,
  "bold" | "dim" | "italic" | "underline" | "strike" | "blink" | "reverse" | "hidden"
> => ({
  ...(decorations?.includes("bold") ? { bold: true } : {}),
  ...(decorations?.includes("dim") ? { dim: true } : {}),
  ...(decorations?.includes("italic") ? { italic: true } : {}),
  ...(decorations?.includes("underline") ? { underline: true } : {}),
  ...(decorations?.includes("strikethrough") ? { strike: true } : {}),
  ...(decorations?.includes("blink") ? { blink: true } : {}),
  ...(decorations?.includes("reverse") ? { reverse: true } : {}),
  ...(decorations?.includes("hidden") ? { hidden: true } : {}),
})

const canvasLinesToScreenLines = (lines: CanvasLine[]): ScreenLine[] =>
  lines.map((line) =>
    line.map((run) => ({
      text: run.text,
      style: {
        ...(run.style.foreground ? { foreground: run.style.foreground } : {}),
        ...(run.style.background ? { background: run.style.background } : {}),
        ...(run.style.label ? { href: run.style.label } : {}),
        ...canvasDecorationsToScreenStyle(run.style.decorations),
      },
    })),
  )

const parseLeadingSgrToken = (content: string) => {
  if (content.startsWith(standardSgrPrefix)) {
    const endIndex = content.indexOf("m", standardSgrPrefix.length)

    return endIndex === -1 ? undefined : content.slice(0, endIndex + 1)
  }

  if (!content.startsWith("[")) {
    return undefined
  }

  const endIndex = content.indexOf("m", 1)

  if (endIndex === -1) {
    return undefined
  }

  const body = content.slice(1, endIndex)

  return /^[\d;]+$/.test(body) ? `\x1b[${body}m` : undefined
}

const parseLeadingLineSgrToken = (content: string) => {
  const leadingWhitespaceLength = content.length - content.trimStart().length

  return parseLeadingSgrToken(content.slice(leadingWhitespaceLength))
}

const sgrTokenToStyle = (token: string): ScreenStyle | undefined => {
  const [entry] = Anser.ansiToJson(`${token}x`, {
    remove_empty: true,
    use_classes: true,
  })
  const foreground = resolveAnsiColor(entry?.fg, entry?.fg_truecolor)
  const background = resolveAnsiColor(entry?.bg, entry?.bg_truecolor)
  const decorations = anserDecorationsToScreenStyle(entry?.decorations)

  return foreground || background || Object.keys(decorations).length > 0
    ? {
        ...(foreground ? { foreground } : {}),
        ...(background ? { background } : {}),
        ...decorations,
      }
    : undefined
}

const sgrTokenToFillStyle = (token: string): ScreenStyle | undefined => {
  const style = sgrTokenToStyle(token)

  return style?.background ? style : undefined
}

const getFrameFillStyle = (content: string): ScreenStyle | undefined => {
  const token = parseLeadingSgrToken(content)

  if (!token) {
    return undefined
  }

  const style = sgrTokenToFillStyle(token)

  return style
    ? {
        ...(style.foreground ? { foreground: style.foreground } : {}),
        ...(style.background ? { background: style.background } : {}),
      }
    : undefined
}

const getLineFillStyles = (content: string): Array<ScreenStyle | undefined> =>
  content.split("\n").map((line) => {
    const token = parseLeadingLineSgrToken(line)

    if (!token) {
      return undefined
    }

    return sgrTokenToFillStyle(token)
  })

const applyLineFillStyles = (
  lines: ScreenLine[],
  fillStyles: Array<ScreenStyle | undefined>,
) => {
  lines.forEach((line, index) => {
    const fillStyle = fillStyles[index]

    if (fillStyle) {
      line.fillStyle = fillStyle
    }
  })

  return lines
}

export const ansiProtocol: ScreenProtocol = {
  id: "ansi",
  detect: (content) => ansiProtocolPattern.test(content),
  stabilize: (content, options) => stabilizeAnsiStream(content, options?.streaming),
  parse: (content, options): ScreenFrame => {
    const stabilized = stabilizeAnsiStream(content, options?.streaming)
    const stable = stabilized.stable
    const lines = canvasLinesToScreenLines(parseAnsiToLines(stable))

    return {
      lines: applyLineFillStyles(lines, getLineFillStyles(stable)),
      fillStyle: getFrameFillStyle(stable),
    }
  },
}
