'use strict';
/* Thai / English switch: persists, translates every screen, keeps data values in English,
   leaves filters and forms working in Thai, and is reachable on mobile and on the login page. */
const {run,store,reset,login,approveRequestAndSend,switchTo,assert}=require('./_env.cjs');
/* UI text that is intentionally the same in both languages */
const IMPORT_CSV=['part_code,part_name,format,supplier_code,rtp_code,drawing,annual_qty,components,review_months,next_review','17999-TST-0001,SAMPLE COVER,Single Part,40110020,S001571-099-01,M206-F-26,25000,,3,2027-01-15','17999-TST-0002,SAMPLE CASE ASSY,assy,40110020,S001571-099-02,04,2400,17999-TST-0001:1,1,',',NO CODE,Single Part,40110020,,,,,,','17999-TST-0003,BAD SUPPLIER,Single Part,99999999,,,,,,','17999-TST-0004,BAD FORMAT,Plastic,40110020,,,,,,','17999-TST-0005,BAD DATE,Single Part,40110046,,,,,,31/02/2027','17999-TST-0006,BAD COMPONENT,Assembly,40110046,,,,17999-TST-0006:1,,','17999-TST-0007,BAD MONTHS,Single Part,40110046,,,,,6,'].join('\r\n');
const SAME=new Set(['Cavity','Supply','Rack','Rev. No.:','Language / ภาษา','Progressive','Blank','Line 01']);
run('verify-i18n',async({base,context})=>{
  const page=await context.newPage();
  await reset(page,base,'roki');

  /* login page switcher, persistence, html lang */
  assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
  await page.locator('[data-lang="th"]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.lang),'th');
  assert.match(await page.locator('h2').first().innerText(),/ยินดีต้อนรับ/);
  await page.reload();assert.match(await page.locator('h2').first().innerText(),/ยินดีต้อนรับ/,'Language persists across reloads');
  await page.locator('#demo-account').selectOption('r-check');await page.locator('[data-action="login"]').click();

  /* navigation and quotation screens in Thai; data values untouched */
  await page.goto(base+'roki.html#quote/Q-2026-0105');await page.locator('.compare-table').waitFor();
  const body=await page.locator('.content').innerText();
  assert.match(body,/เปรียบเทียบต้นทุน/);assert.match(body,/ส่งกลับ Supplier แก้ไข/);
  assert.match(body,/CASE ASSY, AIR\/C/,'Part names stay as entered');assert.match(body,/17221-K1Z-J100/,'Part numbers stay as entered');
  assert.match(body,/พ\.ย\. 2026/,'Dates use Thai month names');
  assert.match(await page.locator('.side-nav').innerText(),/ภาพรวม/);
  assert.equal(await page.evaluate(()=>document.title),'WEBPARK | พื้นที่ทำงานฝ่ายจัดซื้อ');

  /* switching back re-renders in English */
  await page.locator('[data-lang="en"]').click();
  assert.match(await page.locator('.content').innerText(),/Cost comparison/);assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
  await page.locator('[data-lang="th"]').click();

  /* filters keep working in Thai (option values stay English) */
  await page.goto(base+'roki.html#quotes');await page.locator('#status-filter').waitFor();
  assert.match(await page.locator('#status-filter').innerText(),/อนุมัติแล้ว/);
  await page.locator('#status-filter').selectOption('Approved');
  const rows=await page.locator('tbody tr').count();assert(rows>0,'Approved filter returns rows in Thai');
  for(const badge of await page.locator('tbody td:nth-last-child(3) .badge:first-child').allInnerTexts())assert.equal(badge,'อนุมัติแล้ว');
  await page.goto(base+'roki.html#schedule');await page.locator('#status-filter').selectOption('Overdue');
  assert(await page.locator('tbody tr').count()>0,'Schedule filter works in Thai');

  /* toasts, dialogs and validation messages */
  await page.goto(base+'roki.html#quote/Q-2026-0101');
  await page.locator('[data-transition="revert"]').click();
  assert.match(await page.locator('.dialog').innerText(),/ส่งใบเสนอราคากลับให้แก้ไข/);
  await page.locator('[data-action="confirm-transition"]').click();
  assert.match(await page.locator('#toast').innerText(),/ต้องระบุเหตุผล/);
  await page.keyboard.press('Escape');

  /* editor: values saved in English even though labels are Thai */
  await login(page,base,'supplier','s1-issue','requests');
  await page.locator('[data-request]').first().click();
  await page.locator('#remark').fill('ทดสอบการสลับภาษากลางฟอร์ม');
  await page.locator('[data-lang="en"]').click();
  assert.equal(await page.locator('#remark').inputValue(),'ทดสอบการสลับภาษากลางฟอร์ม','Typed text survives a language switch');
  await page.locator('[data-lang="th"]').click();
  const origin=page.locator('select[data-field="origin"]').first();
  if(await origin.count()){const values=await origin.locator('option').evaluateAll(o=>o.map(x=>x.value));assert(values.every(v=>/^[A-Za-z]+$/.test(v)),'Origin option values stay English: '+values)}

  /* mobile: switcher stays reachable */
  await page.setViewportSize({width:390,height:844});await page.goto(base+'supplier.html#overview');
  assert(await page.locator('.top-actions .lang-switch').isVisible(),'Language switch visible on mobile');
  await page.setViewportSize({width:1500,height:1100});

  /* completeness: nothing in the app is left untranslated except data values */
  const data=await store(page);
  const known=new Set();
  const addWords=s=>String(s).split(/[^A-Za-z0-9\-\/]+/).forEach(w=>w&&known.add(w.toLowerCase()));
  data.items.forEach(i=>[i.code,i.name,i.rtp,i.drawing].forEach(addWords));
  data.formulas.versions.forEach(v=>Object.values(v.formats).forEach(f=>{f.sections.forEach(s=>{s.fields.forEach(x=>addWords(x[0]));(s.adj||[]).forEach(a=>addWords(a.key));addWords(s.expr)});addWords(f.total)}));
  ['Bad Key','Test change','col1','adj1','nope','bogus','rate','time','cavity'].forEach(addWords);
  data.quotes.forEach(q=>{addWords(q.id);Object.values(q.costs).forEach(v=>Array.isArray(v)&&v.forEach(r=>Object.values(r).forEach(addWords)))});
  [...data.items].forEach(i=>addWords(i.id));
  const NAMES=['Somchai K.','Jaruphan P.','Wanida T.','Nattapong S.','Anong P.','Pim S.','Somsak T.','Wichai L.','Kanya R.','General Chemicals (Thailand) Co., Ltd.','Pathumthani Rubber Co., Ltd.','Louis Engineering Co., Ltd.','ROKI (THAILAND) Co., Ltd.','SIAM EASTERN INDUSTRIAL PARK · 60/3 MOO 3 MABYANGPORN, PLUAKDAENG, RAYONG 21140','TEL: +66-3-8891594 · FAX: +66-3-8891318'];
  /* free text typed by this script, like a user would; it is data, not UI */
  addWords(IMPORT_CSV);addWords('17999-NEW-0001');['NEW BRACKET','SAMPLE COVER','SAMPLE CASE ASSY','NO CODE','BAD SUPPLIER','BAD FORMAT','BAD DATE','BAD COMPONENT','BAD MONTHS','First quotation.','Plastic','Blank','MESH'].forEach(addWords);
  ['Price not supported by the material index.','Please attach the supplier price notice.','Corrected volume.','Check the tooling cost.'].forEach(addWords);
  NAMES.forEach(addWords);['ROKI','THB','PDF','CSV','SAP','ICT','PM','CT','RTP','VAT','Excel','WebP','JPG','PNG','Rev','Qty','Q','TH','EN','jig','Jig','Dies','Runner','Scrap','Loss','Cycle','time','Drawing','Supply','Cavity','Spare','part','Issue','Check','Approve','Reject','Revert','Single','Part','Assembly'].forEach(w=>known.add(w.toLowerCase()));
  const crawl=await context.newPage();
  await crawl.addInitScript(()=>{localStorage.setItem('roki-lang','th')});
  const leftovers=new Set();
  const grab=async()=>{for(const s of await crawl.evaluate(()=>[...window.__i18nMissing]))if(!SAME.has(s)){const words=s.split(/[^A-Za-z0-9\-\/]+/).filter(w=>/[A-Za-z]{3,}/.test(w)&&!known.has(w.toLowerCase()));if(words.length)leftovers.add(s)}};
  const rokiRoutes=['overview','request-new','request-register','request-drafts','request-dispatch','request-review','request-tracking','quotes','approvals','schedule','history','parts','suppliers','reports','outbox','exports','formulas','quote/Q-2026-0101','quote/Q-2026-0105','quote/Q-2025-0041','quote/Q-2026-0046','print/Q-2026-0046'];
  const supRoutes=['overview','sent','quotes','approvals','requests','history','parts','reports','outbox','quote/Q-2026-0102','quote/Q-2026-0105','new','print/Q-2026-0015'];
  for(const [portal,accounts,routes] of [['roki',['r-issue','r-check','r-approve'],rokiRoutes],['supplier',['s1-issue','s1-approve','s2-issue','s3-approve'],supRoutes]]){
    for(const account of accounts){
      await reset(crawl,base,portal);await grab();await crawl.locator('#demo-account').selectOption(account);await grab();
      await login(crawl,base,portal,account);
      for(const route of routes){
        if(portal==='roki'&&(['request-new','request-drafts','request-dispatch'].includes(route)&&account!=='r-issue'||route==='request-review'&&account==='r-issue'))continue;
        await crawl.goto(`${base}${portal}.html#${route}`);await crawl.locator('.content').waitFor();await grab();
        for(const tab of await crawl.locator('[data-cmp-tab],[data-tab]').all()){await tab.click().catch(()=>{});await grab()}
      }
    }
  }
  /* dialogs, toasts and the emails they create only appear on interaction: walk real workflow steps */
  await switchTo(crawl,base,'roki','r-issue','schedule');
  await crawl.locator('[data-select]').first().check();await crawl.locator('[data-action="notify"]').click();await grab();
  await approveRequestAndSend(crawl,base);await grab();
  await crawl.locator('[data-schedule]').first().click();await grab();await crawl.keyboard.press('Escape');
  const act=async(portal,account,id,kind,reason)=>{
    await crawl.evaluate(([p,a])=>sessionStorage.setItem('roki-session-'+p,a),[portal,account]);
    await crawl.goto(`${base}${portal}.html#quote/${id}`);await crawl.reload();await crawl.locator('.status-strip').waitFor();
    await crawl.locator(`[data-transition="${kind}"]`).first().click();await grab();
    await crawl.locator('[data-action="confirm-transition"]').click();await grab();           /* validation toast */
    if(reason)await crawl.locator('#action-reason').fill(reason);
    if(kind==='advance')await crawl.locator('#confirm-action').check();
    await crawl.locator('[data-action="confirm-transition"]').click();await crawl.locator('.dialog').waitFor({state:'detached'});await grab();
  };
  await act('roki','r-issue','Q-2026-0107','advance');                      /* waiting for ROKI Check */
  await act('roki','r-check','Q-2026-0101','advance');                      /* waiting for ROKI Approve */
  await act('roki','r-approve','Q-2026-0101','advance');                    /* approved by WEBPARK */
  await act('roki','r-approve','Q-2026-0104','reject','Price not supported by the material index.');
  await act('roki','r-check','Q-2026-0107','revert','Please attach the supplier price notice.');
  await act('supplier','s2-approve','Q-2026-0102','advance');               /* waiting for ROKI Issue */
  await crawl.evaluate(()=>sessionStorage.setItem('roki-session-supplier','s1-issue'));
  await crawl.goto(`${base}supplier.html#quote/Q-2026-0105`);await crawl.reload();await crawl.locator('[data-edit]').first().click();
  await crawl.locator('#remark').fill('Corrected volume.');await crawl.locator('button[type="submit"]').click();await crawl.locator('.status-strip').waitFor();await grab();  /* waiting for your approval */
  await crawl.evaluate(()=>sessionStorage.setItem('roki-session-supplier','s1-approve'));await crawl.reload();await crawl.locator('[data-transition="revert"]').click();await crawl.locator('#action-reason').fill('Check the tooling cost.');await crawl.locator('[data-action="confirm-transition"]').click();await grab();
  await crawl.goto(`${base}supplier.html#outbox`);await grab();await crawl.goto(`${base}supplier.html#history`);await grab();
  /* part master: dialogs, validation toasts, import preview, schedule creation */
  await crawl.evaluate(()=>sessionStorage.setItem('roki-session-roki','r-issue'));await crawl.goto(`${base}roki.html#parts`);await crawl.reload();
  await crawl.locator('[data-action="add-part"]').click();await grab();await crawl.locator('[data-action="save-part"]').click();await grab();
  await crawl.locator('#pf-code').fill('17999-NEW-0001');await crawl.locator('#pf-name').fill('NEW BRACKET');await crawl.locator('#pf-supplier').selectOption('s2');await crawl.locator('#pf-children').fill('17999-NEW-0001, 1');await crawl.locator('[data-action="save-part"]').click();await grab();
  await crawl.locator('#pf-children').fill('');await crawl.locator('[data-action="save-part"]').click();await crawl.locator('.dialog').waitFor({state:'detached'});await grab();
  await crawl.locator('tbody tr',{hasText:'17999-NEW-0001'}).locator('[data-edit-part]').click();await grab();await crawl.locator('[data-action="delete-part"]').click();await grab();await crawl.locator('[data-action="confirm-delete-part"]').click();await grab();
  await crawl.locator('[data-action="import-parts"]').click();await grab();
  await crawl.locator('#import-file').setInputFiles({name:'parts.xlsx',mimeType:'application/vnd.ms-excel',buffer:Buffer.from('x')});await grab();
  await crawl.locator('#import-file').setInputFiles({name:'parts.csv',mimeType:'text/csv',buffer:Buffer.from(IMPORT_CSV,'utf8')});await crawl.locator('.import-summary').waitFor();await grab();
  await crawl.locator('#import-go').click();await crawl.locator('.dialog').waitFor({state:'detached'});await grab();
  await crawl.goto(`${base}roki.html#schedule`);await crawl.locator('[data-action="add-schedule"]').click();await grab();
  await crawl.locator('[data-action="save-schedule-add"]').click();await crawl.locator('.dialog').waitFor({state:'detached'});await grab();
  await crawl.locator('[data-action="add-schedule"]').click();await crawl.locator('#sa-all').uncheck();await crawl.locator('[data-action="save-schedule-add"]').click();await grab();await crawl.keyboard.press('Escape');
  await crawl.locator('[data-schedule]').first().click();await crawl.locator('[data-action="remove-schedule"]').click();await crawl.locator('.dialog').waitFor({state:'detached'});await grab();
  /* formulas page: errors, edits, save, history */
  await crawl.evaluate(()=>sessionStorage.setItem('roki-session-roki','r-approve'));await crawl.goto(`${base}roki.html#formulas`);await crawl.reload();
  await grab();
  await crawl.locator('[data-fp="sections.2.expr"]').fill('rate*time/nope');await grab();
  await crawl.locator('[data-fp="sections.2.expr"]').fill('rate*time/(');await grab();
  await crawl.locator('[data-fp="sections.2.expr"]').fill('rate*time/cavity;');await grab();
  await crawl.locator('[data-fp="sections.2.expr"]').fill('rate*time/cavity');
  await crawl.locator('[data-fp="total"]').fill('subtotal+profit+spare+bogus');await grab();
  await crawl.locator('[data-fp="total"]').fill('subtotal+profit+spare');
  await crawl.locator('[data-fm-add-field="2"]').click();await crawl.locator('[data-fm-add-adj="2"]').click();await grab();
  await crawl.locator('[data-fp="sections.2.fields.5.0"]').fill('Bad Key');await grab();
  await crawl.locator('[data-fm-remove-field="2.5"]').click();await crawl.locator('[data-fm-remove-adj="2.0"]').click();
  await crawl.locator('[data-fp="profit.percent"]').fill('12');await crawl.locator('[data-fp="profit.lock"]').uncheck();await grab();
  await crawl.locator('[data-fm-save]').click({force:true});await grab();
  await crawl.locator('#fm-reason').fill('Test change');await crawl.locator('#fm-save').click();await crawl.locator('.fm-tabs').waitFor();await grab();
  await crawl.locator('[data-fm-tab="Assembly"]').click();await grab();
  await crawl.locator('[data-fm-load="1"]').click();await grab();await crawl.locator('[data-fm-discard]').click();await grab();
  await crawl.evaluate(()=>sessionStorage.setItem('roki-session-roki','r-check'));await crawl.goto(`${base}roki.html#formulas`);await crawl.reload();await grab();
  /* a first quotation for a part with no approved price: ROKI schedules it and sends the request first */
  await crawl.evaluate(()=>sessionStorage.setItem('roki-session-roki','r-issue'));await crawl.goto(`${base}roki.html#schedule`);await crawl.reload();
  await crawl.locator('[data-select="i9"]').check();await crawl.locator('[data-action="notify"]').click();await approveRequestAndSend(crawl,base);await crawl.locator('.dialog').waitFor({state:'detached'});await grab();
  await crawl.evaluate(()=>sessionStorage.setItem('roki-session-supplier','s1-issue'));await crawl.goto(`${base}supplier.html#parts`);await crawl.reload();await grab();
  await crawl.goto(`${base}supplier.html#requests`);await grab();
  await crawl.locator('[data-request]').last().click();await grab();
  await crawl.locator('#remark').fill('First quotation.');
  await crawl.locator('[data-cost="0"][data-field="name"]').fill('MESH');await crawl.locator('[data-cost="0"][data-field="rate"]').fill('320');await crawl.locator('[data-cost="0"][data-field="weight"]').fill('0.0066');
  await crawl.locator('[data-tab="process"]').click();await crawl.locator('[data-cost="0"][data-field="name"]').fill('Blank');await crawl.locator('[data-cost="0"][data-field="rate"]').fill('0.15');await crawl.locator('[data-cost="0"][data-field="time"]').fill('8');
  await crawl.locator('button[type="submit"]').click();await crawl.locator('.status-strip').waitFor();await grab();await crawl.goto(`${base}supplier.html#quotes`);await grab();
  await crawl.goto(`${base}supplier.html#requests`);await grab();await crawl.goto(`${base}supplier.html#new`);await crawl.reload();await grab();
  await crawl.goto(`${base}roki.html#outbox`);await grab();
  assert.deepEqual([...leftovers].sort(),[],'Untranslated UI text in Thai mode');
});
