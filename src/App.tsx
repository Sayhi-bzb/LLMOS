import { useCompletion } from "@ai-sdk/react"
import { useEffect, useRef, useState, type FormEvent } from "react"

import { LlmCanvasWorkspace, LlmConfigPanel, pendingOutput } from "@/components/llm"
import type { LlmConfigDraft, LlmTurnFrame, ServerInitialScreen, ServerLlmConfig, ServerSystemPrompt } from "@/components/llm"

const defaultLiteLLMBaseURL = "http://localhost:4000/v1"

const emptyConfigDraft: LlmConfigDraft = {
  baseURL: defaultLiteLLMBaseURL,
  apiKey: "",
  model: "",
}

const createFrameId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const formatPromptWithSourceScreen = (sourceContent: string, prompt: string) => [
  "当前 screen:",
  sourceContent.trim(),
  "",
  "用户操作:",
  prompt.trim(),
].join("\n")

const getFrameTitle = (prompt: string) => {
  const title = prompt.split(/\r?\n/)[0]?.trim() || "Untitled turn"

  return title.length > 40 ? `${title.slice(0, 40)}...` : title
}

function App() {
  const [savedSystemPrompt, setSavedSystemPrompt] = useState("")
  const [systemPromptDraft, setSystemPromptDraft] = useState("")
  const [initialScreenContent, setInitialScreenContent] = useState("")
  const [configOpen, setConfigOpen] = useState(false)
  const [configDraft, setConfigDraft] = useState<LlmConfigDraft>(emptyConfigDraft)
  const [hasServerApiKey, setHasServerApiKey] = useState(false)
  const [configStatus, setConfigStatus] = useState("Loading config")
  const [configError, setConfigError] = useState("")
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [isSavingSystemPrompt, setIsSavingSystemPrompt] = useState(false)
  const [frames, setFrames] = useState<LlmTurnFrame[]>([])
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const activeFrameIdRef = useRef<string | null>(null)
  const wasLoadingRef = useRef(false)
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
    onFinish: (_prompt, finalCompletion) => {
      const activeFrameId = activeFrameIdRef.current

      if (!activeFrameId) {
        return
      }

      setFrames((currentFrames) =>
        currentFrames.map((frame) =>
          frame.id === activeFrameId && frame.status === "streaming"
            ? {
                ...frame,
                content: finalCompletion,
                rawFinalContent: finalCompletion,
                debug: {
                  ...frame.debug,
                  finalCompletionLength: finalCompletion.length,
                },
                status: "complete",
              }
            : frame,
        ),
      )
      activeFrameIdRef.current = null
    },
  })

  useEffect(() => {
    let ignore = false

    const loadSystemPrompt = async () => {
      try {
        const response = await fetch("/api/system-prompt")

        if (!response.ok) {
          throw new Error(`System prompt load failed: ${response.status}`)
        }

        const data = (await response.json()) as ServerSystemPrompt

        if (ignore) {
          return
        }

        setSavedSystemPrompt(data.systemPrompt ?? "")
        setSystemPromptDraft(data.systemPrompt ?? "")
      } catch (loadError) {
        if (!ignore) {
          console.error(loadError)
        }
      }
    }

    const loadInitialScreen = async () => {
      try {
        const response = await fetch("/api/initial-screen")

        if (!response.ok) {
          throw new Error(`Initial screen load failed: ${response.status}`)
        }

        const data = (await response.json()) as ServerInitialScreen

        if (ignore) {
          return
        }

        setInitialScreenContent(data.initialScreen ?? "")
      } catch (loadError) {
        if (!ignore) {
          console.error(loadError)
        }
      }
    }

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
    void loadSystemPrompt()
    void loadInitialScreen()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const activeFrameId = activeFrameIdRef.current

    if (!activeFrameId) {
      return
    }

    setFrames((currentFrames) =>
      currentFrames.map((frame) =>
        frame.id === activeFrameId
          ? {
              ...frame,
              content: completion,
              debug: {
                ...frame.debug,
                lastCompletionLength: completion.length,
              },
            }
          : frame,
      ),
    )
  }, [completion])

  useEffect(() => {
    const activeFrameId = activeFrameIdRef.current

    if (wasLoadingRef.current && !isLoading && activeFrameId && error) {
      setFrames((currentFrames) =>
        currentFrames.map((frame) =>
          frame.id === activeFrameId && frame.status === "streaming"
            ? { ...frame, status: "error" }
            : frame,
        ),
      )
      activeFrameIdRef.current = null
    }

    wasLoadingRef.current = isLoading
  }, [error, isLoading])

  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId)
  const isInitialScreenVisible = !selectedFrame && !isLoading
  const canvasContent = selectedFrame ? selectedFrame.content : isLoading ? pendingOutput : initialScreenContent
  const canSubmit = input.trim().length > 0 && !isLoading
  const hasUnsavedSystemPrompt = systemPromptDraft !== savedSystemPrompt

  const updateConfigDraft = (key: keyof LlmConfigDraft, value: string) => {
    setConfigDraft((current) => ({ ...current, [key]: value }))
  }

  const handleSaveSystemPrompt = async () => {
    setIsSavingSystemPrompt(true)

    try {
      const response = await fetch("/api/system-prompt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ systemPrompt: systemPromptDraft }),
      })
      const data = (await response.json()) as Partial<ServerSystemPrompt> & {
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error ?? `System prompt save failed: ${response.status}`)
      }

      setSavedSystemPrompt(data.systemPrompt ?? systemPromptDraft)
    } catch (saveError) {
      console.error(saveError)
    } finally {
      setIsSavingSystemPrompt(false)
    }
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

  const submitPrompt = (prompt: string, options?: { sourceContent?: string }) => {
    const actionPrompt = prompt.trim()
    const nextPrompt = options?.sourceContent
      ? formatPromptWithSourceScreen(options.sourceContent, actionPrompt)
      : actionPrompt

    if (!actionPrompt || isLoading) {
      return
    }

    const frameId = createFrameId()
    const nextFrame: LlmTurnFrame = {
      id: frameId,
      title: getFrameTitle(actionPrompt),
      prompt: nextPrompt,
      content: "",
      createdAt: Date.now(),
      status: "streaming",
    }

    activeFrameIdRef.current = frameId
    setFrames((currentFrames) => [...currentFrames, nextFrame])
    setSelectedFrameId(frameId)
    setCompletion("")
    void complete(nextPrompt, {
      body: {
        systemPrompt: savedSystemPrompt.trim(),
      },
    })
  }

  const handlePromptHref = (prompt: string) => {
    submitPrompt(
      prompt,
      isInitialScreenVisible ? { sourceContent: initialScreenContent } : undefined,
    )
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitPrompt(input)
  }

  const handleSubmitShortcut = () => {
    submitPrompt(input)
  }

  const handleResetThread = () => {
    if (isLoading) {
      stop()
    }

    activeFrameIdRef.current = null
    setFrames([])
    setSelectedFrameId(null)
    setInput("")
    setCompletion("")
  }

  const handleStop = () => {
    const activeFrameId = activeFrameIdRef.current

    if (activeFrameId) {
      setFrames((currentFrames) =>
        currentFrames.map((frame) =>
          frame.id === activeFrameId ? { ...frame, status: "stopped" } : frame,
        ),
      )
      activeFrameIdRef.current = null
    }

    stop()
  }

  return (
    <main className="flex min-h-svh flex-col bg-background p-6 text-foreground">
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
        frames={frames}
        selectedFrameId={selectedFrameId}
        systemPromptDraft={systemPromptDraft}
        hasUnsavedSystemPrompt={hasUnsavedSystemPrompt}
        isSavingSystemPrompt={isSavingSystemPrompt}
        input={input}
        isLoading={isLoading}
        error={error}
        canSubmit={canSubmit}
        onSelectFrame={setSelectedFrameId}
        onSystemPromptChange={setSystemPromptDraft}
        onSaveSystemPrompt={handleSaveSystemPrompt}
        onInputChange={setInput}
        onPromptHref={handlePromptHref}
        onSubmit={handleSubmit}
        onSubmitShortcut={handleSubmitShortcut}
        onResetThread={handleResetThread}
        onStop={handleStop}
      />
    </main>
  )
}

export default App

