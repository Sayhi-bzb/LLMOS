import type { FormEvent } from "react"

import { AsciiCanvas } from "@/components/ascii-canvas"
import { LlmDebugPanel } from "@/components/llm/llm-debug-panel"
import { PromptConsole } from "@/components/llm/prompt-console"
import { SystemPromptFloatingPanel } from "@/components/llm/system-prompt-floating-panel"
import { TurnFrameToc } from "@/components/llm/turn-frame-toc"
import type { LlmTurnFrame } from "@/components/llm/types"

interface LlmCanvasWorkspaceProps {
  canvasContent: string
  frames: LlmTurnFrame[]
  selectedFrameId: string | null
  systemPromptDraft: string
  hasUnsavedSystemPrompt: boolean
  isSavingSystemPrompt: boolean
  input: string
  isLoading: boolean
  error?: Error
  canSubmit: boolean
  onSelectFrame: (frameId: string) => void
  onSystemPromptChange: (value: string) => void
  onSaveSystemPrompt: () => void
  onInputChange: (value: string) => void
  onPromptHref: (prompt: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSubmitShortcut: () => void
  onResetThread: () => void
  onStop: () => void
}

export function LlmCanvasWorkspace({
  canvasContent,
  frames,
  selectedFrameId,
  systemPromptDraft,
  hasUnsavedSystemPrompt,
  isSavingSystemPrompt,
  input,
  isLoading,
  error,
  canSubmit,
  onSelectFrame,
  onSystemPromptChange,
  onSaveSystemPrompt,
  onInputChange,
  onPromptHref,
  onSubmit,
  onSubmitShortcut,
  onResetThread,
  onStop,
}: LlmCanvasWorkspaceProps) {
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId)
  const isCanvasStreaming = selectedFrame?.status === "streaming"

  return (
    <section className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-6xl min-w-0 flex-col gap-4">
      <TurnFrameToc
        frames={frames}
        selectedFrameId={selectedFrameId}
        onSelectFrame={onSelectFrame}
        variant="mobile"
      />
      <TurnFrameToc
        frames={frames}
        selectedFrameId={selectedFrameId}
        onSelectFrame={onSelectFrame}
        variant="desktop"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <SystemPromptFloatingPanel
          systemPromptDraft={systemPromptDraft}
          hasUnsavedSystemPrompt={hasUnsavedSystemPrompt}
          isSavingSystemPrompt={isSavingSystemPrompt}
          isLoading={isLoading}
          onSystemPromptChange={onSystemPromptChange}
          onSaveSystemPrompt={onSaveSystemPrompt}
        />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <AsciiCanvas
            content={canvasContent}
            className="h-[420px] w-full"
            isStreaming={isCanvasStreaming}
            onPromptHref={onPromptHref}
          />
        </div>
        <div className="mt-auto">
          <PromptConsole
            input={input}
            isLoading={isLoading}
            error={error}
            canSubmit={canSubmit}
            onInputChange={onInputChange}
            onSubmit={onSubmit}
            onSubmitShortcut={onSubmitShortcut}
            onResetThread={onResetThread}
            onStop={onStop}
          />
        </div>
        <LlmDebugPanel frame={selectedFrame} isStreaming={isCanvasStreaming} />
      </div>
    </section>
  )
}
