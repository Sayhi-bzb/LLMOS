# LLMOS Blueprint

## Minimal Loop

LLMOS starts with a minimal state/render loop:

```txt
user request / href label interaction
-> state LLM appends natural-language event log
-> render LLM reads event log
-> render LLM outputs ANSI frame + @eN event map
-> compiler checks protocol validity
-> display accepted frame
```

## Core Principles

- State and rendering are separated.
- The event log is the only intermediate state passed from the state LLM to the render LLM.
- The event log is append-only.
- Event content is natural language first, not structured state first.
- Rendering uses ASCII art, ANSI SGR, and OSC 8.
- OSC 8 href labels use frame-local handles such as `@e1`.
- `@eN` labels are open events, not predefined components.
- The compiler validates protocol correctness, not subjective UI semantics.

## Event Log

The event log uses JSONL. Each line is one event wrapper with natural-language content.

```jsonl
{"type":"user","text":"用户请求打开设置页。"}
{"type":"state","text":"用户打开了设置页。当前画面应该显示设置选项，并提供返回主页的交互。"}
{"type":"interaction","text":"用户点击了上一帧中的 @e1，对应事件是 go_home。"}
```

Initial event types:

- `user`: user text request.
- `interaction`: user selected an OSC 8 `@eN` handle from the previous frame.
- `state`: state LLM's natural-language state/event update.

The state LLM appends natural-language events. It does not render ANSI and does not own display layout.

## Render Frame

The render LLM reads the event log and produces a render frame:

```json
{
  "ansi": "...",
  "events": {
    "@e1": "go_home",
    "@e2": "open_theme_settings"
  }
}
```

The `ansi` field contains the visible ASCII/ANSI frame.

The `events` field maps frame-local OSC 8 href labels to free-form event names. These event names are used to create the next `interaction` event when the user clicks a label.

Example OSC 8 label:

```txt
ESC]8;;@e1ESC\[ Back ]ESC]8;;ESC\
```

## Interaction Labels

`@eN` labels are frame-local interaction handles.

They do not imply:

- button
- menu item
- tab
- checkbox
- component role
- permission
- business state

The visible ASCII/ANSI text creates the user's visual affordance. The event map creates the machine-readable interaction binding.

## Compiler

The first compiler checks only protocol validity:

- ANSI and OSC 8 sequences are closed correctly.
- Every `@eN` used in ANSI exists in the frame event map.
- Every `@eN` in the frame event map is used in ANSI.
- Event labels match `@e<number>`.
- The frame stays within configured width and height limits.

The compiler does not judge whether the UI is semantically good, whether an event name is business-correct, or whether a visual element should be a specific component type.
