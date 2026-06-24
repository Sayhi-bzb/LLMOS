import fs from "node:fs/promises"
import path from "path"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import tailwindcss from "@tailwindcss/vite"
import { streamText } from "ai"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"

const completionApiPath = "/api/completion"
const llmConfigApiPath = "/api/llm-config"
const systemPromptApiPath = "/api/system-prompt"
const initialScreenApiPath = "/api/initial-screen"
const defaultLiteLLMBaseURL = "http://localhost:4000/v1"
const managedEnvKeys = ["LITELLM_BASE_URL", "LITELLM_API_KEY", "LITELLM_MODEL"] as const

interface CompletionRequestBody {
  prompt?: unknown
  systemPrompt?: unknown
}

interface LlmConfigRequestBody {
  baseURL?: unknown
  apiKey?: unknown
  model?: unknown
}

interface SystemPromptRequestBody {
  systemPrompt?: unknown
}

interface LiteLLMServerConfig {
  baseURL: string
  apiKey?: string
  model?: string
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
  const initialScreenPath = path.resolve(process.cwd(), "prompts/initial-screen.md")

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

      if (!model) {
        sendJson(res, 400, { error: "Model is required." })
        return
      }

      const envUpdates: Partial<Record<(typeof managedEnvKeys)[number], string>> = {
        LITELLM_BASE_URL: baseURL,
        LITELLM_MODEL: model,
      }

      runtimeConfig.baseURL = baseURL
      runtimeConfig.model = model

      if (apiKey) {
        envUpdates.LITELLM_API_KEY = apiKey
        runtimeConfig.apiKey = apiKey
      }

      await upsertEnvLocal(envLocalPath, envUpdates)
      sendJson(res, 200, {
        baseURL: runtimeConfig.baseURL,
        model: runtimeConfig.model,
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
        const systemPrompt = await fs.readFile(systemPromptPath, "utf8")
        sendJson(res, 200, { systemPrompt })
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          sendJson(res, 200, { systemPrompt: "" })
          return
        }

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
      sendJson(res, 200, { systemPrompt })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      sendJson(res, 500, { error: message })
    }
  }
  return {
    name: "llm-completion-api",
    configureServer(server) {
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
    },
    configurePreviewServer(server) {
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
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})

