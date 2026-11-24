import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
const require = createRequire(import.meta.url);
// Optional local tooling only; no browser dependency is shipped with the app.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: '3097' }, stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch('http://localhost:3097/tests/fixtures/center-workflows.html')).ok) break; } catch {} await setTimeout(100); }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  for (const language of ['kk', 'ru']) for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, timezoneId: 'Asia/Qyzylorda' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(lang => localStorage.setItem('qadam.center.language', lang), language);
    await page.goto('http://localhost:3097/tests/fixtures/center-workflows.html');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-records]').click();
    await page.locator('[data-record-day="2026-11-24"]').click();
    await page.locator('[data-session-status="present"]').click();
    await page.waitForFunction(() => window.testWrites.some(row => row.status === 'present'));
    assert.equal(await page.locator('[data-session-status="present"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-session-status="absent"]').click();
    await page.waitForFunction(() => window.testWrites.some(row => row.status === 'absent'));
    await page.locator('[data-record-day="2026-11-25"]').click();
    assert.equal(await page.locator('[data-session-id]').count(), 0);
    await page.locator('[data-record-add-session]').click();
    assert.equal(await page.locator('[data-action="save-session"] [name="child_id"]').inputValue(), 'test-child');
    assert.match(await page.locator('[name="starts_at"]').inputValue(), /^2026-11-25/);
    await page.locator('[data-view="students"]').click();
    await page.locator('[data-homework]').click();
    await page.locator('.center-homework-options input[value="communication-01"]').check();
    const spoon = page.locator('.center-homework-options input[value="imitation-09"]');
    await spoon.focus(); await page.keyboard.press('Space');
    assert.equal(await page.locator('.center-homework-options input:checked').count(), 2);
    await page.locator('[name="homework_due"]').fill('2026-11-30');
    await page.locator('[name="homework_note"]').fill('Күніне бірге орындаңыз');
    // Switching language must not discard the selected child's homework draft.
    await page.locator(`[data-language="${language === 'kk' ? 'ru' : 'kk'}"]`).click();
    assert.equal(await page.locator('.center-homework-options input:checked').count(), 2);
    assert.equal(await page.locator('[name="homework_note"]').inputValue(), 'Күніне бірге орындаңыз');
    await page.locator('[data-action="assign-homework"] button[type="submit"]').click();
    await page.waitForFunction(() => window.testWrites.some(row => row.p_child_id === 'test-child'));
    const payload = await page.evaluate(() => window.testWrites.find(row => row.p_child_id));
    assert.equal(payload.p_exercise_ids.length, 2); assert.equal(payload.p_due_on, '2026-11-30');
    assert.deepEqual(payload.p_exercise_ids.sort(), ['communication-01', 'imitation-09']);
    assert.equal(await page.locator('.center-homework-history > li').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `tests/center-workflows-${language}-${width}.png`, fullPage: true });
    console.log(`PASS ${language} ${width}: attendance correction, empty date, scheduling, selection, draft, assignment, layout`);
    await page.close();
  }
} finally { await browser?.close(); server.kill(); }
