import { useMemo } from "react"

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

  if (!import.meta.env.DEV || !frame) {
    return null
  }

  return (
    <details className="border border-dashed border-amber-300 bg-amber-50/60 p-3 text-xs text-amber-950">
      <summary className="cursor-pointer font-medium">Debug output pipeline</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
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
    </details>
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