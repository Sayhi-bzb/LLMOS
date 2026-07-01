import { Bug } from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { LlmTurnFrame } from "@/components/llm/types"
import { parseCanvasContent } from "@/lib/canvas-content"
import { canvasLinesToCells } from "@/lib/canvas-text"
import { stabilizeMarkdownStream } from "@/lib/markdown-stream"

interface LlmDebugPanelProps {
  frame?: LlmTurnFrame
  isStreaming: boolean
}

const debugCols = 120

const cellsToText = (cells: ReturnType<typeof canvasLinesToCells>) =>
  cells
    .map((row) => row.map((cell) => cell.char).join("").trimEnd())
    .join("\n")
    .trimEnd()

const preview = (value: string) => value || "<empty>"

export function LlmDebugPanel({ frame, isStreaming }: LlmDebugPanelProps) {
  const diagnostics = useMemo(() => {
    const frameContent = frame?.content ?? ""
    const rawFinalContent = frame?.rawFinalContent ?? ""
    const stabilized = stabilizeMarkdownStream(frameContent, { streaming: isStreaming })
    const canvasLines = parseCanvasContent(frameContent, { streaming: isStreaming })
    const canvasText = cellsToText(canvasLinesToCells(canvasLines, debugCols, 1))

    return {
      rawFinalContent,
      frameContent,
      markdownStable: stabilized.stable,
      markdownPending: stabilized.pending,
      canvasText,
    }
  }, [frame, isStreaming])

  if (!import.meta.env.DEV) {
    return null
  }

  if (!frame) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Open debug panel"
              disabled
              size="icon"
              type="button"
              variant="secondary"
            >
              <Bug className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Debug · no frame</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                aria-label="Open debug panel"
                size="icon"
                type="button"
                variant="secondary"
              >
                <Bug className="size-4" aria-hidden="true" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Debug · {frame.status}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-h-[calc(100vh-4rem)] overflow-auto border-amber-300 bg-amber-50 text-xs text-amber-950 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Debug output pipeline</DialogTitle>
          <DialogDescription className="text-amber-800">
            {frame.status} · frame {diagnostics.frameContent.length.toLocaleString()} chars
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <DebugBlock label="rawFinalContent" value={diagnostics.rawFinalContent} />
          <DebugBlock label="frameContent" value={diagnostics.frameContent} />
          <DebugBlock label="markdownStable" value={diagnostics.markdownStable} />
          <DebugBlock label="markdownPending" value={diagnostics.markdownPending} />
          <DebugBlock label="canvasText" value={diagnostics.canvasText} />
          <div className="rounded-none border border-amber-200 bg-white/70 p-2 font-mono">
            <div>status: {frame.status}</div>
            <div>streaming: {String(isStreaming)}</div>
            <div>raw length: {diagnostics.rawFinalContent.length}</div>
            <div>frame length: {diagnostics.frameContent.length}</div>
            <div>stable length: {diagnostics.markdownStable.length}</div>
            <div>pending length: {diagnostics.markdownPending.length}</div>
            <div>canvas length: {diagnostics.canvasText.length}</div>
            <div>lastCompletionLength: {frame.debug?.lastCompletionLength ?? "n/a"}</div>
            <div>finalCompletionLength: {frame.debug?.finalCompletionLength ?? "n/a"}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DebugBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-none border border-amber-200 bg-white/70 p-2">
      <div className="mb-1 font-medium">{label}</div>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5">
        {preview(value)}
      </pre>
    </section>
  )
}
