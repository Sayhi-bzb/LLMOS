import { Loader2, Save, Settings, X } from "lucide-react"

import { Button } from "@/components/ui/button"
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
      <Button
        aria-expanded={configOpen}
        aria-label="Open LLM config"
        onClick={() => onOpenChange(!configOpen)}
        type="button"
        variant="secondary"
      >
        {configOpen ? (
          <X className="size-4" aria-hidden="true" />
        ) : (
          <Settings className="size-4" aria-hidden="true" />
        )}
        LLM
      </Button>

      {configOpen ? (
        <div className="w-[min(24rem,calc(100vw-2rem))] bg-popover p-3 text-popover-foreground">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">LiteLLM env</h2>
              <p className="text-xs text-muted-foreground">
                Saves URL, key, and model to .env.local.
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{configStatus}</span>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              URL
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
                onChange={(event) => onConfigChange("baseURL", event.target.value)}
                placeholder={defaultBaseURL}
                value={configDraft.baseURL}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Model
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
                onChange={(event) => onConfigChange("model", event.target.value)}
                placeholder="gpt-4o-mini"
                value={configDraft.model}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Key
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
                onChange={(event) => onConfigChange("apiKey", event.target.value)}
                placeholder={hasServerApiKey ? "Saved on server" : "Missing key"}
                type="password"
                value={configDraft.apiKey}
              />
            </label>

            {configError ? <p className="text-sm text-destructive">{configError}</p> : null}

            <div className="flex justify-end">
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
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
