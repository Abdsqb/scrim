// Checks that need no screen and no network: equation splitting, streamed script parsing, and the cost model.
// Run with: npm test
const katex = require('katex');
const assert = require('assert');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message); } };

// ---------- 1. KaTeX: can each term be its own addressable element? ----------
const tex = String.raw`\htmlId{t-lhs}{d[v]} = \htmlId{t-min}{\min}\big(\htmlId{t-old}{d[v]},\ \htmlId{t-alt}{d[u] + w(u,v)}\big)`;
t('katex renders split equation with trust on', () => {
  const html = katex.renderToString(tex, { trust: true, strict: false, throwOnError: true, output: 'html' });
  for (const id of ['t-lhs', 't-min', 't-old', 't-alt']) assert(html.includes(`id="${id}"`), 'missing ' + id);
});
t('katex blocks \\htmlId when trust is off (so trust must be set, and scoped)', () => {
  const html = katex.renderToString(tex, { trust: false, strict: false, throwOnError: false, output: 'html' });
  assert(!html.includes('id="t-alt"'));
});
t('trust can be limited to htmlId only', () => {
  const opts = { trust: (ctx) => ctx.command === '\\htmlId', strict: false, throwOnError: false, output: 'html' };
  const ok = katex.renderToString(tex, opts);
  assert(ok.includes('id="t-alt"'));
  const bad = katex.renderToString(String.raw`\href{javascript:alert(1)}{x}`, opts);
  assert(!bad.includes('javascript:'), 'href should be blocked');
});
t('bad LaTeX from a model is catchable', () => {
  assert.throws(() => katex.renderToString(String.raw`\frac{a}{`, { throwOnError: true }));
});
t('katex render time is negligible', () => {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 200; i++) katex.renderToString(tex, { trust: true, strict: false });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 200;
  console.log('   avg render ms:', ms.toFixed(3));
  assert(ms < 5);
});

// ---------- 2. Streamed script: one JSON move per line, parsed as chunks arrive ----------
function makeLineParser(onMove, onBad) {
  let buf = '';
  return {
    push(chunk) {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        try { onMove(JSON.parse(line)); } catch { onBad(line); }
      }
    },
    end() { const line = buf.trim(); buf = ''; if (line) { try { onMove(JSON.parse(line)); } catch { onBad(line); } } }
  };
}
const script = [
  { move: 'split', piece: 'equation' },
  { move: 'match', term: 't-alt', line: 2, say: 'This term is computed on line 2.' },
  { move: 'match', term: 't-min', line: 3, say: 'Line 3 keeps the smaller value — "min".' },
  { move: 'label', piece: 't-old', text: 'the distance we already had' },
];
const wire = script.map(m => JSON.stringify(m)).join('\n');
t('parser yields every move for every possible chunk boundary', () => {
  for (let cut = 1; cut < wire.length; cut++) {
    const got = []; const p = makeLineParser(m => got.push(m), () => { throw new Error('bad line'); });
    p.push(wire.slice(0, cut)); p.push(wire.slice(cut)); p.end();
    assert.deepStrictEqual(got, script);
  }
});
t('parser yields a move before the stream has finished', () => {
  const got = []; const p = makeLineParser(m => got.push(m), () => {});
  p.push(wire.slice(0, wire.indexOf('\n') + 5));
  assert.strictEqual(got.length, 1);
});
t('parser survives one-character chunks and a junk line', () => {
  const got = [], bad = []; const p = makeLineParser(m => got.push(m), l => bad.push(l));
  for (const ch of ('Sure! Here is the script:\n' + wire)) p.push(ch); p.end();
  assert.strictEqual(got.length, 4); assert.strictEqual(bad.length, 1);
});
t('script line format is much shorter than drawing code', () => {
  const svgEquivalent = 4 * 380; // rough chars for a styled SVG box + label + connector per move
  console.log('   script chars:', wire.length, 'vs rough SVG chars:', svgEquivalent);
  assert(wire.length < svgEquivalent / 3);
});

// ---------- 3. Casting: checking what the model sends back ----------
const casting = require('./casting');
const eq = (tex, terms = []) => ({ kind: 'equation', box: [10, 10, 200, 40], tex, terms: terms.map(([id, t]) => ({ id, tex: t })) });
const texs = (parts) => parts.map((q) => q.tex);
t('casting cuts an equation at its terms, keeping operator spacing', () => {
  const p = eq(String.raw`d[v] = \min\left(d[v],\ d[u] + w(u,v)\right)`, [['lhs', 'd[v]'], ['fn', String.raw`\min`], ['alt', 'd[u] + w(u,v)']]);
  assert.strictEqual(casting.validate(p, 1000, 800), null);
  const parts = casting.equationParts(p, 'c1-');
  assert.deepStrictEqual(texs(parts), ['d[v]', '{}={}', String.raw`\min`, String.raw`\big(d[v],\ `, 'd[u] + w(u,v)', String.raw`\big)`]);
  assert.deepStrictEqual(parts.filter((q) => q.id).map((q) => q.id), ['c1-lhs', 'c1-fn', 'c1-alt']);
});
t('casting keeps a fraction whole and tags the terms inside it', () => {
  const p = eq(String.raw`P(A \mid B) = \frac{P(B \mid A)\,P(A)}{P(B)}`, [['post', String.raw`P(A \mid B)`], ['ev', 'P(B)']]);
  assert.strictEqual(casting.validate(p, 1000, 800), null);
  const parts = casting.equationParts(p, 'c1-');
  assert.strictEqual(parts[0].id, 'c1-post');
  assert(parts[1].tex.includes(String.raw`\frac{`) && parts[1].tex.includes(String.raw`\htmlId{c1-ev}{P(B)}`));
  assert.deepStrictEqual(parts[1].inner, [{ id: 'c1-ev', tex: 'P(B)' }]);
});
t('casting drops terms that are not in the equation, unbalanced, or have unsafe ids', () => {
  const p = eq('x + y = 1', [['ok', 'x'], ['gone', 'z'], ['half', '{x'], ['bad}{\\href', 'y']]);
  assert.strictEqual(casting.validate(p, 1000, 800), null);
  assert.deepStrictEqual(p.terms.map((q) => q.id), ['ok']);
});
t('casting accepts text, tables and figures, and keeps only terms found in the text', () => {
  const box = [10, 10, 300, 60];
  const text = { kind: 'text', box, lines: ["Stockholders' equity is the owners' claim."], terms: [{ id: 'eq', text: "Stockholders' equity" }, { id: 'x', text: 'not in the text' }] };
  assert.strictEqual(casting.validate(text, 1000, 800), null);
  assert.deepStrictEqual(text.terms.map((q) => q.id), ['eq']);
  assert.strictEqual(casting.validate({ kind: 'table', box, rows: [['Assets', '$500'], ['Liabilities', '$300']] }, 1000, 800), null);
  assert.strictEqual(casting.validate({ kind: 'figure', box, about: 'a leaf' }, 1000, 800), null);
  assert(casting.validate({ kind: 'table', box, rows: [['a', 5]] }, 1000, 800));
  assert(casting.validate({ kind: 'poem', box }, 1000, 800));
});
t('casting rejects bad LaTeX, links and boxes off screen', () => {
  assert(casting.validate(eq(String.raw`\frac{a}{`), 1000, 800));
  assert(casting.validate(eq(String.raw`\href{javascript:alert(1)}{x}`), 1000, 800));
  assert(casting.validate({ ...eq('x'), box: [990, 10, 200, 40] }, 1000, 800));
  assert(casting.validate({ ...eq('x'), box: [10, 10, 5, 5] }, 1000, 800));
});
t('casting forgives a number written with a leading zero', () => {
  const got = []; const p = casting.lineParser((v) => got.push(v), () => { throw new Error('refused'); });
  p.push('{"kind":"figure","box":[430,435,1190,070],"about":"x"}\n');
  assert.deepStrictEqual(got[0].box, [430, 435, 1190, 70]);
});

// ---------- 4. Cost model, from the published prices ----------
const visTok = (w, h) => Math.ceil(w / 28) * Math.ceil(h / 28);       // Claude vision docs
t('image token formula matches the docs table', () => {
  assert.strictEqual(visTok(200, 200), 64);
  assert.strictEqual(visTok(1000, 1000), 1296);
  assert.strictEqual(visTok(1920, 1080), 2691);
});
const price = { haiku55: { in: 0.10, out: 0.50, cacheRead: 0.01 }, sonnet55: { in: 2, out: 10, cacheRead: 0.10 } }; // $ per million tokens
const STT_PER_HR = 0.15, TTS_PER_1K = 0.04;
function sceneCost(model, { followUps = 4, fullScreen = true } = {}) {   // the full screen goes with the first question; follow-ups send no image
  const p = price[model];
  const sys = 900;                                   // instructions + move list, cached after first call
  const img = fullScreen ? visTok(1920, 1200) : visTok(640, 120) + visTok(720, 400);   // or two dragged pieces
  const pieceText = 220, question = 40, stage = 250, outPerTurn = 450; // output includes some thinking
  let inTok = sys + img + question, out = outPerTurn, cached = 0;
  for (let i = 0; i < followUps; i++) { cached += sys; inTok += pieceText + stage + question + i * 120; out += outPerTurn; }
  const llm = (inTok * p.in + out * p.out + cached * p.cacheRead) / 1e6;
  const turns = 1 + followUps;
  const stt = turns * 8 / 3600 * STT_PER_HR;         // 8 seconds of speech per question
  const tts = turns * 320 / 1000 * TTS_PER_1K;       // 320 characters spoken per answer
  return { img, inTok, out, llm, stt, tts, total: llm + stt + tts };
}
const h = sceneCost('haiku55'), s = sceneCost('sonnet55'), hc = sceneCost('haiku55', { fullScreen: false });
console.log('   full 1920x1200 screen image tokens:', h.img, '| two dragged pieces:', hc.img);
for (const [n, c] of [['Haiku 5.5', h], ['Sonnet 5.5', s]])
  console.log(`   ${n}: model $${c.llm.toFixed(5)}  speech-in $${c.stt.toFixed(5)}  voice-out $${c.tts.toFixed(5)}  total $${c.total.toFixed(4)} per 5-question scene`);
const perMonth = (c, scenesPerDay) => c.total * scenesPerDay * 30;
console.log(`   heavy user (10 scenes/day): Haiku $${perMonth(h, 10).toFixed(2)}/mo, Sonnet $${perMonth(s, 10).toFixed(2)}/mo; without voice-out Haiku $${((h.total - h.tts) * 300).toFixed(2)}/mo`);
t('voice-out is the largest cost on the small model', () => assert(h.tts > h.llm && h.tts > h.stt));
t('cropping cuts image tokens by >4x vs full screen', () => assert(h.img / hc.img > 4));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
