import type { FormEvent } from "react"

import { PromptConsole } from "@/components/llm/prompt-console"
import { AsciiCanvas } from "@/components/ascii-canvas"

interface LlmCanvasWorkspaceProps {
  canvasContent: string
  systemPromptDraft: string
  hasUnsavedSystemPrompt: boolean
  input: string
  isLoading: boolean
  error?: Error
  canSubmit: boolean
  onSystemPromptChange: (value: string) => void
  onSaveSystemPrompt: () => void
  onInputChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onResetThread: () => void
  onStop: () => void
}

export function LlmCanvasWorkspace({
  canvasContent,
  systemPromptDraft,
  hasUnsavedSystemPrompt,
  input,
  isLoading,
  error,
  canSubmit,
  onSystemPromptChange,
  onSaveSystemPrompt,
  onInputChange,
  onSubmit,
  onResetThread,
  onStop,
}: LlmCanvasWorkspaceProps) {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4">
      <PromptConsole
        systemPromptDraft={systemPromptDraft}
        hasUnsavedSystemPrompt={hasUnsavedSystemPrompt}
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
      <AsciiCanvas content={canvasContent} className="h-[420px]" />
    </section>
  )
}
