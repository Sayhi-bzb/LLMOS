import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const tmpDir = join(root, "node_modules", ".tmp", "box-repair-check")
const sourceDir = join(root, "src", "lib")
const outDir = join(tmpDir, "dist")

rmSync(tmpDir, { force: true, recursive: true })
mkdirSync(tmpDir, { recursive: true })

const copySource = (fileName) => {
  const source = readFileSync(join(sourceDir, fileName), "utf8")
    .replaceAll("@/lib/canvas-text", "./canvas-text.js")
  writeFileSync(join(tmpDir, fileName), source)
}

copySource("canvas-text.ts")
copySource("box-repair.ts")

execFileSync(
  process.execPath,
  [
    join(root, "node_modules", "typescript", "bin", "tsc"),
    "box-repair.ts",
    "canvas-text.ts",
    "--ignoreConfig",
    "--target",
    "ES2023",
    "--module",
    "ES2022",
    "--moduleResolution",
    "bundler",
    "--outDir",
    outDir,
    "--skipLibCheck",
    "--strict",
  ],
  { cwd: tmpDir, stdio: "inherit" },
)

const { repairBoxDrawingLines } = await import(pathToFileURL(join(outDir, "box-repair.js")))

const plainStyle = { decorations: [] }
const styledTextStyle = { foreground: "rgb(1, 2, 3)", decorations: [] }
const linkStyle = { label: "prompt://open", decorations: [] }

const textToLine = (text, style = plainStyle) => [{ text, style, sourceText: text }]
const linesFromText = (text) => text.split("\n").map((line) => textToLine(line))
const textFromLines = (lines) => lines.map((line) => line.map((run) => run.text).join("")).join("\n")

const runCase = ({ name, input, expected, maxWidth = 80, lines = linesFromText(input), assert }) => {
  const repaired = repairBoxDrawingLines(lines, maxWidth)
  const actual = textFromLines(repaired)

  if (actual !== expected) {
    console.error(`\n[FAIL] ${name}`)
    console.error("input:\n" + input)
    console.error("expected:\n" + expected)
    console.error("actual:\n" + actual)
    process.exitCode = 1
    return
  }

  if (assert) {
    const failure = assert(repaired)
    if (failure) {
      console.error(`\n[FAIL] ${name}`)
      console.error(failure)
      process.exitCode = 1
      return
    }
  }

  console.log(`[PASS] ${name}`)
}

const cases = [
  {
    name: "expands top and bottom when content is wider",
    input: ["┌────┐", "│ ready │", "└────┘"].join("\n"),
    expected: ["┌───────┐", "│ ready │", "└───────┘"].join("\n"),
  },
  {
    name: "adds missing right border",
    input: ["┌──────┐", "│ ready", "└──────┘"].join("\n"),
    expected: ["┌──────┐", "│ ready│", "└──────┘"].join("\n"),
  },
  {
    name: "adds missing left border",
    input: ["┌──────┐", "ready │", "└──────┘"].join("\n"),
    expected: ["┌──────┐", "│ready │", "└──────┘"].join("\n"),
  },
  {
    name: "aligns uneven empty middle rows",
    input: ["┌──────┐", "│ ready │", "│     │", "│      │", "└──────┘"].join("\n"),
    expected: ["┌───────┐", "│ ready │", "│       │", "│       │", "└───────┘"].join("\n"),
  },
  {
    name: "uses display width for CJK content",
    input: ["┌──────┐", "│ 状态正常 │", "└──────┘"].join("\n"),
    expected: ["┌──────────┐", "│ 状态正常 │", "└──────────┘"].join("\n"),
  },
  {
    name: "uses display width for emoji content",
    input: ["┌──────┐", "│ ✔ Ready │", "└──────┘"].join("\n"),
    expected: ["┌─────────┐", "│ ✔ Ready │", "└─────────┘"].join("\n"),
  },
  {
    name: "extends separator lines",
    input: ["┌──────┐", "│ A    │", "├───┤", "│ B    │", "└──────┘"].join("\n"),
    expected: ["┌──────┐", "│ A    │", "├──────┤", "│ B    │", "└──────┘"].join("\n"),
  },
  {
    name: "does not modify ascii art",
    input: [" /\\_/\\", "( o.o )", " > ^ <"].join("\n"),
    expected: [" /\\_/\\", "( o.o )", " > ^ <"].join("\n"),
  },
  {
    name: "does not modify single line separator text",
    input: "状态 │ ready",
    expected: "状态 │ ready",
  },
  {
    name: "does not modify markdown tables",
    input: ["| name | status |", "|------|--------|", "| api  | ready  |"].join("\n"),
    expected: ["| name | status |", "|------|--------|", "| api  | ready  |"].join("\n"),
  },
  {
    name: "preserves content styles and links",
    input: ["┌──────┐", "│ go", "└──────┘"].join("\n"),
    expected: ["┌──────┐", "│ go   │", "└──────┘"].join("\n"),
    lines: [
      textToLine("┌──────┐"),
      [
        { text: "│ ", style: plainStyle, sourceText: "│ " },
        { text: "go", style: linkStyle, sourceText: "go" },
      ],
      textToLine("└──────┘"),
    ],
    assert: (repaired) => {
      const middle = repaired[1]
      const linkRuns = middle.filter((run) => run.text === "g" || run.text === "o")
      if (linkRuns.length !== 2 || linkRuns.some((run) => run.style.label !== "prompt://open")) {
        return "expected link style to be preserved on content characters"
      }
    },
  },
]

cases.forEach(runCase)

if (process.exitCode) {
  process.exit(process.exitCode)
}

