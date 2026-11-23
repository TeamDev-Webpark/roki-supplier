'use strict';
const {run,reset,login,assert}=require('./_env.cjs');
run('verify-sidebar-navigation',async({base,context,errors})=>{
 for(const [portal,account] of [['roki','r-issue'],['supplier','s1-issue']]){
  const page=await context.newPage();
  await page.setViewportSize({width:1400,height:700});
  await reset(page,base,portal);await login(page,base,portal,account);
  await page.evaluate(()=>{
   window.sidebarBefore=document.querySelector('.sidebar');
   window.navBefore=document.querySelector('.sidebar > .side-nav');
   window.mainBefore=document.querySelector('.main');
   window.documentBefore=document;
   navBefore.scrollTop=navBefore.scrollHeight;
   window.navScrollBefore=navBefore.scrollTop;
  });
  const links=await page.locator('.sidebar > .side-nav a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
  const target=links.find(href=>href!=='#overview');
  // DOM click avoids Playwright scrolling the menu to bring a link into view.
  await page.locator(`.sidebar > .side-nav a[href="${target}"]`).evaluate(el=>el.click());
  await page.waitForFunction(hash=>location.hash===hash&&document.querySelector('.sidebar a.active')?.getAttribute('href')===hash,target);
  assert(await page.evaluate(()=>document===documentBefore&&document.querySelector('.sidebar')===sidebarBefore&&document.querySelector('.main')===mainBefore&&document.querySelector('.sidebar > .side-nav')===navBefore));
  assert.equal(await page.evaluate(()=>navBefore.scrollTop),await page.evaluate(()=>navScrollBefore));
  assert.equal(await page.locator('.sidebar a[aria-current="page"]').getAttribute('href'),target);
  await page.goBack();
  await page.waitForFunction(()=>document.querySelector('.sidebar a.active')?.getAttribute('href')==='#overview');
  await page.goForward();
  await page.waitForFunction(hash=>document.querySelector('.sidebar a.active')?.getAttribute('href')===hash,target);
  await page.evaluate(()=>render());
  assert.equal(await page.evaluate(()=>navBefore.scrollTop),await page.evaluate(()=>navScrollBefore));
  for(const href of links){
   await page.locator(`.sidebar > .side-nav a[href="${href}"]`).evaluate(el=>el.click());
   await page.waitForFunction(hash=>document.querySelector('.sidebar a.active')?.getAttribute('href')===hash,href);
   assert.equal(await page.locator('.content h1').count(),1,portal+' '+href+' '+await page.locator('.content').innerText()+' '+errors.join(' | '));
   assert(await page.evaluate(()=>document.querySelector('.sidebar > .side-nav')===navBefore));
   assert.equal(await page.evaluate(()=>navBefore.scrollTop),await page.evaluate(()=>navScrollBefore));
  }
  await page.locator('[data-lang="th"]').click();
  await page.locator('[data-lang="en"]').click();
  assert.equal(await page.locator('.sidebar a[href="#overview"] span').innerText(),'Overview');
  assert(await page.evaluate(()=>document.querySelector('.sidebar')===sidebarBefore&&document.querySelector('.sidebar > .side-nav')===navBefore));
  await page.setViewportSize({width:390,height:844});
  await page.locator('.mobile-nav a[href="#overview"]').click();
  await page.waitForFunction(()=>document.querySelector('.mobile-nav a.active')?.getAttribute('href')==='#overview');
  assert.equal(await page.locator('.content h1').count(),1);
  await page.close();
 }
}).catch(e=>{console.error(e);process.exit(1)});
