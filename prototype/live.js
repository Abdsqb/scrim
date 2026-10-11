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
const has = (flag) => process.argv.includes(flag);
const AUTO = has('--auto'), ABORT = has('--abort'), AUTO_SELECT = has('--auto-select'), DEMO = has('--demo') || AUTO;
const ESC_EARLY = has('--esc-while-selecting');   // with --auto-select: press Esc before Enter, with two pieces already lifted
const askArg = process.argv.find((a) => a.startsWith('--auto-ask'));
const AUTO_ASK = askArg ? (askArg.split('=')[1] || 'how does this equation fit into this algorithm?') : null;
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
    await notes.loadFile(path.join(__dirname, 'notes.html'));
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
    feed({ move: 'ask', text: question, pause: 0 });
    const usage = await casting.cast(client, {
      png: sent.toPNG().toString('base64'), width: sw, height: sh, question,
      onPiece: (p) => {
        // Model box (sent pixels) -> screen pixels -> snapped to the content -> stage (CSS) pixels.
        const s = casting.snap(px, PW, PH, p.box.map((v) => v * k));
        const rect = { x: Math.round(s[0] / sf), y: Math.round(s[1] / sf), w: Math.round(s[2] / sf), h: Math.round(s[3] / sf) };
        const piece = 'c' + (placed.length + 1);
        placed.push({ ...p, piece, rect });
        if (process.env.SCRIM_DEBUG) log('piece', JSON.stringify(p.parts || p.lines));
        if (placed.length === 1) log(`first piece ${((performance.now() - t0) / 1000).toFixed(2)} s after asking`);
        feed({ move: 'lift', piece, rect, pause: 0 });
      },
      onReject: (why) => log('Casting refused a line:', why),
    });
    log(`Casting done in ${((performance.now() - t0) / 1000).toFixed(2)} s: ${placed.map((p) => p.kind).join(', ') || 'nothing'} | tokens ${usage.input_tokens} in, ${usage.output_tokens} out`);
    if (!placed.length) {
      feed({ move: 'say', text: "I couldn't find that on your screen. Press Esc, then drag a box around it." });
      return placed;
    }
    // Simple placement until the stage owns layout (build step 2): equations stacked at the top, the first code block below them.
    feed({ move: 'recede', pause: 120 });
    const cx = Math.round(W / 2), eqs = placed.filter((p) => p.kind === 'equation'), code = placed.find((p) => p.kind === 'code');
    eqs.forEach((p, i) => {
      const seen = new Set();                         // part ids must be unique on the stage: prefix with the piece, drop repeats
      const parts = p.parts.map((q) => { const id = q.id && !seen.has(q.id) ? (seen.add(q.id), `${p.piece}-${q.id}`) : null; return id ? { tex: q.tex, id } : { tex: q.tex }; });
      feed({ move: 'write', piece: p.piece, row: p.piece, at: { x: cx, y: 150 + i * 100 }, size: eqs.length > 1 ? 40 : 46, parts, pause: 60 });
    });
    if (code) feed({ move: 'code', piece: code.piece, at: { x: Math.max(40, cx - 420), y: eqs.length ? 150 + eqs.length * 100 + 40 : 160 }, size: 22, lines: code.lines });
    const names = [...new Set(placed.map((p) => (p.kind === 'code' ? 'the code' : 'the equation')))];
    feed({ move: 'say', text: `Found ${names.join(' and ')}. The explanation comes next, with the Director. Esc to go back.` });
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
          if (AUTO_ASK) {                               // test: save what the scene looks like once the pieces are live, then press Esc
            setTimeout(async () => require('fs').writeFileSync(path.join(__dirname, '..', 'samples', 'live-ask.png'), (await overlay.webContents.capturePage()).toPNG()), 8000);
            setTimeout(() => js('cancel()'), 12000);
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
    const ok = r && !r.error && r.identical && kinds === 'code,equation';
    log(ok ? 'PASS Casting found the equation and the code, they lifted and went live, and the screen came back identical' : 'FAIL ' + JSON.stringify({ ...r, placed: kinds }));
    process.exitCode = ok ? 0 : 1; app.quit();
  }, 1200);
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
