// The Director: given the question and the pieces Casting put on stage, it writes the explanation as moves, streamed one JSON object
// per line. The point is a new angle on the material, not a repeat of it: a picture of the idea, a process, the student's own
// numbers working. The model only writes moves; the stage lays out and draws everything, and every move is checked here first.
const casting = require('./casting');

const MODEL = 'claude-haiku-5-5';
const COLORS = ['blue', 'teal', 'green', 'yellow', 'gold', 'red', 'pink'];

// Kept identical for every request, so the prompt cache can reuse it.
const system = `You direct a short animated explanation that plays over a student's own screen. The pieces of their material that their question is about are already lifted onto a dark stage, in a column on the left. You build the explanation on the right, with moves.

The student has already read the material and did not get it. Repeating it, rephrasing it or making it bigger teaches nothing. Give them a new angle on it: a picture of the idea, the process or cause and effect behind it, their own numbers worked through, or a comparison that makes the difference visible. Then tie what you built back to their material with arrows and highlights, so they see where it lives on their page.

Reply with one move per line, each a JSON object. No other text, no code fences, no blank lines.

MOVES
{"move":"focus","id":ID,"color":COLOR}
  Light up a term, cell, line, part or figure that is on stage.
{"move":"say","text":TEXT}
  The caption: one sentence of at most 18 words. Say what the visuals cannot show by themselves; do not narrate the moves.
{"move":"diagram","type":"flow","id":NEW,"steps":[{"id":NEW,"label":TEXT}, ...]}
  2 to 5 boxes top to bottom joined by arrows: a process, a cause and effect, an order of events. Labels of at most 5 words.
{"move":"diagram","type":"stack","id":NEW,"unit":"$","bars":[{"id":NEW,"label":TEXT,"segments":[{"id":NEW,"label":TEXT,"value":NUMBER,"color":COLOR}, ...]}, ...]}
  1 to 3 bars of amounts stacked and drawn to scale: parts of a whole, or two sides that must balance. Segments are listed top to bottom. Use real numbers from the stage when there are any.
{"move":"diagram","type":"compare","id":NEW,"columns":[{"id":NEW,"title":TEXT,"color":COLOR,"items":[TEXT, ...]}, ...]}
  2 or 3 columns side by side, at most 4 short items each.
{"move":"arrow","from":ID,"to":ID,"label":TEXT,"color":COLOR}
  A curved arrow, usually from something in the student's material to the part of your diagram it becomes. Label optional, at most 4 words.
{"move":"note","near":ID,"text":TEXT,"color":COLOR}
  A short handwritten label beside something. At most 5 words.
{"move":"write","row":NEW,"tex":LATEX,"terms":[{"id":NEW,"tex":LATEX}, ...]}
  A line of math on your canvas, such as the relationship in symbols or a worked calculation. terms are pieces of tex copied exactly.
{"move":"hold","ms":N}
  Pause so the student can take it in. 600 to 1500.

IDS
Use only ids listed under ON STAGE, or ids you created earlier in your reply. Every new id starts with "d-" and uses only letters, digits and dashes, such as "d-assets".

COLORS
blue, teal, green, yellow, gold, red, pink. One colour per idea, and the same colour for the same idea everywhere: a term, its block in a diagram and the arrow between them.

HOW TO EXPLAIN
- Open by focusing the key term or number the question is about.
- Build at most two diagrams. Choose the type that fits: stack for amounts and balances, flow for processes and consequences, compare for differences.
- Use the student's own words and numbers in labels, so the diagram is clearly about their material.
- Connect at least one diagram back to the material with an arrow.
- One idea at a time: a visual move, then a caption, then a hold.
- End with one caption that answers the question in plain words.
- 8 to 16 moves in all.
- Do not invent facts that contradict the material. If the material does not answer the question, say so in a caption and show what it does say.
- Start your reply with the first JSON line. Do not explain your plan.`;

// What is on stage, written the way the model reads it best: plain lines, with the exact ids it may use.
function inventory(placed) {
  const out = [], ids = new Set();
  for (const p of placed) {
    ids.add(p.piece);
    if (p.kind === 'text') {
      out.push(`${p.piece} (text):`, ...p.lines.map((l) => `  "${l}"`));
      if (p.terms.length) out.push('  terms: ' + p.terms.map((t) => { ids.add(`${p.piece}-${t.id}`); return `${p.piece}-${t.id} = "${t.text}"`; }).join('; '));
    } else if (p.kind === 'table') {
      out.push(`${p.piece} (table, cell ids ${p.piece}-r<row>c<column>):`);
      p.rows.forEach((row, i) => { out.push(`  r${i + 1}: ` + row.map((c, j) => { ids.add(`${p.piece}-r${i + 1}c${j + 1}`); return JSON.stringify(c); }).join(' | ')); });
    } else if (p.kind === 'equation') {
      const parts = casting.equationParts(p, p.piece + '-'), named = [];
      for (const q of parts) { if (q.id) named.push(q); for (const t of q.inner || []) named.push(t); }
      out.push(`${p.piece} (equation): ${p.tex}`);
      if (named.length) out.push('  parts: ' + named.map((q) => { ids.add(q.id); return `${q.id} = ${q.tex}`; }).join('; '));
    } else if (p.kind === 'code') {
      out.push(`${p.piece} (code${p.live ? '' : ', shown as a picture'}):`);
      p.lines.forEach((l, i) => { out.push(`  ${p.live ? `ln-${i + 1}: ` : ''}${l}`); if (p.live) ids.add(`ln-${i + 1}`); });
    } else if (p.kind === 'figure') out.push(`${p.piece} (figure): ${p.about || 'a picture'}`);
  }
  return { text: out.join('\n'), ids };
}

const NEW_ID = /^d-[A-Za-z0-9-]{1,30}$/;
const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
// Checks one move against what is known to exist. Returns an error, or null; ids a valid move creates are added to `known`.
function check(m, known) {
  if (!m || typeof m.move !== 'string') return 'not a move';
  const has = (id) => typeof id === 'string' && known.has(id);
  const fresh = [], claim = (id) => { if (!NEW_ID.test(id || '') || known.has(id) || fresh.includes(id)) return false; fresh.push(id); return true; };
  const colour = (c) => c === undefined || COLORS.includes(c);
  switch (m.move) {
    case 'focus': if (!has(m.id)) return 'focus on unknown id ' + m.id; if (!colour(m.color)) return 'bad colour'; break;
    case 'say': if (!str(m.text, 220)) return 'say needs text'; break;
    case 'note': if (!has(m.near)) return 'note near unknown id ' + m.near; if (!str(m.text, 60) || !colour(m.color)) return 'bad note'; break;
    case 'arrow': if (!has(m.from) || !has(m.to)) return `arrow between unknown ids ${m.from} -> ${m.to}`; if ((m.label !== undefined && !str(m.label, 50)) || !colour(m.color)) return 'bad arrow'; break;
    case 'hold': if (!Number.isFinite(m.ms) || m.ms < 0 || m.ms > 4000) return 'bad hold'; break;
    case 'write': {
      if (!claim(m.row)) return 'write needs a new row id';
      const eq = { kind: 'equation', tex: m.tex, terms: (m.terms || []).map((t) => ({ ...t, id: (t.id || '').replace(/^d-/, '') })) };
      const err = casting.validateContent(eq); if (err) return 'write: ' + err;
      m.parts = casting.equationParts(eq, 'd-'); for (const q of m.parts) { if (q.id && !claim(q.id)) return 'write: repeated id ' + q.id; for (const t of q.inner || []) if (!claim(t.id)) return 'write: repeated id ' + t.id; }
      break;
    }
    case 'diagram': {
      if (!claim(m.id)) return 'diagram needs a new id';
      if (m.type === 'flow') {
        if (!Array.isArray(m.steps) || m.steps.length < 2 || m.steps.length > 5) return 'flow needs 2 to 5 steps';
        for (const st of m.steps) if (!claim(st.id) || !str(st.label, 60) || !colour(st.color)) return 'bad flow step';
      } else if (m.type === 'stack') {
        if (!Array.isArray(m.bars) || !m.bars.length || m.bars.length > 3 || (m.unit !== undefined && typeof m.unit !== 'string')) return 'stack needs 1 to 3 bars';
        for (const b of m.bars) {
          if (!claim(b.id) || !str(b.label, 40) || !Array.isArray(b.segments) || !b.segments.length || b.segments.length > 5) return 'bad stack bar';
          for (const sg of b.segments) if (!claim(sg.id) || !str(sg.label, 40) || !Number.isFinite(sg.value) || sg.value <= 0 || !colour(sg.color)) return 'bad stack segment';
        }
      } else if (m.type === 'compare') {
        if (!Array.isArray(m.columns) || m.columns.length < 2 || m.columns.length > 3) return 'compare needs 2 or 3 columns';
        for (const c of m.columns) if (!claim(c.id) || !str(c.title, 50) || !colour(c.color) || !Array.isArray(c.items) || c.items.length > 5 || !c.items.every((it) => str(it, 90))) return 'bad compare column';
      } else return 'unknown diagram type ' + m.type;
      break;
    }
    default: return 'unknown move ' + m.move;
  }
  for (const id of fresh) known.add(id);
  return null;
}

// Ask the Director. onMove gets each checked move as soon as its line arrives; onReject gets anything refused. Resolves with usage.
async function direct(client, { question, placed, onMove, onReject = () => {} }) {
  const inv = inventory(placed), known = new Set(inv.ids);
  const parser = casting.lineParser((m) => { const err = check(m, known); if (err) onReject(err, m); else onMove(m); }, (line) => onReject('not JSON', line.slice(0, 80)));
  const stream = client.messages.stream({
    model: MODEL, max_tokens: 8000, output_config: { effort: 'low' },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `QUESTION\n${question}\n\nON STAGE\n${inv.text}` }],
  });
  for await (const ev of stream) if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') parser.push(ev.delta.text);
  parser.end();
  return (await stream.finalMessage()).usage;
}

module.exports = { MODEL, system, inventory, check, direct };
