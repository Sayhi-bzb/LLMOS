import { Loader2, Save, Settings } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { LlmConfigDraft } from "@/components/llm/types"

interface LlmConfigPanelProps {
  configOpen: boolean
  configDraft: LlmConfigDraft
  configStatus: string
  configError: string
  hasServerApiKey: boolean
  isSavingConfig: boolean
  defaultBaseURL: string
  onOpenChange: (open: boolean) => void
  onConfigChange: (key: keyof LlmConfigDraft, value: string) => void
  onSave: () => void
}

export function LlmConfigPanel({
  configOpen,
  configDraft,
  configStatus,
  configError,
  hasServerApiKey,
  isSavingConfig,
  defaultBaseURL,
  onOpenChange,
  onConfigChange,
  onSave,
}: LlmConfigPanelProps) {
  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col items-end gap-2">
      <Dialog open={configOpen} onOpenChange={onOpenChange}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button
                  aria-label="Open LLM settings"
                  size="icon"
                  type="button"
                  variant="secondary"
                >
                  <Settings className="size-4" aria-hidden="true" />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="left">LLM settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>LiteLLM env</DialogTitle>
            <DialogDescription>
              Saves URL, key, and model to .env.local. {configStatus}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="llm-base-url">URL</Label>
              <Input
                id="llm-base-url"
                onChange={(event) => onConfigChange("baseURL", event.target.value)}
                placeholder={defaultBaseURL}
                value={configDraft.baseURL}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="llm-model">Model</Label>
              <Input
                id="llm-model"
                onChange={(event) => onConfigChange("model", event.target.value)}
                placeholder="gpt-4o-mini"
                value={configDraft.model}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="llm-api-key">Key</Label>
              <Input
                id="llm-api-key"
                onChange={(event) => onConfigChange("apiKey", event.target.value)}
                placeholder={hasServerApiKey ? "Saved on server" : "Missing key"}
                type="password"
                value={configDraft.apiKey}
              />
            </div>

            {configError ? <p className="text-sm text-destructive">{configError}</p> : null}
          </div>

          <DialogFooter>
            <Button
              disabled={isSavingConfig || configDraft.model.trim().length === 0}
              onClick={onSave}
              type="button"
            >
              {isSavingConfig ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Save env
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
