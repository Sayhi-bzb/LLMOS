import { useCompletion } from "@ai-sdk/react"
import { useEffect, useState, type FormEvent } from "react"

import { LlmCanvasWorkspace, LlmConfigPanel, pendingOutput, sampleOutput } from "@/components/llm"
import type { LlmConfigDraft, ServerLlmConfig } from "@/components/llm"

const systemPromptStorageKey = "llmos.systemPrompt"
const defaultLiteLLMBaseURL = "http://localhost:4000/v1"

const readStoredSystemPrompt = () => {
  if (typeof window === "undefined") {
    return ""
  }

  return window.localStorage.getItem(systemPromptStorageKey) ?? ""
}

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
      <LlmConfigPanel
        configOpen={configOpen}
        configDraft={configDraft}
        configStatus={configStatus}
        configError={configError}
        hasServerApiKey={hasServerApiKey}
        isSavingConfig={isSavingConfig}
        defaultBaseURL={defaultLiteLLMBaseURL}
        onOpenChange={setConfigOpen}
        onConfigChange={updateConfigDraft}
        onSave={handleSaveLlmConfig}
      />

      <LlmCanvasWorkspace
        canvasContent={canvasContent}
        systemPromptDraft={systemPromptDraft}
        hasUnsavedSystemPrompt={hasUnsavedSystemPrompt}
        input={input}
        isLoading={isLoading}
        error={error}
        canSubmit={canSubmit}
        onSystemPromptChange={setSystemPromptDraft}
        onSaveSystemPrompt={handleSaveSystemPrompt}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onResetThread={handleResetThread}
        onStop={stop}
      />
    </main>
  )
}

export default App


