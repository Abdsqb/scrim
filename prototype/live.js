// Scrim, live. Press the hotkey on any screen, drag a box around each piece you are asking about, and the pieces lift off the page.
//   Ctrl+Alt+Space  freeze the screen and start selecting (falls back to Alt+Shift+Space or Ctrl+Alt+X if taken)
//   drag            box a piece; it lifts on release. Up to four
//   Enter           done selecting; the page recedes behind the pieces. Pressing the hotkey again does the same
//   Esc             cancel, or end a scene early. The screen comes back
//   Ctrl+Alt+Q      quit
// --demo          show the sample lecture notes and play the hand-written demo scene instead of selecting
// --auto          play the demo scene once and exit; --auto --abort also ends it early. For testing
// --auto-select   drag two boxes on the sample notes by itself, check the screen comes back identical, and exit. For testing
//                 add --esc-while-selecting to press Esc before Enter instead
const { app, BrowserWindow, desktopCapturer, globalShortcut, screen } = require('electron');
const path = require('path');
const demoScript = require('./demo-script');
const has = (flag) => process.argv.includes(flag);
const AUTO = has('--auto'), ABORT = has('--abort'), AUTO_SELECT = has('--auto-select'), DEMO = has('--demo') || AUTO;
const ESC_EARLY = has('--esc-while-selecting');   // with --auto-select: press Esc before Enter, with two pieces already lifted
const HOTKEYS = ['Control+Alt+Space', 'Alt+Shift+Space', 'Control+Alt+X'];   // first one that is free wins
const log = (...a) => console.log('[live]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Windows shrinks a new window to fit above the taskbar, which squashed the screenshot. Setting the bounds again after creation is not clamped.
const cover = (win, bounds) => { win.setBounds(bounds); return win; };
let busy = false, selecting = false;

app.whenReady().then(async () => {
  const display = screen.getPrimaryDisplay(), { x, y, width: W, height: H } = display.bounds, sf = display.scaleFactor;
  log(`display ${W}x${H} at scale ${sf}, ${process.platform}, electron ${process.versions.electron}`);

  // The sample page stands in for the user's screen in the demo and the selection test. The real app has no window of its own.
  let notes = null;
  if (DEMO || AUTO_SELECT) {
    notes = cover(new BrowserWindow({ x, y, width: W, height: H, frame: false, backgroundColor: '#fbfaf6' }), display.bounds);
    await notes.loadFile(path.join(__dirname, 'notes.html'));
  }

  // The stage is created hidden at start-up so that showing it later is instant.
  const overlay = cover(new BrowserWindow({ x, y, width: W, height: H, frame: false, show: false, alwaysOnTop: true, skipTaskbar: true, resizable: false,
    backgroundColor: '#000000', webPreferences: { backgroundThrottling: false } }), display.bounds);
  overlay.setAlwaysOnTop(true, 'screen-saver');
  await overlay.loadFile(path.join(__dirname, 'stage.html'));
  const js = (code) => overlay.webContents.executeJavaScript(code);

  // Capture the screen and show it on the stage. To the user nothing has changed yet.
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
  }

  async function explain() {
    if (busy) { if (selecting) js('finishSelect()'); return null; }   // the hotkey again while selecting means "done"
    busy = true;
    try {
      const rects = DEMO ? await notes.webContents.executeJavaScript('pieceRects()') : null;
      await freeze();
      globalShortcut.register('Escape', () => { js('cancel()'); });
      let before = null;
      if (AUTO_SELECT) { await sleep(300); before = (await overlay.webContents.capturePage()).toBitmap(); }

      let script, picks = null;
      if (DEMO) {
        if (ABORT) setTimeout(() => js('abort()'), 6000);
        script = demoScript(W, rects);
      } else {
        // Enter is taken globally only while selecting, because the stage may not get keyboard focus from another app.
        selecting = true; globalShortcut.register('Return', () => { js('finishSelect()'); });
        if (AUTO_SELECT) autoSelect();
        const tSel = performance.now();
        picks = await js('select()');
        selecting = false; globalShortcut.unregister('Return');
        log(picks ? `selected ${picks.length} in ${((performance.now() - tSel) / 1000).toFixed(1)} s: ${JSON.stringify(picks.map((p) => p.rect))}` : 'selection cancelled');
        // No director yet, so the page recedes behind the pieces and the scene holds until Esc. The director's script will play here.
        const n = picks ? picks.length : 0;
        script = n ? [{ move: 'recede', pause: 120 }, { move: 'say', text: `${n === 1 ? 'One piece' : n + ' pieces'} lifted. Esc to go back.` }, { move: 'wait' }] : [];
      }

      const tRun = performance.now();
      const result = await js(`run(${JSON.stringify(script)})`);
      log(`scene ended after ${((performance.now() - tRun) / 1000).toFixed(1)} s`, JSON.stringify(result));
      if (before) {
        await sleep(100);
        result.identical = before.equals((await overlay.webContents.capturePage()).toBitmap());
        result.picks = picks;
        log('restored screen identical to frozen screen ->', result.identical);
      }
      return result;
    } catch (e) { log('ERROR', e.stack || e); return { error: String(e) }; }
    finally { selecting = false; globalShortcut.unregister('Escape'); globalShortcut.unregister('Return'); overlay.hide(); busy = false; }
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
  if (hotkey && !DEMO && !AUTO_SELECT) log(`ready. Open anything, press ${hotkey.replace('Control', 'Ctrl')}, drag a box around each piece, Enter when done, Esc to go back. Ctrl+Alt+Q quits.`);

  if (AUTO) setTimeout(async () => { const r = await explain(); process.exitCode = r && !r.error ? 0 : 1; app.quit(); }, 1200);
  if (AUTO_SELECT) setTimeout(async () => {
    const r = await explain();
    const ok = r && !r.error && r.identical && (ESC_EARLY ? r.picks === null : r.picks && r.picks.length === 2);
    log(ok ? `PASS ${ESC_EARLY ? 'Esc while selecting cancelled' : 'two boxes lifted, the tiny one was ignored,'} and the screen came back identical` : 'FAIL ' + JSON.stringify(r));
    process.exitCode = ok ? 0 : 1; app.quit();
  }, 1200);
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
