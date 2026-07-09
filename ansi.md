# ANSI AI-Native Guide

这不是 ANSI 标准手册。  
这是给 LLMOS screen 生成使用的 ANSI 输出准则。

目标：让模型稳定生成当前 turn 的 screen keyframe，而不是展示 ANSI 知识。

## Hard Protocol

只输出当前 screen。不要解释语法，不要输出聊天流。

使用无 ESC 前缀 ANSI：

```txt
[37;44mtext[0m
```

不要输出：

```txt
\x1b[37;44mtext\x1b[0m
```

可点击操作使用 OSC8：

```txt
]8;;prompt://操作意图\显示文本]8;;\
```

每帧至少提供一个 `prompt://` 操作。

外部链接同样使用 OSC8：

```txt
]8;;https://example.com/logs\查看日志]8;;\
```

## Generation Principle

协议边界可以显式，生成策略尽量隐式。

不要把 ANSI 当成逐词内联样式。  
把 screen 当成有继承状态的界面。

```txt
区域声明 -> 内容布局 -> 局部覆盖 -> 局部关闭 -> 区域结束
```

好的输出让模型学习结构，不让模型学习炫技。

## State Discipline

ANSI 是状态机。谁打开，谁关闭。

优先：

```txt
[37;44m
  LLMOS

  状态：准备就绪
  ]8;;prompt://查看状态\[7m 查看状态 [27m]8;;\

  [90m最近检查：42ms 前[39m
[0m
```

避免：

```txt
[37;44mLLMOS[0m
[37;44m状态：准备就绪[0m
]8;;prompt://查看状态\[37;44m查看状态[0m]8;;\
```

`[0m` 是全量 reset，只适合区域结束或整帧结束。  
局部效果用局部关闭：

```txt
[7m按钮[27m
[1m标题[22m
[31m错误[39m
[44m蓝底[49m
```

局部关闭的目标是回到父级状态，不是盲目回默认。

无父级前景色：

```txt
[92m图标[39m
```

父级黑底白字：

```txt
[40;37m [90m灰字[37m 正文 [0m
```

父级白底黑字：

```txt
[30;47m [31m●[30m Finder [0m
```

`[39m` 回到终端默认前景，不一定等于父级前景。父级颜色明确时，显式回父级色。

## OSC8 Nesting

OSC8 与 ANSI 按栈顺序嵌套：

```txt
链接打开 -> 样式打开 -> 文本 -> 样式关闭 -> 链接关闭
```

推荐：

```txt
]8;;prompt://切换Tab\[7m main.py ● [27m]8;;\
```

避免：

```txt
]8;;prompt://切换Tab\[7m main.py ● ]8;;\[27m
```

链接边界和样式边界不要错位。

## Scope Patterns

区域作用域适合整屏 terminal、BIOS、系统面板：

```txt
[37;44m
  AMIBIOS EASY SETUP UTILITY

  Main     ]8;;prompt://打开 Advanced 设置\[7m Advanced [27m]8;;\    Boot    Exit

  ]8;;prompt://打开 CPU Configuration\[7m > CPU Configuration [27m]8;;\
[0m
```

行级作用域适合缩进窗口、dock、局部 GUI 面板：

```txt
     [30;47m [31m●[30m [33m●[30m [32m●[30m                  [1mFinder[22m                     [0m
     [30;47m                                                   [0m
     [30;47m  󰉋 Favorites       Name       Size    Kind        [0m
     [30;47m  󰋜 ]8;;prompt://打开桌面\[7m Desktop [27m]8;;\       ]8;;prompt://打开 Notes.txt\Notes.txt]8;;\  2 KB    Text        [0m
```

结构优雅不是最少 token。  
视觉边界和状态边界一致更重要。

## Short State Flow

允许短距离状态流动，禁止跨结构边界泄露。

代码高亮可以紧凑：

```txt
[40;37m
  [90m 1 [35mimport[37m sys
  [90m 2 [35mfrom[37m time [35mimport[37m sleep
  [90m 3 [35mdef[37m [36manimate[37m():
[0m
```

在这些边界回到父级状态：

```txt
行尾
新列表项
新链接
状态栏
case 结束
```

## Minimal Codes

常规输出优先使用 16 色和少量效果。

```txt
[0m       reset all
[1m       bold
[22m      bold off
[7m       reverse
[27m      reverse off
[30-37m   foreground
[40-47m   background
[90m      muted foreground
[39m      default foreground
[49m      default background
```

常用语义：

```txt
[7m...[27m      button / selected
[90m...[39m     muted text
[31m...[39m     error / danger
[33m...[39m     warning / pending
[32m...[39m     success / active
[1m...[22m      title / emphasis
```

Truecolor 只用于确实需要的品牌色、特殊图形、进度资产。不要把它当常规文本样式：

```txt
[38;2;59;130;246m特殊蓝色[39m
```

## Good Samples

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
     [30;47m  󰉋 Favorites       Name       Size    Kind        [0m
     [30;47m  󰋜 ]8;;prompt://打开桌面\[7m Desktop [27m]8;;\       ]8;;prompt://打开 Notes.txt\Notes.txt]8;;\  2 KB    Text        [0m
```

### Media

```txt
[92m󰓇[39m Spotify Premium

            [33m󰝚 [1mBlinding Lights[22;39m

  01:45 [92m━━━━━━━━━━━━━━━━━━━━━━━[90m━━━━━━[39m 03:22

  ]8;;prompt://暂停播放\[7m 󰐊 暂停 [27m]8;;\  ]8;;prompt://下一首\󰒭 下一首]8;;\
```

### Editor

```txt
[40;37m 󰙴 EXPLORER   ]8;;prompt://切换Tab\[7m main.py ● [27m]8;;\ ]8;;prompt://打开 settings.json\[90m settings.json[37m]8;;\
[37m 󰙴 ]8;;prompt://折叠项目\PROJECT]8;;\        [90m 1 [35mimport[37m sys
 [90m]8;;prompt://选中 main.py\󰈚 main.py]8;;\[37m        [90m 2 [35mfrom[37m time [35mimport[37m sleep
                  [90m 3 [35mdef[37m [36manimate[37m():
[44;37m 󰘬 main*  ]8;;prompt://同步代码\󰚰]8;;\ 󰅚 0 󰘦 12                       Ln 3, Col 12  UTF-8 [0m
```

## Avoid

不要输出 Markdown、HTML、span 语法。

不要输出 ESC 或 `\x1b`。

不要把控制码表当作要展示的能力。

不要逐词重复完整样式：

```txt
[38;2;192;192;192;48;2;0;0;0mA[0m
[38;2;192;192;192;48;2;0;0;0mB[0m
```

不要在父级区域中用 `[0m` 关闭局部按钮：

```txt
[37;44m
  ]8;;prompt://启动\[7m 启动 [0m]8;;\
  状态：正常
```

应使用：

```txt
[37;44m
  ]8;;prompt://启动\[7m 启动 [27m]8;;\
  状态：正常
[0m
```

## Case Checklist

写入 prompt 的 case 必须是可复用生成样本。

检查：

```txt
是否每帧至少有一个 prompt://？
是否存在孤立的 ]8;;\？
OSC8 是否打开后关闭？
链接内样式是否先关样式，再关链接？
前景色是否跨行泄露？
父级区域内是否误用 [0m？
局部颜色是否回到父级色？
是否过度使用 truecolor？
视觉边界和状态边界是否一致？
case 是否提供一种不同的 screen 地形？
```

高质量 case 的作用不是解释语法，而是塑造生成地形。  
坏 case 会比坏规则更危险：模型会复制写法，而不只是复制画面。
