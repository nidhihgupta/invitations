/*
 * Renders the images a theme needs outside the browser app:
 *   themes/<id>/email/envelope-<palette>-<ground>-<accent>.png  (email header, one per color pair)
 *   themes/<id>/og.png                                 (link preview in WhatsApp / iMessage)
 *
 * Usage: serve the repo root (python3 -m http.server 8765), then
 *   node tools/render-images.js [theme] [baseUrl]
 * Needs Playwright (npm i -g playwright). Set FONTS_VIA_CURL=1 in sandboxes whose browser
 * cannot reach Google Fonts directly.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const Core = require('../backend/core.js');

const theme = process.argv[2] || 'diwali';
const base = (process.argv[3] || 'http://localhost:8765/').replace(/\/?$/, '/');
const meta = Core.THEMES[theme];

(async () => {
  const args = process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=localhost;127.0.0.1'] : [];
  const browser = await chromium.launch({ args });
  async function fontRoute(c) {
    if (!process.env.FONTS_VIA_CURL) return;
    await c.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
      const url = route.request().url();
      const body = require('child_process').execFileSync('curl', ['-sSL', '-A', 'Mozilla/5.0 Chrome/140', url], { maxBuffer: 1 << 26 });
      route.fulfill({ status: 200, body, headers: { 'content-type': url.includes('css2') ? 'text/css' : 'font/woff2', 'access-control-allow-origin': '*' } });
    });
  }
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  await fontRoute(ctx);
  const page = await ctx.newPage();
  const dir = path.join(__dirname, '..', 'themes', theme);
  fs.mkdirSync(path.join(dir, 'email'), { recursive: true });

  async function shot(mode, qs, file, size, clip) {
    await page.setViewportSize(size);
    await page.goto(base + 'tools/render.html?mode=' + mode + '&theme=' + theme + '&' + qs);
    await page.waitForSelector('body[data-ready]');
    await page.screenshot({ path: file, type: 'png', clip });
    console.log('wrote', path.relative(process.cwd(), file));
  }

  // One set of envelope images per palette (several card designs can share a palette).
  for (const key of Object.keys(meta.palettes)) {
    const template = Object.keys(meta.templates).find((t) => meta.templates[t] === key);
    const pal = meta.palettes[key];
    for (let g = 0; g < pal.grounds.length; g++) {
      for (let a = 0; a < pal.accents.length; a++) {
        const qs = 'template=' + template + '&ground=' + encodeURIComponent(pal.grounds[g].value) + '&accent=' + encodeURIComponent(pal.accents[a].value);
        await shot('email', qs, path.join(dir, 'email', 'envelope-' + key + '-' + g + '-' + a + '.png'), { width: 700, height: 480 }, { x: 40, y: 40, width: 620, height: 400 });
      }
    }
  }
  await ctx.close();
  // Link previews are shown small; render at 1x so the file stays light.
  const og = await browser.newContext({ deviceScaleFactor: 1 });
  await fontRoute(og);
  const p2 = await og.newPage();
  await p2.setViewportSize({ width: 1200, height: 630 });
  const first = meta.palettes[meta.templates[Object.keys(meta.templates)[0]]];
  await p2.goto(base + 'tools/render.html?mode=og&theme=' + theme + '&ground=' + encodeURIComponent(first.grounds[0].value) + '&accent=' + encodeURIComponent(first.accents[0].value));
  await p2.waitForSelector('body[data-ready]');
  await p2.screenshot({ path: path.join(dir, 'og.png'), type: 'png' });
  console.log('wrote', path.join('themes', theme, 'og.png'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
