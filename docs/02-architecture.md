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

One vision model call takes the screenshot and the question, decides which pieces the question is about, and returns each one's box and structured content. Finding and reading in one call saves a round trip. Each piece is one line of the streamed reply, box first, so the first piece can lift before the rest arrive. A dragged piece is read on its own crop with the same rules.

- An equation becomes a list of parts with LaTeX and ids.
- Code becomes a list of lines.

A full 1920 by 1200 screenshot costs about 2,967 image tokens, about $0.0003 on Haiku 5.5. A dragged crop is far smaller: in the test, the equation was 368 by 52 pixels and the algorithm 258 by 152, which cost 28 and 60 image tokens.

The stage already measures where the dark pixels of a crop are (`inkBox`), so a lifted photo can be scaled to land exactly on the live text. For that to look right, Casting's LaTeX must reproduce the original closely.

## The director (to build)

A model call that receives the question, the content of the pieces, and what is on the stage, and returns a script.

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
