import { Loader2, RotateCcw, Save, Send, Square } from "lucide-react"
import type { FormEvent } from "react"

import { Button } from "@/components/ui/button"

interface PromptConsoleProps {
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

export function PromptConsole({
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
}: PromptConsoleProps) {
  return (
    <form className="flex flex-col gap-4 bg-card p-3 text-card-foreground" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-medium" htmlFor="system-prompt">
            System prompt
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {hasUnsavedSystemPrompt ? "Unsaved changes" : "Saved"}
            </span>
            <Button
              disabled={!hasUnsavedSystemPrompt}
              onClick={onSaveSystemPrompt}
              type="button"
              variant="secondary"
            >
              <Save className="size-4" aria-hidden="true" />
              Save
            </Button>
          </div>
        </div>
        <textarea
          className="min-h-20 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-normal leading-6 outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
          id="system-prompt"
          onChange={(event) => onSystemPromptChange(event.target.value)}
          placeholder="Optional behavior or output format instructions"
          value={systemPromptDraft}
        />
      </div>

      <textarea
        className="min-h-24 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
        onChange={(event) => onInputChange(event.target.value)}
        placeholder="Ask the model for ANSI/plain text output..."
        value={input}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-5 text-sm text-muted-foreground" role="status">
          {error ? (
            <span className="text-destructive">{error.message}</span>
          ) : isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Streaming current turn
            </span>
          ) : (
            "Ready"
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onResetThread} type="button" variant="secondary">
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset thread
          </Button>
          {isLoading ? (
            <Button onClick={onStop} type="button" variant="secondary">
              <Square className="size-4" aria-hidden="true" />
              Stop
            </Button>
          ) : null}
          <Button disabled={!canSubmit} type="submit">
            <Send className="size-4" aria-hidden="true" />
            Send
          </Button>
        </div>
      </div>
    </form>
  )
}
