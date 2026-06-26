import { Save, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
  const estimatedSystemPromptTokens = estimateTokenCount(systemPromptDraft)
  const statusText = isSavingSystemPrompt
    ? "Saving"
    : hasUnsavedSystemPrompt
      ? "Unsaved changes"
      : "Saved"
  const tooltip = `System prompt · ~${estimatedSystemPromptTokens.toLocaleString()} tokens · ${statusText}`

  return (
    <div className="fixed right-4 top-24 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      <Dialog>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button
                  aria-label="Open system prompt"
                  className="shadow-sm"
                  size="icon"
                  type="button"
                  variant={hasUnsavedSystemPrompt ? "default" : "secondary"}
                >
                  <Settings2 className="size-4" aria-hidden="true" />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="left">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DialogContent className="max-h-[calc(100vh-4rem)] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>System prompt</DialogTitle>
            <DialogDescription>
              ~{estimatedSystemPromptTokens.toLocaleString()} tokens · {statusText}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="min-h-0 max-h-[60vh] pr-3">
            <div className="grid gap-1.5">
              <Label htmlFor="system-prompt">Prompt</Label>
              <Textarea
                id="system-prompt"
                className="min-h-48 max-h-[50vh] resize-y text-sm leading-6"
                disabled={isLoading}
                onChange={(event) => onSystemPromptChange(event.target.value)}
                placeholder="Optional behavior or output format instructions"
                value={systemPromptDraft}
              />
            </div>
          </ScrollArea>

          <DialogFooter className="items-center justify-between sm:justify-between">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

