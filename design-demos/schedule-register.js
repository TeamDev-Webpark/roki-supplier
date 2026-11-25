'use strict';
/* "รายการกำหนดรอบทบทวนทั้งหมด": every part's review schedule in one register, with filters that suit the way it is used —
   who (Supplier), what (form category, formula set), how often (interval), when (next review window, quick presets),
   how it stands (not yet quoted / upcoming / due / in progress / no schedule) and how stale (last approved price).
   Owns activeScheduleView; operations-desk.js supplies the shared request and schedule data. */
const REG_KEY='schedule-active';
const REG_ADVANCED_KEYS=['supplier','format','fset','cadence','range','price','stale'];
const REG_STATES=[['new','First quotation needed','รอเสนอราคาครั้งแรก','gray'],['upcoming','Upcoming review','ยังไม่ถึงรอบ','green'],['due','Due · sent by the system','ถึงรอบแล้ว · ระบบกำลังส่ง','amber'],['processing','Request in progress','มีคำขอกำลังดำเนินการ','blue'],['none','No schedule','ไม่มีกำหนดการ','gray']];
const regDays=i=>i.next?Math.round((new Date(i.next+'T00:00:00')-new Date(TODAY+'T00:00:00'))/86400000):null;
function regStateOf(i){
  if(deskPendingPair(i.id))return 'processing';
  if(deskFirstTime(i))return 'new';
  if(!i.next)return 'none';
  return i.next<=TODAY?'due':'upcoming';
}
const regStateMeta=k=>REG_STATES.find(s=>s[0]===k)||REG_STATES[0];
const regSetName=i=>FORMULAS.sets.find(s=>s.id===i.formulaSet)?.name||'';
function regAdd(days){const d=new Date(TODAY+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
const REG_PRESETS=[['overdue','Due now','ถึงรอบแล้ว',()=>({from:'',to:TODAY})],['7','Next 7 days','ภายใน 7 วัน',()=>({from:TODAY,to:regAdd(7)})],['30','Next 30 days','ภายใน 30 วัน',()=>({from:TODAY,to:regAdd(30)})],['90','Next 90 days','ภายใน 90 วัน',()=>({from:TODAY,to:regAdd(90)})]];

const regPreset=s=>REG_PRESETS.find(p=>{const r=p[3]();return (s.from||'')===r.from&&(s.to||'')===r.to&&(s.from||s.to)})?.[0];
function regFilter(items,s){
  const q=(s.query||'').trim().toLowerCase(),pmin=s.pmin===''||s.pmin==null?null:Number(s.pmin),pmax=s.pmax===''||s.pmax==null?null:Number(s.pmax),staleBefore=s.stale?addMonths(TODAY,-Number(s.stale)):null;
  return items.filter(i=>{
    if(s.supplier&&i.supplier!==s.supplier)return false;
    if(s.format&&i.format!==s.format)return false;
    if(s.fset&&i.formulaSet!==s.fset)return false;
    if(s.cadence&&String(i.cadence||3)!==s.cadence)return false;
    if(s.stage&&s.stage!=='active'&&regStateOf(i)!==s.stage)return false;
    if(s.from&&(!i.next||i.next<s.from))return false;
    if(s.to&&(!i.next||i.next>s.to))return false;
    if(pmin!=null&&!(i.price!=null&&i.price>=pmin))return false;
    if(pmax!=null&&!(i.price!=null&&i.price<=pmax))return false;
    if(staleBefore&&!(i.last&&i.last<=staleBefore))return false;
    if(q&&![i.code,i.name,i.rtp,familyKey(i),supplierName(i.supplier),regSetName(i)].join(' ').toLowerCase().includes(q))return false;
    return true;
  });
}

function regChips(s){
  const chips=[],stage=s.stage&&s.stage!=='active'?regStateMeta(s.stage):null;
  if(s.query)chips.push(['query',wfText('Search','ค้นหา')+': '+s.query]);
  if(s.supplier)chips.push(['supplier',supplierName(s.supplier)]);
  if(s.format)chips.push(['format',s.format]);
  if(s.fset)chips.push(['fset',FORMULAS.sets.find(x=>x.id===s.fset)?.name||s.fset]);
  if(s.cadence)chips.push(['cadence',wfText('Every '+s.cadence+' month(s)','ทุก '+s.cadence+' เดือน')]);
  if(stage)chips.push(['stage',wfText(stage[1],stage[2])]);
  if(s.from||s.to)chips.push(['range',wfText('Next review','ทบทวนครั้งถัดไป')+' '+(s.from?date(s.from):'…')+' → '+(s.to?date(s.to):'…')]);
  if(s.pmin||s.pmax)chips.push(['price',wfText('Price','ราคา')+' '+(s.pmin||'0')+' – '+(s.pmax||'∞')]);
  if(s.stale)chips.push(['stale',wfText('Last approved over '+s.stale+' months ago','อนุมัติล่าสุดเกิน '+s.stale+' เดือน')]);
  return chips;
}
function regClear(s,key){
  const reset={query:{query:''},supplier:{supplier:''},format:{format:''},fset:{fset:''},cadence:{cadence:''},stage:{stage:'active'},range:{from:'',to:''},price:{pmin:'',pmax:''},stale:{stale:''}};
  if(key==='*')Object.assign(s,...Object.values(reset));else Object.assign(s,reset[key]||{});
  s.page=1;
}

function regControls(s,all,chips){
  const sel=(key,label,options)=>`<label><span>${label}</span><select name="${key}">${options.map(([v,t])=>`<option value="${esc(v)}" ${(s[key]??'')===v?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
  const input=(key,label,type)=>`<label><span>${label}</span><input name="${key}" type="${type}" value="${esc(s[key]??'')}" ${type==='number'?'min="0" step="any" inputmode="decimal"':''}></label>`;
  const suppliersIn=suppliers.filter(x=>all.some(i=>i.supplier===x.id)),formats=[...new Set(all.map(i=>i.format))],sets=FORMULAS.sets.filter(x=>all.some(i=>i.formulaSet===x.id)),cadences=[...new Set(all.map(i=>i.cadence||3))].sort((a,b)=>a-b);
  const counts=Object.fromEntries(REG_STATES.map(([k])=>[k,all.filter(i=>regStateOf(i)===k).length]));
  const count=chips.filter(([key])=>REG_ADVANCED_KEYS.includes(key)).length;
  const preset=regPreset(s);
  return `<div class="desk-filters" data-reg-controls>
    <label class="desk-search">${icon('search')}<input data-desk-query="${REG_KEY}" value="${esc(s.query||'')}" placeholder="${wfText('Search part, Supplier or formula set','ค้นหาชิ้นส่วน Supplier หรือชุดสูตร')}" aria-label="${wfText('Search schedules','ค้นหากำหนดการ')}"></label>
    <select data-desk-filter="stage" data-desk-key="${REG_KEY}" aria-label="${wfText('Schedule status','สถานะกำหนดการ')}">
      <option value="active">${wfText('All statuses','ทุกสถานะ')} (${all.length})</option>
      ${REG_STATES.map(([key,en,th])=>`<option value="${key}" ${s.stage===key?'selected':''}>${wfText(en,th)} (${counts[key]})</option>`).join('')}
    </select>
    <button class="button" type="button" data-reg-toggle aria-expanded="${Boolean(s.advancedOpen)}" aria-controls="schedule-advanced">${wfText('Advanced filters','ตัวกรองขั้นสูง')}${count?` <span class="desk-count">${count}</span>`:''}</button>
  </div>
  <form id="schedule-advanced" class="desk-advanced" ${s.advancedOpen?'':'hidden'}>
    <div class="desk-advanced-fields reg-advanced-fields">
      ${sel('supplier','Supplier',[['',wfText('All Suppliers','Supplier ทั้งหมด')],...suppliersIn.map(x=>[x.id,x.name])])}
      ${sel('format',wfText('Form category','ประเภทฟอร์ม'),[['',wfText('All categories','ทุกประเภท')],...formats.map(f=>[f,f])])}
      ${sel('fset',wfText('Formula set','ชุดสูตร'),[['',wfText('All formula sets','ทุกชุดสูตร')],...sets.map(x=>[x.id,x.name])])}
      ${sel('cadence',wfText('Review interval','รอบทบทวน'),[['',wfText('Any interval','ทุกรอบ')],...cadences.map(n=>[String(n),wfText('Every '+n+' month(s)','ทุก '+n+' เดือน')])])}
      ${sel('stale',wfText('Time since price approval','ระยะเวลาตั้งแต่อนุมัติราคา'),[['',wfText('Any time','ทุกช่วงเวลา')],['6',wfText('Older than 6 months','เกิน 6 เดือน')],['12',wfText('Older than 12 months','เกิน 12 เดือน')],['24',wfText('Older than 24 months','เกิน 24 เดือน')]])}
      <fieldset class="reg-review-range"><legend>${wfText('Next review date','วันทบทวนครั้งถัดไป')}</legend>
        ${input('from',wfText('From','ตั้งแต่'),'date')}
        ${input('to',wfText('To','ถึง'),'date')}
        <div class="reg-presets" role="group" aria-label="${wfText('Quick ranges','ช่วงเวลาด่วน')}">${REG_PRESETS.map(([key,en,th])=>`<button type="button" class="chip ${preset===key?'active':''}" aria-pressed="${preset===key}" data-reg-preset="${key}">${wfText(en,th)}</button>`).join('')}</div>
      </fieldset>
      <fieldset><legend>${wfText('Current price (THB / pc)','ราคาปัจจุบัน (บาท / ชิ้น)')}</legend>
        ${input('pmin',wfText('Minimum','ต่ำสุด'),'number')}
        ${input('pmax',wfText('Maximum','สูงสุด'),'number')}
      </fieldset>
    </div>
    <p class="desk-advanced-error" role="alert" hidden></p>
    <div class="desk-advanced-actions">
      <button class="button" type="button" data-reg-clear-advanced>${wfText('Clear advanced filters','ล้างตัวกรองขั้นสูง')}</button>
      <button class="button primary" type="submit">${wfText('Apply filters','ใช้ตัวกรอง')}</button>
    </div>
  </form>`;
}

function regRow(i){
  const st=regStateMeta(regStateOf(i)),d=regDays(i),pair=deskPendingPair(i.id);
  const when=i.next?`<time>${date(i.next)}</time><small class="desk-secondary ${d<0?'reg-late':''}">${d<0?wfText('Overdue '+(-d)+' days','เกินกำหนด '+(-d)+' วัน'):d===0?wfText('Today','วันนี้'):wfText('In '+d+' days','อีก '+d+' วัน')}</small>`:`<span class="desk-secondary">${deskFirstTime(i)?wfText('Starts after the first approval','เริ่มหลังอนุมัติราคาแรก'):'—'}</span>`;
  return `<tr ${detailRowAttrs('part/'+i.id)} data-plan-item="${i.id}" data-schedule-state="${regStateOf(i)}">
    <td>${deskPart(i)}<span class="desk-supplier">${esc(supplierName(i.supplier))}</span></td>
    <td>${esc(i.format)}<small class="desk-secondary">${esc(regSetName(i)||'—')}</small></td>
    <td><span class="desk-interval">${i.cadence||3} ${wfText('months','เดือน')}</span></td>
    <td>${i.last?`<time>${date(i.last)}</time>`:'<span class="desk-secondary">—</span>'}</td>
    <td>${when}</td>
    <td class="num"><strong class="desk-amount">${i.price==null?'—':cash(i.price)}</strong>${i.price==null?'':`<small class="desk-secondary">${wfText('THB / pc','บาท/ชิ้น')}</small>`}</td>
    <td>${statusPill(wfText(st[1],st[2]),st[3])}${pair?`<small class="desk-secondary">${esc(pair.phase?.label||'')}</small>`:''}</td>
    <td class="desk-actions">${portal==='roki'&&user.role==='Issue'&&!deskFirstTime(i)?`<button class="button" data-schedule="${i.id}">${wfText('Edit schedule','แก้ไขกำหนดการ')}</button>`:`<a class="button" href="#part/${i.id}">${wfText('Details','รายละเอียด')}</a>`}</td></tr>`;
}

function activeScheduleView(){
  if(portal!=='roki')return rfqDenied();
  const s=deskState(REG_KEY),all=currentItems();
  if(s.stage==null||s.stage==='')s.stage='active';
  const rows=regFilter(all,s),page=deskPage(rows,s),chips=regChips(s);
  const due=all.filter(i=>regStateOf(i)==='due').length,soon=all.filter(i=>i.next&&i.next>TODAY&&i.next<=regAdd(30)&&regStateOf(i)==='upcoming').length;
  return heading(wfText('Requests and purchase prices','คำขอและราคาซื้อ'),wfText('All review schedules','รายการกำหนดรอบทบทวนทั้งหมด'),wfText('Every part and its review interval, next review date and status. Reviews that come due are sent to the Supplier automatically; editing a schedule never sends anything.','ทุกชิ้นส่วนพร้อมรอบทบทวน วันทบทวนครั้งถัดไป และสถานะ เมื่อถึงรอบระบบส่งให้ Supplier เอง การแก้กำหนดการไม่ใช่การส่งคำขอ'),rfqCanCreate()?wfLink('request-new','Review schedule','กำหนดรอบทบทวน',true):'')
  +`<div class="desk-totals"><span><strong>${all.length}</strong>${wfText('parts in the register','ชิ้นส่วนในทะเบียน')}</span><span><strong>${due}</strong>${wfText('due now','ถึงรอบแล้ว')}</span><span><strong>${soon}</strong>${wfText('due within 30 days','ถึงรอบภายใน 30 วัน')}</span></div>`
  +`<section class="panel desk-panel" data-desk-section="schedule-register">
  ${regControls(s,all,chips)}
  ${chips.length?`<div class="reg-chips" data-reg-chips>${chips.map(([k,label])=>`<button type="button" class="chip removable" data-reg-clear="${k}">${esc(label)} <span aria-hidden="true">×</span></button>`).join('')}<button type="button" class="link-button" data-reg-clear="*">${wfText('Clear all filters','ล้างตัวกรองทั้งหมด')}</button></div>`:''}
  <header class="desk-panel-heading reg-table-heading"><div><h2>${wfText('Schedules','กำหนดการ')} <span class="count">${rows.length}</span></h2><p>${rows.length===all.length?wfText('Showing every part.','แสดงทุกชิ้นส่วน'):wfText('Showing '+rows.length+' of '+all.length+' parts.','แสดง '+rows.length+' จาก '+all.length+' ชิ้นส่วน')}</p></div>
    <div class="reg-tools"><label>${wfText('Rows per page','แถวต่อหน้า')} <select data-desk-filter="size" data-desk-key="${REG_KEY}">${[12,25,50,100].map(n=>`<option value="${n}" ${Number(s.size)===n?'selected':''}>${n}</option>`).join('')}</select></label>
      <button type="button" class="button" data-reg-export ${rows.length?'':'disabled'}>${icon('download')}${wfText('Export CSV','ส่งออก CSV')}</button></div>
  </header>
  <div class="table-wrap desk-table-wrap"><table class="data-table desk-table desk-planning-table reg-table" data-desk-table="schedules"><thead><tr><th>${wfText('Part / Supplier','ชิ้นส่วน / Supplier')}</th><th>${wfText('Form / formula set','ประเภท / ชุดสูตร')}</th><th>${wfText('Review interval','รอบทบทวน')}</th><th>${wfText('Last approved','อนุมัติล่าสุด')}</th><th>${wfText('Next review','ทบทวนครั้งถัดไป')}</th><th class="num">${wfText('Current price','ราคาปัจจุบัน')}</th><th>${wfText('Status','สถานะ')}</th><th>${wfText('Action','ดำเนินการ')}</th></tr></thead><tbody>${page.items.map(regRow).join('')}</tbody></table></div>
  ${!rows.length?deskEmpty(wfText('No schedules match these filters.','ไม่มีกำหนดการที่ตรงกับตัวกรอง')):''}${deskPager(REG_KEY,rows.length,page.pages)}</section>`;
}

function regExport(){
  const s=deskState(REG_KEY),rows=regFilter(currentItems(),s);
  const head=['Part code','Part name','Supplier','Form','Formula set','Interval (months)','Last approved','Next review','Days to next review','Current price (THB/pc)','Status'];
  const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const lines=[head,...rows.map(i=>{const st=regStateMeta(regStateOf(i));return [i.code,i.name,supplierName(i.supplier),i.format,regSetName(i),i.cadence||3,i.last||'',i.next||'',regDays(i)??'',i.price==null?'':i.price,st[1]]})];
  download('review-schedules-'+TODAY+'.csv','﻿'+lines.map(r=>r.map(cell).join(',')).join('\r\n'));
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||route().split('/')[0]!==REG_KEY)return;
  const s=deskState(REG_KEY);
  if(b.hasAttribute('data-reg-toggle')){
    s.advancedOpen=!s.advancedOpen;
    document.getElementById('schedule-advanced').hidden=!s.advancedOpen;
    b.setAttribute('aria-expanded',String(s.advancedOpen));
    return;
  }
  if(b.dataset.regPreset){
    const form=b.form,{from,to}=form.elements;
    const preset=REG_PRESETS.find(([key])=>key===b.dataset.regPreset);
    const range=b.getAttribute('aria-pressed')==='true'?{from:'',to:''}:preset[3]();
    from.value=range.from;
    to.value=range.to;
    return regUpdateForm(form);
  }
  if(b.hasAttribute('data-reg-clear-advanced')){
    REG_ADVANCED_KEYS.forEach(key=>regClear(s,key));
    render();
    document.querySelector('[data-reg-clear-advanced]')?.focus();
    return;
  }
  if(b.dataset.regClear){regClear(s,b.dataset.regClear);return render()}
  if(b.hasAttribute('data-reg-export'))return regExport();
});

function regUpdateForm(form){
  const {from,to}=form.elements,preset=regPreset({from:from.value,to:to.value});
  for(const button of form.querySelectorAll('[data-reg-preset]')){
    const active=button.dataset.regPreset===preset;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  }
  form.querySelector('[role="alert"]').hidden=true;
}
document.addEventListener('input',e=>{
  if(e.target.form?.id==='schedule-advanced')regUpdateForm(e.target.form);
});
document.addEventListener('submit',e=>{
  const form=e.target;
  if(form.id!=='schedule-advanced')return;
  e.preventDefault();
  const f=Object.fromEntries(new FormData(form)),error=form.querySelector('[role="alert"]');
  const invalidDates=f.from&&f.to&&f.from>f.to;
  const invalidPrices=f.pmin!==''&&f.pmax!==''&&Number(f.pmin)>Number(f.pmax);
  if(invalidDates||invalidPrices){
    error.textContent=invalidDates?wfText('Start date must be on or before the end date.','วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด'):wfText('Minimum price must not exceed the maximum price.','ราคาต่ำสุดต้องไม่เกินราคาสูงสุด');
    error.hidden=false;
    return;
  }
  Object.assign(deskState(REG_KEY),f,{page:1});
  render();
  document.querySelector('#schedule-advanced button[type="submit"]')?.focus();
});
