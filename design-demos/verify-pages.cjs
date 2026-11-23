'use strict';
/* Every demo account opens every page it can reach, in English and Thai, with no page or console errors. */
const {run,reset,login,assert}=require('./_env.cjs');
const ROKI=['internal-pending','supplier-waiting','process','process/i1','overview','request-new','request-register','request-drafts','request-dispatch','request-review','request-tracking','quotes','approvals','schedule','history','parts','suppliers','reports','outbox','exports','part/i1','supplier/s1','account/s1-issue','price-record/0','request-detail/N-DEMO-001/i6'];
const SUPPLIER=['process','overview','quotes','approvals','sent','requests','history','parts','reports','outbox'];
const GROUPS=[['roki',['r-issue','r-check','r-approve'],ROKI],['supplier',['s1-issue','s1-approve','s2-issue','s2-approve','s3-issue','s3-approve'],SUPPLIER]];
run('verify-pages',async({base,context,shot})=>{
  const page=await context.newPage();let combos=0;
  for(const lang of ['en','th']){
    await page.addInitScript(l=>{try{localStorage.setItem('roki-lang',l)}catch{}},lang);
    for(const [portal,accounts,routes] of GROUPS){
      for(const account of accounts){
        await reset(page,base,portal);await page.evaluate(l=>localStorage.setItem('roki-lang',l),lang);await page.reload();
        await login(page,base,portal,account);
        await page.locator('.metrics').waitFor();assert.equal(await page.locator('.metric').count(),4,`${account} metrics`);
        for(const route of routes){
          if(portal==='roki'&&(['request-new','request-drafts'].includes(route)&&account!=='r-issue'||route==='request-dispatch'&&!['r-issue','r-approve'].includes(account)||route==='request-review'&&account==='r-issue'))continue;
          await page.goto(`${base}${portal}.html#${route}`);await page.locator('.content h1').waitFor();
          assert.equal(await page.getByText('This view could not be loaded.').count()+await page.getByText('ไม่สามารถโหลดหน้านี้ได้').count(),0,`${lang} ${account} ${route}`);
          combos++;
        }
      }
    }
  }
  await page.evaluate(()=>localStorage.setItem('roki-lang','en'));
  await login(page,base,'roki','r-check','overview');await shot(page,'roki-overview-fixed.png');
  console.log(`  ${combos} account/page/language combinations opened`);
});
