import * as React from "react"

import {
  TableOfContents,
  TableOfContentsList,
  TableOfContentsMobile,
  type TocItem,
} from "@/components/llm/table-of-contents"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { LlmTurnFrame } from "@/components/llm/types"
import { cn } from "@/lib/utils"

type TurnFrameTocVariant = "desktop" | "mobile"

interface TurnFrameTocProps {
  frames: LlmTurnFrame[]
  selectedFrameId: string | null
  onSelectFrame: (frameId: string) => void
  variant: TurnFrameTocVariant
  header?: React.ReactNode
  className?: string
}

export function TurnFrameToc({
  frames,
  selectedFrameId,
  onSelectFrame,
  variant,
  header,
  className,
}: TurnFrameTocProps) {
  const items = React.useMemo(
    () =>
      frames.map<TocItem>((frame) => ({
        id: frame.id,
        title: frame.title,
        depth: 2,
        status: frame.status,
      })),
    [frames]
  )

  if (items.length === 0 && !header) {
    return null
  }

  if (variant === "mobile") {
    return items.length ? (
      <TableOfContentsMobile
        items={items}
        activeId={selectedFrameId ?? undefined}
        onItemClick={onSelectFrame}
        title="Frames"
        className={cn("lg:hidden", className)}
      />
    ) : null
  }

  return (
    <aside
      className={cn(
        "pointer-events-auto fixed top-24 left-6 z-20 hidden w-56 xl:block",
        className
      )}
    >
      <div className="flex h-[calc(100svh-6rem)] min-h-0 flex-col gap-5">
        {header ? <div className="shrink-0">{header}</div> : null}
        {items.length ? (
          <ScrollArea className="min-h-0 flex-1 pr-2">
            <TableOfContents
              items={items}
              activeId={selectedFrameId ?? undefined}
              onItemClick={onSelectFrame}
            >
              <TableOfContentsList />
            </TableOfContents>
          </ScrollArea>
        ) : null}
      </div>
    </aside>
  )
}
