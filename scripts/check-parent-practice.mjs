import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { exercises } from '../src/data/exercises.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: '3098' }, stdio: 'ignore' });
let browser;
try {
  for (let i=0;i<50;i++) { try { if ((await fetch('http://localhost:3098/')).ok) break; } catch {} await setTimeout(100); }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  for (const language of ['kk','ru']) for (const width of [1440,375]) {
    const parent = '11111111-1111-4111-8111-111111111111';
    const child = '22222222-2222-4222-8222-222222222222';
    const db = { children: [{ id: child, parent_id: parent, name: 'Тест бала', age: 5, diagnosis: '', home_language: 'Қазақша', meaningful_words: '' }], skill_assessments: [], child_skill_levels: [], child_exercise_progress: [], daily_plans: [], exercise_attempts: [] };
    let failChildren = false; let failWrites = false;
    const session = { access_token: 'test-parent', expires_at: Math.floor(Date.now()/1000)+3600, user: { id: parent, app_metadata: { center_parent: true, role: 'parent' } } };
    async function context() {
      const ctx = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'Asia/Qyzylorda' });
      await ctx.addInitScript(({ session, language }) => { localStorage.setItem('qadam.auth.session.v1',JSON.stringify(session)); localStorage.setItem('qadam.family.language',language); }, { session, language });
      await ctx.route('https://iismpbsapzmacxqraecx.supabase.co/**', async route => {
        const req=route.request(), url=new URL(req.url());
        const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
        if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
        const table=url.pathname.replace('/rest/v1/','');
        if((failChildren&&table==='children')||(failWrites&&req.method()==='POST'&&!table.startsWith('rpc/')))return route.fulfill({status:503,headers,json:{message:'Test network failure'}});
        if(table==='rpc/active_exercises')return route.fulfill({headers,json:exercises.map(content=>({content}))});
        if(req.method()==='POST'&&!table.startsWith('rpc/')) {
          assert.ok(!['children','center_homework','specialist_assessments'].includes(table),'unexpected ownership/assignment write');
          const rows=req.postDataJSON(); db[table] ||= [];
          const keys=(url.searchParams.get('on_conflict')||'id').split(',');
          for(const row of rows){assert.equal(row.parent_id,parent);assert.equal(row.child_id,child);const existing=db[table].find(item=>keys.every(key=>item[key]===row[key]));if(existing){if(!req.headers().prefer?.includes('ignore-duplicates'))Object.assign(existing,row);}else db[table].push(row);}
          return route.fulfill({status:200,headers,json:[]});
        }
        let rows=db[table]||[];
        for(const [key,value] of url.searchParams)if(value.startsWith('eq.'))rows=rows.filter(row=>String(row[key])===value.slice(3));
        return route.fulfill({headers,json:rows});
      });
      return ctx;
    }
    const ctx=await context(), page=await ctx.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:3098/family'); await page.waitForLoadState('networkidle');
    await page.locator('#family-practice a[href="/today"]').click();
    try { await page.locator('[data-route="/skill-check/1"]').waitFor({timeout:5000}); }
    catch(error) { console.log('BOOTSTRAP DIAGNOSTIC',page.url(),await page.locator('#app').innerText(),errors); await page.screenshot({path:'tests/parent-practice-failure.png',fullPage:true}); throw error; }
    await page.locator('[data-route="/skill-check/1"]').click();
    for(let i=1;i<=16;i++)await page.locator('[data-skill-answer$=":2"]').click();
    await page.waitForFunction(()=>location.pathname==='/plan-ready');
    await page.waitForResponse(response=>response.url().includes('skill_assessments?')&&response.request().method()==='POST');
    assert.equal(db.skill_assessments.length,1);
    await page.locator('[data-route="/today"]').click();
    await page.locator('[data-route^="/daily/"]').last().click();
    for(let i=0;i<3;i++)await page.locator('[data-daily-next]').click();
    await page.locator('[data-show-batch-results]').click();
    for(let i=1;i<=3;i++)await page.locator(`[data-batch-outcome="${i}:independent"]`).click();
    await page.locator('[data-save-batch-outcomes]').click();
    await page.waitForResponse(response=>response.url().includes('exercise_attempts?')&&response.request().method()==='POST');
    assert.equal(db.exercise_attempts.length,3);
    await page.goto('http://localhost:3098/progress'); await page.waitForLoadState('networkidle');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
    await page.screenshot({path:`tests/parent-practice-${language}-${width}.png`,fullPage:true});
    const second=await context(), device=await second.newPage();
    await device.goto('http://localhost:3098/today'); await device.waitForLoadState('networkidle');
    assert.equal(new URL(device.url()).pathname,'/today');
    const restored=await device.evaluate(()=>JSON.parse(localStorage.getItem('qadam.mvp.state.v1')));
    assert.equal(restored.childProfile.name,'Тест бала'); assert.ok(restored.adaptive.initialAssessment.completedAt);
    assert.equal(restored.adaptive.exerciseHistory.length,3);
    failChildren=true; await device.reload(); await device.waitForLoadState('networkidle');
    assert.ok(await device.locator('[role="alert"]').count()); assert.equal(await device.locator('[data-daily-next]').count(),0);
    failChildren=false;
    // Switch identity without clearing browser state: stale child must never render.
    await device.evaluate(()=>{const session=JSON.parse(localStorage.getItem('qadam.auth.session.v1'));session.user.id='33333333-3333-4333-8333-333333333333';localStorage.setItem('qadam.auth.session.v1',JSON.stringify(session));});
    // Disable initial session injection for this reload by overriding after navigation.
    await second.addInitScript(()=>{const session=JSON.parse(localStorage.getItem('qadam.auth.session.v1'));session.user.id='33333333-3333-4333-8333-333333333333';localStorage.setItem('qadam.auth.session.v1',JSON.stringify(session));});
    await device.reload(); await device.waitForLoadState('networkidle');
    assert.ok(await device.locator('[role="alert"]').count());
    assert.deepEqual(errors,[]);
    await second.close(); await ctx.close();
    console.log(`PASS ${language} ${width}: family, 16 questions, plan, 3 results, second device, failed hydrate, changed account`);
  }
} finally { await browser?.close(); server.kill(); }
