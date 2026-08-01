import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport:{width:1440,height:1000}, colorScheme:'dark', deviceScaleFactor:2, permissions:['microphone'] });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('http://localhost:3000/', {waitUntil:'networkidle'});
await p.getByText('Rosa Iqbal').click();
await p.waitForTimeout(1500);
await p.getByRole('button', { name: /Ask about this patient/i }).click();
await p.waitForTimeout(6000);
console.log('status:', await p.locator('.voice-status').innerText());
const input = p.getByPlaceholder('Or type instead of speaking');
if (await input.count()) {
  await input.fill('How is her recovery going, and what should she be doing about weight bearing?');
  await p.getByRole('button', { name: 'Send' }).click();
  await p.waitForTimeout(12000);
}
const turns = await p.locator('.turn').allInnerTexts();
console.log('turns:', turns.length);
turns.forEach(t=>console.log('  -', t.replace(/\n/g,' | ').slice(0,180)));
console.log('grounded:', await p.locator('.grounded').count() ? await p.locator('.grounded').innerText() : '(none)');
await p.screenshot({path:'/tmp/voice-live.png', fullPage:false});
console.log('errors:', errs.length); errs.slice(0,5).forEach(e=>console.log('  !',e));
await b.close();
