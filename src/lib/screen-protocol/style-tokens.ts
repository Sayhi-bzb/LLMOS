const foregroundColorMap: Record<string, string> = {
  default: "#0F172A",
  foreground: "#0F172A",
  primary: "#2563EB",
  secondary: "#334155",
  muted: "#64748B",
  accent: "#2563EB",
  danger: "#DC2626",
  success: "#16A34A",
  warning: "#A16207",
  surface: "#0F172A",
}

const backgroundColorMap: Record<string, string> = {
  background: "#FFFFFF",
  surface: "#F8FAFC",
  primary: "#2563EB",
  secondary: "#E2E8F0",
  muted: "#F1F5F9",
  accent: "#2563EB",
  danger: "#DC2626",
  success: "#16A34A",
  warning: "#FACC15",
}

const onBackgroundColorMap: Record<string, string> = {
  background: "#0F172A",
  surface: "#0F172A",
  primary: "#FFFFFF",
  secondary: "#0F172A",
  muted: "#0F172A",
  accent: "#FFFFFF",
  danger: "#FFFFFF",
  success: "#FFFFFF",
  warning: "#0F172A",
}

const legacyForegroundColorMap: Record<string, string> = {
  "primary-fg": onBackgroundColorMap.primary,
  "secondary-fg": onBackgroundColorMap.secondary,
  "muted-fg": onBackgroundColorMap.muted,
  "accent-fg": onBackgroundColorMap.accent,
  "danger-fg": onBackgroundColorMap.danger,
  "success-fg": onBackgroundColorMap.success,
  "warning-fg": onBackgroundColorMap.warning,
  "surface-fg": onBackgroundColorMap.surface,
}

export const getSemanticColor = (channel: string, token: string) => {
  const normalizedChannel = channel.toLowerCase()

  if (normalizedChannel === "fg") {
    if (token.startsWith("on-")) {
      return onBackgroundColorMap[token.slice(3)]
    }

    return foregroundColorMap[token] ?? legacyForegroundColorMap[token]
  }

  return backgroundColorMap[token]
}
