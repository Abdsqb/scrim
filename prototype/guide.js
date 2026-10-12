// The guide: walks someone through doing something on their computer, one action at a time, over their live screen.
// Each call sees the screen as it is now, the goal, and what has been done, and returns the single next action: where it is and
// what to say. After the person acts, the app looks at the screen again and asks for the next one, until the goal is reached.
const casting = require('./casting');

const MODEL = 'claude-haiku-5-5';
const DOS = ['click', 'double-click', 'right-click', 'type', 'scroll', 'look'];

const system = (W, H) => `You guide someone through doing something on their computer, one action at a time. Your guidance is drawn over their live screen and they do each action themselves. You see their screen right now, their goal, and the steps already done.

The screenshot is ${W} by ${H} pixels. Boxes are [x, y, width, height] in those pixels, with 0,0 at the top left.

Reply with exactly one JSON object on one line, and nothing else.

The next action:
{"do":"click","box":[x,y,w,h],"label":"Insert","say":"...","last":false}
  do: click, double-click, right-click, type, scroll or look.
  box: the control to act on, tightly. For type, the field to type in. For look, the thing to read.
  label: the control's name as written on screen, or a few words saying what it is.
  say: what you say aloud: what to do and, in a few words, why. One or two sentences, at most 25 words, plain and friendly.
  text: for type only, what to type, if it is clear.
  last: true if this action completes the goal.

If the goal is already reached on this screen:
{"done":true,"say":"..."}
  say: one short sentence, at most 15 words. If steps were done, confirm the result ("That's it: dark mode is on."). If none were, say it is already so.

If it cannot be done from this screen (the feature is not here, or the person went somewhere else):
{"stuck":true,"say":"..."}
  say: what is wrong and what to do about it, at most 25 words.

Rules:
- Only point at controls you can see now. If the next control is hidden in a menu, the next action is opening that menu.
- Go by what is on the screen, not by how the app usually looks. Apps differ between versions.
- If the steps done show the person clicked somewhere else, work from where they are now.
- One action per reply. Never list several.`;

// Checks the reply. Returns an error, or null.
function check(s, W, H) {
  if (!s || typeof s !== 'object') return 'not an object';
  if (s.done || s.stuck) return typeof s.say === 'string' && s.say.trim() ? null : 'done or stuck needs say';
  if (!DOS.includes(s.do)) return 'unknown action ' + s.do;
  const err = casting.validateBox({ kind: 'target', box: s.box }, W, H); if (err) return err;
  if (!(typeof s.say === 'string' && s.say.trim() && s.say.length <= 300)) return 'action needs say';
  if (s.text !== undefined && typeof s.text !== 'string') return 'text must be a string';
  if (typeof s.label !== 'string' || !s.label.trim()) s.label = s.do;
  return null;
}

// Ask for the next action. history is [{ n, do, label, onTarget }]. signal cancels the call. Resolves with the checked step
// (boxes in the sent image's pixels) and the usage.
async function next(client, { png, width, height, goal, history = [], signal }) {
  const done = history.length ? history.map((h) => `${h.n}. ${h.do} ${h.label}${h.onTarget ? '' : ' (they clicked somewhere else)'}`).join('\n') : 'none yet';
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 4000, output_config: { effort: 'low' }, ...(process.env.GUIDE_THINKING === 'off' ? { thinking: { type: 'disabled' } } : {}),
    system: [{ type: 'text', text: system(width, height), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: [
      { type: 'text', text: `GOAL\n${goal}\n\nSTEPS DONE\n${done}` },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png } },
    ] }],
  }, { signal });
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  let step = null, error = null;
  casting.lineParser((v) => { if (!step) step = v; }, () => {}).push(text.replace(/^```(?:json)?|```$/g, '') + '\n');
  error = step ? check(step, width, height) : 'no JSON in reply';
  return { step: error ? null : step, error, raw: text, usage: msg.usage };
}

module.exports = { MODEL, system, check, next };
