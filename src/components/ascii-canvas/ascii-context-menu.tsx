import type { ContextMenuState } from "@/components/ascii-canvas/types"

interface AsciiContextMenuProps {
  contextMenu: ContextMenuState
  copySourceTextDisabled: boolean
  onCopySourceText: () => void
}

export function AsciiContextMenu({
  contextMenu,
  copySourceTextDisabled,
  onCopySourceText,
}: AsciiContextMenuProps) {
  return (
    <div
      className="fixed z-50 min-w-40 rounded-md border border-slate-200 bg-white p-1 text-sm text-slate-950 shadow-lg"
      onPointerDownCapture={(event) => event.stopPropagation()}
      role="menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button
        className="flex w-full items-center rounded px-2.5 py-1.5 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
        disabled={copySourceTextDisabled}
        onClick={onCopySourceText}
        role="menuitem"
        type="button"
      >
        复制源文本
      </button>
    </div>
  )
}
