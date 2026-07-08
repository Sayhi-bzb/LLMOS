import {
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu"

interface AsciiContextMenuProps {
  copyRawContentDisabled: boolean
  onCopyRawContent: () => void
}

export function AsciiContextMenu({
  copyRawContentDisabled,
  onCopyRawContent,
}: AsciiContextMenuProps) {
  return (
    <ContextMenuContent onPointerDownCapture={(event) => event.stopPropagation()}>
      <ContextMenuItem
        disabled={copyRawContentDisabled}
        onSelect={onCopyRawContent}
      >
        复制原始内容
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
