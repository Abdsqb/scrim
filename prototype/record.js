// Recorder: plays the demo scene on a stepped clock and saves one image per frame into prototype/frames/.
// Because the clock is stepped, the result shows the motion exactly as designed, regardless of how fast this machine is.
// Turn the frames into a video with ffmpeg, if you have it:
//   ffmpeg -framerate 30 -i prototype/frames/f%05d.jpg -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -crf 19 scene.mp4
// `--frames N` stops after N frames (used by the tests).
const { app, BrowserWindow, desktopCapturer, screen } = require('electron');
const fs = require('fs'), path = require('path');
const demoScript = require('./demo-script');
app.disableHardwareAcceleration();          // software drawing, so every run produces the same frames
const FPS = 30, out = path.join(__dirname, 'frames');
const limitArg = process.argv.indexOf('--frames'), LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : 3000;
const log = (...a) => console.log('[rec]', ...a);

app.whenReady().then(async () => {
  try {
    fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
    const display = screen.getPrimaryDisplay(), { x, y, width: W, height: H } = display.bounds;
    const notes = new BrowserWindow({ x, y, width: W, height: H, frame: false, show: true });
    await notes.loadFile(path.join(__dirname, 'notes.html')); await new Promise((r) => setTimeout(r, 900));
    const rects = await notes.webContents.executeJavaScript('pieceRects()');
    const shot = (await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: W, height: H } }))[0].thumbnail;

    const overlay = new BrowserWindow({ x, y, width: W, height: H, frame: false, show: false, alwaysOnTop: true, backgroundColor: '#000000' });
    await overlay.loadFile(path.join(__dirname, 'stage.html'));
    const js = (code) => overlay.webContents.executeJavaScript(code);
    await js(`freeze(${JSON.stringify('data:image/png;base64,' + shot.toPNG().toString('base64'))})`); overlay.show(); await new Promise((r) => setTimeout(r, 300));

    const before = (await overlay.webContents.capturePage()).toPNG();
    await js(`run(${JSON.stringify(demoScript(W, rects))}, { manual: true }); 0`);
    let n = 0, stepMs = 0, st;
    do {
      const a = performance.now(); st = await js(`advance(${1000 / FPS}); state()`); stepMs += performance.now() - a;
      await js('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
      fs.writeFileSync(path.join(out, 'f' + String(n).padStart(5, '0') + '.jpg'), (await overlay.webContents.capturePage()).toJPEG(93));
      n++;
      if (st.error) throw new Error('scene error: ' + st.error);
    } while (!st.done && n < LIMIT);
    log(`frames ${n}, scene ${(n / FPS).toFixed(1)} s, average step ${(stepMs / n).toFixed(2)} ms`);
    if (st.done) { const after = (await overlay.webContents.capturePage()).toPNG(); log('restored screen identical to frozen screen ->', before.equals(after), '| leftover tweens', st.active); if (!before.equals(after)) process.exitCode = 1; }
    log('DONE');
  } catch (e) { log('ERROR', e.stack || e); process.exitCode = 1; }
  app.quit();
});
