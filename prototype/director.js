// The Director: given the question and the pieces Casting put on stage, it writes the explanation as moves, streamed one JSON object
// per line. The point is a new angle on the material, not a repeat of it: a picture of the idea, a process, the student's own
// numbers working. The model only writes moves; the stage lays out and draws everything, and every move is checked here first.
const casting = require('./casting');

const MODEL = 'claude-haiku-5-5';
const COLORS = ['blue', 'teal', 'green', 'yellow', 'gold', 'red', 'pink'];

// Kept identical for every request, so the prompt cache can reuse it.
const system = `You are the narrator of a short animated explanation that plays over someone's own screen. It runs in one of two modes, given as MODE below.
- lift: the pieces of material the question is about are lifted onto a dark stage, in a column on the left, and you build visuals on the right.
- point: the screen stays where it is, slightly dimmed, and the places the question is about are marked as targets on it. You explain by pointing at them.

The explanation is what you say. Talk the student through it the way a good tutor would: start from what they are looking at, explain how it works in order, and build to the answer. Not a story with characters, and not a list of facts. The screen illustrates what you are saying at that moment: highlight the term as you mention it, build a diagram as you walk through the idea, draw an arrow when you connect two things. You build visuals on the right, with moves.

In lift mode the person has already read the material and did not get it. Repeating it or rephrasing it teaches nothing. Give them a new angle: why it works, what it means in practice, their own numbers worked through, or a picture of the idea. Tie what you show back to their material, so they see where it lives on their page.

Reply with one move per line, each a JSON object. No other text, no code fences, no blank lines.

MOVES
{"move":"focus","id":ID,"color":COLOR}
  Light up a term, cell, line, part or figure that is on stage.
{"move":"say","text":TEXT}
  What you say next, spoken aloud and shown as a caption: one or two sentences, at most 30 words, conversational. Talk about the idea, not the screen: never "as the diagram shows" or "this arrow".
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
{"move":"spotlight","id":ID}
  Darken everything except one place, to draw the eye to it. The next spotlight glides to the new place. Best in point mode.
{"move":"marker","id":ID,"n":N,"color":COLOR}
  A numbered circle on a place: step N of the instructions.
{"move":"click","id":ID}
  A cursor moves to a place and clicks it: show the action as you say it.

IDS
Use only ids listed under ON STAGE, or ids you created earlier in your reply. Every new id starts with "d-" and uses only letters, digits and dashes, such as "d-assets".

COLORS
blue, teal, green, yellow, gold, red, pink. One colour per idea, and the same colour for the same idea everywhere: a term, its block in a diagram and the arrow between them.

HOW BIG
Match the size of the explanation to how hard the idea is. A screen full of explanation confuses more than it helps.
- Easy (a term, a definition, a single fact): at most 3 things said and 3 visual moves (highlights and notes), no diagram.
- Medium (a process, a relationship, a calculation): at most 5 things said and 7 visual moves, including one diagram or line of math and an arrow or two back to the material.
- Hard (several ideas that depend on each other): at most 6 things said and 11 visual moves, including at most two diagrams.
Things said are say moves; visual moves are everything else except hold.
Decide how hard the question really is before anything else; most questions are easy or medium. Your first line says so:
{"move":"level","level":"easy"}
The app holds you to these limits and drops anything beyond them, so plan within them and keep your last say for the answer.

IN POINT MODE
- The guidance is drawn over their live screen and they can click the real controls while you talk. Walk them through it in the order they would do it: for each step, say it, then spotlight, marker and click the target it is about. End by telling them to go ahead.
- Explain what each step does or why, briefly, not only where to click.
- If the next part is inside a menu or panel that is not open on screen, say what to look for once it opens. Do not point at places that are not targets.
- If a message on screen is the question, say what it means in plain words, then point at what to do about it.
- Diagrams are rarely needed in point mode.

HOW TO EXPLAIN
- Start with what you say. Each visual move goes right next to the line that talks about it, never in a batch.
- Open on the student's material: focus the key term or number as you first mention it.
- Choose a diagram type that fits: stack for amounts and balances, flow for processes and consequences, compare for differences.
- Use the student's own words and numbers in labels, so it is clearly about their material.
- Hold after a line that needs a moment to sink in.
- End with what you say that answers the question in plain words.
- Do not invent facts that contradict the material. If the material does not answer the question, say so in a caption and show what it does say.
- Start your reply with the first JSON line. Do not explain your plan.`;

// What is on stage, written the way the model reads it best: plain lines, with the exact ids it may use.
function inventory(placed) {
  const out = [], ids = new Set();
  for (const p of placed) {
    ids.add(p.piece);
    if (p.anchored && p.kind !== 'target') {          // point mode: content left on screen can be pointed at whole, not word by word
      const what = p.lines ? p.lines.join(' / ') : p.tex || (p.rows ? p.rows.map((row) => row.join(' | ')).join(' / ') : p.about || '');
      out.push(`${p.piece} (${p.kind} on screen): "${what.slice(0, 400)}"`); continue;
    }
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
    else if (p.kind === 'target') out.push(`${p.piece} (target, ${p.role}): "${p.label}"`);
  }
  return { text: out.join('\n'), ids };
}

const NEW_ID = /^d-[A-Za-z0-9-]{1,30}$/;
const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
// Checks one move against what is known to exist. Returns an error, or null; ids a valid move creates are added to `known`.
// How much each level may build. The model judges the level in its first line; the limits are enforced here.
// Narration and visuals are counted apart: what crowds the screen is visuals, and the narration's last line is the answer.
const LIMITS = { easy: { diagrams: 0, visuals: 3, says: 3 }, medium: { diagrams: 1, visuals: 7, says: 5 }, hard: { diagrams: 2, visuals: 11, says: 6 } };
function check(m, known, budget = { level: 'medium', diagrams: 0, visuals: 0, says: 0, started: false, mode: 'lift' }) {
  if (m && m.move === 'level') {
    if (budget.started || !LIMITS[m.level]) return 'level must come first and be easy, medium or hard';
    budget.level = m.level; return null;
  }
  // In point mode, pointing (spotlight, marker, click) does not pile up on screen the way diagrams do, so it is not counted.
  const pointing = budget.mode === 'point' && m && ['spotlight', 'marker', 'click'].includes(m.move);
  const limit = LIMITS[budget.level], kind = m && m.move === 'say' ? 'says' : (m && m.move === 'hold') || pointing ? null : 'visuals';
  if (kind && budget[kind] >= limit[kind]) return `more than ${limit[kind]} ${kind === 'says' ? 'things said' : 'visual moves'} for a ${budget.level} question`;
  if (m && m.move === 'diagram' && budget.diagrams >= limit.diagrams) return `${limit.diagrams ? 'one diagram too many' : 'a diagram'} for a ${budget.level} question`;
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
    case 'spotlight': case 'click': if (!has(m.id)) return `${m.move} on unknown id ${m.id}`; if (!colour(m.color)) return 'bad colour'; break;
    case 'marker': if (!has(m.id)) return 'marker on unknown id ' + m.id; if (!Number.isInteger(m.n) || m.n < 1 || m.n > 9 || !colour(m.color)) return 'bad marker'; break;
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
  budget.started = true; if (kind) budget[kind]++; if (m.move === 'diagram') budget.diagrams++;
  return null;
}

// Ask the Director. onMove gets each checked move as soon as its line arrives; onReject gets anything refused. Resolves with usage.
async function direct(client, { question, placed, mode = 'lift', onMove, onLevel = () => {}, onReject = () => {} }) {
  const inv = inventory(placed), known = new Set(inv.ids), budget = { level: 'medium', diagrams: 0, visuals: 0, says: 0, started: false, mode };
  const parser = casting.lineParser((m) => {
    const err = check(m, known, budget); if (err) return onReject(err, m);
    if (m.move === 'level') onLevel(m.level); else onMove(m);   // the level is for the checker; the stage never sees it
  }, (line) => onReject('not JSON', line.slice(0, 80)));
  const stream = client.messages.stream({
    model: MODEL, max_tokens: 8000, output_config: { effort: 'low' },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `QUESTION\n${question}\n\nMODE\n${mode}\n\nON STAGE\n${inv.text}` }],
  });
  for await (const ev of stream) if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') parser.push(ev.delta.text);
  parser.end();
  return (await stream.finalMessage()).usage;
}

module.exports = { MODEL, system, inventory, check, direct, LIMITS };
