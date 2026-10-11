// Casting accuracy test: sends each sample screen and its question to the model, scores the reply against samples/truth.json,
// and writes samples/cast-report.html with the true, model and snapped boxes drawn on each screen.
//   npm run cast                     all screens
//   npm run cast -- --only=01        screens whose file name starts with 01
//   npm run cast -- --model=claude-sonnet-5-5 --effort=medium --width=1920
//   npm run cast -- --thinking=off --format=boxes-first   speed experiments: no thinking; every box before any content
//   npm run cast -- --dry            no API call: jitters the true boxes by up to 20 px and checks that snapping fixes them
// Every call costs money, so a run stops after --max-calls (default 12). Needs ANTHROPIC_API_KEY in .env.
const { app, nativeImage } = require('electron');
const fs = require('fs'), path = require('path');
const Anthropic = require('@anthropic-ai/sdk').default;
const casting = require('../prototype/casting');

const arg = (name, def) => { const a = process.argv.find((s) => s.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : def; };
const THINK = arg('thinking', 'on'), BOXES_FIRST = arg('format', 'one-line') === 'boxes-first';
const DRY = process.argv.includes('--dry'), ONLY = arg('only', ''), MODEL = arg('model', casting.MODEL), EFFORT = arg('effort', 'low'), SEND_W = Number(arg('width', 0)), MAX_CALLS = Number(arg('max-calls', 12));
const PRICE = { 'claude-haiku-5-5': [0.10, 0.50, 0.01], 'claude-sonnet-5-5': [2, 10, 0.20], 'claude-opus-5-5': [4, 20, 0.20] };   // $ per million: in, out, cache read
const ROOT = path.join(__dirname, '..'), S = path.join(ROOT, 'samples');
const iou = (a, b) => { const x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]), x1 = Math.min(a[0] + a[2], b[0] + b[2]), y1 = Math.min(a[1] + a[3], b[1] + b[3]);
  const i = Math.max(0, x1 - x0) * Math.max(0, y1 - y0); return i / (a[2] * a[3] + b[2] * b[3] - i); };
// Did Casting read the piece completely? Equations: the same brackets, commas and operators as the original, ignoring sizing
// commands like \big and \left and spacing like \, (which is not a comma). Code: the same lines, ignoring trailing spaces.
const symbols = (tex) => (tex.replace(/\\(big|Big|bigg|Bigg|left|right)[lr]?(?![a-zA-Z])/g, '').replace(/\\[,;:! ]/g, ' ').match(/[()\[\],=+\-<>|]/g) || []).sort().join('');
function readOk(p, q) {
  if (!p.read && p.read !== undefined) return false;
  if (q.kind === 'equation') return !!p.parts && symbols(p.parts.map((r) => r.tex).join(' ')) === symbols(q.tex);
  return !!p.lines && JSON.stringify(p.lines.map((l) => l.trimEnd())) === JSON.stringify(q.lines.map((l) => l.trimEnd()));
}
const edgeErr = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[0] + a[2] - b[0] - b[2]), Math.abs(a[1] + a[3] - b[1] - b[3]));

let seed = 7;                                         // the dry run's jitter repeats from run to run, so changes to snap() compare fairly
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

app.whenReady().then(async () => {
  try {
    if (!DRY) process.loadEnvFile(path.join(ROOT, '.env'));
    const client = DRY ? null : new Anthropic();
    const truth = JSON.parse(fs.readFileSync(path.join(S, 'truth.json'))).filter((t) => t.file.startsWith(ONLY));
    if (!truth.length) throw new Error(`no sample matches --only=${ONLY}. Run npm run samples first.`);
    if (truth.length > MAX_CALLS) throw new Error(`${truth.length} screens but --max-calls=${MAX_CALLS}`);
    const price = PRICE[MODEL] || PRICE['claude-haiku-5-5'];
    console.log(DRY ? `[cast] ${truth.length} screen(s), dry run: no API calls` : `[cast] ${truth.length} screen(s), ${MODEL}, effort ${EFFORT}, thinking ${THINK}, ${BOXES_FIRST ? 'boxes first' : 'one line per piece'}, sent at ${SEND_W || 'full'} px wide`);
    const results = [];
    let spent = 0;
    for (const t of truth) {
      const img = nativeImage.createFromPath(path.join(S, t.file)), { width: W, height: H } = img.getSize();
      const sendW = SEND_W || Math.min(W, 2576);       // default: full resolution, up to the model's limit
      const k = W / sendW, sent = sendW === W ? img : img.resize({ width: sendW, quality: 'best' }), sw = sent.getSize().width, sh = sent.getSize().height;
      const px = img.toBitmap();
      const pieces = [], bad = [];
      const t0 = performance.now(); let tFirst = null;
      const parser = casting.lineParser((p) => {
        if (p.kind === 'none') { bad.push('none: ' + p.reason); return; }
        const reject = (err) => { bad.push(err); console.log('[cast]   rejected: ' + JSON.stringify(p).slice(0, 300)); };
        if (!p.box && p.piece) {                         // boxes-first: the content of a piece whose box came earlier
          const q = pieces.find((pp) => pp.piece === p.piece); if (!q) return reject('content for unknown piece ' + p.piece);
          const err = casting.validateContent({ ...q, ...p }); if (err) return reject(err);
          Object.assign(q, p, { box: q.box, snapped: q.snapped }); q.read = true; return;
        }
        const err = BOXES_FIRST ? casting.validateBox(p, sw, sh) : casting.validate(p, sw, sh); if (err) return reject(err);
        if (tFirst == null) tFirst = performance.now() - t0;
        const box = p.box.map((v) => v * k);            // back to screen pixels
        pieces.push({ ...p, box, snapped: casting.snap(px, W, H, box), read: !BOXES_FIRST });
      }, (line) => bad.push('not JSON: ' + line.slice(0, 80)));
      if (DRY) {                                        // a pretend model whose boxes are off by up to 20 px on each edge
        const j = (size) => (rand() * 2 - 1) * Math.min(20, 0.25 * size);   // never so far that a small piece turns inside out
        for (const id of t.expect) { const q = t.pieces.find((qq) => qq.id === id), [x, y, w, h] = q.box, x0 = x + j(w), y0 = y + j(h), x1 = x + w + j(w), y1 = y + h + j(h);
          parser.push(JSON.stringify(q.kind === 'equation' ? { kind: 'equation', box: [x0, y0, x1 - x0, y1 - y0].map((v) => v / k), parts: [{ tex: 'x' }] } : { kind: 'code', box: [x0, y0, x1 - x0, y1 - y0].map((v) => v / k), lines: ['x'] }) + '\n'); }
        parser.end();
      }
      const stream = DRY ? null : client.messages.stream({
        model: MODEL, max_tokens: 8000, output_config: { effort: EFFORT }, ...(THINK === 'off' ? { thinking: { type: 'disabled' } } : {}),
        system: [{ type: 'text', text: casting.system(sw, sh, { boxesFirst: BOXES_FIRST }), cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'QUESTION\n' + t.question },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: sent.toPNG().toString('base64') } },
        ] }],
      });
      if (stream) { for await (const ev of stream) if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') parser.push(ev.delta.text); parser.end(); }
      for (const p of pieces) if (!p.read) bad.push(`no content came for ${p.piece}`);
      const msg = stream ? await stream.finalMessage() : { usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: 'dry' }, u = msg.usage, total = performance.now() - t0;
      const cost = ((u.input_tokens + (u.cache_creation_input_tokens || 0) * 1.25) * price[0] + (u.cache_read_input_tokens || 0) * price[2] + u.output_tokens * price[1]) / 1e6;
      spent += cost;

      // Score: each model piece is matched to the true piece it overlaps most.
      const near = (b, q) => Math.max(iou(b, q.box), q.text ? iou(b, q.text) : 0);   // a code piece may be boxed by its panel or by its text
      for (const p of pieces) { let best = null; for (const q of t.pieces) { const v = near(p.box, q); if (!best || v > best.v) best = { q, v }; } p.match = best && best.v > 0.1 ? best.q.id : null; }
      const found = t.expect.map((id) => { const p = pieces.find((pp) => pp.match === id), q = t.pieces.find((qq) => qq.id === id);
        const tb = (b) => (q.text && iou(b, q.text) > iou(b, q.box) ? q.text : q.box);   // score against whichever box the answer is closer to
        return p ? { id, raw: near(p.box, q), snapped: near(p.snapped, q), rawEdge: edgeErr(p.box, tb(p.box)), snapEdge: edgeErr(p.snapped, tb(p.snapped)), read: DRY || readOk(p, q) } : { id, missing: true }; });
      const extra = pieces.filter((p) => !t.expect.includes(p.match)).map((p) => p.match || 'nothing');
      const right = found.every((f) => !f.missing) && !extra.length;
      results.push({ t, pieces, found, extra, right, bad, tFirst, total, u, cost, stop: msg.stop_reason });
      console.log(`[cast] ${t.file}: ${right ? 'RIGHT PIECES' : 'WRONG PIECES'}` +
        found.map((f) => f.missing ? ` | ${f.id} missed` : ` | ${f.id} IoU ${f.raw.toFixed(2)} -> ${f.snapped.toFixed(2)} snapped (worst edge ${Math.round(f.rawEdge)} -> ${Math.round(f.snapEdge)} px)${f.read ? '' : ', READ WRONG'}`).join('') +
        (extra.length ? ` | extra: ${extra.join(', ')}` : '') + (bad.length ? ` | rejected: ${bad.join('; ')}` : ''));
      console.log(`[cast]   first piece ${tFirst == null ? '-' : (tFirst / 1000).toFixed(2) + ' s'}, done ${(total / 1000).toFixed(2)} s | tokens ${u.input_tokens} in (+${u.cache_read_input_tokens || 0} cached), ${u.output_tokens} out | $${cost.toFixed(5)}`);
    }

    const n = results.length, ok = results.filter((r) => r.right).length, all = results.flatMap((r) => r.found.filter((f) => !f.missing));
    const avg = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    console.log(`[cast] SUMMARY right pieces on ${ok}/${n} | read completely ${all.filter((f) => f.read).length}/${all.length} | mean IoU ${avg(all.map((f) => f.raw)).toFixed(2)} raw, ${avg(all.map((f) => f.snapped)).toFixed(2)} snapped` +
      ` | mean first piece ${(avg(results.filter((r) => r.tFirst != null).map((r) => r.tFirst)) / 1000).toFixed(2)} s | spent $${spent.toFixed(4)}`);
    fs.writeFileSync(path.join(S, 'cast-report.html'), report(results, { MODEL, EFFORT: `${EFFORT}, thinking ${THINK}${BOXES_FIRST ? ', boxes first' : ''}`, SEND_W, spent }));
    fs.writeFileSync(path.join(S, 'cast-results.json'), JSON.stringify(results.map((r) => ({ file: r.t.file, right: r.right, found: r.found, extra: r.extra, rejected: r.bad,
      pieces: r.pieces.map(({ piece, kind, box, snapped, match, parts, lines }) => ({ piece, kind, match, box: box.map(Math.round), snapped, parts, lines })) })), null, 2));
    console.log('[cast] report: ' + path.join(S, 'cast-report.html'));
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) console.log('[cast] ERROR the API key was rejected. Check .env');
    else if (e instanceof Anthropic.APIError) console.log(`[cast] ERROR API ${e.status}: ${e.message}`);
    else console.log('[cast] ERROR', e.stack || e);
    process.exitCode = 1;
  }
  app.quit();
});

function report(results, o) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rect = (b, W, H, cls, label) => `<div class="b ${cls}" style="left:${b[0] / W * 100}%;top:${b[1] / H * 100}%;width:${b[2] / W * 100}%;height:${b[3] / H * 100}%">${label ? `<span>${esc(label)}</span>` : ''}</div>`;
  const cards = results.map((r) => { const { W, H } = { W: r.t.size.width, H: r.t.size.height };
    const boxes = r.t.pieces.map((q) => rect(q.box, W, H, r.t.expect.includes(q.id) ? 'truth' : 'decoy', q.id)).join('') +
      r.pieces.map((p) => rect(p.box, W, H, 'raw', '') + rect(p.snapped, W, H, 'snap', '')).join('');
    const read = r.pieces.filter((p) => p.read).map((p) => `<pre>${esc(p.kind === 'equation' ? p.parts.map((q) => (q.id ? `[${q.id}] ` : '') + q.tex).join('  ') : p.lines.join('\n'))}</pre>`).join('');
    return `<section><h2>${esc(r.t.file)} <em class="${r.right ? 'ok' : 'no'}">${r.right ? 'right pieces' : 'wrong pieces'}</em></h2><p class="q">“${esc(r.t.question)}”</p>
      <div class="shot"><img src="${esc(r.t.file)}">${boxes}</div>
      <p>${r.found.map((f) => f.missing ? `<b>${f.id}</b> missed` : `<b>${f.id}</b> IoU ${f.raw.toFixed(2)} → ${f.snapped.toFixed(2)} snapped`).join(' · ')}${r.extra.length ? ` · extra: ${esc(r.extra.join(', '))}` : ''}${r.bad.length ? ` · rejected: ${esc(r.bad.join('; '))}` : ''}</p>
      <p class="m">first piece ${r.tFirst == null ? '–' : (r.tFirst / 1000).toFixed(2) + ' s'} · done ${(r.total / 1000).toFixed(2)} s · ${r.u.input_tokens} in, ${r.u.output_tokens} out · $${r.cost.toFixed(5)}</p>
      <details><summary>What it read</summary>${read}</details></section>`; }).join('');
  return `<!doctype html><meta charset="utf-8"><title>Casting report</title><style>
    body{font:15px/1.5 "Segoe UI",sans-serif;margin:24px auto;max-width:1000px;padding:0 16px;color:#1d2330;background:#f6f7f9}
    section{background:#fff;border:1px solid #e3e6ec;border-radius:10px;padding:16px 18px;margin:18px 0}h2{font-size:17px;margin:0}
    em{font-style:normal;font-size:12px;padding:2px 8px;border-radius:99px;margin-left:8px}.ok{background:#dcf5e3;color:#11602d}.no{background:#fde2e1;color:#8c1d18}
    .q{color:#555;margin:4px 0 10px}.m{color:#777;font-size:13px}.shot{position:relative}.shot img{width:100%;display:block;border:1px solid #ddd}
    .b{position:absolute;box-sizing:border-box}.b span{position:absolute;top:-17px;left:0;font:600 11px sans-serif}
    .truth{border:2px solid #14a44d}.truth span{color:#14a44d}.decoy{border:1px dashed #d33}.decoy span{color:#d33}.raw{border:2px solid #f08c00}.snap{border:2px solid #2f6fed}
    pre{background:#f3f4f7;padding:8px 10px;border-radius:6px;white-space:pre-wrap;font-size:13px}.legend span{margin-right:16px}
  </style><h1>Casting report</h1><p>${esc(o.MODEL)} · effort ${esc(o.EFFORT)} · image sent at ${o.SEND_W || "full resolution"}${o.SEND_W ? " px wide" : ""} · spent $${o.spent.toFixed(4)}</p>
  <p class="legend"><span style="color:#14a44d">■ true piece</span><span style="color:#d33">▢ decoy</span><span style="color:#f08c00">■ model box</span><span style="color:#2f6fed">■ after snapping</span></p>${cards}`;
}
