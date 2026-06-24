export const sampleOutput = [
  "**<span fg-foreground>LLMOS 系统启动程序</span>**",
  "",
  "<span bg-surface>系统核心加载中...</span>",
  "<span bg-surface>版本: LLMOS v1.0.2026-STABLE</span>",
  "<span bg-surface>状态: 准备就绪</span>",
  "",
  "[<span fg-on-accent bg-accent> 启动图形界面 </span>](prompt://启动图形界面) [<span fg-on-muted bg-muted> 查看系统日志 </span>](prompt://查看系统日志) [<span fg-on-danger bg-danger> 进入救援模式 </span>](prompt://进入救援模式并列出可用操作)",
].join("\n")

export const pendingOutput = "\u001b[38;2;100;116;139mWaiting for the first token...\u001b[0m"
