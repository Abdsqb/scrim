// Scrim, live. Press the hotkey on any screen and ask about it: Casting finds the pieces your question is about, they lift off the
// page, and each turns into live math or code. Dragging a box around a piece is the fallback.
//   Ctrl+Alt+Space  freeze the screen and open the question box (falls back to Alt+Shift+Space or Ctrl+Alt+X if taken)
//   type, Enter     ask; Casting picks the pieces and they lift. Needs ANTHROPIC_API_KEY in .env, otherwise only dragging works
//   drag            box a piece yourself instead; it lifts on release. Up to four. Enter or the hotkey again when done
//   Esc             cancel, or end a scene early. The screen comes back
//   Ctrl+Alt+Q      quit
// --demo                show the sample lecture notes and play the hand-written demo scene instead
// --auto                play the demo scene once and exit; --auto --abort also ends it early. For testing
// --auto-select         drag two boxes on the sample notes by itself, check the screen comes back identical, and exit. For testing
//                       add --esc-while-selecting to press Esc before Enter instead
// --auto-ask[=question] ask Casting about the sample notes by itself (one API call), check the pieces and the restore, and exit
const { app, BrowserWindow, desktopCapturer, globalShortcut, screen } = require('electron');
const path = require('path');
const demoScript = require('./demo-script');
const casting = require('./casting');
const director = require('./director');
const has = (flag) => process.argv.includes(flag);
const AUTO = has('--auto'), ABORT = has('--abort'), AUTO_SELECT = has('--auto-select'), DEMO = has('--demo') || AUTO;
const ESC_EARLY = has('--esc-while-selecting');   // with --auto-select: press Esc before Enter, with two pieces already lifted
const askArg = process.argv.find((a) => a.startsWith('--auto-ask'));
const AUTO_ASK = askArg ? (askArg.split('=')[1] || 'how does this equation fit into this algorithm?') : null;
// --screen=samples/11-balance-sheet-slides.png shows that picture full screen instead of the sample notes, for --auto-ask and --demo.
const SCREEN = (process.argv.find((a) => a.startsWith('--screen=')) || '').slice(9);
const HOTKEYS = ['Control+Alt+Space', 'Alt+Shift+Space', 'Control+Alt+X'];   // first one that is free wins
const log = (...a) => console.log('[live]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Windows shrinks a new window to fit above the taskbar, which squashed the screenshot. Setting the bounds again after creation is not clamped.
const cover = (win, bounds) => { win.setBounds(bounds); return win; };
let busy = false, selecting = false;

// Casting calls the model straight from the app, with the key in the git-ignored .env. It moves to a server before anyone else gets a copy.
let client = null;
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* no .env: dragging only */ }
if (process.env.ANTHROPIC_API_KEY) client = new (require('@anthropic-ai/sdk').default)();

app.whenReady().then(async () => {
  const display = screen.getPrimaryDisplay(), { x, y, width: W, height: H } = display.bounds, sf = display.scaleFactor;
  log(`display ${W}x${H} at scale ${sf}, ${process.platform}, electron ${process.versions.electron}, ${client ? 'Casting on' : 'no API key in .env: dragging only'}`);

  // The sample page stands in for the user's screen in the demo and the tests. The real app has no window of its own.
  let notes = null;
  if (DEMO || AUTO_SELECT || AUTO_ASK) {
    notes = cover(new BrowserWindow({ x, y, width: W, height: H, frame: false, backgroundColor: '#fbfaf6' }), display.bounds);
    if (SCREEN) {                                   // a file page may show a local picture; a data: page may not
      const page = path.join(app.getPath('temp'), 'scrim-screen.html');
      require('fs').writeFileSync(page, `<body style="margin:0;overflow:hidden"><img src="${require('url').pathToFileURL(path.resolve(SCREEN))}" style="width:100vw;height:100vh;display:block">`);
      await notes.loadFile(page); await sleep(300);
    }
    else await notes.loadFile(path.join(__dirname, 'notes.html'));
    notes.setAlwaysOnTop(true, 'floating'); notes.moveTop();   // the stand-in screen stays in front of other windows; the stage sits above it
  }

  // The stage is created hidden at start-up so that showing it later is instant.
  const overlay = cover(new BrowserWindow({ x, y, width: W, height: H, frame: false, show: false, alwaysOnTop: true, skipTaskbar: true, resizable: false,
    backgroundColor: '#000000', webPreferences: { backgroundThrottling: false } }), display.bounds);
  overlay.setAlwaysOnTop(true, 'screen-saver');
  await overlay.loadFile(path.join(__dirname, 'stage.html'));
  const js = (code) => overlay.webContents.executeJavaScript(code);
  const feed = (m) => js(`feed(${JSON.stringify(m)})`);

  // Capture the screen and show it on the stage. To the user nothing has changed yet. Returns the screenshot for Casting.
  async function freeze() {
    const t0 = performance.now();
    // Capture at the screen's real pixel size, which is the reported size times the scale factor.
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(W * sf), height: Math.round(H * sf) } });
    const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
    const tCap = performance.now();
    await js(`freeze(${JSON.stringify('data:image/png;base64,' + source.thumbnail.toPNG().toString('base64'))})`);
    cover(overlay, display.bounds).show(); overlay.focus();
    const inner = await js('[innerWidth, innerHeight]');
    if (inner[0] !== W || inner[1] !== H) log(`WARNING stage is ${inner.join('x')}, screen is ${W}x${H}: pieces will be cut from the wrong place`);
    log(`capture ${Math.round(tCap - t0)} ms, freeze ${Math.round(performance.now() - tCap)} ms`);
    return source.thumbnail;
  }

  // Casting: send the screenshot and the question, lift each piece the moment it arrives, then turn the pieces live.
  // Plays into a running feed. Without a Director there is no explanation yet, so the scene holds until Esc.
  async function castScene(shot, question) {
    const { width: PW, height: PH } = shot.getSize();
    // Full resolution reads small symbols better (tested: nested brackets in code); 2576 px is the most the model takes on the long edge.
    const sent = PW > 2576 || PH > 2576 ? shot.resize(PW >= PH ? { width: 2576, quality: 'best' } : { height: 2576, quality: 'best' }) : shot, { width: sw, height: sh } = sent.getSize();
    const k = PW / sw, px = shot.toBitmap(), placed = [], t0 = performance.now();
    let mode = 'lift';                                // Casting's first line: lift the pieces out, or point at places in place
    feed({ move: 'ask', text: question, pause: 0 });
    const usage = await casting.cast(client, {
      png: sent.toPNG().toString('base64'), width: sw, height: sh, question,
      onMode: (m) => { mode = m; log(`Casting chose ${m} mode`); },
      onPiece: (p) => {
        // Model box (sent pixels) -> screen pixels -> snapped to the content -> stage (CSS) pixels.
        const s = casting.snap(px, PW, PH, p.box.map((v) => v * k), { kind: p.kind });
        const rect = { x: Math.round(s[0] / sf), y: Math.round(s[1] / sf), w: Math.round(s[2] / sf), h: Math.round(s[3] / sf) };
        const piece = 'c' + (placed.length + 1);
        placed.push({ ...p, piece, rect });
        if (process.env.SCRIM_DEBUG) log('piece', p.kind, JSON.stringify(p.parts || p.lines || p.rows || p.about || p.label || '').slice(0, 400));
        if (placed.length === 1) log(`first piece ${((performance.now() - t0) / 1000).toFixed(2)} s after asking`);
        if (mode === 'point') { placed[placed.length - 1].anchored = true; feed({ move: 'anchor', piece, rect, pause: 0 }); }   // stays where it is
        else feed({ move: 'lift', piece, rect, pause: 0 });
      },
      onReject: (why) => log('Casting refused a line:', why),
    });
    log(`Casting done in ${((performance.now() - t0) / 1000).toFixed(2)} s: ${placed.map((p) => p.kind).join(', ') || 'nothing'} | tokens ${usage.input_tokens} in, ${usage.output_tokens} out`);
    if (!placed.length) {
      feed({ move: 'say', text: "I couldn't find that on your screen. Press Esc, then drag a box around it." });
      return placed;
    }
    // Simple placement until the stage owns layout (build step 2): Casting's pieces in a column on the left, in the order Casting
    // ranked them, and the Director's canvas on the right. Heights are estimates, since nothing is measured until it is on stage.
    // Only one code block can be live, so others stay pictures.
    if (mode === 'point') feed({ move: 'dim', pause: 0 });
    else feed({ move: 'recede', pause: 120 });
    const left = 56, colW = Math.round(W * 0.36), mid = left + colW / 2;
    let y = 130, codeLive = false;
    for (const p of mode === 'point' ? [] : placed) {   // in point mode nothing moves: the Director points at the real screen
      if (p.kind === 'equation') {
        const parts = casting.equationParts(p, p.piece + '-');   // ids must be unique on the stage, so each is prefixed with its piece
        feed({ move: 'write', piece: p.piece, row: p.piece, at: { x: mid, y: y + 26 }, size: 34, parts, pause: 60 });
        y += 90;
      } else if (p.kind === 'code' && !codeLive) {
        codeLive = p.live = true;
        feed({ move: 'code', piece: p.piece, at: { x: left, y }, size: 18, lines: p.lines });
        y += p.lines.length * 18 * 1.75 + 36;
      } else if (p.kind === 'text') {
        const size = 21, perLine = Math.floor(colW / (size * 0.5));
        feed({ move: 'text', piece: p.piece, at: { x: left, y }, width: colW, size, lines: p.lines, terms: p.terms });
        y += p.lines.reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0) * size * 1.45 + p.lines.length * size * 0.45 + 36;
      } else if (p.kind === 'table') {
        feed({ move: 'table', piece: p.piece, at: { x: left, y }, size: 18, rows: p.rows });
        y += p.rows.length * 18 * 1.95 + 36;
      } else {                                        // a figure, or a second code block: it stays a picture
        const w = Math.round(Math.min(colW, p.rect.w * 1.1, p.rect.w * 320 / p.rect.h));
        feed({ move: 'place', piece: p.piece, at: { x: mid - w / 2, y }, w });
        y += p.rect.h * w / p.rect.w + 36;
      }
    }
    const canvasX = mode === 'point' ? Math.round(W * 0.6) : left + colW + 80;
    js(`setCanvas(${JSON.stringify({ x: canvasX, y: 140, w: W - canvasX - 60 })})`);

    // The Director writes the explanation; each checked move plays as soon as it arrives.
    const t1 = performance.now(); let moves = 0;
    try {
      const dUsage = await director.direct(client, {
        question, placed, mode,
        onMove: (m) => {
          if (!moves++) log(`Director: first move ${((performance.now() - t1) / 1000).toFixed(2)} s after Casting finished`);
          if (process.env.SCRIM_DEBUG) log('move', JSON.stringify(m).slice(0, 300));
          feed(m.move === 'write' ? { move: 'write', row: m.row, size: 36, parts: m.parts } : m);
        },
        onLevel: (level) => log(`Director judged the question ${level}`),
        onReject: (why, m) => log('Director move refused:', why, JSON.stringify(m || '').slice(0, 200)),
      });
      log(`Director done in ${((performance.now() - t1) / 1000).toFixed(2)} s: ${moves} moves | tokens ${dUsage.input_tokens} in, ${dUsage.output_tokens} out`);
    } catch (e) { log('Director failed:', e.message); }
    if (!moves) feed({ move: 'say', text: "I found the pieces, but couldn't build an explanation this time. Esc to go back." });
    return placed;
  }

  async function explain() {
    if (busy) { if (selecting) js('finishSelect()'); return null; }   // the hotkey again while selecting means "done"
    busy = true;
    try {
      const rects = DEMO ? await notes.webContents.executeJavaScript('pieceRects()') : null;
      const shot = await freeze();
      globalShortcut.register('Escape', () => { js('cancel()'); });
      let before = null;
      if (AUTO_SELECT || AUTO_ASK) { await sleep(300); before = (await overlay.webContents.capturePage()).toBitmap(); }

      let script, picks = null, placed = null;
      if (DEMO) {
        if (ABORT) setTimeout(() => js('abort()'), 6000);
        script = demoScript(W, rects);
      } else {
        const ask = !!client && !AUTO_SELECT;
        selecting = true;
        // Without the question box, Enter is taken globally, because the stage may not get keyboard focus from another app.
        if (!ask) globalShortcut.register('Return', () => { js('finishSelect()'); });
        if (AUTO_SELECT) autoSelect();
        if (AUTO_ASK) setTimeout(async () => { await js(`setQuestion(${JSON.stringify(AUTO_ASK)})`); js('finishSelect()'); }, 600);
        const answer = await js(`select(${JSON.stringify({ ask })})`);
        selecting = false; globalShortcut.unregister('Return');
        const question = ask && answer ? answer.question : '';
        picks = ask ? (answer ? answer.picks : null) : answer;
        if (question && !picks.length) {
          log(`asked: "${question}"`);
          js('openFeed()');
          const running = js(`run('feed')`);
          if (AUTO_ASK) {                               // test: save stills of the scene every 4 s, then press Esc
            const shots = path.join(__dirname, '..', 'samples', 'stills'); require('fs').mkdirSync(shots, { recursive: true });
            for (let k = 1; k <= 9; k++) setTimeout(async () => require('fs').writeFileSync(path.join(shots, `t${String(k * 4).padStart(2, '0')}s.png`), (await overlay.webContents.capturePage()).toPNG()), k * 4000);
            setTimeout(() => js('cancel()'), 38000);
          }
          placed = await castScene(shot, question);
          feed({ move: 'wait' });
          js('closeFeed()');
          const result = await running;
          return await finish(result, before, { placed });
        }
        log(picks ? `selected ${picks.length}: ${JSON.stringify(picks.map((p) => p.rect))}` : 'cancelled');
        // Dragged pieces: the page recedes behind them and the scene holds until Esc.
        const n = picks ? picks.length : 0;
        script = n ? [{ move: 'recede', pause: 120 }, { move: 'say', text: `${n === 1 ? 'One piece' : n + ' pieces'} lifted. Esc to go back.` }, { move: 'wait' }] : [];
      }
      const result = await js(`run(${JSON.stringify(script)})`);
      return await finish(result, before, { picks });
    } catch (e) { log('ERROR', e.stack || e); return { error: String(e) }; }
    finally { selecting = false; globalShortcut.unregister('Escape'); globalShortcut.unregister('Return'); overlay.hide(); busy = false; }
  }

  async function finish(result, before, extra) {
    log('scene ended', JSON.stringify(result));
    Object.assign(result, extra);
    if (before) {
      await sleep(100);
      result.identical = before.equals((await overlay.webContents.capturePage()).toBitmap());
      log('restored screen identical to frozen screen ->', result.identical);
    }
    return result;
  }

  // Test only: drag a box around each piece of the sample page, plus a tiny one that must be ignored, then finish and press Esc.
  async function autoSelect() {
    const rects = await notes.webContents.executeJavaScript('pieceRects()');
    const send = (type, px, py) => overlay.webContents.sendInputEvent({ type, x: Math.round(px), y: Math.round(py), button: 'left', clickCount: 1, modifiers: type === 'mouseMove' ? ['leftButtonDown'] : [] });
    await sleep(500);
    const pad = (r) => ({ x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 });
    for (const r of [pad(rects.equation), pad(rects.algorithm), { x: 40, y: 40, w: 4, h: 4 }]) {
      const x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
      send('mouseDown', x0, y0);
      for (let i = 1; i <= 10; i++) { send('mouseMove', x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); await sleep(16); }
      send('mouseUp', x1, y1); await sleep(500);
    }
    if (ESC_EARLY) { js('cancel()'); return; }
    js('finishSelect()'); await sleep(3000); js('cancel()');
  }

  // Another app may already own a hotkey (on Windows, launchers like Flow Launcher or PowerToys often do), so take the first free one.
  const hotkey = HOTKEYS.find((k) => globalShortcut.register(k, explain));
  log(hotkey ? `hotkey ${hotkey}` : `ERROR no free hotkey among ${HOTKEYS.join(', ')}`);
  if (hotkey && notes) notes.webContents.executeJavaScript(`setHotkey(${JSON.stringify(hotkey.replace('Control', 'Ctrl'))})`);
  if (!globalShortcut.register('Control+Alt+Q', () => app.quit())) log('Ctrl+Alt+Q is taken; close the window to quit');
  if (hotkey && !DEMO && !AUTO_SELECT && !AUTO_ASK) log(`ready. Open anything, press ${hotkey.replace('Control', 'Ctrl')}, ${client ? 'type a question and press Enter (or drag a box around each piece)' : 'drag a box around each piece, Enter when done'}, Esc to go back. Ctrl+Alt+Q quits.`);

  if (AUTO) setTimeout(async () => { const r = await explain(); process.exitCode = r && !r.error ? 0 : 1; app.quit(); }, 1200);
  if (AUTO_SELECT) setTimeout(async () => {
    const r = await explain();
    const ok = r && !r.error && r.identical && (ESC_EARLY ? r.picks === null : r.picks && r.picks.length === 2);
    log(ok ? `PASS ${ESC_EARLY ? 'Esc while selecting cancelled' : 'two boxes lifted, the tiny one was ignored,'} and the screen came back identical` : 'FAIL ' + JSON.stringify(r));
    process.exitCode = ok ? 0 : 1; app.quit();
  }, 1200);
  if (AUTO_ASK) setTimeout(async () => {
    if (!client) { log('FAIL --auto-ask needs ANTHROPIC_API_KEY in .env'); process.exitCode = 1; return app.quit(); }
    const r = await explain();
    const kinds = r && r.placed ? r.placed.map((p) => p.kind).sort().join(',') : '';
    const ok = r && !r.error && r.identical && (SCREEN ? kinds.length > 0 : kinds.includes('code') && kinds.includes('equation'));   // helpful extra context is fine
    log(ok ? `PASS Casting found ${kinds}, the pieces lifted and went live, and the screen came back identical` : 'FAIL ' + JSON.stringify({ ...r, placed: kinds }));
    process.exitCode = ok ? 0 : 1; app.quit();
  }, 1200);
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
