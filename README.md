# Screen explainer

Turns whatever is on your screen into an explainer video you can interrupt.

You press a hotkey and ask about something on screen. The equation and the algorithm you are stuck on lift off the page, the page falls away, and they are taken apart and matched in front of you. Ask a follow-up and the scene changes. Press Esc and your screen is back.

This repository is an early prototype plus the plan. See `media/explainer-scene.mp4` for what it does today.

## Run it

You need Node.js (a current LTS version) and npm.

```
npm install
npm start
```

A page of sample lecture notes fills the screen.

- **Ctrl+Alt+Space** plays the scene. If another app already owns it, the app uses Alt+Shift+Space or Ctrl+Alt+X instead and the page says which.
- **Esc** ends it early.
- **Ctrl+Alt+Q** quits.

Other commands:

```
npm test           # checks that need no screen
npm run demo:auto  # play the scene once and exit
npm run record     # save every frame to prototype/frames/
```

## What is real and what is not

The motion is real. The intelligence is not there yet: the scene is a hand-written script in `prototype/demo-script.js`, and the two pieces it lifts are found by the sample page itself. No AI model is called.

It runs on Windows at 100% scaling. Higher scaling and a second monitor are not checked yet.

## Layout

```
CLAUDE.md          project brief for Claude Code
docs/              product, architecture, motion style, services, build plan, test results
prototype/
  live.js          Electron main process: hotkey, capture, overlay, play
  record.js        same scene on a stepped clock, saved frame by frame
  stage.html       the stage: clock, tweens and every move
  demo-script.js   the hand-written scene
  notes.html       sample lecture notes that stand in for the user's screen
  test_core.js     checks that need no screen
media/             recording and still of the demo scene
```
