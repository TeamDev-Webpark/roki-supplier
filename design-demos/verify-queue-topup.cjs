'use strict';
const {run,login,switchTo,store,assert}=require('./_env.cjs');
/* A browser record whose queues were all worked off (the "empty page" case) is topped up once, and every
   role then has sample work to click through. */
run('empty queues are topped up with linked sample work',async({base,context})=>{
 const p=await context.newPage();await login(p,base,'roki','r-issue','approvals');
 await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem(STORE));d.demoDataVersion=4;
  for(const q of d.quotes)if(['Draft','Supplier approval','ROKI Issue','ROKI Check','ROKI Approve','Reverted'].includes(q.status))q.status='Approved';
  for(const n of d.notifications)n.read=true;localStorage.setItem(STORE,JSON.stringify(d))});
 await p.reload();
 const counts=await p.evaluate(()=>{const c={};for(const q of db.quotes)c[q.status]=(c[q.status]||0)+1;return {c,v:db.demoDataVersion,orphan:db.quotes.filter(q=>!q.requestedBy||!db.notifications.some(n=>n.id===q.requestedBy)).length,trailless:db.quotes.filter(q=>q.status!=='Draft'&&!q.trail.length).length}});
 assert.equal(counts.v,5);assert(counts.c['ROKI Issue']>=3&&counts.c['ROKI Check']>=3&&counts.c['ROKI Approve']>=3,JSON.stringify(counts.c));
 assert(counts.c['Supplier approval']>=6&&counts.c.Reverted>=3&&counts.c.Draft>=3,JSON.stringify(counts.c));
 if(counts.orphan)console.log('orphans',counts.orphan);assert(counts.orphan<=2,'Every quotation links to its request');assert.equal(counts.trailless,0);
 for(const [id,portal,min] of [['r-issue','roki',3],['r-check','roki',3],['r-approve','roki',3],['s1-issue','supplier',3],['s2-issue','supplier',3],['s3-issue','supplier',3],['s1-approve','supplier',2],['s2-approve','supplier',2],['s3-approve','supplier',2]]){
  await switchTo(p,base,portal,id,'approvals');
  const rows=await p.locator('.content tbody tr[data-open], .content tbody tr[data-plan-item], .content tbody tr[data-desk-row]').count();assert(rows>=min,id+' rows '+rows);
 }
 /* click one quotation through every hand-off, using the queue pages as a presenter would */
 await switchTo(p,base,'supplier','s1-approve','approvals');
 const id=await p.locator('tr[data-open]').first().getAttribute('data-open');
 const status=()=>p.evaluate(id=>db.quotes.find(q=>q.id===id).status,id);
 const step=async(account,portal,from,to)=>{
  await switchTo(p,base,portal,account,'approvals');await p.locator(`tr[data-open="${id}"]`).click();
  await p.locator('[data-transition="advance"]').click();await p.locator('#confirm-action').check();await p.locator('[data-action="confirm-transition"]').click();
  await p.locator('.dialog').waitFor({state:'detached'});assert.equal(await status(),to,from+' → '+to);
  await p.goto(base+portal+'.html#approvals');assert.equal(await p.locator(`tr[data-open="${id}"]`).count(),0,'Leaves the '+account+' queue');
 };
 await step('s1-approve','supplier','Supplier approval','ROKI Issue');
 await step('r-issue','roki','ROKI Issue','ROKI Check');
 await step('r-check','roki','ROKI Check','ROKI Approve');
 await step('r-approve','roki','ROKI Approve','Approved');
 const done=await store(p);assert(done.history.some(h=>h.quote===id));
 const again=await p.evaluate(()=>{const n=db.quotes.length;db=populateDemoData(db);return db.quotes.length===n});assert(again,'Second run adds nothing');
});
