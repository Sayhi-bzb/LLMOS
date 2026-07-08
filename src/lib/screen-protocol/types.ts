export type ScreenProtocolId = "markdown" | "ansi"

export interface ScreenParseOptions {
  streaming?: boolean
  protocol?: ScreenProtocolId
}

export interface StableScreenContent {
  stable: string
  pending: string
}

export interface ScreenStyle {
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  blink?: boolean
  reverse?: boolean
  hidden?: boolean
  foreground?: string
  background?: string
  href?: string
}

export interface ScreenRun {
  text: string
  style: ScreenStyle
}

export type ScreenLine = ScreenRun[]

export interface ScreenProtocol {
  id: ScreenProtocolId
  detect: (content: string) => boolean
  stabilize: (content: string, options?: ScreenParseOptions) => StableScreenContent
  parse: (content: string, options?: ScreenParseOptions) => ScreenLine[]
}
