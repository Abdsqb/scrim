// Casting: one vision model call that picks the pieces of the screen a question is about and reads them.
// The reply streams one JSON object per line, one line per piece, so the first piece can lift before the rest arrive.
// The model's boxes are rough, so snap() tightens each one to the content on screen before it is lifted.
const katex = require('katex');

const MODEL = 'claude-haiku-5-5';

// Kept identical for every request of a given image size, so the prompt cache can reuse it.
// boxesFirst: every piece's box comes before any content, so pieces can lift while the model is still reading them.
const system = (W, H, { boxesFirst = false } = {}) => `You look at a screenshot of a student's screen, find the pieces of their course material that their question is about, and convert each piece into structured content.

The screenshot is ${W} by ${H} pixels. Boxes are [x, y, width, height] in those pixels, with 0,0 at the top left.

${boxesFirst ? `Reply with one JSON object per line. No other text, no code fences, no blank lines.

First, one line per piece with only where it is, most important first:
{"piece":"p1","kind":"equation","box":[x,y,w,h]}
{"piece":"p2","kind":"code","box":[x,y,w,h]}

Then, for each piece in the same order, one line with its content:
{"piece":"p1","parts":[{"id":"...","tex":"..."}, ...]}
{"piece":"p2","lines":["...", "..."]}
` : `Reply with one JSON object per line, one line per piece, most important first. No other text, no code fences, no blank lines.

For an equation or expression:
{"piece":"p1","kind":"equation","box":[x,y,w,h],"parts":[{"id":"...","tex":"..."}, ...]}

For code or pseudocode:
{"piece":"p2","kind":"code","box":[x,y,w,h],"lines":["...", "..."]}
`}
If nothing on screen matches the question:
{"kind":"none","reason":"..."}

Choosing pieces:
- Pick only what the question refers to. "this equation" means one equation. "how this equation fits into this algorithm" means one equation and one algorithm. At most four pieces.
- When several equations or code blocks are visible, pick the ones the question names or describes, not the ones that merely look similar.
- If the question names two things, such as a formula and code, or an equation and an algorithm, return both, even when one is asked about inside the other ("where does this formula appear in this code" means the formula and the code).
- Start your reply with the first JSON line. Do not explain your choice.
- Prefer the main reading area over toolbars, sidebars, notifications and other windows.
- The box must enclose the whole piece with a small margin. It does not need to be exact; the app tightens it.

Rules for equations:
- Reproduce the equation exactly as shown. Do not simplify, reorder or correct it.
- An equation runs to the end of its line: include conditions and base cases written beside it, such as ", F(0) = 0".
- Split it into parts in reading order. Joined together, the parts must reproduce every symbol of the original, nothing left out.
- A part is one meaningful unit: one side of an equation, an operator name, one argument of a function, a summand.
- Brackets, commas and bare operators are parts too, without an id. Give a short id to every other part a student might ask about, such as "lhs", "fn", "arg1".
- Example: f(x) = \\max(0,\\ x) becomes [{"id":"lhs","tex":"f(x)"},{"tex":"{}={}"},{"id":"fn","tex":"\\\\max"},{"tex":"\\\\big("},{"id":"arg1","tex":"0"},{"tex":",\\\\ "},{"id":"arg2","tex":"x"},{"tex":"\\\\big)"}]
- Write an operator that stands alone with empty groups on both sides so spacing is kept, for example {}={}.- Use standard LaTeX that KaTeX supports. No \\htmlId, no \\href, no macros.

Rules for code:
- One string per line, in order. Keep indentation as spaces.
- Do not add, remove or fix anything.`;

// One JSON object per line, parsed as chunks arrive. The same parser is checked in test_core.js.
function lineParser(onLine, onBad) {
  let buf = '';
  const take = (line) => { line = line.trim(); if (!line) return; let v; try { v = JSON.parse(line); } catch { return onBad(line); } onLine(v); };
  return {
    push(chunk) { buf += chunk; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); take(line); } },
    end() { const line = buf; buf = ''; take(line); },
  };
}

const KOPT = { trust: (c) => c.command === '\\htmlId', strict: false, throwOnError: true, output: 'html' };
// The stage renders every part on its own, so a bracket split into its own part cannot use \left( ... \right), which only work
// as a pair. Models do split them, and prompting against it made things worse, so a lone \left or \right becomes \big.
function repair(p) {
  for (const q of p.parts) if (typeof q.tex === 'string' && (/\\left(?![a-zA-Z])/.test(q.tex) !== /\\right(?![a-zA-Z])/.test(q.tex)))
    q.tex = q.tex.replace(/\\(left|right)(?![a-zA-Z])/g, '\\big');
}

// Each returns an error message, or null if that much of the piece is safe to put on stage.
function validateBox(p, W, H) {
  if (!p || (p.kind !== 'equation' && p.kind !== 'code')) return 'unknown kind ' + (p && p.kind);
  const b = p.box;
  if (!Array.isArray(b) || b.length !== 4 || !b.every(Number.isFinite)) return 'box is not [x,y,w,h]';
  if (b[2] < 12 || b[3] < 12 || b[0] < 0 || b[1] < 0 || b[0] + b[2] > W + 2 || b[1] + b[3] > H + 2) return 'box is tiny or off screen';
  return null;
}
const validate = (p, W, H) => validateBox(p, W, H) || validateContent(p);
function validateContent(p) {
  if (p.kind === 'equation' && Array.isArray(p.parts)) repair(p);
  if (p.kind === 'equation') {
    if (!Array.isArray(p.parts) || !p.parts.length) return 'equation has no parts';
    for (const q of p.parts) { if (typeof q.tex !== 'string') return 'part without tex';
      // KaTeX already renders these harmlessly with trust limited, but Casting has no reason to send them, so refuse outright.
      if (/\\(href|url|html[a-zA-Z]*|includegraphics)(?![a-zA-Z])/.test(q.tex)) return 'link or HTML command in LaTeX: ' + q.tex; try { katex.renderToString(q.tex, KOPT); } catch (e) { return 'bad LaTeX: ' + q.tex; } }
    // Joined with a space, or \Rightarrow followed by T(n) would read as the unknown command \RightarrowT.
    try { katex.renderToString(p.parts.map((q) => q.tex).join(' '), KOPT); } catch (e) { return 'parts do not join into valid LaTeX'; }
  } else if (!Array.isArray(p.lines) || !p.lines.length || !p.lines.every((l) => typeof l === 'string')) return 'code has no lines';
  return null;
}

// Tighten a rough box to the content under it. px is 4 bytes per pixel (channel order does not matter), W x H.
// Ink is anything that differs from the background colour around the box, including the faint tint of a code panel. Inside the box,
// ink is split into blocks wherever the background runs longer than `gap` pixels, and the biggest block wins, so a sliver of a
// neighbouring paragraph or cell at the edge is dropped. The block then grows outward over ink that continues within the gap, never
// more than `margin` beyond the rough box. Both gaps scale with the size of the content, because big equations have wide spaces
// between terms and limits set apart from the line; tall blocks such as code panels keep the small gap.
// If the block reaches the edge of the search area, it is running into neighbouring content (or a panel wider than the search, like
// a notebook cell), so the model's own box is kept: a slightly loose box looks fine when lifted, one that swallows a neighbour does not.
function snap(px, W, H, box, { margin = 28, gap = 6, thresh = 20 } = {}) {
  const [x, y, w, h] = box;
  const X0 = Math.max(0, Math.floor(x - margin)), Y0 = Math.max(0, Math.floor(y - margin));
  const X1 = Math.min(W, Math.ceil(x + w + margin)), Y1 = Math.min(H, Math.ceil(y + h + margin));
  const bins = new Map();                              // background: the most common colour on the edge of the search area
  const vote = (xx, yy) => { const i = (yy * W + xx) * 4, k = (px[i] >> 3) << 10 | (px[i + 1] >> 3) << 5 | px[i + 2] >> 3;
    const b = bins.get(k) || [0, 0, 0, 0]; b[0]++; b[1] += px[i]; b[2] += px[i + 1]; b[3] += px[i + 2]; bins.set(k, b); };
  for (let xx = X0; xx < X1; xx++) { vote(xx, Y0); vote(xx, Y1 - 1); }
  for (let yy = Y0; yy < Y1; yy++) { vote(X0, yy); vote(X1 - 1, yy); }
  const top = [...bins.values()].sort((a, b) => b[0] - a[0])[0], bg = [top[1] / top[0], top[2] / top[0], top[3] / top[0]];   // the bin's true mean colour
  const ink = (xx, yy) => { const i = (yy * W + xx) * 4; return Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > thresh; };
  const rowInk = (yy, a, b) => { for (let xx = a; xx < b; xx++) if (ink(xx, yy)) return true; return false; };
  const colInk = (xx, a, b) => { for (let yy = a; yy < b; yy++) if (ink(xx, yy)) return true; return false; };
  // The biggest inked block [lo, hi) inside [a, b), grown outward over gaps of at most g within [L, R).
  function run(has, a, b, L, R, g) {
    let lo = -1, hi = -1, s0 = -1, last = -1;
    const close = () => { if (s0 >= 0 && last + 1 - s0 > hi - lo) { lo = s0; hi = last + 1; } };
    for (let v = a; v < b; v++) if (has(v)) { if (s0 < 0 || v - last > g + 1) { close(); s0 = v; } last = v; }
    close();
    if (lo < 0) return null;
    for (let v = lo - 1, miss = 0; v >= L && miss <= g; v--) { if (has(v)) { lo = v; miss = 0; } else miss++; }
    for (let v = hi, miss = 0; v < R && miss <= g; v++) { if (has(v)) { hi = v + 1; miss = 0; } else miss++; }
    return [lo, hi];
  }
  let x0 = Math.max(X0, Math.round(x)), x1 = Math.min(X1, Math.round(x + w)), y0 = Math.max(Y0, Math.round(y)), y1 = Math.min(Y1, Math.round(y + h));
  for (let pass = 0; pass < 3; pass++) {
    const rowHas = (yy) => rowInk(yy, x0, x1);
    let rows = run(rowHas, y0, y1, Y0, Y1, gap); if (!rows) return box;
    if (rows[1] - rows[0] < 90) rows = run(rowHas, y0, y1, Y0, Y1, Math.min(12, Math.max(gap, 0.25 * (rows[1] - rows[0]))));
    const cols = run((xx) => colInk(xx, rows[0], rows[1]), x0, x1, X0, X1, rows[1] - rows[0] < 130 ? Math.max(24, 2.5 * (rows[1] - rows[0])) : gap + 2);
    if (!cols) return box;
    if (rows[0] === y0 && rows[1] === y1 && cols[0] === x0 && cols[1] === x1) break;
    [y0, y1, x0, x1] = [rows[0], rows[1], cols[0], cols[1]];
  }
  if ((x0 <= X0 && X0 > 0) || (y0 <= Y0 && Y0 > 0) || (x1 >= X1 && X1 < W) || (y1 >= Y1 && Y1 < H)) return box;
  return [x0, y0, x1 - x0, y1 - y0];
}

// Ask Casting about one screenshot. `client` is an Anthropic SDK client, `png` the screenshot as base64 at width x height.
// onPiece is called with each valid piece the moment its line arrives (boxes in the sent image's pixels); onReject with anything
// refused. Settings come from the accuracy tests in docs/06-test-results.md: thinking stays on at low effort, because without it the
// model picks decoys. Resolves with the token usage.
async function cast(client, { png, width, height, question, onPiece, onReject = () => {} }) {
  const parser = lineParser((p) => {
    if (p.kind === 'none') return onReject('nothing matches: ' + p.reason);
    const err = validate(p, width, height); if (err) return onReject(err);
    onPiece(p);
  }, (line) => onReject('not JSON: ' + line.slice(0, 80)));
  const stream = client.messages.stream({
    model: MODEL, max_tokens: 8000, output_config: { effort: 'low' },
    system: [{ type: 'text', text: system(width, height), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'QUESTION\n' + question },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png } },
    ] }],
  });
  for await (const ev of stream) if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') parser.push(ev.delta.text);
  parser.end();
  return (await stream.finalMessage()).usage;
}

module.exports = { MODEL, system, lineParser, validate, validateBox, validateContent, snap, cast };
