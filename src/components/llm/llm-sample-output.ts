const urlLabel =
  "\u001b]8;;https://github.com/IonicaBizau/anser\u001b\\OSC 8 URL label\u001b]8;;\u001b\\"

const entityLabel = "\u001b]8;;@e1\u001b\\[实体 e1]\u001b]8;;\u001b\\"
const checksumLabel = "\u001b]8;;SHA256\u001b\\[校验成功]\u001b]8;;\u001b\\"

export const sampleOutput = [
  "\u001b[1;38;2;37;99;235mANSI / OSC label surface\u001b[0m",
  "",
  "\u001b[31mcolor: basic red\u001b[0m  \u001b[38;5;39mcolor: 256 palette blue\u001b[0m",
  "\u001b[38;2;37;99;235mforeground truecolor / 当前选中项\u001b[0m",
  "\u001b[48;2;248;250;252m\u001b[38;2;15;23;42m background truecolor with foreground text \u001b[0m",
  "",
  "\u001b[1mbold text\u001b[0m  \u001b[3mitalic text\u001b[0m  \u001b[9mdelete / strikethrough\u001b[0m  \u001b[4munderline\u001b[0m",
  "",
  `label:url     ${urlLabel}`,
  `label:entity  ${entityLabel}`,
  `label:hash    ${checksumLabel}`,
  "",
  "\u001b[38;2;100;116;139m──────────────────────────────────────── 分割线 / 次要文字 / 边框\u001b[0m",
  "\u001b[1;38;2;255;255;255;48;2;37;99;235m 主要按钮 \u001b[0m  \u001b[1;38;2;255;255;255;48;2;236;72;153m 高亮标签 \u001b[0m",
  "",
  "\u001b[3;38;2;148;163;184mSend a prompt to replace this sample with the current LLM turn.\u001b[0m",
].join("\n")

export const pendingOutput = "\u001b[38;2;100;116;139mWaiting for the first token...\u001b[0m"
