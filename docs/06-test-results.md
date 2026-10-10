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
