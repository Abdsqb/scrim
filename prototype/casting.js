// Casting: one vision model call that picks the pieces of the screen a question is about and reads them: equations, code, text,
// tables, or figures (which are not read, only moved).
// The reply streams one JSON object per line, one line per piece, so the first piece can lift before the rest arrive.
// The model's boxes are rough, so snap() tightens each one to the content on screen before it is lifted.
const katex = require('katex');

const MODEL = 'claude-haiku-5-5';

// Kept identical for every request of a given image size, so the prompt cache can reuse it.
const system = (W, H) => `You look at a screenshot of a student's screen, find the pieces of their course material that their question is about, and convert each piece into structured content. Any subject: math, code, science, business, history, anything.

The screenshot is ${W} by ${H} pixels. Boxes are [x, y, width, height] in those pixels, with 0,0 at the top left.

Reply with one JSON object per line, one line per piece, most important first. No other text, no code fences, no blank lines.

For an equation or expression:
{"piece":"p1","kind":"equation","box":[x,y,w,h],"tex":"...","terms":[{"id":"...","tex":"..."}, ...]}

For code or pseudocode:
{"piece":"p2","kind":"code","box":[x,y,w,h],"lines":["...", "..."]}

For a passage of text, such as a paragraph, a bullet point, a definition or a short list:
{"piece":"p3","kind":"text","box":[x,y,w,h],"lines":["...", "..."],"terms":[{"id":"...","text":"..."}, ...]}

For a table:
{"piece":"p4","kind":"table","box":[x,y,w,h],"rows":[["...", "..."], ...]}

For a chart, diagram, photo or anything else that is a picture rather than text:
{"piece":"p5","kind":"figure","box":[x,y,w,h],"about":"..."}

If nothing on screen matches the question:
{"kind":"none","reason":"..."}

Choosing pieces:
- Pick what answers the question and nothing else. At most four pieces.
- For a question about a concept ("I don't understand X", "what is X"), pick the passage that defines or explains X, plus a table, figure or equation on screen only if it shows X directly.
- Pick the smallest piece that holds the answer: the one bullet or paragraph about X, not the whole slide or page, unless the question is about all of it.
- "this equation" means one equation. "how this equation fits into this algorithm" means one equation and one algorithm. If the question names two things, return both, even when one is asked about inside the other ("where does this formula appear in this code" means the formula and the code).
- When several similar pieces are visible, pick the ones the question names or describes, not the ones that merely look alike.
- Prefer the main reading area over toolbars, menus, sidebars, tabs, notifications and other windows.
- The box must enclose the whole piece with a small margin. It does not need to be exact; the app tightens it.
- Start your reply with the first JSON line. Do not explain your choice.

Rules for equations:
- Reproduce the equation exactly as shown in tex. Do not simplify, reorder or correct it.
- An equation runs to the end of its line: include conditions and base cases written beside it. "a_n = 2a_{n-1}, \\quad a_0 = 1" is one equation, not two.
- tex is the whole equation in one LaTeX string, every symbol included.
- terms: up to eight parts a student might ask about, such as one side, a function, an argument, a term of a sum or a numerator, each copied character for character from tex, with a short id made of letters, such as "lhs", "fn" or "arg".
- Use standard LaTeX that KaTeX supports. No \\htmlId, no \\href, no macros.

Rules for code:
- One string per line, in order. Keep indentation as spaces.
- Do not add, remove or fix anything.

Rules for text:
- One string per paragraph or bullet point, in reading order, word for word. Leave out the bullet symbol itself.
- terms: up to six key words or phrases from the passage that matter for the question, each copied exactly as it appears in one of the lines, with a short id such as "equity" or "assets".

Rules for tables:
- One array per row, top to bottom, one string per cell, left to right, exactly as shown. Include the header row. At most 20 rows and 8 columns.

Rules for figures:
- about: one short sentence saying what the picture shows.`;

// One JSON object per line, parsed as chunks arrive. The same parser is checked in test_core.js.
function lineParser(onLine, onBad) {
  let buf = '';
  // Models occasionally write a number with a leading zero ("070"), which JSON forbids; that one slip is forgiven.
  const parse = (line) => { try { return JSON.parse(line); } catch { return JSON.parse(line.replace(/([[,:]\s*)0+(\d)/g, '$1$2')); } };
  const take = (line) => { line = line.trim(); if (!line) return; let v; try { v = parse(line); } catch { return onBad(line); } onLine(v); };
  return {
    push(chunk) { buf += chunk; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); take(line); } },
    end() { const line = buf; buf = ''; take(line); },
  };
}

const KOPT = { trust: (c) => c.command === '\\htmlId', strict: false, throwOnError: true, output: 'html' };
const KINDS = ['equation', 'code', 'text', 'table', 'figure'];
const isStrings = (a, max) => Array.isArray(a) && a.length > 0 && a.length <= max && a.every((s) => typeof s === 'string');
// An equation arrives whole, as one LaTeX string, with terms copied out of it. Models write equations reliably but cut them into
// parts badly (a fraction's numerator and denominator in separate parts), so the cutting happens here instead.
// equationParts() cuts the equation at each term that sits at the top level, so the stage can move that term on its own. A term
// nested inside a structure, such as one side of a fraction, is tagged in place with \htmlId and stays where it is. Ids get `prefix`.
// If any part fails to render on its own, the whole equation becomes one part: a correct equation beats one that can animate.
const OPWORDS = 'le|ge|leq|geq|ne|neq|approx|equiv|to|gets|leftarrow|rightarrow|Leftarrow|Rightarrow|Leftrightarrow|mapsto|cdot|times|pm|mp|in|propto|sim|mid';
const OP_START = new RegExp(`^(?:[=+\\-<>]|\\\\(?:${OPWORDS})(?![a-zA-Z]))`), OP_END = new RegExp(`(?:[=+\\-<>]|\\\\(?:${OPWORDS}))$`);
function depthAt(tex, i) { let d = 0; for (let k = 0; k < i; k++) { if (tex[k] === '\\') { k++; continue; } if (tex[k] === '{') d++; else if (tex[k] === '}') d--; } return d; }
const balanced = (t) => depthAt(t, t.length) === 0;
const renders = (tex) => { try { katex.renderToString(tex, KOPT); return true; } catch { return false; } };
const tagged = (tex, terms, prefix) => terms.reduce((t, term) => t.replace(term.tex, `\\htmlId{${prefix}${term.id}}{${term.tex}}`), tex);
function equationParts(p, prefix = '') {
  const tex = p.tex, found = [];
  for (const t of p.terms || []) { const at = tex.indexOf(t.tex); if (at >= 0) found.push({ ...t, at, end: at + t.tex.length }); }
  found.sort((a, b) => a.at - b.at);
  const cuts = [], inner = [];
  for (const t of found) (depthAt(tex, t.at) === 0 && (!cuts.length || t.at >= cuts[cuts.length - 1].end) ? cuts : inner).push(t);
  const parts = [], plain = (seg) => {           // the text between terms: an operator alone keeps its spacing with {} on each side
    let s = seg.replace(/^\s+/, '').replace(/(?<!\\)\s+$/, ''); if (!s) return;   // keep the space in a trailing "\ "
    if (OP_START.test(s)) s = '{}' + s; if (OP_END.test(s)) s = s + '{}';
    parts.push({ tex: s });
  };
  let from = 0;
  for (const t of cuts) { plain(tex.slice(from, t.at)); parts.push({ id: prefix + t.id, tex: t.tex }); from = t.end; }
  plain(tex.slice(from));
  for (const t of inner) {                         // tag nested terms inside whichever part holds them
    const q = parts.find((pp) => pp.tex.includes(t.tex)); if (!q) continue;
    q.tex = q.tex.replace(t.tex, `\\htmlId{${prefix}${t.id}}{${t.tex}}`); (q.inner = q.inner || []).push({ id: prefix + t.id, tex: t.tex });
  }
  for (const q of parts) if (/\\left(?![a-zA-Z])/.test(q.tex) !== /\\right(?![a-zA-Z])/.test(q.tex)) q.tex = q.tex.replace(/\\(left|right)(?![a-zA-Z])/g, '\\big');
  if (parts.every((q) => renders(q.tex)) && renders(parts.map((q) => q.tex).join(' '))) return parts;
  const whole = tagged(tex, found, prefix);
  return renders(whole) ? [{ tex: whole, inner: found.map((t) => ({ id: prefix + t.id, tex: t.tex })) }] : [{ tex }];
}

// Each returns an error message, or null if that much of the piece is safe to put on stage.
function validateBox(p, W, H) {
  if (!p || !KINDS.includes(p.kind)) return 'unknown kind ' + (p && p.kind);
  const b = p.box;
  if (!Array.isArray(b) || b.length !== 4 || !b.every(Number.isFinite)) return 'box is not [x,y,w,h]';
  if (b[2] < 12 || b[3] < 12 || b[0] < 0 || b[1] < 0 || b[0] + b[2] > W + 2 || b[1] + b[3] > H + 2) return 'box is tiny or off screen';
  return null;
}
const validate = (p, W, H) => validateBox(p, W, H) || validateContent(p);
function validateContent(p) {
  if (p.kind === 'equation') {
    if (typeof p.tex !== 'string' || !p.tex.trim()) return 'equation has no tex';
    // KaTeX already renders these harmlessly with trust limited, but Casting has no reason to send them, so refuse outright.
    if (/\\(href|url|html[a-zA-Z]*|includegraphics)(?![a-zA-Z])/.test(p.tex)) return 'link or HTML command in LaTeX: ' + p.tex;
    if (!renders(p.tex)) return 'bad LaTeX: ' + p.tex;
    // Term ids go into \htmlId{...}, so they are letters, digits and dashes only. A term must be a whole piece of the equation.
    const seen = new Set();
    p.terms = (Array.isArray(p.terms) ? p.terms : []).filter((t) => t && typeof t.id === 'string' && /^[A-Za-z][A-Za-z0-9-]{0,20}$/.test(t.id)
      && typeof t.tex === 'string' && t.tex.trim() && p.tex.includes(t.tex) && balanced(t.tex) && !seen.has(t.id) && seen.add(t.id)).slice(0, 8);
    p.parts = equationParts(p);
  } else if (p.kind === 'code') {
    if (!isStrings(p.lines, 60)) return 'code has no lines';
  } else if (p.kind === 'text') {
    if (!isStrings(p.lines, 30) || p.lines.join('').length > 3000) return 'text has no lines, or too many';
    // A term the stage cannot find in the text is useless to the Director, so keep only those that appear word for word.
    const all = p.lines.join('\n'), seen = new Set();
    p.terms = (Array.isArray(p.terms) ? p.terms : []).filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string' && t.text && all.includes(t.text) && !seen.has(t.id) && seen.add(t.id)).slice(0, 6);
  } else if (p.kind === 'table') {
    if (!Array.isArray(p.rows) || !p.rows.length || p.rows.length > 20 || !p.rows.every((r) => isStrings(r, 8) && r.every((c) => c.length <= 200))) return 'table rows are not a grid of strings';
  } else if (p.kind === 'figure') {
    if (p.about != null && typeof p.about !== 'string') return 'figure about is not a string';
  }
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
function snap(px, W, H, box, { kind = 'equation', margin = 28, gap = 6, thresh = 20 } = {}) {
  if (kind === 'table' || kind === 'figure') return box;   // full of deliberate gaps (columns, a chart's white space): keep the model's box
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
    const first = rows[1] - rows[0], lines = kind === 'text' || kind === 'code';
    // Lines of text or code without a panel: the first block is one line, and the gap to the next line is about a line high.
    if (lines && first < 40) rows = run(rowHas, y0, y1, Y0, Y1, Math.min(28, Math.max(gap, 0.9 * first)));
    else if (!lines && first < 90) rows = run(rowHas, y0, y1, Y0, Y1, Math.min(12, Math.max(gap, 0.25 * first)));
    const side = lines ? 30 : rows[1] - rows[0] < 130 ? Math.max(24, 2.5 * (rows[1] - rows[0])) : gap + 2;
    const cols = run((xx) => colInk(xx, rows[0], rows[1]), x0, x1, X0, X1, side);
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

module.exports = { MODEL, system, lineParser, validate, validateBox, validateContent, equationParts, snap, cast };
