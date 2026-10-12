# Scrim

Ask about anything on your screen and get an animated, narrated explanation on top of it.

- **Understand something** (an equation, code, a slide, a table, a chart): the pieces lift off the page and the explanation builds beside them with diagrams, arrows and notes.
- **Do something** (use an app feature, find a setting, fix an error): your screen stays live and Scrim guides you one step at a time. Click the real button, and the next step appears.

Windows only for now.

## Setup

Needs Node.js (current LTS) and an Anthropic API key.

```
npm install
```

Create a file named `.env` in this folder (it is git-ignored):

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Use

```
npm start
```

| Key | Does |
| --- | --- |
| Ctrl+Alt+Space | Freeze the screen and open the question box. Falls back to Alt+Shift+Space or Ctrl+Alt+X if taken; the terminal says which |
| Type, Enter | Ask |
| Drag a box | Pick a piece yourself instead of asking |
| Esc | Close, screen comes back |
| Ctrl+Alt+Q | Quit |

Each question costs about $0.001 to $0.003.

## How it works

1. **Casting** (`prototype/casting.js`) sends the screenshot and question to Claude Haiku 5.5 and gets back the pieces it needs, plus a mode: **lift** to explain content, or **point** to guide.
2. **Lift:** the pieces become live math, code, text, tables or pictures. The **Director** (`prototype/director.js`) narrates and builds visuals, sized to how hard the question is.
3. **Point:** the overlay turns transparent and click-through. The **guide** (`prototype/guide.js`) spotlights one control per step; after each click it looks at the screen again and shows the next one, then closes when done.
4. The **stage** (`prototype/stage.html`) draws and animates everything on one clock. Models only send moves; every move is checked before it plays.

## Commands

```
npm test             checks that need no screen
npm run samples      render the test screens to samples/ (git-ignored)
npm run cast         score Casting on those screens (about $0.01); --only=16, --dry for no API call
npm run demo         the original hand-written demo scene
npm run record       record the demo frame by frame and check the screen restores exactly
```

Run one scene on a test screen and save stills to `samples/stills/`:

```
npx electron prototype/live.js "--auto-ask=where do I turn on dark mode?" --screens=samples/17-settings-app.png,samples/17b-settings-appearance.png,samples/17c-settings-dark.png
```

## Status

Works: lift and point modes, the Director, guided multi-step how-tos on the live screen.
Not yet: voice, follow-up questions, display scaling above 100%, multiple monitors, a server for the API key, an installer.

Details are in `docs/` (product, architecture, test results) and `CLAUDE.md`.

## Layout

```
prototype/   the app: live.js (main process), stage.html, casting.js, director.js, guide.js
tools/       test screens and the Casting accuracy test
docs/        product, architecture, motion style, costs, build plan, test results
media/       recording of the original demo
```
