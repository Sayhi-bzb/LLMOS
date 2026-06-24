import { useCompletion } from "@ai-sdk/react"
import {
  Loader2,
  RotateCcw,
  Save,
  Send,
  Settings,
  Square,
  X,
} from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import { AsciiCanvas } from "@/components/ascii-canvas"
import { Button } from "@/components/ui/button"

interface ServerLlmConfig {
  baseURL: string
  model: string
  hasApiKey: boolean
}

interface LlmConfigDraft {
  baseURL: string
  apiKey: string
  model: string
}

const systemPromptStorageKey = "llmos.systemPrompt"
const defaultLiteLLMBaseURL = "http://localhost:4000/v1"

const readStoredSystemPrompt = () => {
  if (typeof window === "undefined") {
    return ""
  }

  return window.localStorage.getItem(systemPromptStorageKey) ?? ""
}

const urlLabel =
  "\u001b]8;;https://github.com/IonicaBizau/anser\u001b\\OSC 8 URL label\u001b]8;;\u001b\\"

const entityLabel = "\u001b]8;;@e1\u001b\\[实体 e1]\u001b]8;;\u001b\\"
const checksumLabel = "\u001b]8;;SHA256\u001b\\[校验成功]\u001b]8;;\u001b\\"

const sampleOutput = [
  "\u001b[1;38;2;37;99;235mANSI / OSC label surface\u001b[0m",
  "",
  "\u001b[31mcolor: basic red\u001b[0m  \u001b[38;5;39mcolor: 256 palette blue\u001b[0m",
  "\u001b[38;2;37;99;235mforeground truecolor / 当前选中项\u001b[0m",
  "\u001b[48;2;248;250;252m\u001b[38;2;15;23;42m background truecolor with foreground text \u001b[0m",
  "",
  "\u001b[1mbold text\u001b[0m  \u001b[3mitalic text\u001b[0m  \u001b[9mdelete / strikethrough\u001b[0m  \u001b[4munderline\u001b[0m",
  "",
  `label:url     ${urlLabel}`,
  `label:entity  ${entityLabel}`,
  `label:hash    ${checksumLabel}`,
  "",
  "\u001b[38;2;100;116;139m──────────────────────────────────────── 分割线 / 次要文字 / 边框\u001b[0m",
  "\u001b[1;38;2;255;255;255;48;2;37;99;235m 主要按钮 \u001b[0m  \u001b[1;38;2;255;255;255;48;2;236;72;153m 高亮标签 \u001b[0m",
  "",
  "\u001b[3;38;2;148;163;184mSend a prompt to replace this sample with the current LLM turn.\u001b[0m",
].join("\n")

const pendingOutput = "\u001b[38;2;100;116;139mWaiting for the first token...\u001b[0m"

const emptyConfigDraft: LlmConfigDraft = {
  baseURL: defaultLiteLLMBaseURL,
  apiKey: "",
  model: "",
}

export function App() {
  const initialSystemPrompt = readStoredSystemPrompt()
  const [savedSystemPrompt, setSavedSystemPrompt] = useState(initialSystemPrompt)
  const [systemPromptDraft, setSystemPromptDraft] = useState(initialSystemPrompt)
  const [configOpen, setConfigOpen] = useState(false)
  const [configDraft, setConfigDraft] = useState<LlmConfigDraft>(emptyConfigDraft)
  const [hasServerApiKey, setHasServerApiKey] = useState(false)
  const [configStatus, setConfigStatus] = useState("Loading config")
  const [configError, setConfigError] = useState("")
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const {
    completion,
    complete,
    error,
    input,
    isLoading,
    setCompletion,
    setInput,
    stop,
  } = useCompletion({
    api: "/api/completion",
    streamProtocol: "text",
    experimental_throttle: 50,
  })

  useEffect(() => {
    let ignore = false

    const loadConfig = async () => {
      try {
        const response = await fetch("/api/llm-config")

        if (!response.ok) {
          throw new Error(`Config load failed: ${response.status}`)
        }

        const data = (await response.json()) as ServerLlmConfig

        if (ignore) {
          return
        }

        setConfigDraft({
          baseURL: data.baseURL || defaultLiteLLMBaseURL,
          apiKey: "",
          model: data.model || "",
        })
        setHasServerApiKey(data.hasApiKey)
        setConfigStatus(data.hasApiKey ? "Key saved on server" : "Missing key")
        setConfigError("")
      } catch (loadError) {
        if (ignore) {
          return
        }

        setConfigStatus("Config unavailable")
        setConfigError(loadError instanceof Error ? loadError.message : "Unknown error")
      }
    }

    void loadConfig()

    return () => {
      ignore = true
    }
  }, [])

  const canvasContent = completion || (isLoading ? pendingOutput : sampleOutput)
  const canSubmit = input.trim().length > 0 && !isLoading
  const hasUnsavedSystemPrompt = systemPromptDraft !== savedSystemPrompt

  const updateConfigDraft = (key: keyof LlmConfigDraft, value: string) => {
    setConfigDraft((current) => ({ ...current, [key]: value }))
  }

  const handleSaveSystemPrompt = () => {
    window.localStorage.setItem(systemPromptStorageKey, systemPromptDraft)
    setSavedSystemPrompt(systemPromptDraft)
  }

  const handleSaveLlmConfig = async () => {
    setIsSavingConfig(true)
    setConfigError("")
    setConfigStatus("Saving")

    try {
      const response = await fetch("/api/llm-config", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(configDraft),
      })
      const data = (await response.json()) as Partial<ServerLlmConfig> & {
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error ?? `Config save failed: ${response.status}`)
      }

      setConfigDraft({
        baseURL: data.baseURL || configDraft.baseURL || defaultLiteLLMBaseURL,
        apiKey: "",
        model: data.model || configDraft.model,
      })
      setHasServerApiKey(Boolean(data.hasApiKey))
      setConfigStatus("Saved to .env.local")
    } catch (saveError) {
      setConfigStatus("Save failed")
      setConfigError(saveError instanceof Error ? saveError.message : "Unknown error")
    } finally {
      setIsSavingConfig(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const prompt = input.trim()

    if (!prompt || isLoading) {
      return
    }

    setCompletion("")
    void complete(prompt, {
      body: {
        systemPrompt: savedSystemPrompt.trim(),
      },
    })
  }

  const handleResetThread = () => {
    if (isLoading) {
      stop()
    }

    setInput("")
    setCompletion("")
  }

  return (
    <main className="min-h-svh bg-background p-6 text-foreground">
      <div className="fixed right-4 top-4 z-50 flex flex-col items-end gap-2">
        <Button
          aria-expanded={configOpen}
          aria-label="Open LLM config"
          onClick={() => setConfigOpen((current) => !current)}
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
          <div className="w-[min(24rem,calc(100vw-2rem))] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-xl">
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
                  onChange={(event) => updateConfigDraft("baseURL", event.target.value)}
                  placeholder={defaultLiteLLMBaseURL}
                  value={configDraft.baseURL}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Model
                <input
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
                  onChange={(event) => updateConfigDraft("model", event.target.value)}
                  placeholder="gpt-4o-mini"
                  value={configDraft.model}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Key
                <input
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
                  onChange={(event) => updateConfigDraft("apiKey", event.target.value)}
                  placeholder={hasServerApiKey ? "Saved on server" : "Missing key"}
                  type="password"
                  value={configDraft.apiKey}
                />
              </label>

              {configError ? (
                <p className="text-sm text-destructive">{configError}</p>
              ) : null}

              <div className="flex justify-end">
                <Button
                  disabled={isSavingConfig || configDraft.model.trim().length === 0}
                  onClick={handleSaveLlmConfig}
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

      <section className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-col gap-1 pr-24">
          <h1 className="text-xl font-semibold tracking-normal">
            LLM ASCII Canvas
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            LiteLLM streams the current turn into the ANSI canvas. Previous turns
            are replaced instead of shown as a feed.
          </p>
        </div>

        <form
          className="flex flex-col gap-4 rounded-md border border-border bg-card p-3 text-card-foreground shadow-sm"
          onSubmit={handleSubmit}
        >
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
                  onClick={handleSaveSystemPrompt}
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
              onChange={(event) => setSystemPromptDraft(event.target.value)}
              placeholder="Optional behavior or output format instructions"
              value={systemPromptDraft}
            />
          </div>

          <textarea
            className="min-h-24 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
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
              <Button onClick={handleResetThread} type="button" variant="secondary">
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset thread
              </Button>
              {isLoading ? (
                <Button onClick={stop} type="button" variant="secondary">
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

        <AsciiCanvas content={canvasContent} className="h-[420px]" />
      </section>
    </main>
  )
}

export default App
