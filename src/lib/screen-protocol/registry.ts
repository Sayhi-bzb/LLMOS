import { ansiProtocol } from "@/lib/screen-protocol/ansi"
import { markdownProtocol } from "@/lib/screen-protocol/markdown"
import type { ScreenProtocol, ScreenProtocolId } from "@/lib/screen-protocol/types"

export const activeScreenProtocolId: ScreenProtocolId = "ansi"

const protocols = {
  markdown: markdownProtocol,
  ansi: ansiProtocol,
} satisfies Record<ScreenProtocolId, ScreenProtocol>

export const getScreenProtocol = (id: ScreenProtocolId = activeScreenProtocolId) => protocols[id]

export const resolveScreenProtocol = (content: string): ScreenProtocol => {
  if (markdownProtocol.detect(content) || !ansiProtocol.detect(content)) {
    return markdownProtocol
  }

  return ansiProtocol
}
