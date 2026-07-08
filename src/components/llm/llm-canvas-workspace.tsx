import type { FormEvent } from "react"

import { AsciiCanvas } from "@/components/ascii-canvas"
import { LlmDebugPanel } from "@/components/llm/llm-debug-panel"
import { LlmConfigPanel } from "@/components/llm/llm-config-panel"
import { PromptConsole } from "@/components/llm/prompt-console"
import { SystemPromptFloatingPanel } from "@/components/llm/system-prompt-floating-panel"
import { ThreadSwitcher } from "@/components/llm/thread-switcher"
import { TurnFrameToc } from "@/components/llm/turn-frame-toc"
import type {
  LlmConfigDraft,
  LlmThreadSummary,
  LlmTurnFrame,
} from "@/components/llm/types"

interface LlmCanvasWorkspaceProps {
  canvasContent: string
  threads: LlmThreadSummary[]
  activeThreadId: string | null
  frames: LlmTurnFrame[]
  selectedFrameId: string | null
  systemPromptDraft: string
  hasUnsavedSystemPrompt: boolean
  isSavingSystemPrompt: boolean
  configOpen: boolean
  configDraft: LlmConfigDraft
  configStatus: string
  configError: string
  hasServerApiKey: boolean
  isSavingConfig: boolean
  defaultBaseURL: string
  input: string
  isLoading: boolean
  error?: Error
  canSubmit: boolean
  onSelectThread: (threadId: string) => void
  onNewThread: () => void
  onSelectFrame: (frameId: string) => void
  onSystemPromptChange: (value: string) => void
  onSaveSystemPrompt: () => void
  onConfigOpenChange: (open: boolean) => void
  onConfigChange: (key: keyof LlmConfigDraft, value: string) => void
  onSaveConfig: () => void
  onInputChange: (value: string) => void
  onPromptHref: (prompt: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSubmitShortcut: () => void
  onResetThread: () => void
  onStop: () => void
}

export function LlmCanvasWorkspace({
  canvasContent,
  threads,
  activeThreadId,
  frames,
  selectedFrameId,
  systemPromptDraft,
  hasUnsavedSystemPrompt,
  isSavingSystemPrompt,
  configOpen,
  configDraft,
  configStatus,
  configError,
  hasServerApiKey,
  isSavingConfig,
  defaultBaseURL,
  input,
  isLoading,
  error,
  canSubmit,
  onSelectThread,
  onNewThread,
  onSelectFrame,
  onSystemPromptChange,
  onSaveSystemPrompt,
  onConfigOpenChange,
  onConfigChange,
  onSaveConfig,
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
      <ThreadSwitcher
        threads={threads}
        activeThreadId={activeThreadId}
        isLoading={isLoading}
        onSelectThread={onSelectThread}
        onNewThread={onNewThread}
        variant="mobile"
      />
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
        header={
          <ThreadSwitcher
            threads={threads}
            activeThreadId={activeThreadId}
            isLoading={isLoading}
            onSelectThread={onSelectThread}
            onNewThread={onNewThread}
            variant="desktop"
          />
        }
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex min-h-0 flex-1 items-start justify-center py-2">
          <AsciiCanvas
            content={canvasContent}
            autoHeight
            maxHeight="clamp(12rem, calc(100svh - 20rem), 40rem)"
            className="min-h-48 w-full"
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
            tools={
              <>
                <LlmConfigPanel
                  configOpen={configOpen}
                  configDraft={configDraft}
                  configStatus={configStatus}
                  configError={configError}
                  hasServerApiKey={hasServerApiKey}
                  isSavingConfig={isSavingConfig}
                  defaultBaseURL={defaultBaseURL}
                  onOpenChange={onConfigOpenChange}
                  onConfigChange={onConfigChange}
                  onSave={onSaveConfig}
                />
                <SystemPromptFloatingPanel
                  systemPromptDraft={systemPromptDraft}
                  hasUnsavedSystemPrompt={hasUnsavedSystemPrompt}
                  isSavingSystemPrompt={isSavingSystemPrompt}
                  isLoading={isLoading}
                  onSystemPromptChange={onSystemPromptChange}
                  onSaveSystemPrompt={onSaveSystemPrompt}
                />
                <LlmDebugPanel
                  frame={selectedFrame}
                  isStreaming={isCanvasStreaming}
                  activeThreadId={activeThreadId}
                  selectedFrameId={selectedFrameId}
                  canvasContent={canvasContent}
                  frameCount={frames.length}
                  isLoading={isLoading}
                  configDraft={configDraft}
                  configStatus={configStatus}
                  hasServerApiKey={hasServerApiKey}
                />
              </>
            }
          />
        </div>
      </div>
    </section>
  )
}
