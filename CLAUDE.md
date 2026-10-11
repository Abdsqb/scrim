# Scrim

A desktop app that turns whatever is on your screen into an explainer video you can interrupt. For anyone, about anything on screen: course material, how to use an app, what an error means, what a chart shows. The user presses a hotkey, asks a question about something on screen, and the screen appears to come apart: pieces lift off the page, the page falls away, and the pieces are taken apart, matched, and animated to answer the question. Follow-up questions change the scene that is already there. Esc puts the screen back.

Named Scrim, after the theatre curtain that looks solid until it is lit from behind and the scene beyond it shows through. Here the screen is the scrim.

## Who you are working with

A computer science junior building this solo on a Windows x64 PC, as a learning project and a possible startup. Comfortable with code, new to Electron, desktop apps and animation. Explain non-obvious choices in a sentence or two. Prefer small steps that end with something visible on screen.

## Current state (as of 2026-10-10)

There is a working prototype in `prototype/`. It is a hand-written demo, not the product.

Works today:
- Capture the screen, freeze it in a full-screen always-on-top window, restore it.
- Ask a typed question on any screen, about anything: Casting (`prototype/casting.js`, Claude Haiku 5.5) finds the pieces on the full screenshot (equations, code, text passages, tables, figures), they lift as they stream in, the page recedes, and each turns into live content: math, code lines, text with addressable key terms, a table grid, or a picture. Needs `ANTHROPIC_API_KEY` in the git-ignored `.env`.
- The Director (`prototype/director.js`, Claude Haiku 5.5) then explains with a new angle instead of repeating the material: it highlights terms, builds diagrams (flow, stack, compare), draws arrows from the material to them, adds notes and lines of math, and captions. Casting's pieces sit in a column on the left; the Director builds on the right.
- Two modes, chosen by Casting per question. **Lift** pulls content out to explain it. **Point** leaves the screen in place for questions about using or finding something (an app feature, a setting, an error dialog, which bar in a chart): the screen dims under a shade, and the Director spotlights controls, numbers the steps, shows a ghost cursor clicking, and narrates.
- Dragging a box around a piece is the fallback. Each lifts on release; Enter recedes the page; Esc restores.
- A stage that plays a script of moves in an explainer-video style (see `docs/03-motion-style.md`).
- A 33-second demo scene with a follow-up question, played live or recorded frame by frame.
- Global hotkey, Esc to end a scene early.

Not built yet:
- Layout. Every position in the demo script is a hand-picked pixel coordinate.
- Voice in, voice out, stage memory for follow-ups, accounts, server, installer.

Runs on the owner's Windows PC (1920x1200, 100% scaling): the scene, Esc and the byte-for-byte restore check all pass. Not yet checked there: 125% and 150% scaling, and a second monitor. Capture takes about 260 ms on Windows, over the 0.1 s target. Results in `docs/06-test-results.md`.

## Commands

```
npm install        # once
npm start          # the real app: hotkey (Ctrl+Alt+Space, or Alt+Shift+Space if taken) freezes any screen, type a question + Enter (or drag boxes), Esc restores, Ctrl+Alt+Q quits
npm run demo       # the sample notes page and the hand-written demo scene, on the hotkey
npm run demo:auto  # plays the demo scene once without the hotkey, then exits (for checking)
npm run select:auto  # drags two boxes by itself and checks the restore (npx electron prototype/live.js --auto-select --esc-while-selecting tests Esc mid-selection)
npm run record     # saves every frame to prototype/frames/ on a stepped clock
npm test           # 12 checks: equation splitting, streamed script parsing, cost model
npm run samples    # renders 10 made-up study screens to samples/ (git-ignored) with truth.json: question, right pieces, true boxes and content
npm run cast       # Casting accuracy test on those screens (about $0.004); --only=01, --dry (no API call), --model=, --thinking=off, --format=boxes-first
npx electron prototype/live.js --auto-ask   # one real Casting call on the sample notes, checks pieces and restore
```

## How it fits together

Named like a theatre production: Casting picks the pieces, the Director writes the scene, the Stage performs it. Details in `docs/02-architecture.md`.

- **Casting** (`prototype/casting.js`): one vision model call that takes the full screenshot and the question, picks the pieces the question is about, and reads each with a rough box: an equation as one LaTeX string plus terms (code cuts it into parts), code lines, text lines plus key terms, table rows, or a figure (not read). Dragging a box is the fallback.

- **Stage** (`prototype/stage.html`): a web page shown in a full-screen window. It displays a screenshot and plays moves on it. Nothing on the real screen is touched.
- **Moves**: a small fixed vocabulary. Casting's pieces: `lift`, `recede`, `write`, `code`, `text`, `table`, `place`. The Director's: `focus`, `say`, `diagram` (flow, stack, compare), `arrow`, `note`, `write`, `hold`. Older ones the demo uses: `split`, `match`, `swap`, `show`, `indicate`, `ask`. The app plays `wait` and `restore`. Each is a plain object; a move that cannot play is skipped and reported, not fatal.
- **Director** (`prototype/director.js`): a model call that turns the question plus the pieces on stage into moves, streamed one JSON object per line. Its job is a new angle (a picture, a process, the student's numbers worked through), never a rephrasing. Every move is checked against the ids on stage before it plays.

## How explanations should feel (the owner's principles)

These shape every scene. The Director's prompt follows them; check new moves and prompts against them.

- **The narrator explains; the screen illustrates.** The explanation is spoken: a tutor talking the student through how something works, in order, building to the answer. It is not a story with characters, and not a list of facts. Visuals appear at the moment the narration reaches them, to help the student see what is being said.
- **Proportional.** The size of the explanation matches how hard the idea is. An easy term gets a highlight and a sentence or two. A process or relationship gets one diagram. Only a genuinely tangled idea gets two. A screen full of explanation confuses more than it helps.
- **A new angle, never a repeat.** The student has already read the material. Showing it bigger or rephrasing it teaches nothing; a picture of the idea, the process behind it, or their own numbers worked through does.
- **Their material, their numbers.** Diagrams use the student's own terms and figures, and arrows tie them back to where they are on the page.

## Rules that must hold

- **The director writes moves, never code.** No model output is ever executed. A move the stage does not know is rejected.
- **Validate before playing.** Every id, line number and row a move names must exist on the stage. A bad script must fail loudly, not draw something wrong.
- **A scene always ends restored.** Finished, ended with Esc, or failed, the screen must come back exactly as it was. `npm run record` checks this byte for byte.
- **One clock.** Every motion goes through `tween()` on the shared clock in the stage. No `setTimeout`, no CSS transitions, no free-running animations. This is what makes scenes pausable, skippable and recordable.
- **No API key in the app.** Keys live on a server the app calls. During early development a key may sit in a local file that is git-ignored. Never commit one, never bundle one.
- **Capture only on the hotkey.** The screenshot goes to the model only with a new question, never at any other time, and is never stored on the server. The app says so plainly. (Decided 2026-10-10: the whole screen is sent so the model can find the pieces itself, as Clicky does.)
- **KaTeX `trust` stays limited** to `\htmlId`. Model-written LaTeX must not be able to add links or markup.
- **Windows first.** Mac comes later and needs a screen recording permission step.

## Conventions

- Plain JavaScript, no framework, no build step yet. Keep it that way until it hurts.
- `prototype/stage.html` is dense. When changing it, keep each move a self-contained async function that takes one plain object.
- New motion uses the `smooth` easing unless there is a reason. See `docs/03-motion-style.md` for the rules that make the style.
- After any change to the stage, run `npm run record` and confirm the restored screen is identical.
- Prices, model names and library versions in `docs/` were checked on 2026-10-10. Re-check before relying on them.

## What to do next

`docs/05-build-plan.md` has the ordered steps with a definition of done for each. In short:

0. Run the prototype on Windows and fix what breaks (scaling above 100%, fonts, hotkey).
1. Drag a box to select a piece on the frozen screen.
2. Let the stage own layout, so scripts name slots instead of pixels.
3. Give the stage a memory of what is on it, and validate moves against it.
4. Ask a typed question; one vision model call finds the pieces on the full screenshot and reads them. Dragging stays as the fallback.
5. Have the director write the script.
6. Follow-ups, then voice.
7. Move the API key to a server.

## Where to find things

| Need | File |
| --- | --- |
| What the product is, who it is for, what done means | `docs/01-product.md` |
| Stage, moves reference, director, follow-ups | `docs/02-architecture.md` |
| The look, each animation, why not ManimGL | `docs/03-motion-style.md` |
| Every service, prices, cost per scene, sign-up order | `docs/04-services-and-costs.md` |
| Ordered build steps and acceptance checks | `docs/05-build-plan.md` |
| What was tested, numbers, known issues | `docs/06-test-results.md` |
| Draft prompts for reading pieces and directing | `docs/07-director-prompt-draft.md` |
| Links for every external fact | `docs/08-sources.md` |
| A recording of the demo scene | `media/explainer-scene.mp4` |

Read the relevant doc before starting a step. Do not load all of them up front.
