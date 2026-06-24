import type { FormEvent } from "react"

import { AsciiCanvas } from "@/components/ascii-canvas"
import { LlmDebugPanel } from "@/components/llm/llm-debug-panel"
import { PromptConsole } from "@/components/llm/prompt-console"
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
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
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
  onSubmit,
  onResetThread,
  onStop,
}: LlmCanvasWorkspaceProps) {
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId)
  const isCanvasStreaming = selectedFrame?.status === "streaming"

  return (
    <section className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4">
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
      <div className="flex min-w-0 flex-col gap-4">
        <PromptConsole
          systemPromptDraft={systemPromptDraft}
          hasUnsavedSystemPrompt={hasUnsavedSystemPrompt}
          isSavingSystemPrompt={isSavingSystemPrompt}
          input={input}
          isLoading={isLoading}
          error={error}
          canSubmit={canSubmit}
          onSystemPromptChange={onSystemPromptChange}
          onSaveSystemPrompt={onSaveSystemPrompt}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
          onResetThread={onResetThread}
          onStop={onStop}
        />
        <AsciiCanvas
          content={canvasContent}
          className="h-[420px]"
          isStreaming={isCanvasStreaming}
        />
        <LlmDebugPanel frame={selectedFrame} isStreaming={isCanvasStreaming} />
      </div>
    </section>
  )
}
