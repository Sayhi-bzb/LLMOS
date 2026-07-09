import fs from "node:fs/promises"
import path from "path"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import tailwindcss from "@tailwindcss/vite"
import { streamText } from "ai"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"
import type { LlmThreadSummary, LlmTurnFrame, SessionEvent } from "./src/components/llm/types"

const completionApiPath = "/api/completion"
const llmConfigApiPath = "/api/llm-config"
const systemPromptApiPath = "/api/system-prompt"
const initialScreenApiPath = "/api/initial-screen"
const legacySessionApiPath = "/api/session"
const legacySessionEventApiPath = "/api/session/event"
const threadsApiPath = "/api/threads"
const defaultLiteLLMBaseURL = "http://localhost:4000/v1"
const defaultLiteLLMTemperature = 0.7
const legacyThreadId = "current"
const managedEnvKeys = [
  "LITELLM_BASE_URL",
  "LITELLM_API_KEY",
  "LITELLM_MODEL",
  "LITELLM_TEMPERATURE",
] as const

interface CompletionRequestBody {
  prompt?: unknown
  systemPrompt?: unknown
}

interface LlmConfigRequestBody {
  baseURL?: unknown
  apiKey?: unknown
  model?: unknown
  temperature?: unknown
}

interface SystemPromptRequestBody {
  systemPrompt?: unknown
}

interface LiteLLMServerConfig {
  baseURL: string
  apiKey?: string
  model?: string
  temperature: number
}

type MiddlewareServer = {
  middlewares: {
    use: (
      path: string,
      handler: (
        req: import("node:http").IncomingMessage,
        res: import("node:http").ServerResponse,
      ) => void,
    ) => void
  }
}

const readJsonBody = async (req: import("node:http").IncomingMessage) => {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return {}
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
}

const sendJson = (
  res: import("node:http").ServerResponse,
  statusCode: number,
  payload: unknown,
) => {
  res.statusCode = statusCode
  res.setHeader("content-type", "application/json; charset=utf-8")
  res.end(JSON.stringify(payload))
}

const asTrimmedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : ""

const asTemperature = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null
  }

  const temperature = Number(value)

  return Number.isFinite(temperature) && temperature >= 0 && temperature <= 2
    ? temperature
    : null
}

const casesPlaceholder = "{cases}"

const readTextFileOrEmpty = async (filePath: string) => {
  try {
    return await fs.readFile(filePath, "utf8")
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return ""
    }

    throw error
  }
}

const resolveSystemPrompt = (systemPrompt: string, casesPrompt: string) => {
  const trimmedCases = casesPrompt.trim()

  if (systemPrompt.includes(casesPlaceholder)) {
    return systemPrompt.replaceAll(casesPlaceholder, trimmedCases)
  }

  return [systemPrompt.trimEnd(), trimmedCases].filter(Boolean).join("\n\n")
}

const isFrameStatus = (value: unknown): value is LlmTurnFrame["status"] =>
  value === "streaming" || value === "complete" || value === "error" || value === "stopped"

const isSessionTerminalStatus = (value: unknown): value is "error" | "stopped" =>
  value === "error" || value === "stopped"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const sanitizeFrame = (value: unknown): LlmTurnFrame | null => {
  if (!isRecord(value)) {
    return null
  }

  const id = asTrimmedString(value.id)
  const title = asTrimmedString(value.title) || "Untitled turn"
  const prompt = typeof value.prompt === "string" ? value.prompt : ""
  const content = typeof value.content === "string" ? value.content : ""
  const status = isFrameStatus(value.status) ? value.status : "stopped"
  const createdAt = typeof value.createdAt === "number" ? value.createdAt : Date.now()

  if (!id || !prompt) {
    return null
  }

  return {
    id,
    title,
    prompt,
    content,
    rawFinalContent: typeof value.rawFinalContent === "string" ? value.rawFinalContent : undefined,
    sourceContent: typeof value.sourceContent === "string" ? value.sourceContent : undefined,
    actionPrompt: typeof value.actionPrompt === "string" ? value.actionPrompt : undefined,
    debug: isRecord(value.debug)
      ? {
          lastCompletionLength:
            typeof value.debug.lastCompletionLength === "number"
              ? value.debug.lastCompletionLength
              : undefined,
          finalCompletionLength:
            typeof value.debug.finalCompletionLength === "number"
              ? value.debug.finalCompletionLength
              : undefined,
        }
      : undefined,
    createdAt,
    status,
  }
}

const sanitizeSessionEvent = (value: unknown): SessionEvent | null => {
  if (!isRecord(value)) {
    return null
  }

  if (value.type === "frame_started") {
    const frame = sanitizeFrame(value.frame)

    return frame ? { type: "frame_started", frame } : null
  }

  if (value.type === "frame_delta") {
    const frameId = asTrimmedString(value.frameId)
    const content = typeof value.content === "string" ? value.content : ""
    const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : Date.now()

    return frameId ? { type: "frame_delta", frameId, content, updatedAt } : null
  }

  if (value.type === "frame_finished") {
    const frameId = asTrimmedString(value.frameId)
    const content = typeof value.content === "string" ? value.content : ""
    const rawFinalContent =
      typeof value.rawFinalContent === "string" ? value.rawFinalContent : content
    const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : Date.now()

    return frameId
      ? { type: "frame_finished", frameId, content, rawFinalContent, updatedAt }
      : null
  }

  if (value.type === "frame_status") {
    const frameId = asTrimmedString(value.frameId)
    const status = isSessionTerminalStatus(value.status) ? value.status : null
    const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : Date.now()

    return frameId && status ? { type: "frame_status", frameId, status, updatedAt } : null
  }

  if (value.type === "session_reset") {
    const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : Date.now()

    return { type: "session_reset", updatedAt }
  }

  return null
}

const getSessionEventTimestamp = (event: SessionEvent) => {
  if (event.type === "frame_started") {
    return event.frame.createdAt
  }

  return event.updatedAt
}

const replaySessionEvents = (events: SessionEvent[]) => {
  const frames = new Map<string, LlmTurnFrame>()

  for (const event of events) {
    if (event.type === "session_reset") {
      frames.clear()
      continue
    }

    if (event.type === "frame_started") {
      frames.set(event.frame.id, event.frame)
      continue
    }

    const frame = frames.get(event.frameId)

    if (!frame) {
      continue
    }

    if (event.type === "frame_delta") {
      frames.set(event.frameId, {
        ...frame,
        content: event.content,
        debug: {
          ...frame.debug,
          lastCompletionLength: event.content.length,
        },
      })
      continue
    }

    if (event.type === "frame_finished") {
      frames.set(event.frameId, {
        ...frame,
        content: event.content,
        rawFinalContent: event.rawFinalContent,
        debug: {
          ...frame.debug,
          finalCompletionLength: event.content.length,
        },
        status: "complete",
      })
      continue
    }

    frames.set(event.frameId, { ...frame, status: event.status })
  }

  return Array.from(frames.values()).map((frame) =>
    frame.status === "streaming" ? { ...frame, status: "stopped" as const } : frame,
  )
}

const summarizeThread = (
  threadId: string,
  events: SessionEvent[],
  fallbackTime = Date.now(),
): LlmThreadSummary => {
  const frames = replaySessionEvents(events)
  const firstFrame = frames[0]
  const timestamps = events.map(getSessionEventTimestamp).filter(Number.isFinite)
  const createdAt = firstFrame?.createdAt ?? timestamps[0] ?? fallbackTime
  const updatedAt = timestamps.at(-1) ?? fallbackTime

  return {
    id: threadId,
    title: firstFrame?.title ?? "New thread",
    frameCount: frames.length,
    createdAt,
    updatedAt,
  }
}

const readSessionEvents = async (sessionPath: string) => {
  let content = ""

  try {
    content = await fs.readFile(sessionPath, "utf8")
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return []
    }

    throw error
  }

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return sanitizeSessionEvent(JSON.parse(line))
      } catch {
        return null
      }
    })
    .filter((event): event is SessionEvent => Boolean(event))
}

const appendSessionEvent = async (sessionPath: string, event: SessionEvent) => {
  await fs.mkdir(path.dirname(sessionPath), { recursive: true })
  await fs.appendFile(sessionPath, `${JSON.stringify(event)}\n`, "utf8")
}

const createThreadId = () =>
  `thread-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const isSafeThreadId = (threadId: string) =>
  threadId === legacyThreadId || /^thread-[A-Za-z0-9_-]+$/.test(threadId)

const getThreadPath = (sessionsDir: string, threadId: string) =>
  path.join(sessionsDir, threadId === legacyThreadId ? "current.jsonl" : `${threadId}.jsonl`)

const readThread = async (sessionsDir: string, threadId: string) => {
  if (!isSafeThreadId(threadId)) {
    return null
  }

  const threadPath = getThreadPath(sessionsDir, threadId)
  const [events, stats] = await Promise.all([
    readSessionEvents(threadPath),
    fs.stat(threadPath),
  ])
  const fallbackTime = stats.mtimeMs || stats.birthtimeMs
  const thread = summarizeThread(threadId, events, fallbackTime)

  return { thread, frames: replaySessionEvents(events) }
}

const listThreads = async (sessionsDir: string) => {
  let entries: string[] = []

  try {
    entries = await fs.readdir(sessionsDir)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return []
    }

    throw error
  }

  const threadIds = entries
    .filter((entry) => entry.endsWith(".jsonl"))
    .map((entry) => (entry === "current.jsonl" ? legacyThreadId : entry.slice(0, -6)))
    .filter(isSafeThreadId)
  const threads = await Promise.all(
    threadIds.map(async (threadId) => {
      const threadPath = getThreadPath(sessionsDir, threadId)
      const [events, stats] = await Promise.all([
        readSessionEvents(threadPath),
        fs.stat(threadPath),
      ])
      const fallbackTime = stats.mtimeMs || stats.birthtimeMs

      return summarizeThread(threadId, events, fallbackTime)
    }),
  )

  return threads.sort((a, b) => b.updatedAt - a.updatedAt)
}

const quoteEnvValue = (value: string) => {
  if (/^[A-Za-z0-9_./:@-]*$/.test(value)) {
    return value
  }

  return JSON.stringify(value)
}

const parseEnvLine = (line: string) => {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)
  return match?.[1]
}

const upsertEnvLocal = async (
  envPath: string,
  values: Partial<Record<(typeof managedEnvKeys)[number], string>>,
) => {
  let existing = ""

  try {
    existing = await fs.readFile(envPath, "utf8")
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error
    }
  }

  const pending = new Map(Object.entries(values).filter(([, value]) => value !== undefined))
  const nextLines = existing
    .split(/\r?\n/)
    .filter((line, index, lines) => index < lines.length - 1 || line.length > 0)
    .map((line) => {
      const key = parseEnvLine(line)

      if (!key || !pending.has(key)) {
        return line
      }

      const value = pending.get(key) ?? ""
      pending.delete(key)
      return `${key}=${quoteEnvValue(value)}`
    })

  for (const [key, value] of pending) {
    nextLines.push(`${key}=${quoteEnvValue(value ?? "")}`)
  }

  await fs.writeFile(envPath, `${nextLines.join("\n")}\n`, "utf8")
}

const pipeWebResponse = async (
  response: Response,
  res: import("node:http").ServerResponse,
) => {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))

  if (!response.body) {
    res.end()
    return
  }

  const reader = response.body.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      res.write(Buffer.from(value))
    }
  } finally {
    res.end()
    reader.releaseLock()
  }
}

const llmCompletionPlugin = (initialConfig: LiteLLMServerConfig): Plugin => {
  const runtimeConfig: LiteLLMServerConfig = { ...initialConfig }
  const envLocalPath = path.resolve(process.cwd(), ".env.local")
  const systemPromptPath = path.resolve(process.cwd(), "prompts/system.md")
  const casesPromptPath = path.resolve(process.cwd(), "prompts/cases.md")
  const initialScreenPath = path.resolve(process.cwd(), "prompts/initial-screen.md")
  const sessionsDir = path.resolve(process.cwd(), "sessions")
  const legacySessionPath = getThreadPath(sessionsDir, legacyThreadId)

  const handleCompletion = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" })
      return
    }

    try {
      const body = (await readJsonBody(req)) as CompletionRequestBody
      const prompt = asTrimmedString(body.prompt)
      const systemPrompt = asTrimmedString(body.systemPrompt)

      if (!prompt) {
        sendJson(res, 400, { error: "Prompt is required." })
        return
      }

      if (!runtimeConfig.apiKey || !runtimeConfig.model) {
        sendJson(res, 500, {
          error: "Set LITELLM_API_KEY and LITELLM_MODEL in the server environment.",
        })
        return
      }

      const litellm = createOpenAICompatible({
        name: "litellm",
        baseURL: runtimeConfig.baseURL,
        apiKey: runtimeConfig.apiKey,
      })
      const result = streamText({
        model: litellm(runtimeConfig.model),
        prompt,
        temperature: runtimeConfig.temperature,
        ...(systemPrompt ? { system: systemPrompt } : {}),
      })

      await pipeWebResponse(result.toTextStreamResponse(), res)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      sendJson(res, 500, { error: message })
    }
  }

  const handleLlmConfig = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) => {
    if (req.method === "GET") {
      sendJson(res, 200, {
        baseURL: runtimeConfig.baseURL,
        model: runtimeConfig.model ?? "",
        temperature: runtimeConfig.temperature,
        hasApiKey: Boolean(runtimeConfig.apiKey),
      })
      return
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" })
      return
    }

    try {
      const body = (await readJsonBody(req)) as LlmConfigRequestBody
      const baseURL = asTrimmedString(body.baseURL) || defaultLiteLLMBaseURL
      const model = asTrimmedString(body.model)
      const apiKey = asTrimmedString(body.apiKey)
      const temperature = asTemperature(body.temperature)

      if (!model) {
        sendJson(res, 400, { error: "Model is required." })
        return
      }

      if (temperature === null) {
        sendJson(res, 400, { error: "Temperature must be a number from 0 to 2." })
        return
      }

      const envUpdates: Partial<Record<(typeof managedEnvKeys)[number], string>> = {
        LITELLM_BASE_URL: baseURL,
        LITELLM_MODEL: model,
        LITELLM_TEMPERATURE: String(temperature),
      }

      runtimeConfig.baseURL = baseURL
      runtimeConfig.model = model
      runtimeConfig.temperature = temperature

      if (apiKey) {
        envUpdates.LITELLM_API_KEY = apiKey
        runtimeConfig.apiKey = apiKey
      }

      await upsertEnvLocal(envLocalPath, envUpdates)
      sendJson(res, 200, {
        baseURL: runtimeConfig.baseURL,
        model: runtimeConfig.model,
        temperature: runtimeConfig.temperature,
        hasApiKey: Boolean(runtimeConfig.apiKey),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      sendJson(res, 500, { error: message })
    }
  }

  const handleInitialScreen = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) => {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" })
      return
    }

    try {
      const initialScreen = await fs.readFile(initialScreenPath, "utf8")
      sendJson(res, 200, { initialScreen })
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        sendJson(res, 200, { initialScreen: "" })
        return
      }

      const message = error instanceof Error ? error.message : "Unknown error"
      sendJson(res, 500, { error: message })
    }
  }

  const handleSystemPrompt = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) => {
    if (req.method === "GET") {
      try {
        const [systemPrompt, casesPrompt] = await Promise.all([
          readTextFileOrEmpty(systemPromptPath),
          readTextFileOrEmpty(casesPromptPath),
        ])

        sendJson(res, 200, {
          systemPrompt,
          resolvedSystemPrompt: resolveSystemPrompt(systemPrompt, casesPrompt),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        sendJson(res, 500, { error: message })
      }
      return
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" })
      return
    }

    try {
      const body = (await readJsonBody(req)) as SystemPromptRequestBody
      const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : ""

      await fs.mkdir(path.dirname(systemPromptPath), { recursive: true })
      await fs.writeFile(systemPromptPath, systemPrompt, "utf8")
      const casesPrompt = await readTextFileOrEmpty(casesPromptPath)
      sendJson(res, 200, {
        systemPrompt,
        resolvedSystemPrompt: resolveSystemPrompt(systemPrompt, casesPrompt),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      sendJson(res, 500, { error: message })
    }
  }

  const handleThreads = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) => {
    if (req.method === "GET") {
      try {
        const threads = await listThreads(sessionsDir)
        sendJson(res, 200, { threads, activeThreadId: threads[0]?.id })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        sendJson(res, 500, { error: message })
      }
      return
    }

    if (req.method === "POST") {
      try {
        const threadId = createThreadId()
        const threadPath = getThreadPath(sessionsDir, threadId)

        await fs.mkdir(path.dirname(threadPath), { recursive: true })
        await fs.writeFile(threadPath, "", "utf8")
        sendJson(res, 200, {
          thread: summarizeThread(threadId, []),
          frames: [],
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        sendJson(res, 500, { error: message })
      }
      return
    }

    sendJson(res, 405, { error: "Method not allowed" })
  }

  const handleThread = async (
    threadId: string,
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) => {
    if (!isSafeThreadId(threadId)) {
      sendJson(res, 400, { error: "Invalid thread id." })
      return
    }

    if (req.method === "GET") {
      try {
        const thread = await readThread(sessionsDir, threadId)

        if (!thread) {
          sendJson(res, 404, { error: "Thread not found." })
          return
        }

        sendJson(res, 200, thread)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        sendJson(res, 500, { error: message })
      }
      return
    }

    if (req.method === "DELETE") {
      try {
        await appendSessionEvent(getThreadPath(sessionsDir, threadId), {
          type: "session_reset",
          updatedAt: Date.now(),
        })
        const thread = await readThread(sessionsDir, threadId)

        sendJson(res, 200, thread ?? { thread: summarizeThread(threadId, []), frames: [] })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        sendJson(res, 500, { error: message })
      }
      return
    }

    sendJson(res, 405, { error: "Method not allowed" })
  }

  const handleThreadEvent = async (
    threadId: string,
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) => {
    if (!isSafeThreadId(threadId)) {
      sendJson(res, 400, { error: "Invalid thread id." })
      return
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" })
      return
    }

    try {
      const event = sanitizeSessionEvent(await readJsonBody(req))

      if (!event) {
        sendJson(res, 400, { error: "Invalid session event." })
        return
      }

      await appendSessionEvent(getThreadPath(sessionsDir, threadId), event)
      sendJson(res, 200, { ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      sendJson(res, 500, { error: message })
    }
  }

  const handleThreadRoute = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) => {
    const rawUrl = req.url ?? ""
    const route = rawUrl.replace(/^\//, "").split("?")[0] ?? ""
    const [threadId, action] = route.split("/")

    if (!threadId) {
      await handleThreads(req, res)
      return
    }

    if (action === "event") {
      await handleThreadEvent(decodeURIComponent(threadId), req, res)
      return
    }

    if (action) {
      sendJson(res, 404, { error: "Thread route not found." })
      return
    }

    await handleThread(decodeURIComponent(threadId), req, res)
  }

  const handleLegacySession = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) => {
    if (req.method === "GET") {
      try {
        const events = await readSessionEvents(legacySessionPath)
        sendJson(res, 200, { frames: replaySessionEvents(events) })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        sendJson(res, 500, { error: message })
      }
      return
    }

    if (req.method === "DELETE") {
      try {
        await appendSessionEvent(legacySessionPath, { type: "session_reset", updatedAt: Date.now() })
        sendJson(res, 200, { frames: [] })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        sendJson(res, 500, { error: message })
      }
      return
    }

    sendJson(res, 405, { error: "Method not allowed" })
  }

  const handleLegacySessionEvent = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" })
      return
    }

    try {
      const event = sanitizeSessionEvent(await readJsonBody(req))

      if (!event) {
        sendJson(res, 400, { error: "Invalid session event." })
        return
      }

      await appendSessionEvent(legacySessionPath, event)
      sendJson(res, 200, { ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      sendJson(res, 500, { error: message })
    }
  }

  const registerMiddlewares = (server: MiddlewareServer) => {
    server.middlewares.use(completionApiPath, (req, res) => {
      void handleCompletion(req, res)
    })
    server.middlewares.use(llmConfigApiPath, (req, res) => {
      void handleLlmConfig(req, res)
    })
    server.middlewares.use(systemPromptApiPath, (req, res) => {
      void handleSystemPrompt(req, res)
    })
    server.middlewares.use(initialScreenApiPath, (req, res) => {
      void handleInitialScreen(req, res)
    })
    server.middlewares.use(legacySessionEventApiPath, (req, res) => {
      void handleLegacySessionEvent(req, res)
    })
    server.middlewares.use(legacySessionApiPath, (req, res) => {
      void handleLegacySession(req, res)
    })
    server.middlewares.use(threadsApiPath, (req, res) => {
      void handleThreadRoute(req, res)
    })
  }

  return {
    name: "llm-completion-api",
    configureServer(server) {
      registerMiddlewares(server)
    },
    configurePreviewServer(server) {
      registerMiddlewares(server)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  return {
    plugins: [
      react(),
      tailwindcss(),
      llmCompletionPlugin({
        baseURL:
          process.env.LITELLM_BASE_URL ||
          env.LITELLM_BASE_URL ||
          defaultLiteLLMBaseURL,
        apiKey: process.env.LITELLM_API_KEY || env.LITELLM_API_KEY,
        model: process.env.LITELLM_MODEL || env.LITELLM_MODEL,
        temperature:
          asTemperature(process.env.LITELLM_TEMPERATURE || env.LITELLM_TEMPERATURE) ??
          defaultLiteLLMTemperature,
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
