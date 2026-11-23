'use strict';
/* Shared helpers for the verify-*.cjs browser checks.
   - Serves this folder from a built-in static server (no Python needed) unless BASE_URL is set.
   - Launches the installed Chrome (or Edge) through playwright-core; set CHROME_PATH to override. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const ROOT=__dirname;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json'};

function startServer(){
  if(process.env.FILE_MODE==='1')return Promise.resolve({base:require('node:url').pathToFileURL(ROOT+path.sep).href,close:async()=>{}});
  if(process.env.BASE_URL)return Promise.resolve({base:process.env.BASE_URL.replace(/\/?$/,'/'),close:async()=>{}});
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,'')||'index.html',file=path.resolve(ROOT,rel);
    if(rel==='favicon.ico'){res.writeHead(204).end();return}   /* browsers ask for it on their own; the pages do not link one */
    if(!file.startsWith(ROOT+path.sep)&&file!==ROOT){res.writeHead(403).end();return}
    fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return}res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)});
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({base:`http://127.0.0.1:${server.address().port}/`,close:()=>new Promise(r=>server.close(r))})));
}
function findChrome(){
  const candidates=[process.env.CHROME_PATH,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'];
  const found=candidates.find(p=>p&&fs.existsSync(p));
  if(!found)throw new Error('No Chrome/Edge found. Set CHROME_PATH to a Chromium-based browser.');
  return found;
}
/* Runs fn({base,browser,newPage,errors,shot}) with a fresh browser; fails if the page logged any error. */
async function run(name,fn,{viewport={width:1500,height:1100},clock='2026-11-18T03:00:00Z'}={}){
  const srv=await startServer(),browser=await chromium.launch({headless:true,executablePath:findChrome(),args:['--disable-gpu']});
  const errors=[];
  try{
    const context=await browser.newContext({viewport});
    // Fixed test clock and offline font response; production still uses Bangkok's real day.
    if(clock)await context.addInitScript(iso=>{const NativeDate=Date;const fixed=NativeDate.parse(iso);globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]))}static now(){return fixed}}},clock);
    await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
    context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())})});
    const shotDir=path.join(ROOT,'previews');
    await fn({base:srv.base,browser,context,errors,shot:async(page,file,opts={})=>{await page.bringToFront();const target=path.join(shotDir,file);try{await page.screenshot({path:target,fullPage:true,timeout:15000,...opts})}catch{await page.screenshot({path:target,fullPage:false,...opts,timeout:15000})}}});
    assert.deepEqual(errors,[],'Browser errors: '+errors.join(' | '));
    console.log('PASS '+name);
  }finally{await browser.close();await srv.close()}
}
/* ---- page helpers ---- */
const store=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('roki-workspace-demo-v2')));
async function reset(page,base,portal){await page.goto(base+portal+'.html');await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();const fixture=seed();fixture.demoDataVersion=1;localStorage.setItem(STORE,JSON.stringify(fixture))});await page.reload()}
async function login(page,base,portal,account,hash=''){await page.goto(base+portal+'.html'+(hash?'#'+hash:''));if(await page.locator('#demo-account').count()){await page.locator('#demo-account').selectOption(account);await page.locator('[data-action="login"]').click()}await page.locator('.content, .login-layout').first().waitFor()}
async function switchTo(page,base,portal,account,hash=''){await page.evaluate(p=>sessionStorage.removeItem('roki-session-'+p),portal);await login(page,base,portal,account,hash);await page.reload();if(await page.locator('#demo-account').count())await login(page,base,portal,account,hash)}
async function approveStep(page,confirm=true){await page.locator('[data-transition="advance"]').click();if(confirm)await page.locator('#confirm-action').check();await page.locator('[data-action="confirm-transition"]').click()}
async function approveRequestAndSend(page,base){
 const original=await page.evaluate(()=>location.hash),before=(await store(page)).notifications.length;
 await page.locator('#rfq-purpose').fill('Periodic review of approved supplier prices.');
 await page.locator('[data-action="send-notifications"]').click();
 const id=(await page.evaluate(()=>location.hash)).split('/')[1];
 assert.equal((await store(page)).notifications.length,before,'Saving RFQ must not send');
 const act=async(action)=>{await page.locator(`[data-rfq="${action}"]`).click();await page.locator('#rfq-confirm').check();await page.locator('[data-action="rfq-confirm"]').click()};
 await act('submit');
 await switchTo(page,base,'roki','r-check','request-register/'+id);await act('advance');
 await switchTo(page,base,'roki','r-approve','request-register/'+id);await act('advance');
 assert.equal((await store(page)).notifications.length,before,'Approval must not send');
 await switchTo(page,base,'roki','r-issue','request-register/'+id);await act('send');
 await page.goto(base+'roki.html'+(original==='#schedule'?'#schedule':'#request-tracking'));
}
module.exports={run,store,reset,login,switchTo,approveStep,approveRequestAndSend,assert};
