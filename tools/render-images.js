/*
 * Renders the images a theme needs outside the browser app:
 *   themes/<id>/email/stamp-<palette>-<ground>-<accent>.png  (stamp + postmark on the email's envelope)
 *   themes/<id>/og.png                                        (link preview in WhatsApp / iMessage)
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
  async function context(scale) {
    const ctx = await browser.newContext({ deviceScaleFactor: scale });
    if (process.env.FONTS_VIA_CURL) {
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
        const url = route.request().url();
        const body = require('child_process').execFileSync('curl', ['-sSL', '-A', 'Mozilla/5.0 Chrome/140', url], { maxBuffer: 1 << 26 });
        route.fulfill({ status: 200, body, headers: { 'content-type': url.includes('css2') ? 'text/css' : 'font/woff2', 'access-control-allow-origin': '*' } });
      });
    }
    return ctx.newPage();
  }
  async function shot(page, qs, file, size, omitBackground) {
    await page.setViewportSize(size);
    await page.goto(base + 'tools/render.html?theme=' + theme + '&' + qs);
    await page.waitForSelector('body[data-ready]');
    await page.screenshot({ path: file, type: 'png', omitBackground });
    console.log('wrote', path.relative(process.cwd(), file));
  }
  const dir = path.join(__dirname, '..', 'themes', theme);
  const emailDir = path.join(dir, 'email');
  fs.mkdirSync(emailDir, { recursive: true });
  fs.readdirSync(emailDir).filter((f) => f.endsWith('.png')).forEach((f) => fs.unlinkSync(path.join(emailDir, f)));

  // One stamp per palette and color pair; drawn at 440x240 and shown at 220x120 in emails.
  const page = await context(1);
  for (const key of Object.keys(meta.palettes)) {
    const template = Object.keys(meta.templates).find((t) => meta.templates[t] === key);
    const pal = meta.palettes[key];
    for (let g = 0; g < pal.grounds.length; g++) {
      for (let a = 0; a < pal.accents.length; a++) {
        const qs = 'mode=stamp&template=' + template + '&ground=' + encodeURIComponent(pal.grounds[g].value) + '&accent=' + encodeURIComponent(pal.accents[a].value);
        await shot(page, qs, path.join(emailDir, 'stamp-' + key + '-' + g + '-' + a + '.png'), { width: 440, height: 240 }, true);
      }
    }
  }

  const first = Object.keys(meta.templates)[0];
  const fp = meta.palettes[meta.templates[first]];
  await shot(page, 'mode=og2&template=' + first + '&ground=' + encodeURIComponent(fp.grounds[0].value) + '&accent=' + encodeURIComponent(fp.accents[0].value),
    path.join(dir, 'og.png'), { width: 1200, height: 630 }, false);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
