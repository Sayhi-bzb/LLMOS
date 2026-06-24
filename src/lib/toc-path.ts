export type TocLinkMetrics = {
  x: number
  top: number
  bottom: number
}

const baseOffset = 6
const depthOffset = 12

export function getDepthOffset(depth: number) {
  return baseOffset + Math.max(0, depth - 2) * depthOffset
}

export function getDepthPadding(depth: number) {
  return `${getDepthOffset(depth) + 18}px`
}

export function measureLinkMetrics(anchor: HTMLAnchorElement) {
  return {
    top: anchor.offsetTop,
    bottom: anchor.offsetTop + anchor.offsetHeight,
  }
}

export function buildTocPath(metrics: TocLinkMetrics[]) {
  if (metrics.length === 0) {
    return ""
  }

  const [first, ...rest] = metrics
  let path = `M ${first.x} ${(first.top + first.bottom) / 2}`
  let previous = first

  for (const metric of rest) {
    const previousY = (previous.top + previous.bottom) / 2
    const y = (metric.top + metric.bottom) / 2
    const controlY = previousY + (y - previousY) / 2

    path += ` C ${previous.x} ${controlY}, ${metric.x} ${controlY}, ${metric.x} ${y}`
    previous = metric
  }

  return path
}
