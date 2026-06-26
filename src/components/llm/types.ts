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
  hasApiKey: boolean
}

export interface ServerSystemPrompt {
  systemPrompt: string
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
}
