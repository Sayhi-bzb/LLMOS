import { Bug, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
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
  const [open, setOpen] = useState(false)
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

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open])

  if (!import.meta.env.DEV || !frame) {
    return null
  }

  return (
    <div className="fixed right-4 top-[9.5rem] z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      <Button
        aria-expanded={open}
        className="shadow-sm"
        onClick={() => setOpen((current) => !current)}
        type="button"
        variant="secondary"
      >
        <Bug className="size-4" aria-hidden="true" />
        Debug
        <span className="text-xs opacity-75">{frame.status}</span>
      </Button>

      {open ? (
        <section className="max-h-[calc(100vh-9rem)] w-[min(720px,calc(100vw-2rem))] overflow-auto border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">Debug output pipeline</div>
              <div className="mt-0.5 text-amber-800">
                {frame.status} · frame {diagnostics.frameContent.length.toLocaleString()} chars
              </div>
            </div>
            <Button
              aria-label="Close debug panel"
              onClick={() => setOpen(false)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <DebugBlock label="rawFinalContent" value={diagnostics.rawFinalContent} />
            <DebugBlock label="frameContent" value={diagnostics.frameContent} />
            <DebugBlock label="markdownStable" value={diagnostics.markdownStable} />
            <DebugBlock label="markdownPending" value={diagnostics.markdownPending} />
            <DebugBlock label="canvasText" value={diagnostics.canvasText} />
            <div className="rounded border border-amber-200 bg-white/70 p-2 font-mono">
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
        </section>
      ) : null}
    </div>
  )
}

function DebugBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded border border-amber-200 bg-white/70 p-2">
      <div className="mb-1 font-medium">{label}</div>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5">
        {preview(value)}
      </pre>
    </section>
  )
}

