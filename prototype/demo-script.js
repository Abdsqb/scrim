// The hand-written demo scene. This is the exact shape the director model will produce later:
// an ordered list of moves, each a plain object. `W` is the screen width in CSS pixels and
// `rects` are the boxes around the two pieces on the page ({x, y, w, h} in CSS pixels).
module.exports = function demoScript(W, rects) {
  const cx = Math.round(W / 2), codeX = cx - 400, numX = cx + 70;
  return [
    { move: 'hold', ms: 400 },
    // Pieces lift off the sharp page first, then the page falls away behind them.
    { move: 'lift', piece: 'equation', rect: rects.equation, pause: 0 },
    { move: 'lift', piece: 'algorithm', rect: rects.algorithm, pause: 220 },
    { move: 'recede', pause: 120 },
    // Each lifted photo turns into live, movable content.
    { move: 'write', piece: 'equation', row: 'eq', at: { x: cx, y: 168 }, size: 46, pause: 60, parts: [
      { id: 't-lhs', tex: 'd[v]' }, { tex: '{}={}' }, { id: 't-min', tex: '\\min' }, { tex: '\\,\\big(' },
      { id: 't-old', tex: 'd[v]' }, { tex: ',\\ \\,' }, { id: 't-alt', tex: 'd[u] + w(u,v)' }, { tex: '\\big)' }] },
    { move: 'code', piece: 'algorithm', at: { x: codeX, y: 318 }, size: 22, lines: [
      'for each neighbor v of u:', '    alt = d[u] + w(u, v)', '    if alt < d[v]:', '        d[v] = alt', '        prev[v] = u'] },
    { move: 'say', text: 'The equation and the algorithm say the same thing. Watch the pieces line up.' },
    { move: 'hold', ms: 900 },
    { move: 'split', row: 'eq' },
    { move: 'match', term: 't-alt', line: 2, span: 'd[u] + w(u, v)', color: 'blue', label: 'line 2', say: 'This term is line 2: the distance to v if you go through u.' },
    { move: 'hold', ms: 1100 },
    { move: 'match', term: 't-min', line: 3, span: 'alt < d[v]', color: 'yellow', label: 'line 3', say: 'The min is the "if" on line 3: keep the new distance only when it is smaller.' },
    { move: 'hold', ms: 1100 },
    { move: 'match', term: 't-lhs', line: 4, span: 'd[v] = alt', color: 'green', label: 'line 4', say: 'The left side is line 4, where the smaller value gets stored.' },
    { move: 'hold', ms: 1300 },
    // A follow-up question changes the scene that is already there.
    { move: 'ask', text: 'show me with numbers' },
    { move: 'say', text: 'Say d[u] is 3, the edge weighs 4, and d[v] is 9 so far.' },
    { move: 'write', row: 'given', anchor: 'left', dim: true, at: { x: numX, y: 336 }, size: 24, parts: [{ tex: 'd[u]=3,\\quad w(u,v)=4,\\quad d[v]=9' }] },
    { move: 'hold', ms: 500 },
    { move: 'write', row: 'r1', anchor: 'left', at: { x: numX, y: 404 }, size: 34, parts: [
      { tex: '\\text{alt}' }, { tex: '{}={}' }, { id: 'r1-alt', from: 't-alt', tex: 'd[u] + w(u,v)', color: 'blue' }] },
    { move: 'swap', id: 'r1-alt', tex: '3 + 4' },
    { move: 'swap', id: 'r1-alt', tex: '7' },
    { move: 'write', row: 'r2', anchor: 'left', at: { x: numX, y: 470 }, size: 34, parts: [
      { id: 'r2-min', from: 't-min', tex: '\\min', color: 'yellow' }, { tex: '\\big(' }, { id: 'r2-old', from: 't-old', tex: 'd[v]' }, { tex: ',\\;' },
      { id: 'r2-new', from: 'r1-alt', tex: '7', color: 'blue' }, { tex: '\\big)' }, { id: 'r2-res', tex: '{}=7', hidden: true }] },
    { move: 'swap', id: 'r2-old', tex: '9' },
    { move: 'say', text: '7 is smaller than 9, so d[v] becomes 7.', pause: 0 },
    { move: 'show', id: 'r2-res', color: 'green' },
    { move: 'hold', ms: 1800 },
    { move: 'restore' },
  ];
};
