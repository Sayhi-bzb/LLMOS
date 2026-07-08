import { Bug } from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { LlmConfigDraft, LlmTurnFrame } from "@/components/llm/types"
import { parseCanvasContent } from "@/lib/canvas-content"
import { canvasLinesToCells } from "@/lib/canvas-text"
import { getScreenProtocol } from "@/lib/screen-protocol/registry"

interface LlmDebugPanelProps {
  frame?: LlmTurnFrame
  isStreaming: boolean
  activeThreadId: string | null
  selectedFrameId: string | null
  canvasContent: string
  frameCount: number
  isLoading: boolean
  configDraft: LlmConfigDraft
  configStatus: string
  hasServerApiKey: boolean
}

const debugCols = 120

const cellsToText = (cells: ReturnType<typeof canvasLinesToCells>) =>
  cells
    .map((row) => row.map((cell) => cell.char).join("").trimEnd())
    .join("\n")
    .trimEnd()

const preview = (value: string) => value || "<empty>"

const formatTime = (value?: number) => (value ? new Date(value).toLocaleTimeString() : "n/a")

const formatDuration = (start?: number, end?: number) =>
  start && end ? `${Math.max(0, end - start)}ms` : "n/a"

const countStyledCells = (cells: ReturnType<typeof canvasLinesToCells>) =>
  cells.flat().filter((cell) => {
    const style = cell.style

    return Boolean(
      style.foreground ||
        style.background ||
        style.label ||
        style.decorations.length > 0,
    )
  }).length

const countHrefCells = (cells: ReturnType<typeof canvasLinesToCells>) =>
  cells.flat().filter((cell) => Boolean(cell.style.label)).length

export function LlmDebugPanel({
  frame,
  isStreaming,
  activeThreadId,
  selectedFrameId,
  canvasContent,
  frameCount,
  isLoading,
  configDraft,
  configStatus,
  hasServerApiKey,
}: LlmDebugPanelProps) {
  const diagnostics = useMemo(() => {
    const frameContent = frame?.content ?? ""
    const rawFinalContent = frame?.rawFinalContent ?? ""
    const protocol = getScreenProtocol()
    const stabilized = protocol.stabilize(frameContent, { streaming: isStreaming })
    const canvasFrame = parseCanvasContent(frameContent, { streaming: isStreaming })
    const canvasCells = canvasLinesToCells(canvasFrame, debugCols, 1)
    const canvasText = cellsToText(canvasCells)

    return {
      rawFinalContent,
      frameContent,
      protocolId: protocol.id,
      protocolStable: stabilized.stable,
      protocolPending: stabilized.pending,
      canvasText,
      canvasRows: canvasCells.length,
      canvasCols: debugCols,
      canvasCellCount: canvasCells.length * debugCols,
      styledCellCount: countStyledCells(canvasCells),
      hrefCellCount: countHrefCells(canvasCells),
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

      <DialogContent className="max-h-[calc(100vh-4rem)] overflow-hidden border-border bg-background text-foreground sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>LLMOS flight recorder</DialogTitle>
          <DialogDescription>
            {frame.status} · frame {diagnostics.frameContent.length.toLocaleString()} chars
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="state" className="min-h-0">
          <TabsList className="max-w-full overflow-x-auto" variant="line">
            <TabsTrigger value="state">State</TabsTrigger>
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="stream">Stream</TabsTrigger>
            <TabsTrigger value="protocol">Protocol</TabsTrigger>
            <TabsTrigger value="canvas">Canvas</TabsTrigger>
            <TabsTrigger value="interaction">Interaction</TabsTrigger>
            <TabsTrigger value="persistence">Persistence</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>

          <TabsContent value="state">
            <DebugCard title="Runtime state">
              <DebugMetric label="activeThreadId" value={activeThreadId ?? "n/a"} />
              <DebugMetric label="selectedFrameId" value={selectedFrameId ?? "n/a"} />
              <DebugMetric label="frame.id" value={frame.id} />
              <DebugMetric label="frame.status" value={frame.status} />
              <DebugMetric label="frameCount" value={frameCount} />
              <DebugMetric label="isLoading" value={String(isLoading)} />
              <DebugMetric label="isStreaming" value={String(isStreaming)} />
              <DebugMetric label="canvasContentLength" value={canvasContent.length} />
            </DebugCard>
          </TabsContent>

          <TabsContent value="request">
            <DebugCard title="Request">
              <DebugMetric label="requestId" value={frame.debug?.request?.requestId ?? "n/a"} />
              <DebugMetric label="trigger" value={frame.debug?.request?.trigger ?? "n/a"} />
              <DebugMetric label="threadId" value={frame.debug?.request?.threadId ?? "n/a"} />
              <DebugMetric label="frameId" value={frame.debug?.request?.frameId ?? "n/a"} />
              <DebugMetric label="promptLength" value={frame.debug?.request?.promptLength ?? "n/a"} />
              <DebugMetric
                label="actionPromptLength"
                value={frame.debug?.request?.actionPromptLength ?? "n/a"}
              />
              <DebugMetric
                label="sourceContentLength"
                value={frame.debug?.request?.sourceContentLength ?? "n/a"}
              />
              <DebugMetric
                label="systemPromptLength"
                value={frame.debug?.request?.systemPromptLength ?? "n/a"}
              />
              <DebugMetric label="createdAt" value={formatTime(frame.debug?.request?.createdAt)} />
            </DebugCard>
          </TabsContent>

          <TabsContent value="stream">
            <DebugCard title="Stream">
              <DebugMetric label="startedAt" value={formatTime(frame.debug?.stream?.startedAt)} />
              <DebugMetric
                label="firstChunkAt"
                value={formatTime(frame.debug?.stream?.firstChunkAt)}
              />
              <DebugMetric label="lastChunkAt" value={formatTime(frame.debug?.stream?.lastChunkAt)} />
              <DebugMetric label="finishedAt" value={formatTime(frame.debug?.stream?.finishedAt)} />
              <DebugMetric
                label="timeToFirstChunk"
                value={formatDuration(
                  frame.debug?.stream?.startedAt,
                  frame.debug?.stream?.firstChunkAt,
                )}
              />
              <DebugMetric
                label="duration"
                value={formatDuration(
                  frame.debug?.stream?.startedAt,
                  frame.debug?.stream?.finishedAt,
                )}
              />
              <DebugMetric label="chunkCount" value={frame.debug?.stream?.chunkCount ?? "n/a"} />
              <DebugMetric
                label="lastDeltaLength"
                value={frame.debug?.stream?.lastDeltaLength ?? "n/a"}
              />
              <DebugMetric label="totalLength" value={frame.debug?.stream?.totalLength ?? "n/a"} />
              <DebugMetric label="outcome" value={frame.debug?.stream?.outcome ?? "n/a"} />
              <DebugMetric label="errorMessage" value={frame.debug?.stream?.errorMessage ?? "n/a"} />
            </DebugCard>
          </TabsContent>

          <TabsContent value="protocol">
            <div className="grid gap-3 md:grid-cols-2">
              <DebugCard title="Protocol metrics">
                <DebugMetric label="rawFinalLength" value={diagnostics.rawFinalContent.length} />
                <DebugMetric label="frameLength" value={diagnostics.frameContent.length} />
                <DebugMetric label="protocol" value={diagnostics.protocolId} />
                <DebugMetric label="stableLength" value={diagnostics.protocolStable.length} />
                <DebugMetric label="pendingLength" value={diagnostics.protocolPending.length} />
                <DebugMetric
                  label="hasPending"
                  value={String(diagnostics.protocolPending.length > 0)}
                />
                <DebugMetric
                  label="lastCompletionLength"
                  value={frame.debug?.lastCompletionLength ?? "n/a"}
                />
                <DebugMetric
                  label="finalCompletionLength"
                  value={frame.debug?.finalCompletionLength ?? "n/a"}
                />
              </DebugCard>
              <DebugBlock label="protocolPending" value={diagnostics.protocolPending} />
              <DebugBlock label="protocolStable" value={diagnostics.protocolStable} />
              <DebugBlock label="frameContent" value={diagnostics.frameContent} />
            </div>
          </TabsContent>

          <TabsContent value="canvas">
            <div className="grid gap-3 md:grid-cols-2">
              <DebugCard title="Canvas metrics">
                <DebugMetric label="rows" value={diagnostics.canvasRows} />
                <DebugMetric label="cols" value={diagnostics.canvasCols} />
                <DebugMetric label="cellCount" value={diagnostics.canvasCellCount} />
                <DebugMetric label="styledCellCount" value={diagnostics.styledCellCount} />
                <DebugMetric label="hrefCellCount" value={diagnostics.hrefCellCount} />
                <DebugMetric label="canvasTextLength" value={diagnostics.canvasText.length} />
              </DebugCard>
              <DebugBlock label="canvasText" value={diagnostics.canvasText} />
            </div>
          </TabsContent>

          <TabsContent value="interaction">
            <DebugCard title="Interaction">
              <DebugMetric label="kind" value={frame.debug?.interaction?.kind ?? "n/a"} />
              <DebugMetric label="href" value={frame.debug?.interaction?.href ?? "n/a"} />
              <DebugMetric label="prompt" value={frame.debug?.interaction?.prompt ?? "n/a"} />
              <DebugMetric
                label="triggeredRequest"
                value={
                  frame.debug?.interaction
                    ? String(frame.debug.interaction.triggeredRequest)
                    : "n/a"
                }
              />
              <DebugMetric label="at" value={formatTime(frame.debug?.interaction?.at)} />
            </DebugCard>
          </TabsContent>

          <TabsContent value="persistence">
            <DebugCard title="Persistence">
              <DebugMetric
                label="lastEventType"
                value={frame.debug?.persistence?.lastEventType ?? "n/a"}
              />
              <DebugMetric
                label="lastPersistedLength"
                value={frame.debug?.persistence?.lastPersistedLength ?? "n/a"}
              />
              <DebugMetric
                label="pendingLength"
                value={frame.debug?.persistence?.pendingLength ?? "n/a"}
              />
              <DebugMetric
                label="lastPersistedAt"
                value={formatTime(frame.debug?.persistence?.lastPersistedAt)}
              />
              <DebugMetric
                label="lastPersistError"
                value={frame.debug?.persistence?.lastPersistError ?? "n/a"}
              />
            </DebugCard>
          </TabsContent>

          <TabsContent value="config">
            <DebugCard title="Config">
              <DebugMetric label="baseURL" value={frame.debug?.request?.baseURL || configDraft.baseURL} />
              <DebugMetric label="model" value={frame.debug?.request?.model || configDraft.model || "n/a"} />
              <DebugMetric
                label="hasServerApiKey"
                value={String(frame.debug?.request?.hasServerApiKey ?? hasServerApiKey)}
              />
              <DebugMetric label="configStatus" value={configStatus} />
            </DebugCard>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function DebugCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid max-h-[60vh] gap-2 overflow-auto font-mono">
        {children}
      </CardContent>
    </Card>
  )
}

function DebugMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
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
