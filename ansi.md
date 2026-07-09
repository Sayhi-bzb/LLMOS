# ANSI AI-Native Guide

This guide shapes LLMOS screen generation.

It is not an ANSI tutorial. It is a compact output terrain for an AI model.

## Hard Protocol

Output only the current screen keyframe.

Use ANSI without ESC prefix:

```txt
[37;44mtext[0m
```

Clickable actions use OSC8:

```txt
]8;;prompt://操作意图\显示文本]8;;\
```

Every screen includes at least one `prompt://` action.

External links also use OSC8:

```txt
]8;;https://example.com/logs\查看日志]8;;\
```

## Canonical Screens

These samples define the preferred generation terrain. Reuse their structure, not their literal content.

### Frame

```txt
[37;44m
  LLMOS

  状态：准备就绪
  任务：等待用户操作

  ]8;;prompt://查看系统状态\[7m 系统状态 [27m]8;;\  ]8;;prompt://进入终端\[7m 终端 [27m]8;;\

  [90m提示：选择一个操作继续。[39m
[0m
```

### GUI

```txt
[30;47m󰀵 ]8;;prompt://打开 Finder 菜单\Finder]8;;\  ]8;;prompt://打开 File 菜单\File]8;;\  ]8;;prompt://打开 Edit 菜单\Edit]8;;\       󰁹 100%  11:45 AM[0m

     [30;47m [31m●[30m [33m●[30m [32m●[30m                  [1mFinder[22m                     [0m
     [30;47m                                                   [0m
     [30;47m  󰉋 Favorites       Name       Size    Kind        [0m
     [30;47m  󰋜 ]8;;prompt://打开桌面\[7m Desktop [27m]8;;\       ]8;;prompt://打开 Notes.txt\Notes.txt]8;;\  2 KB    Text        [0m
```

### Media

```txt
[92m󰓇[39m Spotify Premium               󰒔 Desktop-PC

            [33m󰝚 [1mBlinding Lights[22;39m
        The Weeknd — After Hours

  01:45 [92m━━━━━━━━━━━━━━━━━━━━━━━[90m━━━━━━[39m 03:22

            ]8;;prompt://切换随机播放\󰒝]8;;\   ]8;;prompt://上一首\󰒮]8;;\   ]8;;prompt://暂停播放\󰐊]8;;\   ]8;;prompt://下一首\󰒭]8;;\
```

### Editor

```txt
[40;37m 󰙴 EXPLORER   ]8;;prompt://切换Tab\[7m main.py ● [27m]8;;\ ]8;;prompt://打开 settings.json\[90m settings.json[37m]8;;\
[37m 󰙴 ]8;;prompt://折叠项目\PROJECT]8;;\        [90m 1 [35mimport[37m sys
 [90m]8;;prompt://选中 main.py\󰈚 main.py]8;;\[37m        [90m 2 [35mfrom[37m time [35mimport[37m sleep
                  [90m 3 [35mdef[37m [36manimate[37m():
[44;37m 󰘬 main*  ]8;;prompt://同步代码\󰚰]8;;\ 󰅚 0 󰘦 12                       Ln 3, Col 12  UTF-8 [0m
```

## Generation Invariants

Protocol boundaries are explicit. Generation strategy is implicit in the samples.

Use ANSI as a stateful interface, not as inline decoration.

```txt
区域声明 -> 内容布局 -> 局部覆盖 -> 局部关闭 -> 区域结束
```

Keep these invariants:

```txt
Declare region style before local style.
Close local style before closing OSC8.
Return local style to the parent state.
Use [0m only at region or frame boundaries.
Allow short state flow inside syntax/highlight runs.
Do not leak style across lines, list items, links, status bars, or case boundaries.
Prefer 16-color ANSI for routine UI.
Use truecolor only for special assets.
```

OSC8 nesting is stack-like:

```txt
]8;;prompt://切换Tab\[7m main.py ● [27m]8;;\
```

Parent-state return:

```txt
[40;37m [90m灰字[37m 正文 [0m
[30;47m [31m●[30m Finder [0m
```

Scope follows visual boundaries:

```txt
Frame/panel: one region scope.
Indented GUI/window/dock: line scope is acceptable.
Code highlight: short state flow is acceptable.
```

## Style Vocabulary

Use a small stable vocabulary. These are semantic habits, not a syntax inventory.

```txt
[7m...[27m      selected / button
[90m...[39m     muted
[31m...[39m     danger
[33m...[39m     pending
[32m...[39m     active
[1m...[22m      title
[30;47m         light GUI surface
[40;37m         dark editor/terminal surface
[44;37m         status bar
```

When a parent foreground is explicit, return to that parent color instead of terminal default:

```txt
[40;37m [90mmeta[37m text [0m
[30;47m [32m●[30m title [0m
```

## Audit

Before a case enters prompt context, check:

```txt
At least one prompt:// action.
No ESC prefix.
No Markdown/HTML/span protocol.
No orphan OSC8 close.
OSC8 opens and closes.
ANSI style closes before OSC8 closes.
Local style returns to parent state.
[0m does not break a parent region.
No foreground leakage across structural boundaries.
Truecolor is rare and intentional.
The case adds a distinct screen terrain.
```

High-quality cases shape generation. Bad cases are worse than missing rules: the model copies writing habits, not just visuals.
