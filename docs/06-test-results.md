# Test results

## Windows (step 0)

Run on 2026-10-10 on the owner's PC: Windows 11, x64, one display at 1920 by 1200, 100% scaling, Node 24.16.0, Electron 44.7.0.

| Test | Result |
| --- | --- |
| `npm test` | 12 of 12 passed |
| Live demo scene (`npm run demo:auto`) | Played to the end in 32.2 s with no error |
| Esc during the scene (`--auto --abort`) | Abort at 6.0 s, restored at 6.8 s |
| Recorded scene (`npm run record`) | 976 frames, average step 0.62 ms. Restored screen byte-for-byte identical |
| Capture | 260 to 280 ms. Over the 0.1 s target for hotkey to frozen screen |
| Freeze | 48 to 51 ms |
| Ctrl+Alt+Space | Already taken by another app (Flow Launcher or Copilot were running). The app now takes the first free hotkey of Ctrl+Alt+Space, Alt+Shift+Space, Ctrl+Alt+X and shows it on the demo page |

Notes:
- **Fixed: the stage was squashed.** Windows shrinks a new window to fit above the taskbar, so both windows came out 1920 by 1160 on a 1920 by 1200 screen. The screenshot was squeezed into that height and every lifted piece was cut from slightly the wrong place, worse lower on the page. Calling `setBounds` after the window is created is not clamped. With that, the frozen stage matches the page pixel for pixel, and `live.js` now warns if the stage and screen sizes ever differ.
- The very first launch, right after Electron was downloaded, took 4.6 s to freeze and then hung. It did not happen again. Most likely Windows scanning the new binary.
- Scaling at 125% and 150%: the owner saw lifted text jump sideways and an off-centre crop at 150% before the fix above. **Re-check after the fix.** Chromium's `--force-device-scale-factor` flag gives wrong display bounds under Electron (the size is divided by the scale twice), so it cannot stand in for the real Windows setting.
- Capture is the slowest stage. `desktopCapturer.getSources` takes about 260 ms on this PC against 26 to 99 ms on the Linux display. Worth fixing before the speed targets matter, for example by keeping a capture stream open.

## Selecting pieces (step 1)

Run on 2026-10-10 on the same PC, at 100% scaling, against the sample notes page with synthetic mouse events.

| Test | Result |
| --- | --- |
| Two boxes dragged, then Enter, then Esc (`npm run select:auto`) | Both lifted, the page receded, the screen came back byte-for-byte identical |
| A 4 by 4 box | Ignored |
| Esc while selecting, with two pieces lifted (`--esc-while-selecting`) | Cancelled and restored byte-for-byte identical |
| Demo scene and recorder after the change | Unchanged: 32.2 s, 976 frames, restore identical |

Not tested: a real PDF with a real mouse, which is what "done" means for step 1.

## The Director, narration-led and proportional

Run on 2026-10-11 after the owner's two principles (see "How explanations should feel" in CLAUDE.md): the narrator explains and the screen illustrates; the size of the explanation matches the difficulty.

The Director's first line now judges the question easy, medium or hard, and the checker holds it to that level's limits. Narration and visuals are counted apart, because what crowds the screen is visuals and the last thing said is the answer: easy allows 3 things said and 3 visual moves with no diagram; medium 5 and 7 with one diagram; hard 6 and 11 with two.

| Question | Judged | What it built |
| --- | --- | --- |
| "what are assets?" (balance-sheet slide) | easy | 6 to 7 moves: highlights, one note, three spoken lines. No diagram |
| "what happens during anaphase?" | easy | Highlights and narration only |
| "I don't understand stockholders' equity" | medium | 11 moves: one stack bar, one arrow from the table, E = A - L, narration ending on the answer with the slide's numbers |
| "how is net income calculated in this table?" | medium | One flow, narration walking down the statement |

The narration now reads like a tutor talking ("Think of the $500,000 of assets as one stack..."), with each visual next to the line about it. A first limit that counted every move cut off the closing line; separate budgets fixed that. Notes now look for free space (beside the paragraph, level with the word, then below or above) instead of landing on the text.


Run on 2026-10-10 with `npx electron prototype/live.js --auto-ask="..." --screen=samples/NN-....png`, which saves a still every 4 s to `samples/stills/`. Judged by looking at the stills; there is no automatic score for explanations yet.

| Screen and question | What the Director built |
| --- | --- |
| Balance-sheet slide: "I don't understand stockholders' equity" | Highlighted the term in the bullet and the table; a stack bar of total assets split into liabilities ($300,000) and equity ($200,000); arrows from each table row to its block; the note "cushion for creditors"; a closing caption on what happens if assets fall |
| Dijkstra: "how does the relaxation equation fit into the algorithm?" | Highlighted min and the if on line 3; a flow of the update (check neighbour, compute alt, compare, overwrite); arrows from code lines to the steps |
| Supply and demand: "why does the price end up where the two lines cross?" | Two flows: price above P* leads to a surplus and a falling price, price below leads to a shortage and a rising price; arrow from the chart: "E is where it stops" |
| Income statement: "how is net income calculated?" | A flow down the statement with its own numbers, the whole subtraction written as one line of math, and a note on brackets |
| Mitosis: "what happens during anaphase?" | A flow of the stage (joined, pulled apart, at opposite poles) with a note |

Speed: the first Director move arrives 0.7 to 0.9 s after Casting finishes; a whole script (8 to 16 moves) takes 2 to 3 s to write, once 5.9 s. The stage is still playing Casting's lifts when the first move arrives.

Problems found in the stills and fixed: arrows crossing the numbers in a table, the rest of a sentence, and earlier boxes in a horizontal flow (flows now run top to bottom, arrows leave from block edges and pass behind boxes); labels on top of each other and of text; bar labels overflowing; one failing move ending the whole scene (now skipped); trailing commas in the model's JSON.

Still rough: labels sometimes sit on an underline or another line; long scenes with two diagrams can crowd the canvas.


Run on 2026-10-10. The sample screens grew to fifteen: screens 11 to 15 add text, tables and figures (a balance-sheet slide asking about stockholders' equity, a photosynthesis diagram, a supply-and-demand chart, four similar paragraphs on mitosis, an income statement). Some pieces are marked optional: helpful context that may be picked or not.

| Measure | Result |
| --- | --- |
| Right pieces, all fifteen screens | 14 of 15 on each of the last two runs. The miss is the Bayes screen, where the model sometimes also picks the law of total probability beside it |
| Read completely (equations by structure, text and tables by wording, code exactly) | 22 of 22 and 23 of 23 |
| Time to the first piece | Mean 1.1 s |
| In the app, `--screen=samples/11-...png` asking "I don't understand stockholders' equity" | Picked the equity bullet and the balance-sheet table; first piece lifted 1.1 s after asking; both went live |

What changed to get there:
- Casting knows five kinds: equation, code, text, table, figure. Before, a slide of bullet points had nothing it could pick, which is what the owner hit on a real accounting slide.
- Equations come back whole with terms copied out of them, and code cuts them into parts. Asked to cut equations itself, the model kept flattening fractions (numerator and denominator in separate parts) and splitting braces. The reading check now counts fractions, roots, sums and integrals so this is caught.
- Snapping treats lines of text like code lines and leaves tables and figures as the model boxed them, since their gaps are deliberate.
- A number written as `070` no longer loses the whole piece.


Run on 2026-10-10 against the ten made-up screens from `npm run samples` (PDF viewer, course site, slides, notebook, each with decoy equations or code), using `npm run cast`.

**Current settings:** Claude Haiku 5.5, effort low, thinking on, one line per piece, screenshot at full resolution (1920 by 1200; the model takes up to 2576 px on the long edge).

| Measure | Result |
| --- | --- |
| Right pieces picked, decoys skipped | 10 of 10 on the last three full runs |
| Read completely (equation symbols match the original; code lines match exactly) | 18 of 18 |
| Box overlap with the truth (IoU), mean | 0.89 as the model gives it, 0.92 after snapping |
| Time to the first piece | Mean 1.1 to 1.3 s. Target about 1 s |
| Cost | About $0.0004 per screen |
| In the app (`--auto-ask` on the sample notes) | First piece lifted 1.2 to 1.5 s after asking; restore byte-for-byte identical |

**Speed experiments** (each a full run of ten screens):

| Setting | Right pieces | First piece |
| --- | --- | --- |
| Thinking on, one line per piece | 10/10 | 1.1 to 1.4 s |
| Thinking off, one line per piece | 8/10, 8/10 | 1.2 s |
| Thinking off, every box before any content | 9/10, 8/10 | 0.8 s |
| Thinking on, every box first | 8/10 | 1.7 s |

Thinking is what lets the model tell the right formula from a decoy. Telling it to start with JSON and not explain cut the first piece from about 1.7 s to 1.2 s with thinking still on.

**What was wrong and got fixed along the way:**
- The model left brackets and commas out of equations because the prompt said they "get no id". The prompt now says they are parts too, with a worked example, and the test checks readings.
- It dropped base cases written beside an equation (`, F(0) = 0`). A prompt rule fixed it.
- It split `\left(` and `\right)` into separate parts, which cannot render alone. Prompting against it made things worse (`\big\min`), so code repairs a lone one to `\big`.
- At 1568 px wide it misread `np.sqrt(((` as four brackets. Full resolution fixed it, at about $0.0001 more per call.
- The validator joined parts without a space, so `\Rightarrow` then `T(n)` read as an unknown command and a correct piece was refused.
- Link and HTML commands (`\href`, `\url`, `\html...`) are now refused outright, on top of KaTeX's limited `trust`.

**Snapping** (`snap()` in `prototype/casting.js`) was tuned on `npm run cast -- --dry`, which jitters the true boxes by up to 20 px with no API call: every piece lands within 0 to 7 px. If snapping reaches the edge of its search area it keeps the model's box rather than swallow neighbouring content. In notebook cells (grey bars as wide as the page) that means the model's box is kept: all the code plus some grey.

**Caveat:** the screens are generated and cleaner than real PDFs. Repeat on real course notes before trusting these numbers. Sonnet 5.5 and Gemini are untried; Haiku has not needed them yet.

## Linux (first prototype)

Everything below was run on 2026-10-10 on a Linux virtual display at 1440 by 900 with software drawing, using Electron 44.7.0 and KaTeX 0.19.0.

## What passed

| Test | Result |
| --- | --- |
| Capture the screen | Worked. Between 26 and 99 ms across runs |
| Freeze: load the screenshot and show the stage | 38 to 82 ms |
| Live demo scene, real time | Played to the end in 32.6 s with no error |
| Esc during the scene | Scene ended and restored about 0.9 s after the abort |
| Recorded demo scene, stepped clock | 976 frames at 30 per second. Script work averaged 1.4 ms per frame |
| Restore | The restored screen was byte-for-byte identical to the frozen screen |
| Split an equation into addressable terms | Works with KaTeX `\htmlId`, with `trust` limited to that command. About 0.5 ms per render |
| Bad LaTeX | Caught as an error |
| Parse a streamed script, one move per line | Correct at every possible break point. The first move is ready before the stream ends. A junk line is skipped |
| Reject a bad move | A `match` naming a missing term throws |
| Global hotkey | Registered |
| Key-release listener | `uiohook-napi` loads inside Electron and ships a ready-built Windows x64 file |
| Image token formula | Matches the three examples in the model documentation |

`npm test` runs the twelve checks that need no screen. `npm run record` runs the scene and the restore check.

## What the numbers mean

- The 16.7 ms available per frame at 60 frames a second covers both script work and drawing. Only script work was measured (1.4 ms). Drawing cost, especially the full-screen blur, is unknown on a real GPU.
- The recording was stepped one frame at a time, so it shows the motion as designed, not how smooth it will be live.
- Freeze time is dominated by encoding the screenshot as PNG and decoding it again. If it is too slow at high resolution, pass JPEG or share the image without encoding.

## Known issues in the prototype

- Piece positions come from the sample page, not from the user.
- Every position in the demo script is a hand-picked pixel coordinate.
- When the live text's spacing differs from the photo's, the landing shows a brief double image.
- Abort finishes the current move at high speed before restoring, so it is not instant.
- Only the primary display is captured.
- The stage keeps no record of what is on it that could be sent to a model.

## Not tested

- Display scaling above 100% and more than one monitor, on Windows.
- Any model call: speed to first move, whether terms are matched to the right lines, whether a cropped equation comes back as good LaTeX. No API key was available.
- Speech to text and any voice output.
- An installer, signed or unsigned.
- ManimGL and Manim-Web. Neither was installed.
- Tauri.

## Cost model

`prototype/test_core.js` contains the cost estimate. With the stated assumptions it gives, per five-question scene: model $0.0016, speech to text $0.0017, paid voice $0.064. The assumptions are guesses about token counts and speech length. The pieces in the test were smaller than assumed (28 and 60 image tokens against 505), so the model figure is on the high side.
