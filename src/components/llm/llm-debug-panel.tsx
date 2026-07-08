import { Bug } from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

      <DialogContent className="max-h-[calc(100vh-4rem)] overflow-hidden border-border bg-background text-foreground sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Debug output pipeline</DialogTitle>
          <DialogDescription>
            {frame.status} · frame {diagnostics.frameContent.length.toLocaleString()} chars
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="min-h-0">
          <TabsList className="max-w-full overflow-x-auto" variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="raw">Raw</TabsTrigger>
            <TabsTrigger value="frame">Frame</TabsTrigger>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
            <TabsTrigger value="canvas">Canvas</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <DebugOverview frame={frame} isStreaming={isStreaming} diagnostics={diagnostics} />
          </TabsContent>
          <TabsContent value="raw">
            <DebugBlock label="rawFinalContent" value={diagnostics.rawFinalContent} />
          </TabsContent>
          <TabsContent value="frame">
            <DebugBlock label="frameContent" value={diagnostics.frameContent} />
          </TabsContent>
          <TabsContent value="markdown">
            <div className="grid gap-3 md:grid-cols-2">
              <DebugBlock label="markdownStable" value={diagnostics.markdownStable} />
              <DebugBlock label="markdownPending" value={diagnostics.markdownPending} />
            </div>
          </TabsContent>
          <TabsContent value="canvas">
            <DebugBlock label="canvasText" value={diagnostics.canvasText} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function DebugOverview({
  frame,
  isStreaming,
  diagnostics,
}: {
  frame: LlmTurnFrame
  isStreaming: boolean
  diagnostics: {
    rawFinalContent: string
    frameContent: string
    markdownStable: string
    markdownPending: string
    canvasText: string
  }
}) {
  return (
    <Card size="sm">
      <CardContent className="grid max-h-[60vh] gap-2 overflow-auto font-mono">
        <DebugMetric label="status" value={frame.status} />
        <DebugMetric label="streaming" value={String(isStreaming)} />
        <DebugMetric label="raw length" value={diagnostics.rawFinalContent.length} />
        <DebugMetric label="frame length" value={diagnostics.frameContent.length} />
        <DebugMetric label="stable length" value={diagnostics.markdownStable.length} />
        <DebugMetric label="pending length" value={diagnostics.markdownPending.length} />
        <DebugMetric label="canvas length" value={diagnostics.canvasText.length} />
        <DebugMetric label="lastCompletionLength" value={frame.debug?.lastCompletionLength ?? "n/a"} />
        <DebugMetric
          label="finalCompletionLength"
          value={frame.debug?.finalCompletionLength ?? "n/a"}
        />
      </CardContent>
    </Card>
  )
}

function DebugMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function DebugBlock({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-muted-foreground">
          {preview(value)}
        </pre>
      </CardContent>
    </Card>
  )
}
