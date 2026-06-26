export interface LlmTurnFrame {
  id: string
  title: string
  prompt: string
  content: string
  rawFinalContent?: string
  sourceContent?: string
  actionPrompt?: string
  debug?: {
    lastCompletionLength?: number
    finalCompletionLength?: number
  }
  createdAt: number
  status: "streaming" | "complete" | "error" | "stopped"
}

export interface ServerLlmConfig {
  baseURL: string
  model: string
  hasApiKey: boolean
}

export interface ServerSystemPrompt {
  systemPrompt: string
}

export interface ServerInitialScreen {
  initialScreen: string
}

export interface LlmConfigDraft {
  baseURL: string
  apiKey: string
  model: string
}

