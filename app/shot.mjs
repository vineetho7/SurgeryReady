/**
 * Screenshot harness. Renders pages in Chromium and reports console errors,
 * failed requests, and how many times the page navigated (to catch reload loops).
 *
 *   node shot.mjs <path> <out.png> [light|dark]
 */
import { chromium } from 'playwright';

const [, , path = '/preview', out = 'shot.png', scheme = 'light'] = process.argv;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  colorScheme: scheme,
  deviceScaleFactor: 2,
});

const errors = [];
const failed = [];
let navigations = 0;

page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => failed.push(`${r.url()} — ${r.failure()?.errorText}`));
page.on('framenavigated', (f) => f === page.mainFrame() && navigations++);

await page.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle' });
// Sit still for a beat: a redirect loop shows up as navigations climbing here.
await page.waitForTimeout(3000);

await page.screenshot({ path: out, fullPage: true });

console.log(`path=${path} scheme=${scheme}`);
console.log(`navigations=${navigations} ${navigations > 2 ? '  <-- RELOAD LOOP' : '(stable)'}`);
console.log(`console errors: ${errors.length}`);
errors.slice(0, 8).forEach((e) => console.log(`  ! ${e}`));
console.log(`failed requests: ${failed.length}`);
failed.slice(0, 8).forEach((f) => console.log(`  x ${f}`));

await browser.close();
