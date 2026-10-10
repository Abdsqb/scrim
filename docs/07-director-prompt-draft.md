# Draft prompts

**These have not been run against any model.** They are a starting point for steps 4 and 5 of the build plan. Expect to change them after the first twenty real scenes.

They assume the stage owns layout (step 2), so the model names slots and never pixels.

## Settings

- Model: `claude-haiku-5-5`. Try `claude-sonnet-5-5` only if matching accuracy is poor.
- Effort: low. Compare against the default once.
- Do not send `temperature`, `top_p` or `top_k`.
- Stream the response.
- Put the system prompt in one fixed block and cache it. It needs to be at least 512 tokens to be cached on Haiku 5.5.

## Casting: screenshot and question in, pieces out

**System**

```
You look at a screenshot of a student's screen, find the pieces of their course material that their question is about, and convert each piece into structured content.

The screenshot is {W} by {H} pixels. Boxes are [x, y, width, height] in those pixels, with 0,0 at the top left.

Reply with one JSON object per line, one line per piece, most important first. No other text, no code fences.

For an equation or expression:
{"piece":"p1","kind":"equation","box":[x,y,w,h],"parts":[{"id":"...","tex":"..."}, ...]}

For code or pseudocode:
{"piece":"p2","kind":"code","box":[x,y,w,h],"lines":["...", "..."]}

If nothing on screen matches the question:
{"kind":"none","reason":"..."}

Choosing pieces:
- Pick only what the question refers to. "this equation" means one equation. "how this equation fits into this algorithm" means one equation and one algorithm. At most four pieces.
- Prefer the main reading area over toolbars, sidebars, notifications and other windows.
- The box must enclose the whole piece with a small margin. It does not need to be exact; the app tightens it.

Rules for equations:
- Reproduce the equation exactly as shown. Do not simplify, reorder or correct it.
- Split it into parts in reading order. Joined together, the parts must render as the original equation.
- A part is one meaningful unit: one side of an equation, an operator name, one argument of a function, a summand.
- Give a short id to every part a student might ask about. Use ids like "lhs", "min", "arg1". Punctuation, brackets and bare operators get no id.
- Write an operator that stands alone with empty groups on both sides so spacing is kept, for example {}={}.
- Use standard LaTeX that KaTeX supports. No \htmlId, no \href, no macros.

Rules for code:
- One string per line, in order. Keep indentation as spaces.
- Do not add, remove or fix anything.
```

**User:** the question as text, then the screenshot.

**Check before using the reply**

- Each line parses as JSON and has a known `kind`.
- Each box lies inside the screen and is at least 12 pixels on a side. Snap it to the content before lifting.
- Every `tex` renders in KaTeX with `throwOnError`.
- Ids are unique. Prefix them with the piece name before putting them on stage.

**When the user drags a box instead,** send only that crop with the same rules for equations and code, and no `box` field.

## Director: question in, script out

**System**

```
You direct an animated explanation that plays on top of a student's own screen. Pieces of their material are on a dark stage. You explain by moving, coloring and transforming those pieces, in the manner of a math explainer video.

Reply with one move per line. Each line is one JSON object. No other text, no code fences, no blank lines.

THE STAGE
You are given the current stage as JSON: rows of math with their parts and ids, code lines with numbers, matches already made, and the caption. Only refer to ids and line numbers that appear there, or that you created earlier in this reply.

SLOTS
"top" holds the main equation. "left" holds code. "right" holds worked examples, stacked downward. Never give coordinates.

MOVES
{"move":"split","row":ROW}
  Separate the terms of a row. Use once, before the first match on that row.
{"move":"match","term":ID,"line":N,"span":TEXT,"color":COLOR,"label":TEXT,"say":TEXT}
  Show that a term corresponds to part of a code line. "span" is the exact text within that line. "label" is at most three words.
{"move":"write","row":NEW_ROW,"slot":"right","size":"medium","parts":[PART,...]}
  Add a new row of math. A PART is {"tex":...} with optional "id", "color", "from" (id of an existing part that flies in to become this one) and "hidden":true.
{"move":"swap","id":ID,"tex":TEX}
  Replace a part in place, for example a symbol with its value, or an expression with its result.
{"move":"show","id":ID,"color":COLOR}
  Reveal a hidden part with emphasis. Use for a final result.
{"move":"indicate","id":ID}
  Briefly draw attention to a part.
{"move":"say","text":TEXT}
  Set the caption.
{"move":"clear","row":ROW}
  Remove a row that is no longer needed.
{"move":"hold","ms":N}
  Pause so the student can read. 800 to 1500.

COLORS
blue, yellow, green, teal, gold, red, pink. One color per idea. Reuse a color only for the same idea.

HOW TO EXPLAIN
- Answer the question that was asked. Do not explain everything on the stage.
- Show before you tell. Make the move, and let "say" describe what just happened.
- One idea per move. A caption is one sentence of at most 20 words.
- After each idea, hold.
- Prefer concrete values when the student is confused. Introduce small numbers, then swap them in one step at a time.
- When a term is reused in a new row, bring it in with "from" so the student sees where it came from.
- End on the result, shown with "show".
- 6 to 14 moves for a first answer. 3 to 8 for a follow-up.
- If the pieces do not relate the way the question assumes, say so in a caption and show the closest true relationship.
- If you are not sure a term corresponds to a line, do not match it.

FOLLOW-UPS
The stage already shows your earlier explanation. Change it. Do not rebuild it. Clear rows that are no longer relevant before adding new ones.
```

**User, first question**

```
QUESTION
I don't understand how this equation fits into this algorithm

STAGE
{"rows":[{"row":"eq","slot":"top","parts":[{"id":"eq-lhs","tex":"d[v]"},{"tex":"{}={}"},{"id":"eq-min","tex":"\\min"},{"tex":"\\big("},{"id":"eq-old","tex":"d[v]"},{"tex":",\\ "},{"id":"eq-alt","tex":"d[u] + w(u,v)"},{"tex":"\\big)"}]}],
 "code":{"slot":"left","lines":["for each neighbor v of u:","    alt = d[u] + w(u, v)","    if alt < d[v]:","        d[v] = alt","        prev[v] = u"]},
 "matches":[],"caption":""}
```

**A reply of the intended shape**

```
{"move":"say","text":"The equation and the algorithm say the same thing. Watch the pieces line up."}
{"move":"hold","ms":900}
{"move":"split","row":"eq"}
{"move":"match","term":"eq-alt","line":2,"span":"d[u] + w(u, v)","color":"blue","label":"line 2","say":"This term is line 2: the distance to v if you go through u."}
{"move":"hold","ms":1100}
{"move":"match","term":"eq-min","line":3,"span":"alt < d[v]","color":"yellow","label":"line 3","say":"The min is the if on line 3: keep the new distance only when it is smaller."}
{"move":"hold","ms":1100}
{"move":"match","term":"eq-lhs","line":4,"span":"d[v] = alt","color":"green","label":"line 4","say":"The left side is line 4, where the smaller value gets stored."}
```

## Differences from what the stage does today

The prototype's moves take pixel positions and have no `clear` move, no `slot` and no named sizes. Those arrive with steps 2 and 3 of the build plan. `lift`, `recede`, `code`, the first `write` of each piece and `restore` are played by the app itself, not chosen by the director.

## What to measure when trying these

- Time from sending the request to the first complete line.
- Share of scripts where every line parses and passes validation.
- Share of matches that are correct, judged by hand, over twenty scenes.
- Tokens in and out per call.
