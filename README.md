# Scrim

Turns whatever is on your screen into an explainer video you can interrupt.

You press a hotkey and ask about something on screen. The equation and the algorithm you are stuck on lift off the page, the page falls away, and they are taken apart and matched in front of you. Ask a follow-up and the scene changes. Press Esc and your screen is back.

This repository is an early prototype plus the plan. See `media/explainer-scene.mp4` for what it does today.

## Run it

You need Node.js (a current LTS version) and npm.

```
npm install
npm start
```

Scrim runs in the background with no window. Open anything, such as a PDF of your notes.

- **Ctrl+Alt+Space** freezes the screen and opens a question box. If another app already owns the hotkey, Scrim uses Alt+Shift+Space or Ctrl+Alt+X instead and prints which.
- **Type a question and press Enter**, about anything on screen. Casting finds the pieces it is about (equations, code, paragraphs, bullets, tables, charts, diagrams), they lift off the page, and each turns into live content. This needs an Anthropic API key in a file named `.env` in this folder: `ANTHROPIC_API_KEY=...`. The file is git-ignored.
- Or **drag a box** around each piece yourself, then Enter. Without an API key this is the only way.
- **Esc** puts the screen back.
- **Ctrl+Alt+Q** quits.

Other commands:

```
npm run demo         # the sample lecture notes and the hand-written 33-second scene
npm test             # checks that need no screen
npm run demo:auto    # play the demo scene once and exit
npm run select:auto  # drag two boxes automatically and check the screen comes back identical
npm run record       # save every frame of the demo scene to prototype/frames/
```

## What is real and what is not

The motion, the selection, Casting (finding and reading the pieces) and a first Director (the explanation: diagrams, arrows, notes, captions) are real. Follow-up questions and voice are not built yet.

It runs on Windows at 100% scaling. Higher scaling and a second monitor are not checked yet.

## Layout

```
CLAUDE.md          project brief for Claude Code
docs/              product, architecture, motion style, services, build plan, test results
prototype/
  live.js          Electron main process: hotkey, capture, question, Casting, selection, overlay, play
  casting.js       Casting: the prompt, streaming the reply, checking it, snapping boxes
  director.js      the Director: the prompt, what is on stage, checking every move
  record.js        same scene on a stepped clock, saved frame by frame
  stage.html       the stage: clock, tweens and every move
  demo-script.js   the hand-written scene
  notes.html       sample lecture notes that stand in for the user's screen
  test_core.js     checks that need no screen
tools/
  make-samples.js  renders made-up study screens with known piece boxes, for testing Casting
media/             recording and still of the demo scene
```
