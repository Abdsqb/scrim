# Build plan

Each step ends with something you can see working. Do them in order. The AI model does not appear until step 4.

## Where things stand

| Piece | State |
| --- | --- |
| Freeze and restore | Works in the prototype |
| Stage, clock, moves in the explainer style | Works in the prototype |
| A full demo scene with a follow-up | Works, hand-written |
| Hotkey, Esc to end early | Works |
| Running on Windows | Works at 100% scaling. 125% and 150% not checked |
| Dragging a box to select a piece | Not built |
| Layout by slots | Not built |
| Reading a piece with a model | Not built |
| Director model | Not built. Draft prompt exists |
| Stage memory and follow-ups | Not built |
| Voice in and out | Not built |
| Server, accounts, installer | Not built |

## Step 0. Run it on Windows

**Do:** `npm install`, then `npm start`, on the owner's PC. Press Ctrl+Alt+Space.

**Check**
- The scene plays to the end and the notes page comes back.
- Esc ends it early and the page comes back.
- Try display scaling at 100%, 125% and 150% in Windows settings. Lifted pieces must sit exactly over their originals at each.
- Note the two timings `live.js` prints: capture and freeze.
- Watch for stutter during the blur. If it stutters, try a smaller blur or a pre-blurred copy of the screenshot.
- `npm run record` reports that the restored screen is identical.

**Likely problems:** fonts fall back to Segoe UI and Consolas, so widths differ from the recording. The hotkey may clash with another app. A second monitor is ignored.

**Done when:** the demo plays smoothly on the PC at its normal scaling, and any fixes are committed.

## Step 1. Select a piece by dragging

**Do:** after the freeze, let the user drag a rectangle on the stage. On release, play `lift` with that rectangle. Allow a second box. Enter or a second hotkey press means "done selecting".

**Check**
- Works on any app, not just the sample page. Remove the dependency on `pieceRects()` for the live path, and keep the sample page for the recorder.
- A box that is tiny or off-screen is ignored.
- Esc during selection restores cleanly.

**Done when:** on a real PDF of course notes, two boxed pieces lift and the page recedes behind them.

## Step 2. Stage-owned layout

**Do:** replace hand-picked `at` coordinates with slots. A script names `top`, `left`, `right` or a row below an existing row. The stage computes coordinates from the screen size and what is already placed.

**Check**
- The demo script contains no pixel coordinates except the lift rectangles.
- The scene looks right at 1366 by 768, 1920 by 1080 and 2560 by 1440.
- A long equation shrinks to fit instead of running off screen.
- Adding a fourth row to the right column moves or clears the oldest.

**Done when:** `demo-script.js` uses only slots and the recording still passes the restore check.

## Step 3. Stage memory

**Do:** add a function that returns what is on the stage as plain data: rows, parts with ids, LaTeX and colors, code lines, matches made, caption. Add a validator that checks a move against it before playing.

**Check**
- After the demo's first three matches, the returned data lists all three.
- A move naming a missing id is rejected with a clear message and the stage is unchanged.
- An unknown move name is rejected.

**Done when:** every move in the demo passes through the validator, and a deliberately wrong script is refused without touching the stage.

## Step 4. Read a piece with the model

**Do:** send one cropped piece to the vision model and get back parts or lines. Call the model straight from the app for now, with the key in a git-ignored file. Start from `07-director-prompt-draft.md`.

**Check**
- On ten equations from real notes, the LaTeX renders and looks like the original.
- The lifted photo lands on the live text without a visible jump.
- Bad LaTeX is caught (`throwOnError`) and the scene restores.
- Log tokens in, tokens out, and time to full response for every call.

**Done when:** boxing an equation and a code block on real notes produces live, correct versions of both.

## Step 5. The director

**Do:** send the question, the piece contents and the stage data. Stream the reply, parse one JSON object per line, validate each, and play it as it arrives. Type the question in a small box for now.

**Check**
- Time from pressing Enter to the first move playing. Target about one second.
- On twenty scenes from real notes, count how many matches are correct. Write the number down.
- A junk line in the stream is skipped without stopping the scene.
- Set effort to low and compare speed and accuracy against the default.

**Done when:** a typed question about two boxed pieces produces a correct, watchable scene on at least three different pages, with the first move inside about a second and the full explanation inside four.

This is the point to record a clip and show people.

## Step 6. Follow-ups, then voice

**Do**
- Keep the stage open after a script ends. A new question sends the stage data and gets back only changes.
- Hold-to-talk with `uiohook-napi` and streaming speech to text.
- Speak captions with the voice built into Windows.

**Check**
- Three follow-ups in a row work without the stage becoming unreadable.
- A follow-up starts moving in under a second, since no image is sent.
- Typing still works when the microphone is off.

**Done when:** the full scene in `01-product.md` works by voice with at least two follow-ups.

## Step 7. Move the key to a server

**Do:** a Cloudflare Worker with routes for the model call and a speech token. The app calls the Worker. Add a shared secret at first, then real sign-in before a public release.

**Done when:** the app contains no API key and still works.

## After that

Follow the phases in `04-services-and-costs.md`: five classmates with an unsigned installer and usage reports, then signing, accounts and limits for a public release.

## Speed targets

| Moment | Target |
| --- | --- |
| Hotkey to frozen screen | Under 0.1 s |
| Box drawn to piece lifted | Under 0.3 s |
| Question asked to first move playing | About 1 s |
| First explanation complete | 3 to 4 s |
| Follow-up to first move | Under 1 s |

These are starting targets. Log a timestamp at every stage from the first day and fix the slowest stage first.

## Refactoring note

`prototype/stage.html` is one dense file. Once steps 1 to 3 have settled what the stage must do, split it: the clock and tweens, the moves, layout, and stage memory as separate files, and move the app out of `prototype/`. Do not restructure before then.
