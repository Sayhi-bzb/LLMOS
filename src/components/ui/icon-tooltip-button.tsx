import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type IconTooltipButtonProps = Omit<React.ComponentProps<typeof Button>, "size"> & {
  tooltip: string
  children: ReactNode
}

export function IconTooltipButton({
  tooltip,
  children,
  className,
  ...props
}: IconTooltipButtonProps) {
  return (
    <span className="group relative inline-flex">
      <Button
        aria-label={props["aria-label"] ?? tooltip}
        className={className}
        size="icon"
        {...props}
      >
        {children}
      </Button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute right-full top-1/2 z-50 mr-2 -translate-y-1/2 whitespace-nowrap border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-sm transition-opacity",
          "group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        {tooltip}
      </span>
    </span>
  )
}

