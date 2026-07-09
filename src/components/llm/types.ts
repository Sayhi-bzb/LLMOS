export type LlmRequestTrigger = "input" | "prompt_href"

export interface LlmTurnDebug {
  lastCompletionLength?: number
  finalCompletionLength?: number
  request?: {
    requestId: string
    threadId: string
    frameId: string
    trigger: LlmRequestTrigger
    promptLength: number
    actionPromptLength: number
    sourceContentLength: number
    systemPromptLength: number
    baseURL: string
    model: string
    temperature: number
    hasServerApiKey: boolean
    createdAt: number
  }
  stream?: {
    startedAt: number
    firstChunkAt?: number
    lastChunkAt?: number
    finishedAt?: number
    chunkCount: number
    lastDeltaLength: number
    totalLength: number
    outcome?: "complete" | "error" | "stopped"
    errorMessage?: string
  }
  interaction?: {
    href: string
    kind: "prompt"
    prompt: string
    triggeredRequest: boolean
    at: number
  }
  persistence?: {
    lastEventType?: SessionEvent["type"]
    lastPersistedLength?: number
    pendingLength?: number
    lastPersistedAt?: number
    lastPersistError?: string
  }
}

export interface LlmTurnFrame {
  id: string
  title: string
  prompt: string
  content: string
  rawFinalContent?: string
  sourceContent?: string
  actionPrompt?: string
  debug?: LlmTurnDebug
  createdAt: number
  status: "streaming" | "complete" | "error" | "stopped"
}

export interface LlmThreadSummary {
  id: string
  title: string
  frameCount: number
  createdAt: number
  updatedAt: number
}

export interface ServerLlmConfig {
  baseURL: string
  model: string
  temperature: number
  hasApiKey: boolean
}

export interface ServerSystemPrompt {
  systemPrompt: string
  resolvedSystemPrompt?: string
}

export interface ServerInitialScreen {
  initialScreen: string
}

export interface ServerSession {
  frames: LlmTurnFrame[]
}

export interface ServerThreads {
  threads: LlmThreadSummary[]
  activeThreadId?: string
}

export interface ServerThread {
  thread: LlmThreadSummary
  frames: LlmTurnFrame[]
}

export type SessionEvent =
  | { type: "frame_started"; frame: LlmTurnFrame }
  | { type: "frame_delta"; frameId: string; content: string; updatedAt: number }
  | {
      type: "frame_finished"
      frameId: string
      content: string
      rawFinalContent: string
      updatedAt: number
    }
  | {
      type: "frame_status"
      frameId: string
      status: "error" | "stopped"
      updatedAt: number
    }
  | { type: "session_reset"; updatedAt: number }

export interface LlmConfigDraft {
  baseURL: string
  apiKey: string
  model: string
  temperature: string
}
