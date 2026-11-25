'use strict';
const {run,reset,login,assert}=require('./_env.cjs');
async function assertMenu(page,target){
 const expected=target?['#'+target]:[];
 for(const selector of ['.sidebar > .side-nav','.mobile-nav']){
  assert.deepEqual(await page.locator(selector+' a.active').evaluateAll(nodes=>nodes.map(n=>n.hash)),expected,selector+' active on '+page.url());
  assert.deepEqual(await page.locator(selector+' a[aria-current="page"]').evaluateAll(nodes=>nodes.map(n=>n.hash)),expected,selector+' aria-current on '+page.url());
 }
}
run('verify-sidebar-navigation',async({base,context,errors})=>{
 for(const [portal,account] of [['roki','r-issue'],['roki','r-check'],['roki','r-approve'],...['s1','s2','s3'].flatMap(s=>[['supplier',s+'-issue'],['supplier',s+'-approve']])]){
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
  await assertMenu(page,target.slice(1));
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
   await assertMenu(page,href.slice(1));
  }
  await page.locator('[data-lang="th"]').click();
  await page.locator('[data-lang="en"]').click();
  assert.equal(await page.locator('.sidebar a[href="#overview"] span').innerText(),'Overview');
  assert(await page.evaluate(()=>document.querySelector('.sidebar')===sidebarBefore&&document.querySelector('.sidebar > .side-nav')===navBefore));
  await page.setViewportSize({width:390,height:844});
  await page.locator('.mobile-nav a[href="#overview"]').click();
  await page.waitForFunction(()=>document.querySelector('.mobile-nav a.active')?.getAttribute('href')==='#overview');
  assert.equal(await page.locator('.content h1').count(),1);
  await assertMenu(page,'overview');

  // Deep links must resolve from the document ID and the signed-in role,
  // even without visiting a menu first. Sample each available workflow state.
  const cases=await page.evaluate(()=>{
   const samples=new Map();
   for(const q of visibleQuotes()){
    const key=q.status==='Approved'?priceValidity(q):q.status;
    if(!samples.has(key))samples.set(key,q);
   }
   const cases=[['quote/missing',''],['print/missing',''],['parts','parts'],['records','records'],['reports','records'],['history','records']];
   for(const q of samples.values()){
    const mine=portal==='roki'?q.status==='ROKI '+user.role:user.role==='Issue'?['Draft','Reverted'].includes(q.status):q.status==='Supplier approval';
    const menu=mine?'approvals':['ROKI Issue','ROKI Check','ROKI Approve'].includes(q.status)?'sent':q.status==='Approved'&&activeQuote(q.item)?.id===q.id?'quotes':'records';
    cases.push(['quote/'+q.id,menu],['print/'+q.id,menu]);
   }
   const i=currentItems()[0];if(i)cases.push(['part/'+i.id,'parts']);
   const n=db.notifications.find(n=>portal==='roki'||n.supplier===user.supplier);
   const requestMenu=portal==='roki'?'schedule':user.role==='Issue'?'approvals':'requests';
   if(n)cases.push(['request-detail/'+n.id+'/'+n.items[0],requestMenu]);
   if(portal==='supplier')cases.push(['requests',requestMenu],['request-form','']);
   else{
    cases.push(['request-tracking','schedule'],['request-form',user.role==='Issue'?'request-new':'']);
    const r=rfqRecords().find(r=>rfqEditable(r));
    if(user.role==='Issue'&&r)cases.push(['request-new/'+r.id,'schedule'],['request-form/'+r.id,'schedule']);
   }
   return cases;
  });
  for(const [route,menu] of cases){
   await page.goto(base+portal+'.html#'+route);
   await assertMenu(page,menu);
   assert.equal(await page.getByText('This view could not be loaded.',{exact:false}).count(),0,route);
  }
  // A status refresh on the same document must also update cached navigation.
  const quote=await page.evaluate(()=>visibleQuotes()[0]?.id);
  assert(quote,'Account has a quotation fixture');
  await page.goto(base+portal+'.html#quote/'+quote);
  await page.evaluate(id=>{window.navQuoteSnapshot=structuredClone(db.quotes.find(q=>q.id===id))},quote);
  for(const [state,menu] of [['mine','approvals'],['active','quotes'],['future','records']]){
   await page.evaluate(({id,state})=>{
    const q=db.quotes.find(q=>q.id===id);
    q.status=state==='mine'?(portal==='roki'?'ROKI '+user.role:user.role==='Issue'?'Draft':'Supplier approval'):'Approved';
    q.effective=state==='future'?addMonths(TODAY,1):TODAY;q.revision=999;
    render();
   },{id:quote,state});
   await assertMenu(page,menu);
  }
  await page.locator('[data-lang="th"]').click();await assertMenu(page,'records');
  await page.locator('[data-lang="en"]').click();await assertMenu(page,'records');
  await page.evaluate(id=>{Object.assign(db.quotes.find(q=>q.id===id),window.navQuoteSnapshot);render()},quote);
  await page.close();
 }
}).catch(e=>{console.error(e);process.exit(1)});
