import { useEffect, useState, type RefObject } from "react"

import type { TextMetrics, ViewportMetrics } from "@/components/ascii-canvas/types"

export const defaultMetrics: TextMetrics = {
  charWidth: 8,
  lineHeight: 18,
}

export const defaultViewportMetrics: ViewportMetrics = {
  width: 0,
  height: 0,
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 16,
  paddingBottom: 16,
}

export function useCanvasMetrics(
  measureRef: RefObject<HTMLSpanElement | null>,
  viewportRef: RefObject<HTMLDivElement | null>,
) {
  const [metrics, setMetrics] = useState<TextMetrics>(defaultMetrics)
  const [viewportMetrics, setViewportMetrics] = useState<ViewportMetrics>(
    defaultViewportMetrics,
  )

  useEffect(() => {
    const measure = () => {
      const element = measureRef.current

      if (!element) {
        return
      }

      const rect = element.getBoundingClientRect()
      setMetrics({
        charWidth: rect.width / 10 || defaultMetrics.charWidth,
        lineHeight: rect.height || defaultMetrics.lineHeight,
      })
    }

    measure()
    const resizeObserver = new ResizeObserver(measure)

    if (measureRef.current) {
      resizeObserver.observe(measureRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [measureRef])

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    const measure = () => setViewportMetrics(measureViewport(viewport))

    measure()
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(viewport)

    return () => resizeObserver.disconnect()
  }, [viewportRef])

  return { metrics, viewportMetrics }
}

function measureViewport(viewport: HTMLDivElement): ViewportMetrics {
  const style = window.getComputedStyle(viewport)

  return {
    width: viewport.clientWidth,
    height: viewport.clientHeight,
    paddingLeft: parsePixelValue(style.paddingLeft),
    paddingRight: parsePixelValue(style.paddingRight),
    paddingTop: parsePixelValue(style.paddingTop),
    paddingBottom: parsePixelValue(style.paddingBottom),
  }
}

function parsePixelValue(value: string) {
  return Number.parseFloat(value) || 0
}
