# Architecture

The app has four parts, named like a theatre production: **Casting** picks the pieces of the screen a question is about and reads them, the **Director** writes the scene as a list of moves, the **Stage** performs those moves over the frozen screen, and the **Scrim** is the screen itself, which lifts away to show the scene.

```
 hotkey ──> capture screen ──> stage shows the screenshot (frozen)
                                   │
 question + screenshot ──> Casting ──────> each piece: rough box + content (LaTeX parts, code lines)
                                   │        box snapped to the content on screen, piece lifts
                                   │        (fallback: the user drags a box, and only that crop is read)
                                   │
 question + pieces + stage state ──> director model ──> script (one move per line, streamed)
                                   │
                              stage plays each move as it arrives
                                   │
 follow-up question ──────────────┘   (stage state goes back to the director)
```

The capture, the stage and dragging a box exist today. Casting and the Director are not built.

## The stage

`prototype/stage.html`. A web page in a frameless, full-screen, always-on-top Electron window, created hidden at start-up so showing it is instant.

- It displays a screenshot of the screen, so the user sees no change at the moment of freezing.
- Every lifted piece is an ordinary page element, so it can move, scale and change color.
- Nothing on the real screen is touched. Closing the window is the restore.

### The clock

All motion runs on one clock.

- `tween(ms, fn, ease, delay)` registers a motion and returns a promise that resolves when it ends. `fn` receives eased progress from 0 to 1.
- `hold(ms)` is a tween that does nothing.
- `lagged(items, each, stagger, fn)` runs the same tween over many items with a delay between them.
- In **live** mode the clock follows the display's frames. `clock.rate` speeds time up, which is how Esc ends a scene quickly.
- In **manual** mode the clock moves only when `advance(dt)` is called. The recorder uses this to capture exact frames.

Do not animate with `setTimeout`, CSS transitions or anything else that keeps its own time. It would break pause, abort and recording.

### Entry points the main process calls

| Call | What it does |
| --- | --- |
| `freeze(dataUrl)` | Loads the screenshot and keeps a copy of its pixels for measuring |
| `run(script, { manual })` | Plays a script. Resolves with the final state once the stage is clean |
| `abort()` | Finishes the current move at 8 times speed, then restores |
| `select({ max, min })` | Lets the user drag boxes. Each box lifts on release. Resolves with `[{ piece, rect }]`, or `null` if cancelled. Lifted pieces stay for the next `run` |
| `finishSelect()` | Ends selection (Enter or the hotkey again) |
| `cancel()` | Esc: cancels selection, or aborts a playing scene |
| `advance(dt)` | Manual mode only: move the clock forward |
| `state()` | `{ done, error, aborted, now, active }` |

`run` guarantees a restore. If a move throws, or the script ends without a `restore`, it restores anyway.

## The moves

Each move is a plain object with a `move` name. Any move may carry `pause`, the milliseconds to wait afterward (default 260, 0 for none).

| Move | Fields | What you see |
| --- | --- | --- |
| `lift` | `piece`, `rect {x,y,w,h}` | A box of the page pops up with a shadow, in place |
| `recede` | none | The page shrinks, blurs and darkens behind the lifted pieces |
| `write` | `row`, `at {x,y}`, `size`, `parts`, optional `piece`, `anchor`, `dim` | A row of math appears. With `piece`, the lifted photo flies in and turns into it. Without, it writes itself on |
| `code` | `at {x,y}`, `size`, `lines`, optional `piece` | Numbered code lines appear, the same two ways |
| `split` | `row` | The named terms of a row drift apart |
| `match` | `term`, `line`, optional `span`, `color`, `label`, `say` | The term takes a color and gets a brace and label. A copy flies to the code line and the matching words are boxed in the same color |
| `swap` | `id`, `tex`, optional `color` | A term is replaced in place and its neighbors slide |
| `show` | `id`, optional `color` | A hidden part writes itself on, swells, and flashes |
| `indicate` | `id`, optional `color` | A term swells and flashes a color, then returns |
| `ask` | `text` | The user's follow-up question appears as a chip at the top |
| `say` | `text` | The caption changes |
| `text` | `at {x,y}`, `width`, `size`, `lines`, optional `piece`, `terms` | A passage as live text. Each term (`{id, text}`) becomes an element with id `piece-id` |
| `table` | `at {x,y}`, `size`, `rows`, optional `piece` | A live grid. Cell ids are `piece-r<row>c<column>`, counting from 1. Numbers are right-aligned |
| `place` | `piece`, `at {x,y}`, `w` | A lifted figure flies to a new spot and width and stays a picture |
| `hold` | `ms` | Nothing moves |
| `wait` | none | Holds until the user presses Esc. Played by the app, never by the director |
| `restore` | none | Everything fades and the page comes back |

### Parts

A `write` row is a list of parts. Each part is rendered separately so it can move on its own.

| Field | Meaning |
| --- | --- |
| `tex` | LaTeX for this part. Use `{}={}` style padding to keep operator spacing when a part is only an operator |
| `id` | Makes the part addressable by `match`, `swap`, `show` and `from`. Unique across the stage |
| `color` | One of `white`, `blue`, `teal`, `green`, `yellow`, `gold`, `red`, `pink`, `grey` |
| `from` | The id of an existing part. A copy of that part flies in and becomes this one |
| `hidden` | Takes up space but is invisible until a `show` |

### Known limits of the current moves

- **Positions are pixels.** `at` is a screen coordinate chosen by hand. The director must not be asked for pixels. See "Layout" below.
- **One code block.** Lines get ids `ln-1`, `ln-2` and so on, globally.
- **`span` matches the first occurrence** of the text in the line.
- **Writing on is an approximation.** KaTeX draws characters as text, so the effect outlines and fills each character. True stroke drawing needs vector outlines.
- **Abort is not instant.** It finishes the current move quickly first, which takes up to about a second.
- **Primary display only.**

## Layout (to build)

The stage should own layout. A script should say where something goes by naming a slot, and the stage should turn the slot into coordinates for the current screen size and what is already there.

A starting set of slots: `top` for the main equation, `left` for code, `right` for worked examples stacked downward, `bottom` for the caption. When a slot is full, the stage clears or shrinks the oldest item.

This is step 2 in the build plan and comes before the director, because a model cannot be trusted to place things by pixel.

## Finding pieces (to build)

The model finds them. With each new question the full screenshot goes to Casting (below), which returns a rough box around each piece the question is about. Model coordinates are approximate, and a lift that cuts through a letter looks wrong, so each box is snapped locally: grown or shrunk until its edges sit on clear background, with the same kind of pixel scan as `inkBox`. Then `lift` plays with the snapped box.

## Selecting pieces by dragging

The fallback when Casting picks the wrong piece. On the frozen screen the user drags a box around each piece. The box becomes the `rect` for `lift`, and the crop is what will be sent to the reader. Boxes smaller than 12 px on a side are ignored, boxes are clipped to the screen, and there are at most four. Enter is registered as a global shortcut only while selecting, because the stage may not get keyboard focus away from another app. Until the director exists, `npm start` plays `recede`, a caption and `wait` after selection.

Later: use the cursor position and the words of the question to find the pieces without a box.

## Casting (to build)

One vision model call takes the screenshot and the question, decides which pieces the question is about, and returns each one's box and structured content. A piece is an equation, code, a text passage, a table, or a figure. An equation comes back whole, as one LaTeX string with terms copied out of it, because models cut equations into parts badly (a fraction's numerator and denominator ended up in separate parts); `equationParts()` cuts it at the top-level terms and tags nested ones in place with `\htmlId`. Finding and reading in one call saves a round trip. Each piece is one line of the streamed reply, box first, so the first piece can lift before the rest arrive. A dragged piece is read on its own crop with the same rules.

- An equation becomes a list of parts with LaTeX and ids.
- Code becomes a list of lines.

A full 1920 by 1200 screenshot costs about 2,967 image tokens, about $0.0003 on Haiku 5.5. A dragged crop is far smaller: in the test, the equation was 368 by 52 pixels and the algorithm 258 by 152, which cost 28 and 60 image tokens.

The stage already measures where the dark pixels of a crop are (`inkBox`), so a lifted photo can be scaled to land exactly on the live text. For that to look right, Casting's LaTeX must reproduce the original closely.

## Two modes: lift and point

Casting's first line chooses the mode for each question.

- **Lift**: the person wants to understand content. Pieces are lifted off the page, the page recedes, and the Director builds beside them.
- **Point**: the person wants to do or find something on the screen: use an app feature, find a setting, deal with an error message, find which part of a chart answers a "which" question. Nothing moves. Casting returns targets (`kind: "target"`, with a `label` and a `role` such as button, menu, field), which become invisible `anchor` boxes on the stage. `dim` lays a light shade over the screen; `spotlight` cuts a hole in that shade around one target and glides to the next, so the spotlit control is at full brightness; `marker` pins a numbered step; `click` moves a ghost cursor to a target and shows a click. Pointing moves do not count toward the visual budget, since each spotlight replaces the last.

Point mode runs on the **live screen**. The stage window is transparent; once Casting has found the targets from the screenshot, `golive` fades the screenshot out and the app calls `setIgnoreMouseEvents(true, { forward: true })`, so every click goes through to the apps underneath while the guidance stays on top, the way Clicky works. Lift mode keeps the frozen screenshot over a black backdrop. Esc is a global shortcut, so it works whichever window has focus.

**Guided mode** (`prototype/guide.js`) runs every point-mode question, one step at a time:

1. The first guide call starts in parallel with Casting. Whichever mode Casting picks, the other call is cancelled, so a how-to question waits no longer than an explanation.
2. Each step spotlights one control, pins its number, and a soft ring breathes round it while the narration says what to do and why.
3. `uiohook-napi` reports the person's clicks (and Enter) even though they go to other apps. The moment they act, `clearNow()` removes that step's guidance, including any of its moves still queued.
4. After 0.3 s for menus to open, the screen is captured again. The stage has content protection on during guided mode, so the capture sees the app and not the guidance.
5. One guide call sees the new screen, the goal and the steps done, and returns the next action, `done`, or `stuck`. If the person clicked somewhere unexpected, it works from where they are now.
6. On `done` it confirms in one line and the stage closes by itself.

Measured on the settings sequence (screens 17, 17b, 17c): the next step is on screen about 1.8 to 2 s after a click (guide call about 1.2 s, capture about 0.3 s, settle 0.3 s). Thinking on or off made no difference to speed, so it stays on.

Not yet checked: click coordinates from uiohook at display scaling above 100%. A feature inside a closed menu is now handled step by step: so the Director points at what opens it and says what to look for next. A guided mode that waits for the click and looks again would remove this limit.

## The director

Built in `prototype/director.js`. A model call that receives the question and the pieces on stage, written as plain lines with the exact ids it may use, and returns a script.

The prompt's central rule: the student has already read the material and did not get it, so repeating or enlarging it teaches nothing. The Director gives a new angle (a diagram of the idea, the process behind it, the student's own numbers worked through, a comparison) and ties it back to the material with arrows and highlights. The first version only showed the lifted text bigger, which the owner rightly called redundant.

Its moves: `focus` (light up a term, cell, line, part or figure), `say` (caption), `diagram` with `type` `flow` (boxes top to bottom joined by arrows), `stack` (amounts drawn to scale, listed top to bottom) or `compare` (columns), `arrow` (from anything to anything, with a label), `note` (handwritten label), `write` (a line of math on the canvas) and `hold`. The stage lays out and draws everything: Casting's pieces in a column on the left, the Director's canvas on the right, filling top to bottom and then a second column. Arrows from the material leave from the edge of the block they sit in and pass behind diagram boxes; arrows between two things in the student's column arc through the gutter; labels avoid content and other arrows.

- **Output format:** one JSON object per line. The stage plays each line as it arrives, so motion starts before the model finishes. A line parser for this is in `prototype/test_core.js` and passes at every possible break point in the stream.
- **Short output.** A script of moves is several times shorter than drawing code for the same scene, and model response time grows with output length. The exact ratio has not been measured against real model output.
- **Validation.** Before a move plays, check that it is a known move and that everything it names exists. Drop or repair a bad move, and never leave the stage half-drawn.

Draft prompts are in `07-director-prompt-draft.md`. They have not been run against a model.

## Follow-up questions (to build)

A follow-up changes the scene on screen. It does not rebuild it.

- **Stage memory.** The app keeps a list of what is on the stage: every row and part with its id, LaTeX and color, every code line, every match made, and the caption. It also keeps the last few questions.
- **Each follow-up sends** the new question, the stage list and the recent history. No image is sent, because the pieces were already read into text. This makes follow-ups faster and cheaper than the first question.
- **The director returns only changes.** It can add to what is there, clear what is no longer relevant, or bring in something new.
- **Keeping it readable.** The director is told to clear or shrink older items before adding new ones.

The demo scene already contains one follow-up, "show me with numbers", to show what this looks like. It is scripted by hand.

## Voice (to build)

- **In:** hold a key to talk. Electron's `globalShortcut` reports a key press only, so hold-to-talk needs a library that also reports release. `uiohook-napi` does and ships a ready-built Windows x64 file. A typed box does the same job in a library.
- **Out:** captions always. The voice built into Windows first, a paid voice later as an option.

## Server (to build)

The app never holds an API key. It calls a small server, a Cloudflare Worker, which holds the keys, checks who is asking, limits use per person, and forwards the request. Clicky's open-source `worker` folder is a working reference for this layout.

For the first days of development the model can be called straight from the app with a key in a git-ignored local file. Move it to the server before anyone else gets a copy.
