# Scrim

A desktop app that turns whatever is on your screen into an explainer video you can interrupt. The user presses a hotkey, asks a question about something on screen, and the screen appears to come apart: pieces lift off the page, the page falls away, and the pieces are taken apart, matched, and animated to answer the question. Follow-up questions change the scene that is already there. Esc puts the screen back.

Named Scrim, after the theatre curtain that looks solid until it is lit from behind and the scene beyond it shows through. Here the screen is the scrim.

## Who you are working with

A computer science junior building this solo on a Windows x64 PC, as a learning project and a possible startup. Comfortable with code, new to Electron, desktop apps and animation. Explain non-obvious choices in a sentence or two. Prefer small steps that end with something visible on screen.

## Current state (as of 2026-10-10)

There is a working prototype in `prototype/`. It is a hand-written demo, not the product.

Works today:
- Capture the screen, freeze it in a full-screen always-on-top window, restore it.
- Select pieces on any screen by dragging a box. Each lifts on release; Enter recedes the page; Esc restores.
- A stage that plays a script of moves in an explainer-video style (see `docs/03-motion-style.md`).
- A 33-second demo scene with a follow-up question, played live or recorded frame by frame.
- Global hotkey, Esc to end a scene early.

Not built yet:
- Any AI model call. The demo script is written by hand in `prototype/demo-script.js`.
- Finding the pieces a question is about on the full screenshot, and reading them into LaTeX or code lines, with a vision model. Dragging a box is the fallback.
- Layout. Every position in the demo script is a hand-picked pixel coordinate.
- Voice in, voice out, stage memory for follow-ups, accounts, server, installer.

Runs on the owner's Windows PC (1920x1200, 100% scaling): the scene, Esc and the byte-for-byte restore check all pass. Not yet checked there: 125% and 150% scaling, and a second monitor. Capture takes about 260 ms on Windows, over the 0.1 s target. Results in `docs/06-test-results.md`.

## Commands

```
npm install        # once
npm start          # the real app: hotkey (Ctrl+Alt+Space, or Alt+Shift+Space if taken) freezes any screen, drag boxes, Enter, Esc restores, Ctrl+Alt+Q quits
npm run demo       # the sample notes page and the hand-written demo scene, on the hotkey
npm run demo:auto  # plays the demo scene once without the hotkey, then exits (for checking)
npm run select:auto  # drags two boxes by itself and checks the restore (npx electron prototype/live.js --auto-select --esc-while-selecting tests Esc mid-selection)
npm run record     # saves every frame to prototype/frames/ on a stepped clock
npm test           # 12 checks: equation splitting, streamed script parsing, cost model
npm run samples    # renders 10 made-up study screens to samples/ (git-ignored) with truth.json: question, right pieces, true boxes
```

## How it fits together

Named like a theatre production: Casting picks the pieces, the Director writes the scene, the Stage performs it. Details in `docs/02-architecture.md`.

- **Casting**: one vision model call that takes the full screenshot and the question, picks the pieces the question is about, and reads each into LaTeX parts or code lines with a rough box. Not built yet. Dragging a box is the fallback.

- **Stage** (`prototype/stage.html`): a web page shown in a full-screen window. It displays a screenshot and plays moves on it. Nothing on the real screen is touched.
- **Moves**: a small fixed vocabulary (`lift`, `recede`, `write`, `code`, `split`, `match`, `swap`, `show`, `ask`, `say`, `restore`, `hold`, plus `wait`, which only the app plays). Each is a plain object.
- **Director**: an AI model that will turn a question plus the pieces on stage into a list of moves, streamed one JSON object per line. Not built yet. Draft prompt in `docs/07-director-prompt-draft.md`.

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
