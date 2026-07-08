export type AnsiColorChannel = "foreground" | "background"

const classicVgaAnsi16: Record<string, string> = {
  "ansi-black": "rgb(0, 0, 0)",
  "ansi-red": "rgb(170, 0, 0)",
  "ansi-green": "rgb(0, 170, 0)",
  "ansi-yellow": "rgb(170, 85, 0)",
  "ansi-blue": "rgb(0, 0, 170)",
  "ansi-magenta": "rgb(170, 0, 170)",
  "ansi-cyan": "rgb(0, 170, 170)",
  "ansi-white": "rgb(255, 255, 255)",
  "ansi-bright-black": "rgb(85, 85, 85)",
  "ansi-bright-red": "rgb(255, 85, 85)",
  "ansi-bright-green": "rgb(85, 255, 85)",
  "ansi-bright-yellow": "rgb(255, 255, 85)",
  "ansi-bright-blue": "rgb(85, 85, 255)",
  "ansi-bright-magenta": "rgb(255, 85, 255)",
  "ansi-bright-cyan": "rgb(85, 255, 255)",
  "ansi-bright-white": "rgb(255, 255, 255)",
}

const xtermColorLevels = [0, 95, 135, 175, 215, 255]

const rgb = (red: number, green: number, blue: number) =>
  `rgb(${red}, ${green}, ${blue})`

const xterm256Color = (index: number) => {
  if (index < 16) {
    return undefined
  }

  if (index <= 231) {
    const colorIndex = index - 16
    const red = xtermColorLevels[Math.floor(colorIndex / 36)]
    const green = xtermColorLevels[Math.floor((colorIndex % 36) / 6)]
    const blue = xtermColorLevels[colorIndex % 6]

    return rgb(red, green, blue)
  }

  if (index <= 255) {
    const level = 8 + (index - 232) * 10

    return rgb(level, level, level)
  }

  return undefined
}

const truecolor = (value: string | null | undefined) =>
  value ? `rgb(${value})` : undefined

const paletteColor = (value: string | null | undefined) => {
  if (!value) {
    return undefined
  }

  const ansi16Color = classicVgaAnsi16[value]

  if (ansi16Color) {
    return ansi16Color
  }

  const paletteMatch = /^ansi-palette-(\d+)$/.exec(value)

  if (!paletteMatch) {
    return undefined
  }

  return xterm256Color(Number.parseInt(paletteMatch[1], 10))
}

export const resolveAnsiColor = (
  paletteValue: string | null | undefined,
  truecolorValue: string | null | undefined,
) => truecolor(truecolorValue) ?? paletteColor(paletteValue)
