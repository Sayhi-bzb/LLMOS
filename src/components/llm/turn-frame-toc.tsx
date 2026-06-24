import * as React from "react"

import {
  TableOfContents,
  TableOfContentsList,
  TableOfContentsMobile,
  type TocItem,
} from "@/components/llm/table-of-contents"
import type { LlmTurnFrame } from "@/components/llm/types"
import { cn } from "@/lib/utils"

type TurnFrameTocVariant = "desktop" | "mobile"

interface TurnFrameTocProps {
  frames: LlmTurnFrame[]
  selectedFrameId: string | null
  onSelectFrame: (frameId: string) => void
  variant: TurnFrameTocVariant
  className?: string
}

export function TurnFrameToc({
  frames,
  selectedFrameId,
  onSelectFrame,
  variant,
  className,
}: TurnFrameTocProps) {
  const items = React.useMemo(
    () =>
      frames.map<TocItem>((frame, index) => ({
        id: frame.id,
        title: `${String(index + 1).padStart(2, "0")} ${frame.title} ${getStatusLabel(frame.status)}`,
        depth: 2,
      })),
    [frames]
  )

  if (items.length === 0) {
    return null
  }

  if (variant === "mobile") {
    return (
      <TableOfContentsMobile
        items={items}
        activeId={selectedFrameId ?? undefined}
        onItemClick={onSelectFrame}
        title="Frames"
        className={cn("lg:hidden", className)}
      />
    )
  }

  return (
    <aside
      className={cn(
        "pointer-events-auto fixed top-24 left-6 z-20 hidden w-56 xl:block",
        className
      )}
    >
      <div className="max-h-[calc(100svh-6rem)]">
        <TableOfContents
          items={items}
          activeId={selectedFrameId ?? undefined}
          onItemClick={onSelectFrame}
        >
          <TableOfContentsList />
        </TableOfContents>
      </div>
    </aside>
  )
}

function getStatusLabel(status: LlmTurnFrame["status"]) {
  switch (status) {
    case "streaming":
      return "live"
    case "complete":
      return "done"
    case "error":
      return "err"
    case "stopped":
      return "stop"
  }
}


