export interface StableMarkdownContent {
  stable: string
  pending: string
}

export interface MarkdownStreamOptions {
  streaming?: boolean
}

const tailSearchLimit = 512
const trailingBackslashesPattern = /\\+$/
const protocolOpeners = ["[", "<", "*", "~"]

const hasOddTrailingBackslashes = (content: string, index: number) => {
  const before = content.slice(0, index)
  const match = before.match(trailingBackslashesPattern)

  return Boolean(match && match[0].length % 2 === 1)
}

const isEscaped = (content: string, index: number) =>
  index > 0 && hasOddTrailingBackslashes(content, index)

const findLastUnescaped = (content: string, value: string, fromIndex = content.length - 1) => {
  if (fromIndex < 0) {
    return -1
  }

  let index = content.lastIndexOf(value, fromIndex)

  while (index !== -1) {
    if (!isEscaped(content, index)) {
      return index
    }

    index = content.lastIndexOf(value, index - 1)
  }

  return -1
}

const splitAt = (content: string, index: number): StableMarkdownContent => ({
  stable: content.slice(0, index),
  pending: content.slice(index),
})

const looksLikeHtmlProtocol = (tail: string) =>
  /^<\/?(?:span|u)(?:\s|>|$)/i.test(tail)

const findIncompleteHtmlTagStart = (content: string) => {
  const searchStart = Math.max(0, content.length - tailSearchLimit)

  for (let index = content.length - 1; index >= searchStart; index -= 1) {
    if (content[index] !== "<" || isEscaped(content, index)) {
      continue
    }

    const tail = content.slice(index)

    if (!looksLikeHtmlProtocol(tail)) {
      continue
    }

    return tail.includes(">") ? -1 : index
  }

  return -1
}

const findMatchingLinkClose = (content: string, openIndex: number) => {
  for (let index = openIndex + 1; index < content.length; index += 1) {
    if (content[index] === "]" && !isEscaped(content, index)) {
      return index
    }
  }

  return -1
}

const findMatchingUrlClose = (content: string, openParenIndex: number) => {
  for (let index = openParenIndex + 1; index < content.length; index += 1) {
    if (content[index] === ")" && !isEscaped(content, index)) {
      return index
    }
  }

  return -1
}

const looksLikeMarkdownLinkTail = (tail: string) => {
  const closeBracket = tail.indexOf("]")

  if (closeBracket === -1) {
    return /^(?:[^\[\]\n]|<[^>\n]*)*$/.test(tail.slice(1))
  }

  return closeBracket === tail.length - 1 || tail.slice(closeBracket, closeBracket + 2) === "]("
}

const findIncompleteMarkdownLinkStart = (content: string) => {
  const searchStart = Math.max(0, content.length - tailSearchLimit)
  let openIndex = findLastUnescaped(content, "[")

  while (openIndex >= searchStart) {
    const tail = content.slice(openIndex)

    if (!looksLikeMarkdownLinkTail(tail)) {
      openIndex = findLastUnescaped(content, "[", openIndex - 1)
      continue
    }

    const closeBracket = findMatchingLinkClose(content, openIndex)

    if (closeBracket === -1 || closeBracket === content.length - 1) {
      return openIndex
    }

    if (content[closeBracket + 1] !== "(") {
      openIndex = findLastUnescaped(content, "[", openIndex - 1)
      continue
    }

    const closeParen = findMatchingUrlClose(content, closeBracket + 1)

    if (closeParen === -1) {
      return openIndex
    }

    openIndex = findLastUnescaped(content, "[", openIndex - 1)
  }

  return -1
}

type EmphasisDelimiter = {
  marker: "**" | "*" | "~~"
  index: number
}

const isWhitespace = (value: string | undefined) => !value || /\s/.test(value)
const isBoundary = (value: string | undefined) => !value || /[\s([{<>'"]/.test(value)
const isPunctuation = (value: string | undefined) => Boolean(value && /[.,!?;:}\])>]/.test(value))

const canOpenEmphasis = (content: string, index: number, marker: string) => {
  const previous = content[index - 1]
  const next = content[index + marker.length]

  return isBoundary(previous) && !isWhitespace(next) && !isPunctuation(next)
}

const canCloseEmphasis = (content: string, index: number, marker: string) => {
  const previous = content[index - 1]
  const next = content[index + marker.length]

  return !isWhitespace(previous) && (isBoundary(next) || isPunctuation(next))
}

const consumeEmphasisDelimiter = (
  stack: EmphasisDelimiter[],
  content: string,
  index: number,
  marker: EmphasisDelimiter["marker"],
) => {
  const openIndex = stack.findLastIndex((item) => item.marker === marker)

  if (openIndex !== -1 && canCloseEmphasis(content, index, marker)) {
    stack.splice(openIndex, 1)
    return
  }

  if (canOpenEmphasis(content, index, marker)) {
    stack.push({ marker, index })
  }
}

const findIncompleteEmphasisStart = (content: string) => {
  const searchStart = Math.max(0, content.length - tailSearchLimit)
  const stack: EmphasisDelimiter[] = []

  for (let index = searchStart; index < content.length; index += 1) {
    if (isEscaped(content, index)) {
      continue
    }

    if (content.startsWith("**", index)) {
      consumeEmphasisDelimiter(stack, content, index, "**")
      index += 1
      continue
    }

    if (content.startsWith("~~", index)) {
      consumeEmphasisDelimiter(stack, content, index, "~~")
      index += 1
      continue
    }

    if (content[index] === "*") {
      consumeEmphasisDelimiter(stack, content, index, "*")
    }
  }

  return stack.length > 0 ? stack[0].index : -1
}

const findUnclosedUnderlineStart = (content: string) => {
  const openIndex = content.lastIndexOf("<u>")
  const closeIndex = content.lastIndexOf("</u>")

  return openIndex > closeIndex ? openIndex : -1
}

const findFirstPendingStart = (content: string) => {
  const starts = [
    findIncompleteHtmlTagStart(content),
    findIncompleteMarkdownLinkStart(content),
    findIncompleteEmphasisStart(content),
    findUnclosedUnderlineStart(content),
  ].filter((index) => index !== -1)

  return starts.length > 0 ? Math.min(...starts) : -1
}

export const stabilizeMarkdownStream = (
  content: string,
  options: MarkdownStreamOptions = {},
): StableMarkdownContent => {
  if (!options.streaming || !protocolOpeners.some((opener) => content.includes(opener))) {
    return { stable: content, pending: "" }
  }

  const pendingStart = findFirstPendingStart(content)

  if (pendingStart === -1) {
    return { stable: content, pending: "" }
  }

  return splitAt(content, pendingStart)
}

