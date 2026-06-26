import { useCompletion } from "@ai-sdk/react"
import { useEffect, useRef, useState, type FormEvent } from "react"

import { LlmCanvasWorkspace, LlmConfigPanel, pendingOutput } from "@/components/llm"
import type {
  LlmConfigDraft,
  LlmThreadSummary,
  LlmTurnFrame,
  ServerInitialScreen,
  ServerLlmConfig,
  ServerThread,
  ServerThreads,
  ServerSystemPrompt,
  SessionEvent,
} from "@/components/llm"

const defaultLiteLLMBaseURL = "http://localhost:4000/v1"
const sessionDeltaThrottleMs = 500
const pendingSpinnerIntervalMs = 140
const pendingSpinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

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

const formatPendingScreen = (sourceContent: string, actionPrompt: string, tick: number) => [
  sourceContent.trimEnd(),
  "",
  `<span fg-accent>${pendingSpinnerFrames[tick % pendingSpinnerFrames.length]}</span> <span fg-muted>正在处理：</span>${actionPrompt}`,
].join("\n")

const getFrameTitle = (prompt: string) => {
  const title = prompt.split(/\r?\n/)[0]?.trim() || "Untitled turn"

  return title.length > 40 ? `${title.slice(0, 40)}...` : title
}

const sortThreads = (threads: LlmThreadSummary[]) =>
  [...threads].sort((a, b) => b.updatedAt - a.updatedAt)

const summarizeFrames = (threadId: string, frames: LlmTurnFrame[]): LlmThreadSummary => {
  const firstFrame = frames[0]
  const updatedAt = frames.at(-1)?.createdAt ?? firstFrame?.createdAt ?? Date.now()

  return {
    id: threadId,
    title: firstFrame?.title ?? "New thread",
    frameCount: frames.length,
    createdAt: firstFrame?.createdAt ?? updatedAt,
    updatedAt,
  }
}

const persistThreadEvent = async (threadId: string, event: SessionEvent) => {
  const response = await fetch(`/api/threads/${encodeURIComponent(threadId)}/event`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(event),
  })

  if (!response.ok) {
    throw new Error(`Thread event persist failed: ${response.status}`)
  }
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
  const [threads, setThreads] = useState<LlmThreadSummary[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [frames, setFrames] = useState<LlmTurnFrame[]>([])
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [pendingTick, setPendingTick] = useState(0)
  const activeFrameIdRef = useRef<string | null>(null)
  const activeRequestThreadIdRef = useRef<string | null>(null)
  const framesByThreadRef = useRef(new Map<string, LlmTurnFrame[]>())
  const wasLoadingRef = useRef(false)
  const deltaPersistRef = useRef({
    frameId: null as string | null,
    threadId: null as string | null,
    lastAt: 0,
    lastContent: "",
    pendingContent: "",
    timeoutId: null as number | null,
  })
  const threadPersistQueueRef = useRef(new Map<string, Promise<void>>())

  const upsertThread = (thread: LlmThreadSummary) => {
    setThreads((currentThreads) =>
      sortThreads([
        thread,
        ...currentThreads.filter((currentThread) => currentThread.id !== thread.id),
      ])
    )
  }

  const enqueueThreadEvent = (threadId: string, event: SessionEvent) => {
    const previous = threadPersistQueueRef.current.get(threadId) ?? Promise.resolve()
    const next = previous
      .catch(() => undefined)
      .then(() => persistThreadEvent(threadId, event))
      .catch(console.error)

    threadPersistQueueRef.current.set(threadId, next)

    return next
  }

  const enqueueThreadReset = (threadId: string) => {
    const previous = threadPersistQueueRef.current.get(threadId) ?? Promise.resolve()
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch(`/api/threads/${encodeURIComponent(threadId)}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          throw new Error(`Thread reset failed: ${response.status}`)
        }
      })
      .catch(console.error)

    threadPersistQueueRef.current.set(threadId, next)

    return next
  }

  const flushPendingSessionDelta = (threadId: string, frameId: string) => {
    const pendingContent = deltaPersistRef.current.pendingContent

    if (!pendingContent || deltaPersistRef.current.lastContent === pendingContent) {
      return
    }

    deltaPersistRef.current.lastAt = Date.now()
    deltaPersistRef.current.lastContent = pendingContent
    void enqueueThreadEvent(threadId, {
      type: "frame_delta",
      frameId,
      content: pendingContent,
      updatedAt: Date.now(),
    })
  }

  const loadThread = async (threadId: string) => {
    const response = await fetch(`/api/threads/${encodeURIComponent(threadId)}`)

    if (!response.ok) {
      throw new Error(`Thread load failed: ${response.status}`)
    }

    return (await response.json()) as ServerThread
  }

  const createThread = async () => {
    const response = await fetch("/api/threads", { method: "POST" })

    if (!response.ok) {
      throw new Error(`Thread create failed: ${response.status}`)
    }

    return (await response.json()) as ServerThread
  }

  const selectThread = async (threadId: string) => {
    if (threadId === activeThreadId) {
      return
    }

    if (activeThreadId) {
      framesByThreadRef.current.set(activeThreadId, frames)
    }

    const cachedFrames = framesByThreadRef.current.get(threadId)
    setActiveThreadId(threadId)

    if (cachedFrames) {
      setFrames(cachedFrames)
      setSelectedFrameId(cachedFrames.at(-1)?.id ?? null)
      return
    }

    try {
      const data = await loadThread(threadId)

      framesByThreadRef.current.set(threadId, data.frames)
      upsertThread(data.thread)
      setFrames(data.frames)
      setSelectedFrameId(data.frames.at(-1)?.id ?? null)
    } catch (loadError) {
      console.error(loadError)
    }
  }

  const handleNewThread = async () => {
    if (activeThreadId) {
      framesByThreadRef.current.set(activeThreadId, frames)
    }

    try {
      const data = await createThread()

      framesByThreadRef.current.set(data.thread.id, data.frames)
      upsertThread(data.thread)
      setActiveThreadId(data.thread.id)
      setFrames([])
      setSelectedFrameId(null)
      setInput("")
      setCompletion("")
    } catch (createError) {
      console.error(createError)
    }
  }

  const ensureActiveThread = async () => {
    if (activeThreadId) {
      return activeThreadId
    }

    const data = await createThread()

    framesByThreadRef.current.set(data.thread.id, data.frames)
    upsertThread(data.thread)
    setActiveThreadId(data.thread.id)

    return data.thread.id
  }

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
      const requestThreadId = activeRequestThreadIdRef.current

      if (!activeFrameId || !requestThreadId) {
        return
      }

      if (deltaPersistRef.current.timeoutId !== null) {
        window.clearTimeout(deltaPersistRef.current.timeoutId)
        deltaPersistRef.current.timeoutId = null
      }

      void enqueueThreadEvent(requestThreadId, {
        type: "frame_finished",
        frameId: activeFrameId,
        content: finalCompletion,
        rawFinalContent: finalCompletion,
        updatedAt: Date.now(),
      })

      const updateFrames = (currentFrames: LlmTurnFrame[]) =>
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
                status: "complete" as const,
              }
            : frame,
        )

      const cachedFrames = framesByThreadRef.current.get(requestThreadId) ?? []
      const nextFrames = updateFrames(cachedFrames)

      framesByThreadRef.current.set(requestThreadId, nextFrames)
      upsertThread(summarizeFrames(requestThreadId, nextFrames))

      if (activeThreadId === requestThreadId) {
        setFrames(nextFrames)
      }

      activeFrameIdRef.current = null
      activeRequestThreadIdRef.current = null
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

    const loadThreads = async () => {
      try {
        const response = await fetch("/api/threads")

        if (!response.ok) {
          throw new Error(`Threads load failed: ${response.status}`)
        }

        const data = (await response.json()) as ServerThreads
        const threadId = data.activeThreadId ?? data.threads[0]?.id

        if (ignore) {
          return
        }

        setThreads(data.threads)

        if (!threadId) {
          return
        }

        const thread = await loadThread(threadId)

        if (ignore) {
          return
        }

        framesByThreadRef.current.set(threadId, thread.frames)
        upsertThread(thread.thread)
        setActiveThreadId(threadId)
        setFrames(thread.frames)
        setSelectedFrameId(thread.frames.at(-1)?.id ?? null)
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
    void loadThreads()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const activeFrameId = activeFrameIdRef.current
    const requestThreadId = activeRequestThreadIdRef.current

    if (!activeFrameId || !requestThreadId) {
      return
    }

    const updateFrames = (currentFrames: LlmTurnFrame[]) =>
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
      )

    const cachedFrames = framesByThreadRef.current.get(requestThreadId) ?? []
    const nextFrames = updateFrames(cachedFrames)

    framesByThreadRef.current.set(requestThreadId, nextFrames)

    if (activeThreadId === requestThreadId) {
      setFrames(nextFrames)
    }

    if (!completion || deltaPersistRef.current.lastContent === completion) {
      return
    }

    const now = Date.now()
    deltaPersistRef.current.pendingContent = completion

    const persistDelta = () => {
      const content = deltaPersistRef.current.pendingContent

      deltaPersistRef.current.frameId = activeFrameId
      deltaPersistRef.current.threadId = requestThreadId
      deltaPersistRef.current.lastAt = Date.now()
      deltaPersistRef.current.lastContent = content
      deltaPersistRef.current.timeoutId = null
      void enqueueThreadEvent(requestThreadId, {
        type: "frame_delta",
        frameId: activeFrameId,
        content,
        updatedAt: Date.now(),
      })
    }

    if (
      deltaPersistRef.current.frameId !== activeFrameId ||
      deltaPersistRef.current.threadId !== requestThreadId
    ) {
      deltaPersistRef.current = {
        frameId: activeFrameId,
        threadId: requestThreadId,
        lastAt: 0,
        lastContent: "",
        pendingContent: "",
        timeoutId: null,
      }
    }

    if (now - deltaPersistRef.current.lastAt >= sessionDeltaThrottleMs) {
      if (deltaPersistRef.current.timeoutId !== null) {
        window.clearTimeout(deltaPersistRef.current.timeoutId)
      }
      persistDelta()
      return
    }

    if (deltaPersistRef.current.timeoutId === null) {
      deltaPersistRef.current.timeoutId = window.setTimeout(
        persistDelta,
        sessionDeltaThrottleMs - (now - deltaPersistRef.current.lastAt),
      )
    }
  }, [activeThreadId, completion])

  useEffect(() => {
    const activeFrameId = activeFrameIdRef.current
    const requestThreadId = activeRequestThreadIdRef.current

    if (wasLoadingRef.current && !isLoading && activeFrameId && requestThreadId && error) {
      const updateFrames = (currentFrames: LlmTurnFrame[]) =>
        currentFrames.map((frame) =>
          frame.id === activeFrameId && frame.status === "streaming"
            ? { ...frame, status: "error" as const }
            : frame,
        )

      const cachedFrames = framesByThreadRef.current.get(requestThreadId) ?? []
      const nextFrames = updateFrames(cachedFrames)

      framesByThreadRef.current.set(requestThreadId, nextFrames)
      upsertThread(summarizeFrames(requestThreadId, nextFrames))

      if (activeThreadId === requestThreadId) {
        setFrames(nextFrames)
      }

      flushPendingSessionDelta(requestThreadId, activeFrameId)
      void enqueueThreadEvent(requestThreadId, {
        type: "frame_status",
        frameId: activeFrameId,
        status: "error",
        updatedAt: Date.now(),
      })
      activeFrameIdRef.current = null
      activeRequestThreadIdRef.current = null
    }

    wasLoadingRef.current = isLoading
  }, [activeThreadId, error, isLoading])

  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId)
  const isPendingScreenVisible = selectedFrame?.status === "streaming" && !selectedFrame.content
  const isInitialScreenVisible = !selectedFrame && !isLoading

  useEffect(() => {
    if (!isPendingScreenVisible) {
      setPendingTick(0)
      return
    }

    const intervalId = window.setInterval(
      () => setPendingTick((currentTick) => currentTick + 1),
      pendingSpinnerIntervalMs,
    )

    return () => window.clearInterval(intervalId)
  }, [isPendingScreenVisible])

  const canvasContent = selectedFrame
    ? isPendingScreenVisible
      ? formatPendingScreen(
          selectedFrame.sourceContent ?? initialScreenContent,
          selectedFrame.actionPrompt ?? selectedFrame.title,
          pendingTick,
        )
      : selectedFrame.content
    : isLoading
      ? pendingOutput
      : initialScreenContent
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

  const submitPrompt = async (prompt: string, options?: { sourceContent?: string }) => {
    const actionPrompt = prompt.trim()

    if (!actionPrompt || isLoading) {
      return
    }

    try {
      const threadId = await ensureActiveThread()
      const activeFrames = framesByThreadRef.current.get(threadId) ?? frames
      const sourceContent = options?.sourceContent ?? canvasContent
      const nextPrompt = options?.sourceContent
        ? formatPromptWithSourceScreen(options.sourceContent, actionPrompt)
        : actionPrompt
      const frameId = createFrameId()
      const nextFrame: LlmTurnFrame = {
        id: frameId,
        title: getFrameTitle(actionPrompt),
        prompt: nextPrompt,
        content: "",
        sourceContent,
        actionPrompt,
        createdAt: Date.now(),
        status: "streaming",
      }
      const nextFrames = [...activeFrames, nextFrame]

      activeFrameIdRef.current = frameId
      activeRequestThreadIdRef.current = threadId
      deltaPersistRef.current = {
        frameId,
        threadId,
        lastAt: 0,
        lastContent: "",
        pendingContent: "",
        timeoutId: null,
      }
      framesByThreadRef.current.set(threadId, nextFrames)
      upsertThread(summarizeFrames(threadId, nextFrames))
      setActiveThreadId(threadId)
      setFrames(nextFrames)
      setSelectedFrameId(frameId)
      setCompletion("")
      void enqueueThreadEvent(threadId, { type: "frame_started", frame: nextFrame })
      void complete(nextPrompt, {
        body: {
          systemPrompt: savedSystemPrompt.trim(),
        },
      })
    } catch (submitError) {
      console.error(submitError)
    }
  }

  const handlePromptHref = (prompt: string) => {
    void submitPrompt(
      prompt,
      isInitialScreenVisible ? { sourceContent: initialScreenContent } : undefined,
    )
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitPrompt(input)
  }

  const handleSubmitShortcut = () => {
    void submitPrompt(input)
  }

  const handleResetThread = () => {
    if (!activeThreadId) {
      setFrames([])
      setSelectedFrameId(null)
      setInput("")
      setCompletion("")
      return
    }

    if (isLoading) {
      stop()
    }

    if (deltaPersistRef.current.timeoutId !== null) {
      window.clearTimeout(deltaPersistRef.current.timeoutId)
    }

    activeFrameIdRef.current = null
    activeRequestThreadIdRef.current = null
    deltaPersistRef.current = {
      frameId: null,
      threadId: null,
      lastAt: 0,
      lastContent: "",
      pendingContent: "",
      timeoutId: null,
    }
    framesByThreadRef.current.set(activeThreadId, [])
    upsertThread(summarizeFrames(activeThreadId, []))
    setFrames([])
    setSelectedFrameId(null)
    setInput("")
    setCompletion("")
    void enqueueThreadReset(activeThreadId)
  }

  const handleStop = () => {
    const activeFrameId = activeFrameIdRef.current
    const requestThreadId = activeRequestThreadIdRef.current

    if (activeFrameId && requestThreadId) {
      const updateFrames = (currentFrames: LlmTurnFrame[]) =>
        currentFrames.map((frame) =>
          frame.id === activeFrameId ? { ...frame, status: "stopped" as const } : frame,
        )

      const cachedFrames = framesByThreadRef.current.get(requestThreadId) ?? []
      const nextFrames = updateFrames(cachedFrames)

      framesByThreadRef.current.set(requestThreadId, nextFrames)
      upsertThread(summarizeFrames(requestThreadId, nextFrames))

      if (activeThreadId === requestThreadId) {
        setFrames(nextFrames)
      }

      flushPendingSessionDelta(requestThreadId, activeFrameId)
      void enqueueThreadEvent(requestThreadId, {
        type: "frame_status",
        frameId: activeFrameId,
        status: "stopped",
        updatedAt: Date.now(),
      })
      activeFrameIdRef.current = null
      activeRequestThreadIdRef.current = null
    }

    if (deltaPersistRef.current.timeoutId !== null) {
      window.clearTimeout(deltaPersistRef.current.timeoutId)
      deltaPersistRef.current.timeoutId = null
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
        threads={threads}
        activeThreadId={activeThreadId}
        frames={frames}
        selectedFrameId={selectedFrameId}
        systemPromptDraft={systemPromptDraft}
        hasUnsavedSystemPrompt={hasUnsavedSystemPrompt}
        isSavingSystemPrompt={isSavingSystemPrompt}
        input={input}
        isLoading={isLoading}
        error={error}
        canSubmit={canSubmit}
        onSelectThread={(threadId) => {
          void selectThread(threadId)
        }}
        onNewThread={() => {
          void handleNewThread()
        }}
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
