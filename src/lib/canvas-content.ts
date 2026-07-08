import type { CanvasFrame } from "@/lib/canvas-text"
import { screenFrameToCanvasFrame } from "@/lib/screen-protocol/adapter"
import { getScreenProtocol } from "@/lib/screen-protocol/registry"
import type { ScreenParseOptions } from "@/lib/screen-protocol/types"

export type CanvasContentParseOptions = ScreenParseOptions

export const parseCanvasContent = (
  content: string,
  options: CanvasContentParseOptions = {},
): CanvasFrame => {
  const protocol = getScreenProtocol(options.protocol)

  return screenFrameToCanvasFrame(protocol.parse(content, options))
}
