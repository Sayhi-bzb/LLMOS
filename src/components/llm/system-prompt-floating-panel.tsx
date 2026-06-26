import { Save, Settings2, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { IconTooltipButton } from "@/components/ui/icon-tooltip-button"

interface SystemPromptFloatingPanelProps {
  systemPromptDraft: string
  hasUnsavedSystemPrompt: boolean
  isSavingSystemPrompt: boolean
  isLoading: boolean
  onSystemPromptChange: (value: string) => void
  onSaveSystemPrompt: () => void
}

export function SystemPromptFloatingPanel({
  systemPromptDraft,
  hasUnsavedSystemPrompt,
  isSavingSystemPrompt,
  isLoading,
  onSystemPromptChange,
  onSaveSystemPrompt,
}: SystemPromptFloatingPanelProps) {
  const [open, setOpen] = useState(false)
  const estimatedSystemPromptTokens = estimateTokenCount(systemPromptDraft)
  const statusText = isSavingSystemPrompt
    ? "Saving"
    : hasUnsavedSystemPrompt
      ? "Unsaved changes"
      : "Saved"

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

  return (
    <div className="fixed right-4 top-24 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      <IconTooltipButton
        aria-expanded={open}
        aria-label={open ? "Close system prompt" : "Open system prompt"}
        className="shadow-sm"
        onClick={() => setOpen((current) => !current)}
        tooltip={`System prompt · ~${estimatedSystemPromptTokens.toLocaleString()} tokens · ${statusText}`}
        type="button"
        variant={hasUnsavedSystemPrompt ? "default" : "secondary"}
      >
        <Settings2 className="size-4" aria-hidden="true" />
      </IconTooltipButton>

      {open ? (
        <section className="w-[min(360px,calc(100vw-2rem))] border border-border bg-card p-3 text-card-foreground shadow-lg">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">System prompt</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                ~{estimatedSystemPromptTokens.toLocaleString()} tokens · {statusText}
              </div>
            </div>
            <Button
              aria-label="Close system prompt"
              onClick={() => setOpen(false)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <textarea
            className="min-h-48 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-normal leading-6 outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onChange={(event) => onSystemPromptChange(event.target.value)}
            placeholder="Optional behavior or output format instructions"
            value={systemPromptDraft}
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{statusText}</span>
            <Button
              disabled={!hasUnsavedSystemPrompt || isSavingSystemPrompt}
              onClick={onSaveSystemPrompt}
              type="button"
              variant="secondary"
            >
              <Save className="size-4" aria-hidden="true" />
              Save
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}

const cjkCharacterPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu

function estimateTokenCount(text: string) {
  const trimmedText = text.trim()

  if (!trimmedText) {
    return 0
  }

  const cjkCharacterCount = Array.from(trimmedText.matchAll(cjkCharacterPattern)).length
  const nonCjkText = trimmedText.replace(cjkCharacterPattern, "")
  const nonWhitespaceCharacterCount = nonCjkText.replace(/\s+/g, "").length
  const whitespaceSeparatedTokenCount = nonCjkText
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

  return Math.ceil(
    cjkCharacterCount +
      Math.max(nonWhitespaceCharacterCount / 4, whitespaceSeparatedTokenCount),
  )
}

