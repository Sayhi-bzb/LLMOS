import { useCompletion } from "@ai-sdk/react"
import { useEffect, useRef, useState, type FormEvent } from "react"

import { LlmCanvasWorkspace, pendingOutput } from "@/components/llm"
import type {
  LlmConfigDraft,
  LlmRequestTrigger,
  LlmTurnDebug,
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
const defaultLiteLLMTemperature = "0.7"
const sessionDeltaThrottleMs = 500
const pendingSpinnerIntervalMs = 140
const pendingSpinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

const emptyConfigDraft: LlmConfigDraft = {
  baseURL: defaultLiteLLMBaseURL,
  apiKey: "",
  model: "",
  temperature: defaultLiteLLMTemperature,
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
  `[34m${pendingSpinnerFrames[tick % pendingSpinnerFrames.length]}[0m [90m正在处理：[0m${actionPrompt}`,
].join("\n")

const getFrameTitle = (prompt: string) => {
  const title = prompt.split(/\r?\n/)[0]?.trim() || "Untitled turn"

  return title.length > 40 ? `${title.slice(0, 40)}...` : title
}

const sortThreads = (threads: LlmThreadSummary[]) =>
  [...threads].sort((a, b) => b.updatedAt - a.updatedAt)

const parseTemperatureDraft = (value: string) => {
  const temperature = Number(value)

  return Number.isFinite(temperature) ? temperature : Number(defaultLiteLLMTemperature)
}

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
  const [resolvedSystemPrompt, setResolvedSystemPrompt] = useState("")
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
  const streamLengthByFrameRef = useRef(new Map<string, number>())
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

  const updateFrameDebug = (
    threadId: string,
    frameId: string,
    getNextDebug: (currentDebug: LlmTurnDebug | undefined) => LlmTurnDebug,
  ) => {
    const updateFrames = (currentFrames: LlmTurnFrame[]) =>
      currentFrames.map((frame) =>
        frame.id === frameId ? { ...frame, debug: getNextDebug(frame.debug) } : frame,
      )

    const cachedFrames = framesByThreadRef.current.get(threadId) ?? []
    const nextFrames = updateFrames(cachedFrames)

    framesByThreadRef.current.set(threadId, nextFrames)

    if (activeThreadId === threadId) {
      setFrames(nextFrames)
    }
  }

  const getEventFrameId = (event: SessionEvent) => {
    if (event.type === "session_reset") {
      return null
    }

    return event.type === "frame_started" ? event.frame.id : event.frameId
  }

  const getEventPersistedLength = (event: SessionEvent) => {
    if (event.type === "frame_started") {
      return event.frame.content.length
    }

    if (event.type === "frame_delta" || event.type === "frame_finished") {
      return event.content.length
    }

    return undefined
  }

  const createRequestDebug = ({
    requestId,
    threadId,
    frameId,
    trigger,
    prompt,
    actionPrompt,
    sourceContent,
  }: {
    requestId: string
    threadId: string
    frameId: string
    trigger: LlmRequestTrigger
    prompt: string
    actionPrompt: string
    sourceContent: string
  }): LlmTurnDebug => ({
    request: {
      requestId,
      threadId,
      frameId,
      trigger,
      promptLength: prompt.length,
      actionPromptLength: actionPrompt.length,
      sourceContentLength: sourceContent.length,
      systemPromptLength: resolvedSystemPrompt.trim().length,
      baseURL: configDraft.baseURL,
      model: configDraft.model,
      temperature: parseTemperatureDraft(configDraft.temperature),
      hasServerApiKey,
      createdAt: Date.now(),
    },
    stream: {
      startedAt: Date.now(),
      chunkCount: 0,
      lastDeltaLength: 0,
      totalLength: 0,
    },
  })

  const enqueueThreadEvent = (threadId: string, event: SessionEvent) => {
    const frameId = getEventFrameId(event)
    const persistedLength = getEventPersistedLength(event)
    const markPersisted = () => {
      if (!frameId) {
        return
      }

      updateFrameDebug(threadId, frameId, (currentDebug) => ({
        ...currentDebug,
        persistence: {
          ...currentDebug?.persistence,
          lastEventType: event.type,
          lastPersistedLength: persistedLength,
          pendingLength: deltaPersistRef.current.pendingContent.length,
          lastPersistedAt: Date.now(),
          lastPersistError: undefined,
        },
      }))
    }
    const markPersistError = (persistError: unknown) => {
      if (!frameId) {
        return
      }

      updateFrameDebug(threadId, frameId, (currentDebug) => ({
        ...currentDebug,
        persistence: {
          ...currentDebug?.persistence,
          lastEventType: event.type,
          lastPersistedLength: persistedLength,
          pendingLength: deltaPersistRef.current.pendingContent.length,
          lastPersistError:
            persistError instanceof Error ? persistError.message : String(persistError),
        },
      }))
    }

    const previous = threadPersistQueueRef.current.get(threadId) ?? Promise.resolve()
    const next = previous
      .catch(() => undefined)
      .then(() => persistThreadEvent(threadId, event))
      .then(markPersisted)
      .catch((persistError) => {
        markPersistError(persistError)
        console.error(persistError)
      })

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
                  stream: {
                    startedAt: frame.debug?.stream?.startedAt ?? Date.now(),
                    chunkCount: frame.debug?.stream?.chunkCount ?? 0,
                    lastDeltaLength: frame.debug?.stream?.lastDeltaLength ?? 0,
                    totalLength: finalCompletion.length,
                    firstChunkAt: frame.debug?.stream?.firstChunkAt,
                    lastChunkAt: frame.debug?.stream?.lastChunkAt,
                    finishedAt: Date.now(),
                    outcome: "complete" as const,
                  },
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
      streamLengthByFrameRef.current.delete(activeFrameId)
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
        setResolvedSystemPrompt(data.resolvedSystemPrompt ?? data.systemPrompt ?? "")
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
          temperature: String(data.temperature ?? defaultLiteLLMTemperature),
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

    const previousLength = streamLengthByFrameRef.current.get(activeFrameId) ?? 0
    const deltaLength = Math.max(completion.length - previousLength, 0)
    const now = Date.now()

    streamLengthByFrameRef.current.set(activeFrameId, completion.length)

    const updateFrames = (currentFrames: LlmTurnFrame[]) =>
      currentFrames.map((frame) =>
        frame.id === activeFrameId
          ? {
              ...frame,
              content: completion,
              debug: {
                ...frame.debug,
                lastCompletionLength: completion.length,
                stream: {
                  startedAt: frame.debug?.stream?.startedAt ?? now,
                  firstChunkAt:
                    frame.debug?.stream?.firstChunkAt ?? (completion.length > 0 ? now : undefined),
                  lastChunkAt: completion.length > 0 ? now : frame.debug?.stream?.lastChunkAt,
                  finishedAt: frame.debug?.stream?.finishedAt,
                  chunkCount:
                    (frame.debug?.stream?.chunkCount ?? 0) + (deltaLength > 0 ? 1 : 0),
                  lastDeltaLength: deltaLength,
                  totalLength: completion.length,
                  outcome: frame.debug?.stream?.outcome,
                  errorMessage: frame.debug?.stream?.errorMessage,
                },
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
            ? {
                ...frame,
                debug: {
                  ...frame.debug,
                  stream: {
                    startedAt: frame.debug?.stream?.startedAt ?? Date.now(),
                    firstChunkAt: frame.debug?.stream?.firstChunkAt,
                    lastChunkAt: frame.debug?.stream?.lastChunkAt,
                    finishedAt: Date.now(),
                    chunkCount: frame.debug?.stream?.chunkCount ?? 0,
                    lastDeltaLength: frame.debug?.stream?.lastDeltaLength ?? 0,
                    totalLength: frame.content.length,
                    outcome: "error" as const,
                    errorMessage: error.message,
                  },
                },
                status: "error" as const,
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

      flushPendingSessionDelta(requestThreadId, activeFrameId)
      void enqueueThreadEvent(requestThreadId, {
        type: "frame_status",
        frameId: activeFrameId,
        status: "error",
        updatedAt: Date.now(),
      })
      activeFrameIdRef.current = null
      activeRequestThreadIdRef.current = null
      streamLengthByFrameRef.current.delete(activeFrameId)
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
      setResolvedSystemPrompt(data.resolvedSystemPrompt ?? data.systemPrompt ?? systemPromptDraft)
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
        temperature: String(data.temperature ?? configDraft.temperature),
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

  const submitPrompt = async (
    prompt: string,
    options?: {
      sourceContent?: string
      trigger?: LlmRequestTrigger
      interactionHref?: string
    },
  ) => {
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
      const requestId = createFrameId()
      const trigger = options?.trigger ?? "input"
      const nextFrame: LlmTurnFrame = {
        id: frameId,
        title: getFrameTitle(actionPrompt),
        prompt: nextPrompt,
        content: "",
        sourceContent,
        actionPrompt,
        debug: {
          ...createRequestDebug({
            requestId,
            threadId,
            frameId,
            trigger,
            prompt: nextPrompt,
            actionPrompt,
            sourceContent,
          }),
          interaction:
            trigger === "prompt_href"
              ? {
                  href: options?.interactionHref ?? `prompt://${actionPrompt}`,
                  kind: "prompt",
                  prompt: actionPrompt,
                  triggeredRequest: true,
                  at: Date.now(),
                }
              : undefined,
        },
        createdAt: Date.now(),
        status: "streaming",
      }
      const nextFrames = [...activeFrames, nextFrame]

      activeFrameIdRef.current = frameId
      activeRequestThreadIdRef.current = threadId
      streamLengthByFrameRef.current.set(frameId, 0)
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
          systemPrompt: resolvedSystemPrompt.trim(),
        },
      })
    } catch (submitError) {
      console.error(submitError)
    }
  }

  const handlePromptHref = (prompt: string) => {
    const href = `prompt://${prompt}`

    void submitPrompt(
      prompt,
      isInitialScreenVisible
        ? {
            sourceContent: initialScreenContent,
            trigger: "prompt_href",
            interactionHref: href,
          }
        : { trigger: "prompt_href", interactionHref: href },
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
          frame.id === activeFrameId
            ? {
                ...frame,
                debug: {
                  ...frame.debug,
                  stream: {
                    startedAt: frame.debug?.stream?.startedAt ?? Date.now(),
                    firstChunkAt: frame.debug?.stream?.firstChunkAt,
                    lastChunkAt: frame.debug?.stream?.lastChunkAt,
                    finishedAt: Date.now(),
                    chunkCount: frame.debug?.stream?.chunkCount ?? 0,
                    lastDeltaLength: frame.debug?.stream?.lastDeltaLength ?? 0,
                    totalLength: frame.content.length,
                    outcome: "stopped" as const,
                  },
                },
                status: "stopped" as const,
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

      flushPendingSessionDelta(requestThreadId, activeFrameId)
      void enqueueThreadEvent(requestThreadId, {
        type: "frame_status",
        frameId: activeFrameId,
        status: "stopped",
        updatedAt: Date.now(),
      })
      activeFrameIdRef.current = null
      activeRequestThreadIdRef.current = null
      streamLengthByFrameRef.current.delete(activeFrameId)
    }

    if (deltaPersistRef.current.timeoutId !== null) {
      window.clearTimeout(deltaPersistRef.current.timeoutId)
      deltaPersistRef.current.timeoutId = null
    }

    stop()
  }

  return (
    <main className="flex min-h-svh flex-col bg-background p-6 text-foreground">
      <LlmCanvasWorkspace
        canvasContent={canvasContent}
        threads={threads}
        activeThreadId={activeThreadId}
        frames={frames}
        selectedFrameId={selectedFrameId}
        systemPromptDraft={systemPromptDraft}
        hasUnsavedSystemPrompt={hasUnsavedSystemPrompt}
        isSavingSystemPrompt={isSavingSystemPrompt}
        configOpen={configOpen}
        configDraft={configDraft}
        configStatus={configStatus}
        configError={configError}
        hasServerApiKey={hasServerApiKey}
        isSavingConfig={isSavingConfig}
        defaultBaseURL={defaultLiteLLMBaseURL}
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
        onConfigOpenChange={setConfigOpen}
        onConfigChange={updateConfigDraft}
        onSaveConfig={handleSaveLlmConfig}
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
