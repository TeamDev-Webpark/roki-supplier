'use strict';
/* Request details the customer's quotation forms carry, set by ROKI Issue when creating a request and fixed for the Supplier:
   quantity period (Qty/Y, Qty/M, Qty/2Y), price validity (Beginning–Ending), RTP code, required material / grade,
   components supplied by ROKI (“Buy U Part from Roki”), and commercial terms (VAT, payment, other notes).
   Also: company-controlled percentages are enforced on save, whatever the browser sends. */
const QTY_PERIODS=[['year','per year','ต่อปี'],['month','per month','ต่อเดือน'],['2years','per 2 years','ต่อ 2 ปี']];
const defaultQtyPeriod=i=>i&&i.format==='Assembly'?'month':'year';
function qtyLabelOf(period,format){return ({year:'Quantity / year',month:'Monthly quantity','2years':'Quantity / 2 years'})[period]||(format==='Assembly'?'Monthly quantity':'Quantity / year')}
function addDays(iso,n){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return isoDate(d)}
const defaultEnding=(effective,cadence)=>addDays(addMonths(effective,cadence||3),-1);
function formulaSetCurrent(i){const s=i&&i.formulaSet&&FORMULAS.sets.find(s=>s.id===i.formulaSet&&s.formats.includes(i.format));return s?s.current:null}

/* ---------- request form: per-part fields ---------- */
function requestExtraFields(i,spec){
  const period=spec?.qtyPeriod||i.qtyPeriod||defaultQtyPeriod(i),eff=spec?.effective>=TODAY?spec.effective:addMonths(TODAY,1);
  return `<div class="field"><label>${wfText('Volume period *','หน่วยปริมาณ *')}</label><select data-request-qty-period="${i.id}">${QTY_PERIODS.map(([v,en,th])=>`<option value="${v}" ${period===v?'selected':''}>${wfText(en,th)}</option>`).join('')}</select></div>`
  +`<div class="field"><label>${wfText('Price valid until (Ending) *','ราคาใช้ได้ถึง (Ending) *')}</label><input type="date" data-request-ending="${i.id}" min="${TODAY}" value="${esc(spec?.ending||defaultEnding(eff,i.cadence))}"></div>`
  +`<div class="field"><label>${wfText('RTP code','รหัส RTP')}${i.format==='Single Part'?' *':''}</label><input data-request-rtp="${i.id}" maxlength="40" value="${esc(spec?.rtp||i.rtp||'')}" placeholder="${wfText('e.g. S001571-004-01, or N/A','เช่น S001571-004-01 หรือ N/A')}"></div>`
  +`<div class="field fm-wide"><label>${wfText('Required material / grade (optional)','วัสดุ / เกรดที่ต้องการ (ไม่บังคับ)')}</label><input data-request-material="${i.id}" maxlength="160" value="${esc(spec?.material||'')}" placeholder="${wfText('e.g. TTR-50, SGCC 0.4 mm — or see drawing','เช่น TTR-50, SGCC 0.4 mm หรือดูตาม Drawing')}"></div>`;
}
/* components of the part's BOM that ROKI supplies to the Supplier, with the price the Supplier must use */
function requestSupplyTable(i,spec){
  const kids=i.children||[];if(!kids.length)return '';
  const sup=new Map((spec?.supplied||[]).map(s=>[s.code,s.price]));
  return `<div class="request-supply"><h4>${wfText('Components supplied by ROKI','ชิ้นส่วนที่ ROKI จ่ายให้ (Supply)')}</h4><p class="muted-note">${wfText('Tick the components ROKI provides (“Buy U Part from Roki”). The Supplier sees them as Supply with the price set here.','เลือกชิ้นส่วนที่ ROKI จ่ายให้ Supplier จะเห็นเป็น Supply และใช้ราคาที่กำหนดนี้')}</p><div class="table-wrap"><table class="data-table"><thead><tr><th>${wfText('Supplied','จ่ายให้')}</th><th>${wfText('Part no.','เลขที่ชิ้นส่วน')}</th><th>${wfText('Part name','ชื่อชิ้นส่วน')}</th><th class="num">${wfText('Qty','จำนวน')}</th><th class="num">${wfText('Price · THB','ราคา · บาท')}</th></tr></thead><tbody>${kids.map(k=>{const known=db.items.find(x=>x.code===k.code),on=sup.has(k.code);return `<tr><td><input type="checkbox" data-request-supply="${i.id}" value="${esc(k.code)}" ${on?'checked':''} aria-label="${esc(wfText('Supplied by ROKI','ROKI จ่ายให้')+' '+k.code)}"></td><td>${esc(k.code)}</td><td>${esc(known?.name||'—')}</td><td class="num">${esc(k.qty)}</td><td class="num"><input type="number" min="0" step="any" class="narrow-input" data-request-supply-price="${i.id}" data-code="${esc(k.code)}" value="${on?esc(sup.get(k.code)):''}"></td></tr>`}).join('')}</tbody></table></div></div>`;
}
function readRequestExtras(i){
  const q=s=>document.querySelector(s),id=i.id;
  const qtyPeriod=q(`[data-request-qty-period="${id}"]`)?.value||defaultQtyPeriod(i);
  const effective=q(`[data-request-effective="${id}"]`)?.value,ending=q(`[data-request-ending="${id}"]`)?.value;
  const rtp=(q(`[data-request-rtp="${id}"]`)?.value||'').trim(),material=(q(`[data-request-material="${id}"]`)?.value||'').trim();
  if(!ending||!effective||ending<=effective)return {error:wfText(`${i.code}: the price must be valid until a date after the effective date.`,`${i.code}: วันสิ้นสุดราคาต้องอยู่หลังวันเริ่มใช้ราคา`)};
  if(i.format==='Single Part'&&!rtp)return {error:wfText(`${i.code}: enter the RTP code, or N/A if there is none.`,`${i.code}: ระบุรหัส RTP หรือ N/A ถ้าไม่มี`)};
  const supplied=[];
  for(const box of document.querySelectorAll(`[data-request-supply="${id}"]`)){
    if(!box.checked)continue;
    const price=Number(document.querySelector(`[data-request-supply-price="${id}"][data-code="${CSS.escape(box.value)}"]`)?.value);
    if(!Number.isFinite(price)||price<0||document.querySelector(`[data-request-supply-price="${id}"][data-code="${CSS.escape(box.value)}"]`)?.value==='')return {error:wfText(`${i.code}: enter the price of each component ROKI supplies.`,`${i.code}: ระบุราคาของชิ้นส่วนที่ ROKI จ่ายให้ทุกรายการ`)};
    supplied.push({code:box.value,price});
  }
  return {qtyPeriod,ending,rtp,material,supplied};
}

/* ---------- request form: commercial terms (one set per request) ---------- */
function requestTermsFields(r){
  const t=r?.terms||{vat:'excluded',payment:wfText('Credit 60 days','เครดิต 60 วัน'),notes:''};
  return `<h3 class="request-terms-title">${wfText('Commercial terms','เงื่อนไขการค้า')}</h3><div class="form-grid"><div class="field"><label>VAT *</label><select id="request-vat"><option value="excluded" ${t.vat!=='included'?'selected':''}>${wfText('Unit price excludes VAT','ราคาไม่รวม VAT')}</option><option value="included" ${t.vat==='included'?'selected':''}>${wfText('Unit price includes VAT','ราคารวม VAT')}</option></select></div><div class="field"><label>${wfText('Payment term *','เงื่อนไขการชำระเงิน *')}</label><input id="request-payment" maxlength="80" value="${esc(t.payment||'')}"></div><div class="field fm-wide"><label>${wfText('Other terms (optional)','เงื่อนไขอื่น (ไม่บังคับ)')}</label><textarea id="request-terms-notes" maxlength="1500" placeholder="${wfText('e.g. tooling repaid over 10 years; MN cost 5% from year 2','เช่น คืนทุนแม่พิมพ์ภายใน 10 ปี, MN cost 5% เริ่มปีที่ 2')}">${esc(t.notes||'')}</textarea></div></div>`;
}
function readRequestTerms(){
  const vat=document.getElementById('request-vat')?.value||'excluded',payment=(document.getElementById('request-payment')?.value||'').trim(),notes=(document.getElementById('request-terms-notes')?.value||'').trim();
  if(!payment){toast(wfText('Enter the payment term.','ระบุเงื่อนไขการชำระเงิน'));return null}
  return {vat,payment,notes};
}
function termsLines(t){
  if(!t)return [];
  return [t.vat==='included'?wfText('Unit price includes VAT','ราคารวม VAT'):wfText('Unit price excludes VAT','ราคาไม่รวม VAT'),t.payment?wfText('Payment: ','การชำระเงิน: ')+t.payment:'',...String(t.notes||'').split(/\r?\n/)].map(s=>s.trim()).filter(Boolean);
}

/* ---------- Supplier side ---------- */
/* what ROKI fixed in the request, shown above the cost form */
function requestInfoNote(spec,notice){
  if(!spec)return '';
  const lines=[];
  if(spec.ending)lines.push(`${wfText('Price valid','ราคาใช้ได้')} ${date(spec.effective)} – ${date(spec.ending)}`);
  if(spec.material)lines.push(`${wfText('Required material / grade','วัสดุ / เกรดที่ต้องการ')}: ${esc(spec.material)}`);
  if(spec.supplied?.length)lines.push(`${wfText('Supplied by ROKI','ROKI จ่ายให้')}: ${spec.supplied.map(s=>`${esc(s.code)} (฿${cash(s.price)})`).join(', ')}`);
  for(const t of termsLines(notice?.terms))lines.push(esc(t));
  return lines.length?`<div class="highlight-note blue request-info"><strong>${wfText('Set by ROKI in this request','ROKI กำหนดในคำขอนี้')}</strong>${lines.map(l=>`<div>${l}</div>`).join('')}<small>${wfText('Quantity, drawing revision, dates and company percentages are fixed by the request.','ปริมาณ แบบ/Revision วันที่ และเปอร์เซ็นต์ที่บริษัทกำหนด ถูกกำหนดจากคำขอ')}</small></div>`:'';
}
/* components ROKI supplies: origin Supply, fixed price */
function applySupplied(c,spec){
  for(const s of spec?.supplied||[]){
    const r=(c.components||[]).find(r=>r.partNo===s.code);
    if(r){r.origin='Supply';r.rate=s.price;r.supplied=true;delete r.link;delete r.linkQuote;delete r.linkMissing}
  }
  return c;
}
/* company-controlled percentages cannot be changed by the Supplier (locked in the formula set) */
function enforceLocks(c){
  const cfg=cfgOf(c);
  if(cfg.profit.lock){c.profit=cfg.profit.percent;c.basis=cfg.profit.base}
  if(cfg.spare.lock)c.spare=cfg.spare.percent;
  for(const s of cfg.sections)for(const a of s.adj||[])if(a.lock){c[a.key]=a.percent;if(a.ofKey)c[a.ofKey]=a.of}
  return c;
}
