// Live demo: a stand-in page of lecture notes, a global hotkey, and the stage playing the demo scene in real time.
//   Ctrl+Alt+Space  capture the screen and play the scene (falls back to Alt+Shift+Space or Ctrl+Alt+X if taken)
//   Esc             end the scene early
//   Ctrl+Alt+Q      quit
// `--auto` plays the scene once without the hotkey and exits; `--auto --abort` also ends it early. Both are for testing.
const { app, BrowserWindow, desktopCapturer, globalShortcut, screen } = require('electron');
const path = require('path');
const demoScript = require('./demo-script');
const AUTO = process.argv.includes('--auto'), ABORT = process.argv.includes('--abort');
const HOTKEYS = ['Control+Alt+Space', 'Alt+Shift+Space', 'Control+Alt+X'];   // first one that is free wins
const log = (...a) => console.log('[live]', ...a);
// Windows shrinks a new window to fit above the taskbar, which squashed the screenshot. Setting the bounds again after creation is not clamped.
const cover = (win, bounds) => { win.setBounds(bounds); return win; };
let busy = false;

app.whenReady().then(async () => {
  const display = screen.getPrimaryDisplay(), { x, y, width: W, height: H } = display.bounds, sf = display.scaleFactor;
  log(`display ${W}x${H} at scale ${sf}, ${process.platform}, electron ${process.versions.electron}`);

  // The page being "studied". In the real app this is whatever is on the user's screen.
  const notes = cover(new BrowserWindow({ x, y, width: W, height: H, frame: false, backgroundColor: '#fbfaf6' }), display.bounds);
  await notes.loadFile(path.join(__dirname, 'notes.html'));

  // The stage is created hidden at start-up so that showing it later is instant.
  const overlay = cover(new BrowserWindow({ x, y, width: W, height: H, frame: false, show: false, alwaysOnTop: true, skipTaskbar: true, resizable: false,
    backgroundColor: '#000000', webPreferences: { backgroundThrottling: false } }), display.bounds);
  overlay.setAlwaysOnTop(true, 'screen-saver');
  await overlay.loadFile(path.join(__dirname, 'stage.html'));
  const js = (code) => overlay.webContents.executeJavaScript(code);

  async function explain() {
    if (busy) return null; busy = true;
    try {
      const t0 = performance.now();
      // Stand-in for the user dragging a box around each piece: the demo page reports where its two pieces are.
      const rects = await notes.webContents.executeJavaScript('pieceRects()');
      // Capture at the screen's real pixel size, which is the reported size times the scale factor.
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(W * sf), height: Math.round(H * sf) } });
      const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
      const tCap = performance.now();
      await js(`freeze(${JSON.stringify('data:image/png;base64,' + source.thumbnail.toPNG().toString('base64'))})`);
      cover(overlay, display.bounds).show(); overlay.focus();
      const inner = await js('[innerWidth, innerHeight]');
      if (inner[0] !== W || inner[1] !== H) log(`WARNING stage is ${inner.join('x')}, screen is ${W}x${H}: pieces will be cut from the wrong place`);
      log(`capture ${Math.round(tCap - t0)} ms, freeze ${Math.round(performance.now() - tCap)} ms`);
      globalShortcut.register('Escape', () => { js('abort()'); });
      if (ABORT) setTimeout(() => js('abort()'), 6000);
      const tRun = performance.now();
      const result = await js(`run(${JSON.stringify(demoScript(W, rects))})`);
      log(`scene ended after ${((performance.now() - tRun) / 1000).toFixed(1)} s`, JSON.stringify(result));
      return result;
    } catch (e) { log('ERROR', e.stack || e); return { error: String(e) }; }
    finally { globalShortcut.unregister('Escape'); overlay.hide(); busy = false; }
  }

  // Another app may already own a hotkey (on Windows, launchers like Flow Launcher or PowerToys often do), so take the first free one.
  const hotkey = HOTKEYS.find((k) => globalShortcut.register(k, explain));
  log(hotkey ? `hotkey ${hotkey}` : `ERROR no free hotkey among ${HOTKEYS.join(', ')}`);
  if (hotkey) notes.webContents.executeJavaScript(`setHotkey(${JSON.stringify(hotkey.replace('Control', 'Ctrl'))})`);
  if (!globalShortcut.register('Control+Alt+Q', () => app.quit())) log('Ctrl+Alt+Q is taken; close the window to quit');
  if (AUTO) setTimeout(async () => { const r = await explain(); process.exitCode = r && !r.error ? 0 : 1; app.quit(); }, 1200);
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
