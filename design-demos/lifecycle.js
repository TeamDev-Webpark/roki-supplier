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
