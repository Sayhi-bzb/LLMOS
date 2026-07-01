import { Plus, Rows3 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { LlmThreadSummary } from "@/components/llm/types"
import { cn } from "@/lib/utils"

interface ThreadSwitcherProps {
  threads: LlmThreadSummary[]
  activeThreadId: string | null
  isLoading: boolean
  onSelectThread: (threadId: string) => void
  onNewThread: () => void
  variant: "desktop" | "mobile"
  className?: string
}

export function ThreadSwitcher({
  threads,
  activeThreadId,
  isLoading,
  onSelectThread,
  onNewThread,
  variant,
  className,
}: ThreadSwitcherProps) {
  const label = isLoading ? "Running" : "Threads"

  if (variant === "mobile") {
    return (
      <div className={cn("flex items-center gap-2 lg:hidden", className)}>
        <Button
          type="button"
          variant="secondary"
          className="h-9 shrink-0"
          onClick={onNewThread}
        >
          <Plus className="size-4" aria-hidden="true" />
          New
        </Button>
        <ScrollArea className="min-w-0 flex-1">
          <div className="flex min-w-max items-center gap-2 pr-1">
            {threads.map((thread) => (
              <ThreadButton
                key={thread.id}
                thread={thread}
                active={thread.id === activeThreadId}
                onClick={() => onSelectThread(thread.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className={cn("hidden xl:block", className)}>
      <div className="mb-3 flex items-center justify-between gap-2 font-mono text-[0.6875rem] leading-4 tracking-wide text-muted-foreground uppercase">
        <span className="inline-flex items-center gap-2">
          <Rows3 className="size-3.5" aria-hidden="true" />
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="New thread"
          onClick={onNewThread}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      <ScrollArea className="max-h-[min(14rem,32svh)] pr-2">
        <div className="flex flex-col gap-1">
          {threads.length ? (
            threads.map((thread) => (
              <ThreadButton
                key={thread.id}
                thread={thread}
                active={thread.id === activeThreadId}
                onClick={() => onSelectThread(thread.id)}
              />
            ))
          ) : (
            <p className="px-2 py-1 text-xs leading-5 text-muted-foreground/70">
              No threads yet
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

interface ThreadButtonProps {
  thread: LlmThreadSummary
  active: boolean
  onClick: () => void
}

function ThreadButton({ thread, active, onClick }: ThreadButtonProps) {
  return (
    <button
      type="button"
      data-active={active}
      className={cn(
        "group min-w-36 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted/60"
      )}
      onClick={onClick}
    >
      <span className="block truncate text-xs font-medium leading-5">
        {thread.title}
      </span>
      <span
        className={cn(
          "block text-[0.6875rem] leading-4",
          active ? "text-background/70" : "text-muted-foreground/60"
        )}
      >
        {thread.frameCount} turns
      </span>
    </button>
  )
}
