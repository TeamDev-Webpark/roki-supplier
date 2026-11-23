'use strict';
/* RFQ prices are internal planning values. Supplier offers remain separate quotations. */
function rfqPriceLine(itemId,r){
 const saved=r?.priceLines?.[itemId];
 if(saved)return saved;
 const q=activeQuote(itemId),item=db.items.find(i=>i.id===itemId);
 return {referenceQuote:q?.id||null,referencePrice:q?.total??item?.price??null,targetPrice:null};
}
function quotationAccessButton(q,label,primary=false,newTab=false){
 if(newTab)return `<button type="button" class="button ${primary?'primary':''}" data-rfq-preview="${esc(q.id)}" data-quote-access="${esc(q.id)}">${icon('file')}${label}</button>`;
 return `<a class="button ${primary?'primary':''}" data-quote-access="${esc(q.id)}" href="#quote/${esc(q.id)}" ${newTab?'target="_blank" rel="noopener"':''}>${icon('file')}${label}</a>`;
}
function approvedReferenceButton(itemId){
 const q=activeQuote(itemId);
 return q&&visibleQuotes().some(x=>x.id===q.id)?quotationAccessButton(q,wfText('View reference quotation','ดูใบเสนอราคาเดิม')):'';
}
function quotationAccessLinks(itemId,{request=null,notice=null,quote=null,compact=false,newTab=false}={}){
 if(!request&&notice&&portal==='roki')request=rfqRecords().find(r=>r.id===notice.priceRequestId)||null;
 const allowed=visibleQuotes(),line=notice?.referencePrices?.[itemId]||rfqPriceLine(itemId,portal==='roki'?request:null);
 const reference=allowed.find(q=>q.id===line.referenceQuote&&q.item===itemId&&q.status==='Approved');
 const notices=notice?[notice]:request?db.notifications.filter(n=>n.priceRequestId===request.id&&n.items.includes(itemId)):[];
 const responses=allowed.filter(q=>q.item===itemId&&notices.some(n=>n.id===q.requestedBy));
 const response=quote&&allowed.some(q=>q.id===quote.id&&q.item===itemId)?quote:responses.at(-1);
 if(compact){
  const row=(q,isNew)=>`<div class="quote-access-row" data-document-kind="${isNew?'response':'reference'}"><span class="quote-access-label">${isNew?wfText('New','ใหม่'):wfText('Ref.','เดิม')}</span>${q?`<a class="quote-document-link" data-quote-access="${esc(q.id)}" href="#quote/${esc(q.id)}" aria-label="${isNew?wfText('View new quotation','ดูใบเสนอราคาใหม่'):wfText('View reference quotation','ดูใบเสนอราคาเดิม')} ${esc(q.id)}">${icon('file')}<span>${esc(q.id)}</span></a><span class="quote-access-price">${isIncompleteQuote(q)?wfText("Awaiting costs","รอกรอกต้นทุน"):cash(q.total)} <span>${isIncompleteQuote(q)?'':'THB'}</span></span>`:`<span class="quote-access-unavailable">${isNew?(request&&rfqDelivery(request)!=='Sent'?wfText('Not sent yet','ยังไม่ส่งคำขอ'):wfText('Awaiting Supplier','รอ Supplier เสนอราคา')):wfText('No reference','ไม่มีใบอ้างอิง')}</span>`}</div>`;
  return `<div class="quote-access compact">${row(reference,false)}${row(response,true)}</div>`;
 }
 const refTitle=wfText('Reference quotation','ใบเสนอราคาเดิม / อ้างอิง'),responseTitle=wfText('Supplier quotation for this request','ใบเสนอราคาใหม่ของคำขอนี้');
 const cell=(q,title,isNew)=>`<div class="quote-access-card" data-document-kind="${isNew?'response':'reference'}"><small>${title}</small>${q?`<strong>${esc(q.id)} · ${cash(q.total)} THB</strong>${compact?'':statusBadge(q.status)}${quotationAccessButton(q,isNew?wfText('View new quotation','ดูใบเสนอราคาใหม่'):wfText('View reference quotation','ดูใบเสนอราคาเดิม'),isNew,newTab)}${compact?'':`<a class="link-button" href="#print/${esc(q.id)}" ${newTab?'target="_blank" rel="noopener"':''}>${wfText('Quotation form / print','ดูแบบฟอร์ม / พิมพ์')}</a>`}`:`<span class="muted-note">${isNew?(request&&rfqDelivery(request)!=='Sent'?wfText('Available after sending and Supplier submission','ยังไม่ส่งคำขอ · รอ Supplier เสนอราคา'):wfText('Awaiting Supplier quotation visible to your role','รอใบเสนอราคาจาก Supplier ที่เปิดให้บทบาทคุณดูได้')):wfText('No approved reference quotation yet','ยังไม่มีใบเสนอราคาที่อนุมัติแล้ว')}</span>`}</div>`;
 return `<div class="quote-access ${compact?'compact':''}">${cell(reference,refTitle,false)}${cell(response,responseTitle,true)}</div>`;
}
function rfqPublicReferences(r,items){
 return Object.fromEntries(items.map(id=>{const line=rfqPriceLine(id,r);return [id,{referenceQuote:line.referenceQuote,referencePrice:line.referencePrice}]}));
}
function quotationAccessPanel(itemId,options={}){
 return detailPanel(wfText('View quotations at this step','เปิดดูใบเสนอราคาในขั้นตอนนี้'),quotationAccessLinks(itemId,options));
}
function rfqPriceDialogRows(items,r){
 return `<div class="rfq-price-entry"><h3>${wfText('Reference and target unit prices','ราคาอ้างอิงและราคาเป้าหมายต่อหน่วย')}</h3><p>${wfText('Approved prices are filled automatically. Target prices are optional internal WEBPARK values and are not sent to Supplier. Supplier enters its own quotation after receiving the request.','ระบบดึงราคาที่อนุมัติแล้วให้อัตโนมัติ ราคาเป้าหมายกรอกได้ตามต้องการ ใช้ภายใน WEBPARK และไม่ส่งให้ Supplier ส่วนราคาที่ Supplier เสนอจะอยู่ในใบเสนอราคาอีกชุดหนึ่ง')}</p><div class="table-wrap"><table class="data-table"><thead><tr><th>${wfText('Part / supplier','ชิ้นส่วน / Supplier')}</th><th>${wfText('Approved reference · THB / pc','ราคาอ้างอิง · บาท/ชิ้น')}</th><th>${wfText('Internal target · THB / pc (optional)','เป้าหมายภายใน · บาท/ชิ้น (ไม่บังคับ)')}</th></tr></thead><tbody>${items.map(i=>{const line=rfqPriceLine(i.id,r),q=visibleQuotes().find(q=>q.id===line.referenceQuote&&q.item===i.id&&q.status==='Approved');return `<tr><td><strong>${esc(i.code)}</strong><small>${esc(i.name)}</small><small>${esc(supplierName(i.supplier))}</small></td><td>${line.referencePrice==null?wfText('No approved price','ยังไม่มีราคาที่อนุมัติ'):cash(line.referencePrice)}${q?quotationAccessButton(q,wfText('View reference','ดูใบเดิม'),false,true):''}</td><td><input type="number" data-rfq-target="${i.id}" aria-label="${wfText('Internal target price','ราคาเป้าหมายภายใน')} ${esc(i.code+' '+supplierName(i.supplier))}" min="0.01" step="0.01" inputmode="decimal" placeholder="${wfText('Optional','ไม่บังคับ')}" value="${line.targetPrice==null?'':esc(line.targetPrice)}"></td></tr>`}).join('')}</tbody></table></div></div>`;
}
function rfqReadPriceLines(items,old){
 const lines={};
 for(const id of items){
  const input=document.querySelector(`[data-rfq-target="${id}"]`),raw=input?.value.trim()||'',target=raw===''?null:Number(raw);
  if(input?.validity.badInput||raw!==''&&(!Number.isFinite(target)||target<=0||Math.abs(target*100-Math.round(target*100))>1e-7)){
   input?.focus();toast(wfText('Enter a positive target price with at most two decimal places, or leave it blank.','กรอกราคาเป้าหมายมากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง หรือเว้นว่างได้'));return null;
  }
  lines[id]={...rfqPriceLine(id,old),targetPrice:target};
 }
 return lines;
}
function rfqPriceTable(r){
 return `<div class="table-wrap"><table class="data-table rfq-price-table"><thead><tr><th>${wfText('Part / supplier','ชิ้นส่วน / Supplier')}</th><th>${wfText('Reference price · THB / pc','ราคาอ้างอิง · บาท/ชิ้น')}</th><th>${wfText('Internal target · THB / pc','ราคาเป้าหมายภายใน · บาท/ชิ้น')}</th><th>${wfText('Quotations','ใบเสนอราคา')}</th></tr></thead><tbody>${r.items.map(id=>{const i=db.items.find(i=>i.id===id),line=rfqPriceLine(id,r);return `<tr><td>${detailRecordLink('part/'+id,i?.code||id)}<small>${esc(i?.name)}</small><small>${esc(supplierName(i?.supplier))}</small><small>${wfLink('process/'+id+'/'+r.id,'Track workflow','ติดตามทุกขั้นตอน')}</small></td><td>${line.referencePrice==null?'—':cash(line.referencePrice)}<small>${r.priceLines?.[id]?wfText('Saved with this request','บันทึกอ้างอิงไว้ในคำขอนี้'):wfText('Current reference; older request has no snapshot','ราคาอ้างอิงปัจจุบัน · คำขอเดิมยังไม่มีภาพบันทึกราคา')}</small></td><td>${line.targetPrice==null?wfText('Not specified','ไม่ระบุ'):cash(line.targetPrice)}<small>${wfText('WEBPARK only · not sent to Supplier','เฉพาะ WEBPARK · ไม่ส่ง Supplier')}</small></td><td>${quotationAccessLinks(id,{request:r})}</td></tr>`}).join('')}</tbody></table></div>`;
}
function rfqQuotationSummary(r){
 const item=id=>`<div class="rfq-document-summary">${r.items.length>1?`<small>${esc(db.items.find(i=>i.id===id)?.code||id)}</small>`:''}${quotationAccessLinks(id,{request:r,compact:true})}</div>`;
 return r.items.slice(0,2).map(item).join('')+(r.items.length>2?`<details class="rfq-more-documents"><summary>${wfText('More parts','ชิ้นส่วนเพิ่มเติม')} (${r.items.length-2})</summary>${r.items.slice(2).map(item).join('')}</details>`:'');
}
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-rfq-preview]');if(!button)return;
 const q=visibleQuotes().find(q=>q.id===button.dataset.rfqPreview);if(!q)return;
 document.querySelector('.quotation-preview')?.remove();
 const preview=document.createElement('dialog');preview.className='quotation-preview';
 preview.setAttribute('aria-label',wfText('Reference quotation preview','ตัวอย่างใบเสนอราคาอ้างอิง'));
 const template=document.createElement('template');template.innerHTML=printView(q.id);
 preview.innerHTML=`<header><div><strong>${wfText('Reference quotation','ใบเสนอราคาอ้างอิง')} · ${esc(q.id)}</strong><small>${wfText('Close to continue editing your request. Entered values are retained.','ปิดเพื่อกลับไปกรอกคำขอ ข้อมูลที่กรอกไว้ยังอยู่ครบ')}</small></div><button type="button" class="button primary" data-close-preview>${wfText('Close preview','ปิดใบเสนอราคา')}</button></header><div class="quotation-preview-body">${template.content.querySelector('.qt-form')?.outerHTML||''}</div>`;
 document.body.append(preview);I18N.apply(preview);preview.showModal();
 preview.querySelector('[data-close-preview]').onclick=()=>preview.close();
 preview.addEventListener('close',()=>{preview.remove();button.focus()},{once:true});
});
