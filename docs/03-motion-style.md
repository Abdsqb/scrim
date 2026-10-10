# Look and motion

The scene should look like an explainer video made out of the user's own screen, in the style of the 3Blue1Brown videos. `media/explainer-scene.mp4` is the reference for everything below.

## The rules

| Rule | What happens on screen |
| --- | --- |
| Pieces leave first | The pieces lift off the sharp page with a shadow. Then the page shrinks, blurs and goes dark behind them. This order is what makes it read as "my screen came apart" |
| The photo becomes live text | A lifted piece is scaled until its text is the same size as the live version, lands exactly on it, and turns from dark-on-light to light-on-dark |
| One easing curve | Every motion uses the same slow-in, slow-out curve |
| New math writes itself | Each character is outlined, then filled, left to right |
| Nothing teleports | When a term is used somewhere else, a copy travels there along an arc |
| Color means a pairing | A term and the thing it stands for share one color, with a brace and a label under the term |
| Symbols turn into values | A term is replaced in place and its neighbors slide to make room |
| Results get a flash | The final value swells once and short rays fire around it |
| No boxes around math | Math and code float on the dark scene. No cards or panels |

## Values

**Easing.** The default curve, taken from Manim:

```js
const smooth = (t) => { const s = 1 - t; return t*t*t * (10*s*s + 5*s*t + t*t); };
```

Also in use: `rushFrom` (fast start, soft landing) for the lift, and `thereAndBack` for swells.

**Colors.** From Manim's palette, with a softer yellow.

| Name | Hex |
| --- | --- |
| white | `#ffffff` |
| blue | `#58C4DD` |
| teal | `#5CD0B3` |
| green | `#83C167` |
| yellow | `#FFE94E` |
| gold | `#F0AC5F` |
| red | `#FC6255` |
| pink | `#D147BD` |
| grey | `#9aa0ab` |

**Backdrop.** The page scales to 0.95, with blur 9px, brightness 0.32, saturation 0.5, under a dark vignette.

**Type.** Math in KaTeX, which uses the Computer Modern family that LaTeX defaults to. Main equation 46px, worked examples 34px, given values 24px in grey. Code in a monospace face at 22px with grey line numbers. Caption 23px sans, centered, near the bottom.

**Timings (milliseconds).**

| Motion | Duration |
| --- | --- |
| Lift | 380 |
| Recede | 900 |
| Photo flying to its live position | 1000, crossfade over the middle 60% |
| Write, per character | 380 to 420, staggered 45 to 55 |
| Split | 650 |
| Match: color and swell | 520 |
| Match: brace | 420 |
| Match: copy flying to the code | 980 |
| Swap | 520 |
| Flash | 620 |
| Restore | 380 fade, then 800 for the page |
| Default pause after a move | 260 |

## How each effect is done

- **Lift.** Two copies of the cropped screenshot sit exactly over the original spot. One is the normal crop. The other is inverted, high-contrast and blended with "screen", so only its light text shows. The normal one fades out as the inverted one fades in.
- **Landing on the live text.** `inkBox` scans the crop for pixels that differ from its background and returns the box around the actual text. The crop is scaled so that box matches the width of the live text, and positioned so the two coincide.
- **Write.** Each character's fill starts transparent with a thin outline. The outline fades up and then down while the fill fades in.
- **Flying copy.** A separate rendering of the term is placed exactly over the original using the box around its characters, then moved along a curved path while it scales and fades.
- **Swap.** The positions of every part in the row are measured before and after the change. Neighbors are shifted back to where they were and eased to where they now belong.

## Why not ManimGL

ManimGL is the library those videos are made with. It is open source under the MIT license, so using it is allowed. It does not fit the live scene:

- It is a separate Python program that draws in its own window or writes a video file. It cannot draw over a frozen screenshot and respond within a second.
- Every user would need Python 3.10, FFmpeg and, for equations, a LaTeX installation shipped with the app.
- The model would have to write Python that then runs on the user's PC. That fails more often than a list of moves, and running model-written code needs a locked-down sandbox.

ManimGL has not been installed or timed for this project, so the speed point comes from how it is designed.

What this project does is borrow the design: the easing formula, the palette, and the behavior of the named animations, written again in JavaScript. No ManimGL code runs in the app. If actual code is ever copied from it, the MIT license asks for its copyright notice to be included.

Describe the look as inspired by those videos. Do not use the 3Blue1Brown name or logo in a way that suggests the creator is involved.

## Where better visuals can come from later

- **Sharper equations.** MathJax 4 can output equations as vector outlines. That allows true stroke-by-stroke drawing and one shape morphing into another, which KaTeX text cannot do.
- **Graphs and 3D.** Manim-Web is an MIT-licensed TypeScript port of Manim that runs in the browser (version 0.3.24 when checked). Early users reported flicker and fuzzy text, and its author says the code was generated by an AI agent. Try it on one scene before depending on it.
- **A full rendered video.** A "make me a video on this" feature could run real ManimGL on a server, where a wait of a minute is acceptable.

## Open questions about the look

- The recording was stepped frame by frame, so it shows the motion as designed. How smoothly it plays live on an ordinary laptop is untested. The blur on a full-screen image is the most likely cost.
- Fonts differ by system. The recording used DejaVu faces. On Windows the fallbacks are Segoe UI and Consolas.
- When a lifted photo's text and the live text differ in spacing, the landing shows a brief double image.
