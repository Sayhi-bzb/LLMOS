import type { CanvasLine } from "@/lib/canvas-text"
import { screenLinesToCanvasLines } from "@/lib/screen-protocol/adapter"
import { getScreenProtocol } from "@/lib/screen-protocol/registry"
import type { ScreenParseOptions } from "@/lib/screen-protocol/types"

export type CanvasContentParseOptions = ScreenParseOptions

export const parseCanvasContent = (
  content: string,
  options: CanvasContentParseOptions = {},
): CanvasLine[] => {
  const protocol = getScreenProtocol(options.protocol)

  return screenLinesToCanvasLines(protocol.parse(content, options))
}
