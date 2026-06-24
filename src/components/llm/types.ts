export type LlmTurnFrameStatus = "streaming" | "complete" | "error" | "stopped"

export interface LlmTurnFrameDebug {
  lastCompletionLength?: number
  finalCompletionLength?: number
}

export interface LlmTurnFrame {
  id: string
  title: string
  prompt: string
  content: string
  rawFinalContent?: string
  debug?: LlmTurnFrameDebug
  createdAt: number
  status: LlmTurnFrameStatus
}

export interface ServerLlmConfig {
  baseURL: string
  model: string
  hasApiKey: boolean
}

export interface ServerSystemPrompt {
  systemPrompt: string
}

export interface LlmConfigDraft {
  baseURL: string
  apiKey: string
  model: string
}