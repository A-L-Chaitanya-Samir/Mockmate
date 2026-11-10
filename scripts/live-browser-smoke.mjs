// Credentials arrive over stdin and stay in memory; no traces/screenshots include tokens.
import { chromium } from '@playwright/test';
let input='';
for await (const part of process.stdin) input+=part;
const {users,session_id}=JSON.parse(input);
const browser=await chromium.launch({channel:'chrome'});
async function check(label,condition) { if (!condition) throw new Error(label); console.log('PASS: '+label); }
async function login(page,user) {
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill(user.password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL('**/dashboard',{timeout:45000});
  await page.getByRole('heading',{name:/Welcome back/}).waitFor({timeout:45000});
}
try {
  const first=await browser.newContext();
  const page=await first.newPage();
  await login(page,users[0]);
  await page.goto(`http://localhost:3000/dashboard/interview/${session_id}/report`);
  await page.getByRole('button',{name:'Export report & history'}).waitFor({timeout:30000});
  await page.reload();
  await page.getByRole('heading',{name:'Recorded questions & answers'}).waitFor({timeout:30000});
  await check('Real browser report survives refresh',true);
  const other=await browser.newContext();
  const secondPage=await other.newPage();
  await login(secondPage,users[0]);
  await secondPage.goto(`http://localhost:3000/dashboard/interview/${session_id}/report`);
  await secondPage.getByRole('button',{name:'Export report & history'}).waitFor({timeout:30000});
  await check('Real report available in separate browser session',true);
  await other.close();
  await page.getByRole('button',{name:'Log out',exact:true}).first().click();
  await page.waitForURL('**/login');
  await login(page,users[1]);
  await page.goto(`http://localhost:3000/dashboard/interview/${session_id}/report`);
  await page.getByRole('heading',{name:'Report not found.'}).waitFor({timeout:30000});
  await check('Real browser account switch isolates report',true);
  for (const width of [390,768,1440]) {
    await page.setViewportSize({width,height:900});
    for (const path of ['/dashboard','/dashboard/resume','/dashboard/interview/setup','/dashboard/settings']) {
      await page.goto('http://localhost:3000'+path);
      await page.locator('h1').waitFor({timeout:30000});
      await check(`Live responsive ${width} ${path}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
  }
  await first.close();
} catch {
  console.log('FAIL: Real-provider browser journey; credentials and browser errors redacted.');
  process.exitCode=1;
} finally { await browser.close(); }
