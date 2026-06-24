import { Button } from "@/components/ui/button"
import type { LlmTurnFrame } from "@/components/llm/types"

interface TurnFrameNavigatorProps {
  frames: LlmTurnFrame[]
  selectedFrameId: string | null
  onSelectFrame: (frameId: string) => void
}

export function TurnFrameNavigator({
  frames,
  selectedFrameId,
  onSelectFrame,
}: TurnFrameNavigatorProps) {
  if (frames.length === 0) {
    return null
  }

  return (
    <nav
      aria-label="Turn frames"
      className="flex min-w-0 items-center gap-2 overflow-x-auto"
    >
      {frames.map((frame, index) => {
        const isSelected = frame.id === selectedFrameId

        return (
          <Button
            aria-current={isSelected ? "true" : undefined}
            key={frame.id}
            onClick={() => onSelectFrame(frame.id)}
            size="sm"
            type="button"
            variant={isSelected ? "secondary" : "ghost"}
          >
            <span className="font-mono tabular-nums">#{index + 1}</span>
            <span className="max-w-36 truncate">{frame.title}</span>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              {getStatusLabel(frame.status)}
            </span>
          </Button>
        )
      })}
    </nav>
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