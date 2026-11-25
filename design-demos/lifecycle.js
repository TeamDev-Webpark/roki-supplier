'use strict';
/* One document chain; approval and price validity remain separate concepts. */
function bangkokDay(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
}
const familyKey=i=>i.family||i.code;
const familyMatches=(i,key)=>familyKey(i)===key;
function approvedOrder(a,b){return (a.effective||'').localeCompare(b.effective||'')||(a.approvedAtISO||'').localeCompare(b.approvedAtISO||'')||(a.revision||0)-(b.revision||0)||a.id.localeCompare(b.id,undefined,{numeric:true})}
function activeQuote(item,day=TODAY){return db.quotes.filter(q=>q.item===item&&q.status==='Approved'&&q.effective&&q.effective<=day).sort(approvedOrder).at(-1)}
function priceValidity(q){
 if(q.status!=='Approved')return null;
 return activeQuote(q.item)?.id===q.id?'active':q.effective>TODAY?'scheduled':'historical';
}
function validityBadge(q){
 const state=priceValidity(q);if(!state)return '';
 const labels={active:['Active price','ราคาปัจจุบัน','green'],scheduled:['Approved · future effective date','อนุมัติแล้ว · รอวันมีผล','blue'],historical:['Historical price','ราคาเก่า · ประวัติ','gray']};
 const [en,th,color]=labels[state];return statusPill(wfText(en,th),color);
}
function syncActivePrices(){
 for(const i of db.items){
  const q=activeQuote(i.id),legacy=db.history.filter(h=>h.item===i.id&&!h.quote&&h.effective<=TODAY).sort((a,b)=>a.effective.localeCompare(b.effective)).at(-1);
  i.price=q?.total??legacy?.price??null;
 }
}
function prepareLifecycleData(){
 for(const q of db.quotes){
  if(q.baseline){
   const original=db.quotes.find(x=>x.id===q.baseline.quote&&x.revision===q.baseline.revision&&x.status==='Approved');
   if(original)q.baseline={...snapshotOf(original),...q.baseline};
  }
 }
 syncActivePrices();
}
function partIdentity(i){const s=suppliers.find(s=>s.id===i.supplier);return {code:i.code,name:i.name,format:i.format,rtp:i.rtp||'',family:familyKey(i),supplierCode:s?.code||'',supplierName:s?.name||''}}
function quotationIdentity(q){return q.itemSnapshot||itemOf(q)}
function processPartLinks(i){
 const requests=portal==='roki'?rfqRecords().filter(r=>r.items.includes(i.id)):[];
 const equivalents=currentItems().filter(x=>familyKey(x)===familyKey(i)&&x.id!==i.id);
 return detailPanel(wfText('Follow the source documents','ติดตามเอกสารตั้งแต่ต้นทาง'),`<p>${wfText('Common part family','กลุ่มชิ้นส่วนกลาง')}: <strong>${esc(familyKey(i))}</strong></p>${equivalents.map(x=>`<p>${detailRecordLink('part/'+x.id,x.code)} · ${esc(supplierName(x.supplier))}</p>`).join('')}${requests.length?`<h3>${wfText('Requests sent and first-time drafts','คำขอที่ส่งแล้วและฉบับร่างครั้งแรก')}</h3>${requests.map(r=>`<p>${detailRecordLink('request-register/'+r.id,r.id)} ${rfqBadge(r)} ${rfqDeliveryBadge(r)}</p>`).join('')}`:''}`);
}
function rfqSourceLinks(r){
 return detailPanel(wfText('Request prices and quotations','ราคาและใบเสนอราคาของคำขอ'),requestSpecTable(r)+r.items.map(id=>quotationHistoryPanel(id,{requestId:r.id})).join(''));
}

function sourceLinks(q){
 const n=detailSentRequest(q),r=n&&rfqRecords().find(r=>r.id===n.priceRequestId),links=[wfLink('part/'+q.item,'Part source','ชิ้นส่วนต้นทาง')];
 if(portal==='roki'&&r)links.push(wfLink('request-register/'+r.id,'Request '+r.id,'คำขอ '+r.id));
 if(n)links.push(wfLink('request-detail/'+n.id+'/'+q.item,'Sent request '+n.id,'คำขอที่ส่ง '+n.id));
 if(q.baseline?.quote&&visibleQuotes().some(x=>x.id===q.baseline.quote))links.push(wfLink('quote/'+q.baseline.quote,'Previous approved quotation','ใบเสนอราคาอนุมัติต้นฉบับ'));
 return `<section class="panel body-pad source-links"><h2>${wfText('Source documents','เอกสารต้นทาง')}</h2><div class="workflow-tabs">${links.join('')}</div>${validityBadge(q)}${q.versions.length?`<details><summary>${wfText('Saved correction versions','ฉบับก่อนแก้ไขที่เก็บไว้')} (${q.versions.length})</summary>${q.versions.map((v,index)=>`<div class="audit-entry"><strong>Rev. ${v.revision} · ${cash(v.total)} THB</strong><small>${esc(v.drawing||'—')} · ${v.quantity??'—'} pcs · ${esc(v.at||'')}</small><p data-i18n-skip>${esc(v.remark)}</p>${(v.attachments||[]).map((f,fi)=>`<button class="link-button" data-version-file="${fi}" data-version="${index}" data-quote="${q.id}">${esc(f.name)}</button>`).join('')}</div>`).join('')}</details>`:''}</section>`;
}
function processHelp(){return '<section class="panel body-pad process-help"><h2>'+wfText('Direct request, controlled purchase price','ส่งคำขอตรง · ควบคุมการอนุมัติราคาซื้อ')+'</h2><div class="process-phases">'+[['WEBPARK Issue','เลือกรอบ 1 / 3 เดือนหรือชิ้นส่วนใหม่ เลือกสูตรรายชิ้น แล้วส่งคำขอพร้อมแบบฟอร์มว่าง'],['Supplier Issue → Approve','กรอกต้นทุนตามแบบฟอร์ม ตรวจความถูกต้อง แล้วส่งกลับ'],['WEBPARK Check → Approve','ระบบคำนวณราคาซื้อตามสูตร Check ตรวจ แล้ว Approve อนุมัติขั้นสุดท้าย']].map(([title,body])=>'<article><h3>'+title+'</h3><p>'+body+'</p></article>').join('')+'</div><p>'+wfText('Formula versions are fixed on each request; later formula edits never alter issued quotations.','แต่ละคำขอล็อกเวอร์ชันสูตรไว้ การแก้สูตรภายหลังไม่เปลี่ยนเอกสารที่ส่งไปแล้ว')+'</p></section>'}

function legacyLifecyclePartProcess(i){
 const reference=route().split('/')[2],chosenQuote=reference&&visibleQuotes().find(q=>q.id===reference&&q.item===i.id);
 const chosenNotice=chosenQuote&&detailSentRequest(chosenQuote);
 const chosenRequest=reference&&portal==='roki'&&rfqRecords().find(r=>r.id===reference&&r.items.includes(i.id));
 const r=portal==='roki'?(chosenRequest||(chosenNotice?rfqRecords().find(r=>r.id===chosenNotice.priceRequestId):reference?null:rfqRecords().filter(r=>r.items.includes(i.id)).at(-1))):null;
 const n=chosenNotice||(reference&&!chosenRequest?null:db.notifications.filter(n=>n.items.includes(i.id)&&(portal==='roki'||n.supplier===user.supplier)&&(!r||n.priceRequestId===r.id)).at(-1));
 const raw=chosenQuote||(n&&wfLatest(n,i.id)),q=raw&&visibleQuotes().find(q=>q.id===raw.id),price=activeQuote(i.id);
 const state=n?workflowRequestState(n,i.id):null;
 const next=r&&rfqDelivery(r)!=='Sent'?rfqNext(r):q?workflowNext(q):n?wfText('Supplier Issue prepares → Supplier Approve submits','Supplier Issue จัดทำ → Supplier Approve อนุมัติส่ง'):wfText('WEBPARK Issue: create a price request','WEBPARK Issue: สร้างคำขอเสนอราคา');
 const myAction=r&&rfqDelivery(r)!=='Sent'?(rfqMine(r)||rfqEditable(r)||rfqCanDispatch(r)&&rfqApproval(r)==='Approved'?wfLink('request-register/'+r.id,'Open my request action','ไปดำเนินการคำขอของฉัน',true):''):q&&workflowQueue(q)?wfLink('quote/'+q.id,'Open my quotation action','ไปดำเนินการใบเสนอราคาของฉัน',true):portal==='supplier'&&user.role==='Issue'&&n&&['waiting','retry'].includes(state?.[0])?`<button class="button primary" data-request="${n.id}" data-item="${i.id}">${wfText('Prepare quotation','จัดทำใบเสนอราคา')}</button>`:'';
 const phase=(title,body)=>`<section class="panel body-pad"><h2>${title}</h2>${body}</section>`;
 const quoteSteps=[['S-Issue','Supplier Issue',wfText('Enter costs and mandatory reason','กรอกต้นทุนและเหตุผล')],['S-Approve','Supplier Approve',wfText('Approve and submit to WEBPARK','อนุมัติส่ง WEBPARK')],['R-Issue','WEBPARK Issue',wfText('Check the data and e-sign','ตรวจสอบข้อมูลและ E-sign')],['R-Check','WEBPARK Check',wfText('Verify costs and e-sign','ตรวจต้นทุนและ E-sign')],['R-Approve','WEBPARK Approve',wfText('Approve price and e-sign','อนุมัติราคาและ E-sign')]];
 
 const current=q?(({Draft:0,Reverted:0,'Supplier approval':1,'ROKI Issue':2,'ROKI Check':3,'ROKI Approve':4,Approved:5,Rejected:-1})[q.status]):-1;
 const signaturesForRound=q?signatures(q):{};
 return quotationAccessPanel(i.id,{request:r,notice:n,quote:q})+`<div class="highlight-note blue process-owner"><strong>${wfText('Next owner / action','ผู้รับผิดชอบ / สิ่งที่ต้องทำต่อ')}</strong><p>${next}</p>${state?statusPill(state[1],state[2]):''}<div class="workflow-tabs">${myAction}</div></div><div class="workflow-tabs">${wfLink('part/'+i.id,'Part source','ชิ้นส่วนต้นทาง')}${wfLink('reports/'+encodeURIComponent(familyKey(i)),'Price history','ประวัติราคา')}${price?wfLink('quote/'+price.id,'Active quotation','ใบราคาปัจจุบัน'):''}</div>`
 +phase(wfText('Review schedule and request · not a workflow step','กำหนดรอบทบทวนและคำขอ · ไม่ใช่ขั้นตอนในโฟล'),portal==='supplier'?`<p>${wfText('WEBPARK sets the review schedule for the part; the system sends the request to the Supplier automatically.','WEBPARK ตั้งกำหนดการทบทวนของชิ้นส่วน ระบบส่งคำขอให้ Supplier อัตโนมัติ')}</p>`:r?`${rfqBadge(r)} ${rfqDeliveryBadge(r)}${rfqProgress(r)}${wfLink('request-register/'+r.id,'Open request & approval evidence: '+r.id,'ดูคำขอและหลักฐานอนุมัติ: '+r.id)}`:`<p>${wfText('No internal request recorded.','ยังไม่มีคำขอภายในที่บันทึกไว้')}</p>${rfqCanCreate()?wfLink('request-new','Create price request','สร้างคำขอเสนอราคา',true):''}`)
 +phase(wfText('Request sent to Supplier','ส่งคำขอถึง Supplier'),n?`<p>${esc(n.by)} · ${esc(n.created)} · ${wfText('Due','ตอบภายใน')} ${date(n.due)}</p>${wfLink('request-detail/'+n.id+'/'+i.id,'Open received/sent request: '+n.id,'ดูคำขอที่ส่ง/รับ: '+n.id)}`:`<p>${wfText('Not sent. Supplier has no work to act on yet.','ยังไม่ส่ง Supplier จึงยังไม่มีงานให้ดำเนินการ')}</p>`)
 +phase(wfText('Quotation workflow · 5 steps','โฟลใบเสนอราคา · 5 ขั้นตอน'),`${q?`${statusBadge(q.status)} ${validityBadge(q)} ${wfLink('quote/'+q.id,'Quotation '+q.id,'ใบเสนอราคา '+q.id)}`:`<p>${n?wfText('Waiting for Supplier preparation and approval. Internal draft prices remain private.','รอ Supplier จัดทำและอนุมัติ ราคาฉบับร่างภายในยังไม่เปิดเผย'):wfText('Starts after the request is sent.','เริ่มหลังส่งคำขอแล้ว')}</p>`}<ol class="process-steps">${quoteSteps.map(([stage,owner,action],index)=>{const t=signaturesForRound[stage];return `<li class="${current>index?'done':current===index?'current':''}" ${current===index?'aria-current="step"':''}><b>${index+1}</b><div><strong>${owner}</strong><p>${action}</p><small>${t?esc(t.user)+' · '+esc(t.at):current===index?wfText('Waiting for this role','รอบทบาทนี้ดำเนินการ'):wfText('No completion recorded in this round','ยังไม่มีการบันทึกสำเร็จในรอบนี้')}</small></div></li>`}).join('')}</ol>`);
}
/* The old "process" page was the same workflow view as the part page. Old links and bookmarks go to the part page (or the document they point at). */
function processView(){
 const id=route().split('/')[1],reference=route().split('/')[2];
 const target=!id?'parts':reference&&visibleQuotes().some(q=>q.id===reference&&q.item===id)?'quote/'+reference:'part/'+id+(reference?'/'+reference:'');
 setTimeout(()=>{if(route().split('/')[0]==='process')location.replace('#'+target)});
 return '';
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-version-file]');if(!b)return;
 const q=visibleQuotes().find(q=>q.id===b.dataset.quote),f=q?.versions[Number(b.dataset.version)]?.attachments?.[Number(b.dataset.versionFile)];
 if(f){const a=document.createElement('a');a.href=f.data;a.download=f.name;a.click()}
});
