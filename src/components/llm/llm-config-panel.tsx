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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
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
  const parsedTemperature = Number(configDraft.temperature)
  const temperature = Number.isFinite(parsedTemperature)
    ? Math.min(2, Math.max(0, parsedTemperature))
    : 0.7
  const temperatureLabel = temperature.toFixed(1)

  return (
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
          <TooltipContent>LLM settings</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>LiteLLM env</DialogTitle>
          <DialogDescription>
            Saves URL, key, model, and temperature to .env.local. {configStatus}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="llm-base-url">URL</FieldLabel>
            <Input
              id="llm-base-url"
              onChange={(event) => onConfigChange("baseURL", event.target.value)}
              placeholder={defaultBaseURL}
              value={configDraft.baseURL}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="llm-model">Model</FieldLabel>
            <Input
              id="llm-model"
              onChange={(event) => onConfigChange("model", event.target.value)}
              placeholder="gpt-4o-mini"
              value={configDraft.model}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="llm-api-key">Key</FieldLabel>
            <Input
              id="llm-api-key"
              onChange={(event) => onConfigChange("apiKey", event.target.value)}
              placeholder={hasServerApiKey ? "Saved on server" : "Missing key"}
              type="password"
              value={configDraft.apiKey}
            />
          </Field>

          <Field>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="llm-temperature">Temperature</FieldLabel>
              <span className="font-mono text-xs text-muted-foreground">
                {temperatureLabel}
              </span>
            </div>
            <Slider
              id="llm-temperature"
              max={2}
              min={0}
              onValueChange={(value) =>
                onConfigChange("temperature", (value[0] ?? temperature).toFixed(1))
              }
              step={0.1}
              value={[temperature]}
            />
            <p className="text-xs text-muted-foreground">
              Lower is stable, higher is creative.
            </p>
          </Field>

          <FieldError>{configError}</FieldError>
        </FieldGroup>

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
  )
}
