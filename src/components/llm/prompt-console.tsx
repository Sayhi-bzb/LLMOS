import { Loader2, RotateCcw, Send, Square } from "lucide-react"
import type { FormEvent, KeyboardEvent, ReactNode } from "react"

import { Button } from "@/components/ui/button"

interface PromptConsoleProps {
  input: string
  isLoading: boolean
  error?: Error
  canSubmit: boolean
  tools?: ReactNode
  onInputChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSubmitShortcut: () => void
  onResetThread: () => void
  onStop: () => void
}

export function PromptConsole({
  input,
  isLoading,
  error,
  canSubmit,
  tools,
  onInputChange,
  onSubmit,
  onSubmitShortcut,
  onResetThread,
  onStop,
}: PromptConsoleProps) {
  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || !event.ctrlKey) {
      return
    }

    event.preventDefault()

    if (canSubmit) {
      onSubmitShortcut()
    }
  }

  return (
    <form className="flex flex-col gap-4 bg-card p-3 text-card-foreground" onSubmit={onSubmit}>
      <textarea
        className="min-h-24 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={handleInputKeyDown}
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
          {tools}
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
