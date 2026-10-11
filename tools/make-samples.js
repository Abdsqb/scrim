// Renders the made-up study screens in tools/sample-specs.js to samples/*.png, off screen, and writes
// samples/truth.json with each screen's question, the pieces that answer it, and the true box of every piece.
// Run with: npm run samples
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const specs = require('./sample-specs');
const W = 1920, H = 1200, out = path.join(__dirname, '..', 'samples');

app.whenReady().then(async () => {
  try {
    fs.mkdirSync(out, { recursive: true });
    // Off-screen rendering: nothing appears on the real display and the real desktop is never captured.
    const win = new BrowserWindow({ width: W, height: H, show: false, useContentSize: true, webPreferences: { offscreen: true } });
    win.setContentSize(W, H);                           // Windows clamps new windows above the taskbar, even off screen
    let frame = null;                                   // off-screen windows hand over each painted frame here; capturePage does not work for them
    win.webContents.on('paint', (e, dirty, image) => { frame = image; });
    win.webContents.setFrameRate(10);
    const truth = [];
    for (const spec of specs) {
      await win.loadFile(path.join(__dirname, 'sample-page.html'));
      const pieces = await win.webContents.executeJavaScript(`build(${JSON.stringify(spec)})`);
      frame = null;                                     // off-screen painting occasionally skips a frame, so ask again a few times
      for (let tries = 0; tries < 5 && (!frame || frame.isEmpty()); tries++) { win.webContents.invalidate(); await new Promise((r) => setTimeout(r, 600 + tries * 400)); }
      const img = frame;
      if (!img || img.isEmpty()) throw new Error(spec.name + ': no frame was painted');
      const file = spec.name + '.png';
      fs.writeFileSync(path.join(out, file), img.toPNG());
      for (const id of spec.expect) if (!pieces.find((p) => p.id === id)) throw new Error(`${spec.name}: expected piece ${id} has no box`);
      truth.push({ file, size: img.getSize(), question: spec.question, mode: spec.mode || 'lift', expect: spec.expect, optional: spec.optional || [], pieces });
      console.log('[samples]', file, JSON.stringify(img.getSize()), pieces.map((p) => `${p.id}${spec.expect.includes(p.id) ? '*' : ''}`).join(' '));
    }
    fs.writeFileSync(path.join(out, 'truth.json'), JSON.stringify(truth, null, 2));
    console.log(`[samples] wrote ${truth.length} screens and truth.json to ${out}  (* = what the question is about)`);
  } catch (e) { console.log('[samples] ERROR', e.stack || e); process.exitCode = 1; }
  app.quit();
});
