export interface ServerLlmConfig {
  baseURL: string
  model: string
  hasApiKey: boolean
}

export interface LlmConfigDraft {
  baseURL: string
  apiKey: string
  model: string
}
