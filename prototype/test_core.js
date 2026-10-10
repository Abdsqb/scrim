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

// ---------- 3. Cost model, from the published prices ----------
const visTok = (w, h) => Math.ceil(w / 28) * Math.ceil(h / 28);       // Claude vision docs
t('image token formula matches the docs table', () => {
  assert.strictEqual(visTok(200, 200), 64);
  assert.strictEqual(visTok(1000, 1000), 1296);
  assert.strictEqual(visTok(1920, 1080), 2691);
});
const price = { haiku55: { in: 0.10, out: 0.50, cacheRead: 0.01 }, sonnet55: { in: 2, out: 10, cacheRead: 0.10 } }; // $ per million tokens
const STT_PER_HR = 0.15, TTS_PER_1K = 0.04;
function sceneCost(model, { followUps = 4, fullScreen = false } = {}) {
  const p = price[model];
  const sys = 900;                                   // instructions + move list, cached after first call
  const img = fullScreen ? visTok(1920, 1080) : visTok(640, 120) + visTok(720, 400);
  const pieceText = 220, question = 40, stage = 250, outPerTurn = 450; // output includes some thinking
  let inTok = sys + img + question, out = outPerTurn, cached = 0;
  for (let i = 0; i < followUps; i++) { cached += sys; inTok += pieceText + stage + question + i * 120; out += outPerTurn; }
  const llm = (inTok * p.in + out * p.out + cached * p.cacheRead) / 1e6;
  const turns = 1 + followUps;
  const stt = turns * 8 / 3600 * STT_PER_HR;         // 8 seconds of speech per question
  const tts = turns * 320 / 1000 * TTS_PER_1K;       // 320 characters spoken per answer
  return { img, inTok, out, llm, stt, tts, total: llm + stt + tts };
}
const h = sceneCost('haiku55'), s = sceneCost('sonnet55'), hf = sceneCost('haiku55', { fullScreen: true });
console.log('   cropped pieces image tokens:', h.img, '| full 1080p screen:', hf.img);
for (const [n, c] of [['Haiku 5.5', h], ['Sonnet 5.5', s]])
  console.log(`   ${n}: model $${c.llm.toFixed(5)}  speech-in $${c.stt.toFixed(5)}  voice-out $${c.tts.toFixed(5)}  total $${c.total.toFixed(4)} per 5-question scene`);
const perMonth = (c, scenesPerDay) => c.total * scenesPerDay * 30;
console.log(`   heavy user (10 scenes/day): Haiku $${perMonth(h, 10).toFixed(2)}/mo, Sonnet $${perMonth(s, 10).toFixed(2)}/mo; without voice-out Haiku $${((h.total - h.tts) * 300).toFixed(2)}/mo`);
t('voice-out is the largest cost on the small model', () => assert(h.tts > h.llm && h.tts > h.stt));
t('cropping cuts image tokens by >4x vs full screen', () => assert(hf.img / h.img > 4));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
