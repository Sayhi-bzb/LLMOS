import { AsciiCanvas } from "@/components/ascii-canvas"

const oscLink =
  "\u001b]8;;https://github.com/IonicaBizau/anser\u001b\\OSC 8 href link\u001b]8;;\u001b\\"

const oscTooltip = "\u001b]8;;SHA256\u001b\\[校验成功]\u001b]8;;\u001b\\"

const sampleOutput = [
  "\u001b[1;38;2;37;99;235mANSI / OSC style surface\u001b[0m",
  "",
  "\u001b[31mcolor: basic red\u001b[0m  \u001b[38;5;39mcolor: 256 palette blue\u001b[0m",
  "\u001b[38;2;37;99;235mforeground truecolor / 当前选中项\u001b[0m",
  "\u001b[48;2;248;250;252m\u001b[38;2;15;23;42m background truecolor with foreground text \u001b[0m",
  "",
  "\u001b[1mbold text\u001b[0m  \u001b[3mitalic text\u001b[0m  \u001b[9mdelete / strikethrough\u001b[0m  \u001b[4munderline\u001b[0m",
  "",
  `href: ${oscLink}`,
  `tooltip metadata: ${oscTooltip}`,
  "",
  "\u001b[38;2;100;116;139m──────────────────────────────────────── 分割线 / 次要文字 / 边框\u001b[0m",
  "\u001b[1;38;2;255;255;255;48;2;37;99;235m 主要按钮 \u001b[0m  \u001b[1;38;2;255;255;255;48;2;236;72;153m 高亮标签 \u001b[0m",
  "",
  "\u001b[3;38;2;148;163;184mDrag to select. Hold Alt/Option before dragging for block selection.\u001b[0m",
].join("\n")

export function App() {
  return (
    <main className="min-h-svh bg-background p-6 text-foreground">
      <section className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-normal">
            ANSI ASCII Canvas
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            SGR styles and OSC 8 links are parsed into styled cells on a
            selectable monospace grid.
          </p>
        </div>

        <AsciiCanvas content={sampleOutput} className="h-[420px]" />
      </section>
    </main>
  )
}

export default App
