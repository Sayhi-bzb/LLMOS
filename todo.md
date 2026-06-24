# TODO

## Box Repair v2: Intent Recovery

### Current State
- v1 box repair is implemented in `src/lib/box-repair.ts`.
- A regression script exists at `scripts/check-box-repair.mjs` and is runnable with `npm run check:box-repair`.
- Current v1 behavior repairs visible character-level issues: uneven borders, missing left/right border, separator width, display-width handling for CJK/emoji, and style/link preservation.
- The algorithm is still surface-level: it finds a box-like block, picks a target width, and pads/replaces characters. It does not recover the layout intent behind the box.

### Problem Model
LLMs usually understand the intent of a box UI: a complete rectangle containing content. They are weak at exact two-dimensional layout:
- counting spaces and display width,
- keeping the right border in the same column across streamed lines,
- accounting for CJK, emoji, links, and styled spans,
- maintaining top/bottom border width against content width.

The parser should treat LLM box output as noisy layout intent, not as exact coordinates.

### v2 Goal
Upgrade box repair from character padding to single-region box intent recovery:
1. Detect a likely single-region box.
2. Extract content from middle lines without trusting original right-border position.
3. Compute inner width from extracted content using `getTextDisplayWidth`.
4. Redraw the outer box from the recovered layout model.
5. Preserve content run style/link metadata.
6. Fall back to v1 when the box is too complex to safely normalize.

### Proposed Algorithm
- Identify candidate blocks with top border, bottom border, and middle lines.
- Classify each row:
  - top border,
  - bottom border,
  - separator border,
  - content row,
  - malformed content row.
- For content rows:
  - remove one leading border if present,
  - remove one trailing border if present,
  - trim only structural padding, not semantic content,
  - preserve styled/link runs for actual content characters.
- Compute `innerWidth = max(content display width) + horizontalPadding * 2`.
- Redraw:
  - `┌ + ─ * innerWidth + ┐`,
  - `│ + padded content + │`,
  - separators as `├ + ─ * innerWidth + ┤`,
  - `└ + ─ * innerWidth + ┘`.
- Clamp total width to `gridCols` only when needed; do not silently truncate content in v2.

### Fallback To v1
Use existing v1 repair instead of v2 when detecting:
- nested boxes,
- multiple internal vertical separators on a content row,
- complex junctions such as `┬`, `┴`, `┼`,
- multi-column TUI layouts,
- markdown tables,
- rows where content extraction would remove non-structural text,
- boxes wider than the available grid where safe redraw is ambiguous.

### Test Additions
Extend `scripts/check-box-repair.mjs` with v2-specific cases:
- content row wider than top/bottom border should redraw the whole box from content width,
- uneven empty rows should normalize through content extraction,
- missing left or right border should recover the intended content row,
- styled/link content should preserve metadata after redraw,
- CJK and emoji content should size the box by display width,
- separator rows should redraw to the computed inner width,
- multi-column or complex-junction boxes should fall back to v1,
- markdown tables and ASCII art should remain unchanged.

### Acceptance Criteria
- `npm run check:box-repair` passes.
- `npm run typecheck` passes.
- `npm run build` passes.
- v2 improves single-region LLM box output without making complex TUI output worse.
