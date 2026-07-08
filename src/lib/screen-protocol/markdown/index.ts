import { parseMarkdownToScreenLines } from "@/lib/screen-protocol/markdown/rich-markup"
import { stabilizeMarkdownStream } from "@/lib/screen-protocol/markdown/stream"
import type { ScreenProtocol } from "@/lib/screen-protocol/types"

const markdownProtocolPattern = /(?:\*\*|~~|<\/?(?:span|u)\b|\[[^\]]+\]\([^)]*\))/i

export const markdownProtocol: ScreenProtocol = {
  id: "markdown",
  detect: (content) => markdownProtocolPattern.test(content),
  stabilize: stabilizeMarkdownStream,
  parse: (content, options) => ({
    lines: parseMarkdownToScreenLines(stabilizeMarkdownStream(content, options).stable),
  }),
}
