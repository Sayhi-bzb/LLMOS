export type CanvasHref =
  | { kind: "prompt"; href: string; prompt: string }
  | { kind: "external"; href: string }
  | { kind: "unknown"; href: string }

const promptHrefPrefix = "prompt://"

const externalHrefPattern = /^(https?:|mailto:|tel:)/i
const promptMarkdownLinkPattern = /\]\((prompt:\/\/[^)\r\n]+)\)/g

const isPromptHref = (href: string) => href.startsWith(promptHrefPrefix)

const isExternalHref = (href: string) => externalHrefPattern.test(href)

export const isCanvasLinkHref = (href: string) => isPromptHref(href) || isExternalHref(href)

export const parseCanvasHref = (href: string): CanvasHref => {
  if (isPromptHref(href)) {
    const rawPrompt = href.slice(promptHrefPrefix.length)

    try {
      return {
        kind: "prompt",
        href,
        prompt: decodeURIComponent(rawPrompt).trim(),
      }
    } catch {
      return {
        kind: "prompt",
        href,
        prompt: rawPrompt.trim(),
      }
    }
  }

  if (isExternalHref(href)) {
    return { kind: "external", href }
  }

  return { kind: "unknown", href }
}

export const isMarkdownAllowedHref = (
  href: string,
  fallbackValidate: (href: string) => boolean,
) => isPromptHref(href) || fallbackValidate(href)

const encodePromptHref = (href: string) => {
  const prompt = href.slice(promptHrefPrefix.length)

  try {
    return `${promptHrefPrefix}${encodeURIComponent(decodeURIComponent(prompt))}`
  } catch {
    return `${promptHrefPrefix}${encodeURIComponent(prompt)}`
  }
}

export const normalizeMarkdownPromptLinks = (content: string) =>
  content.replace(promptMarkdownLinkPattern, (_match, href: string) =>
    `](${encodePromptHref(href)})`,
  )

