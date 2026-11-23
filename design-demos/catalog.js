'use strict';
/* Part master (parts & assemblies), CSV import, and the price-update schedule.
   Loaded before workspace.js; relies on its globals (db, portal, user, dialog, toast, render, persist, audit…) at call time.
   The part master is a price-management list kept separately from stock: one row per part × supplier pair.
   Part codes normally come from SAP, so they can be typed in or imported from a CSV file (Excel: Save As › CSV UTF-8). */

/* ---------- helpers ---------- */
const pad2=n=>String(n).padStart(2,'0');
const isoDate=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const addMonths=(iso,n)=>{const d=new Date(iso+'T00:00:00'),day=d.getDate();d.setMonth(d.getMonth()+n);if(d.getDate()!==day)d.setDate(0);return isoDate(d)};
const priceText=i=>i.price==null?'—':cash(i.price);
const isScheduled=i=>!!i.next;
const dueState=i=>i.next<TODAY?'Overdue':i.next===TODAY?'Due today':'Upcoming';
const cadenceText=n=>`Every ${n} month${n===1?'':'s'}`;
const nextItemId=()=>'i'+(Math.max(0,...db.items.map(i=>Number(i.id.slice(1))||0))+1);
const hasQuotes=id=>db.quotes.some(q=>q.item===id);
const codeHasQuotes=code=>db.items.some(i=>i.code===code&&hasQuotes(i.id));
const canDeletePair=id=>!(db.priceRequests||[]).some(r=>r.items.includes(id))&&!hasQuotes(id)&&!db.notifications.some(n=>n.items.includes(id))&&!db.history.some(h=>h.item===id);
const FORMAT_NAMES=['Single Part','Assembly'];
const persistOrWarn=()=>{try{persist();return true}catch{toast('Browser storage is full. Remove some attachments and try again.');return false}};

function childrenHtml(i){
  const c=i.children||[];if(!c.length)return '';
  return `<details class="part-children"><summary>Components (${c.length})</summary><ul>${c.map(x=>{const known=db.items.find(p=>p.code===x.code);return `<li><span>${esc(x.code)}</span>${known?`<small>${esc(known.name)}</small>`:'<small>Not in the part list</small>'}<b>× ${esc(x.qty)}</b></li>`}).join('')}</ul></details>`;
}
/* "code, qty" lines or "code:qty;code:qty" → [{code,qty}] */
function parseChildList(str,self){
  const out=[],seen=new Set();
  for(const entry of String(str||'').split(/\r?\n|;/).map(s=>s.trim()).filter(Boolean)){
    let code,qty=1;
    const m=/^(.+?)\s*[:,\t]\s*(\S+)$/.exec(entry)||/^(\S+)\s+(\S+)$/.exec(entry);
    if(m){code=m[1].trim();qty=Number(m[2])}else code=entry;
    if(!code||!Number.isFinite(qty)||qty<=0)return {error:'Each component needs a part code and a quantity above zero.'};
    if(code===self)return {error:'A part cannot be a component of itself.'};
    if(seen.has(code))return {error:'A component part code is listed twice.'};
    seen.add(code);out.push({code,qty});
  }
  return {list:out};
}
const childrenText=i=>(i.children||[]).map(c=>`${c.code}, ${c.qty}`).join('\n');

/* ---------- price update requests, as seen by the signed-in supplier ---------- */
function requestItemState(n,itemId){
  const q=db.quotes.filter(q=>q.requestedBy===n.id&&q.item===itemId&&q.status!=='Rejected').at(-1);
  if(!q)return {state:'open'};
  return {state:['Draft','Reverted'].includes(q.status)?'progress':'submitted',quote:q};
}
function latestRequest(itemId){
  const n=deskLatestNotice(itemId,n=>n.supplier===user?.supplier);
  return n?{n,...requestItemState(n,itemId)}:null;
}
function requestCell(i){
  const r=latestRequest(i.id);
  if(!r)return '<span class="muted-note">No request</span>';
  if(r.state==='open')return `${statusPill('Request open','blue')}<small>Response due ${date(r.n.due)}</small>${user.role==='Issue'?`<button class="date-button" data-request="${r.n.id}" data-item="${i.id}">Prepare quotation</button>`:''}`;
  if(r.state==='progress')return `${statusPill('In progress','purple')}<small><a class="link-button" href="#quote/${r.quote.id}">${esc(r.quote.id)}</a></small>`;
  return `${statusBadge(r.quote.status)}<small><a class="link-button" href="#quote/${r.quote.id}">${esc(r.quote.id)}</a></small>`;
}

/* ---------- Parts & assemblies page ---------- */
function parts(){
  const roki=portal==='roki',manage=roki&&user.role==='Issue';
  const items=currentItems().filter(i=>`${i.code} ${i.name} ${i.rtp||''} ${supplierName(i.supplier)}`.toLowerCase().includes(search.toLowerCase())&&(!filterSupplier||i.supplier===filterSupplier)&&(!formatFilter||i.format===formatFilter));
  const codes=new Set(items.map(i=>i.code)).size;
  return heading('Part master',roki?'Parts & assemblies':'My parts',roki?'Create parts and assemblies, import them from a file, and link each one to its suppliers. Prices come from approved quotations.':'Current approved prices and review dates for each item–supplier pair.',manage?actionButton('Import from file','import-parts')+actionButton('Add part','add-part',true):'')
  +(roki?'':'<div class="highlight-note blue">These are the parts ROKI has assigned to your company. You can prepare a quotation for a part only after ROKI sends a price update request for it.</div>')+`<section class="panel"><div class="filters"><div class="search">${icon('search')}<input id="search" value="${esc(search)}" placeholder="Search part, RTP code or supplier…"></div>${roki?`<select id="supplier-filter"><option value="">All suppliers</option>${suppliers.map(s=>`<option value="${s.id}" ${filterSupplier===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`:''}<select id="format-filter"><option value="">All formats</option>${FORMAT_NAMES.map(f=>`<option value="${f}" ${formatFilter===f?'selected':''}>${f}</option>`).join('')}</select></div>`
  +`<div class="table-wrap"><table class="data-table"><thead><tr><th>Part / item code</th><th>Supplier</th><th>Format</th><th>RTP code</th><th class="num">Approved · THB</th><th>Last update</th><th>Next review</th>${roki?'<th></th>':'<th>Price request</th>'}</tr></thead><tbody>${items.map(i=>`<tr ${detailRowAttrs('part/'+i.id)}><td><strong>${detailRecordLink('part/'+i.id,i.code)}</strong><small>${esc(i.name)}</small>${childrenHtml(i)}</td><td>${esc(supplierName(i.supplier))}</td><td>${esc(i.format)}</td><td>${esc(i.rtp||'—')}</td><td class="num price">${priceText(i)}</td><td>${date(i.last)}</td><td>${i.next?`${date(i.next)}<small>${cadenceText(i.cadence)}</small>`:statusPill('Not scheduled','gray')}</td>${manage?`<td><button class="date-button" data-edit-part="${i.id}">Edit</button></td>`:`<td>${roki?'':requestCell(i)}</td>`}</tr>`).join('')}</tbody></table>${!items.length?'<div class="empty">No parts match this view.</div>':''}</div><div class="table-footer"><span>${items.length} item–supplier pairs · ${codes} part code${codes===1?'':'s'}</span><span>Prices come from approved quotations</span></div></section>`;
}

/* ---------- add / edit a part ---------- */
let partEdit=null;
function partDialog(id){
  if(portal!=='roki'||user?.role!=='Issue')return;
  const it=id?db.items.find(i=>i.id===id):null;partEdit=it?it.id:null;
  const supplierOpts=suppliers.map(s=>`<option value="${s.id}" ${it?.supplier===s.id?'selected':''}>${esc(s.name)} · ${esc(s.code)}</option>`).join('');
  const cad=it?.cadence||3;
  dialog(it?'Edit part':'Add part',
  `<div class="form-grid dialog-grid"><div class="field"><label for="pf-code">Part code *</label><input id="pf-code" maxlength="40" value="${esc(it?.code||'')}" ${it?'readonly':''} placeholder="e.g. 17230-KWN-9000"></div>
  <div class="field"><label for="pf-name">Part name *</label><input id="pf-name" maxlength="100" value="${esc(it?.name||'')}"></div>
  <div class="field"><label for="pf-format">Format *</label><select id="pf-format" ${it&&codeHasQuotes(it.code)?'disabled':''}>${FORMAT_NAMES.map(f=>`<option value="${f}" ${it?.format===f?'selected':''}>${f}</option>`).join('')}</select></div>
  <div class="field"><label for="pf-supplier">Supplier *</label><select id="pf-supplier" ${it?'disabled':''}>${it?'':'<option value="">Select a supplier</option>'}${supplierOpts}</select></div>
  <div class="field"><label for="pf-family">${wfText("Part family / common reference","รหัสกลุ่มชิ้นส่วนกลาง")}</label><input id="pf-family" maxlength="80" value="${esc(it?familyKey(it):'')}"><small>${wfText("Use the same family for equivalent parts with different supplier item codes. Leave empty to use the part code.","ใช้รหัสกลุ่มเดียวกันสำหรับชิ้นส่วนเทียบเท่าที่คนละ Item Code เว้นว่างเพื่อใช้รหัสชิ้นส่วน")}</small></div><div class="field"><label for="pf-rtp">RTP code</label><input id="pf-rtp" maxlength="40" value="${esc(it?.rtp||'')}"></div>
  <div class="field"><label for="pf-drawing">Rev. no. / drawing</label><input id="pf-drawing" maxlength="80" value="${esc(it?.drawing||'')}"></div>
  <div class="field"><label for="pf-qty">Quantity per year · pcs</label><input id="pf-qty" type="number" min="0" step="1" value="${esc(it?.qty??'')}"></div></div>
  <div class="field"><label for="pf-children">Components (optional)</label><textarea id="pf-children" rows="3" placeholder="One per line: part code, quantity">${esc(it?childrenText(it):'')}</textarea><small>For assemblies or parts made from sub-parts. Example: 17211-KZL-9300-21, 1</small></div>
  <div class="schedule-box"><label class="check"><input type="checkbox" id="pf-sched" ${it?(it.next?'checked':''):'checked'}> Include in the price update schedule</label>
  <div class="form-grid dialog-grid"><div class="field"><label for="pf-cadence">Review interval</label><select id="pf-cadence"><option value="1" ${cad===1?'selected':''}>Every month</option><option value="3" ${cad===3?'selected':''}>Every 3 months</option></select></div>
  <div class="field"><label for="pf-next">Next review date</label><input id="pf-next" type="date" value="${esc(it?.next||'')}"></div></div><small>Leave the date empty to calculate it from the last approved price.</small></div>
  <p class="dialog-note">${it?'Name, format, drawing and components apply to every supplier of this part. ':''}Saving a part never sends a notification.</p>`,
  (it&&canDeletePair(it.id)?actionButton('Delete part','delete-part'):'')+actionButton(it?'Save part':'Add part','save-part',true),'wide');
}
function savePart(){
  if(portal!=='roki'||user?.role!=='Issue')return;
  const v=id=>document.getElementById(id).value.trim(),edit=partEdit?db.items.find(i=>i.id===partEdit):null;
  const code=edit?edit.code:v('pf-code'),name=v('pf-name'),supplier=edit?edit.supplier:v('pf-supplier');
  const format=document.getElementById('pf-format').disabled?edit.format:v('pf-format');
  if(!code||!name)return toast('Enter a part code and a part name.');
  if(!supplier||!suppliers.some(s=>s.id===supplier))return toast('Select a supplier for this part.');
  if(!edit&&db.items.some(i=>i.code===code&&i.supplier===supplier))return toast('This part is already linked to this supplier.');
  const sameCode=db.items.filter(i=>i.code===code);
  if(!edit&&sameCode.length&&sameCode[0].format!==format)return toast('This part code already exists in a different format.');
  const qtyRaw=v('pf-qty'),qty=qtyRaw===''?0:Number(qtyRaw);
  if(!Number.isFinite(qty)||qty<0)return toast('Quantity per year must be zero or more.');
  const kids=parseChildList(document.getElementById('pf-children').value,code);if(kids.error)return toast(kids.error);
  const cadence=Number(document.getElementById('pf-cadence').value)||3,wantsSchedule=document.getElementById('pf-sched').checked,nextInput=v('pf-next');
  const pair=edit||{id:nextItemId(),code,supplier,price:null,last:null};
  Object.assign(pair,{rtp:v('pf-rtp'),qty,cadence});
  pair.next=wantsSchedule?(nextInput||addMonths(pair.last||TODAY,cadence)):null;
  for(const i of [pair,...sameCode]){i.family=v('pf-family')||code;i.name=name;i.format=format;i.drawing=v('pf-drawing');i.children=structuredClone(kids.list)}
  if(!edit)db.items.push(pair);
  audit((edit?'Updated part · ':'Added part · ')+code+' / '+supplierName(supplier));
  if(!persistOrWarn())return;
  closeDialog();render();toast(edit?'Part saved.':'Part added.');
}
function deletePartDialog(){
  if(portal!=='roki'||user?.role!=='Issue')return;
  const it=db.items.find(i=>i.id===partEdit);if(!it||!canDeletePair(it.id))return;
  dialog('Delete part',`<p><strong>${esc(it.code)}</strong> · ${esc(it.name)}<br>${esc(supplierName(it.supplier))}</p><p style="margin-top:15px">This removes the part from this supplier’s list and from the price update schedule. It has no quotations, requests or price history, and this cannot be undone.</p>`,actionButton('Delete part','confirm-delete-part',true));
}
function confirmDeletePart(){
  if(portal!=='roki'||user?.role!=='Issue')return;
  const it=db.items.find(i=>i.id===partEdit);if(!it||!canDeletePair(it.id))return toast('This part has quotations or requests and cannot be deleted.');
  db.items=db.items.filter(i=>i.id!==it.id);selected.delete(it.id);audit('Deleted part · '+it.code+' / '+supplierName(it.supplier));
  if(!persistOrWarn())return;closeDialog();render();toast('Part deleted.');
}

/* ---------- import from CSV ---------- */
let importRows=null;
const TEMPLATE_HEAD=['part_code','part_name','format','supplier_code','rtp_code','drawing','annual_qty','components','review_months','next_review','part_family'];
const COLUMN_ALIASES={family:['partfamily','family','commonpartcode'],code:['partcode','code','partno','partnumber','itemcode'],name:['partname','name','description'],format:['format','type','quotationformat'],supplier:['suppliercode','supplier','vendorcode','vendor'],rtp:['rtpcode','rtp'],drawing:['drawing','drawingrev','rev','revno'],qty:['annualqty','qty','quantityperyear','qtyyear','qtyy'],children:['components','bom','subparts','componentparts'],cadence:['reviewmonths','cadence','interval','reviewinterval'],next:['nextreview','nextreviewdate','nextreviewon']};
function parseCSV(text){
  text=text.replace(/^﻿/,'');
  const first=text.split(/\r?\n/,1)[0]||'';
  const delim=[',',';','\t'].map(d=>[d,first.split(d).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[];let row=[],cell='',q=false;
  for(let k=0;k<text.length;k++){
    const ch=text[k];
    if(q){if(ch==='"'){if(text[k+1]==='"'){cell+='"';k++}else q=false}else cell+=ch}
    else if(ch==='"')q=true;
    else if(ch===delim){row.push(cell);cell=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[k+1]==='\n')k++;row.push(cell);cell='';if(row.some(c=>c.trim()!==''))rows.push(row);row=[]}
    else cell+=ch;
  }
  row.push(cell);if(row.some(c=>c.trim()!==''))rows.push(row);
  return rows;
}
function parseDateInput(s){
  s=String(s||'').trim();if(!s)return {value:null};
  let y,m,d,x;
  if((x=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)))[y,m,d]=[x[1],x[2],x[3]];
  else if((x=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)))[d,m,y]=[x[1],x[2],x[3]];
  else return {error:true};
  y=Number(y);if(y>2400)y-=543;m=Number(m);d=Number(d);
  const dt=new Date(y,m-1,d);if(dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d)return {error:true};
  return {value:isoDate(dt)};
}
function normalizeFormat(s){const t=String(s||'').trim().toLowerCase().replace(/[^a-z]/g,'');if(['singlepart','single','part','unitpart'].includes(t))return 'Single Part';if(['assembly','assy'].includes(t))return 'Assembly';return null}
function mapHeaders(head){
  const norm=head.map(h=>String(h).toLowerCase().replace(/[^a-z0-9]/g,'')),idx={};
  for(const [key,names] of Object.entries(COLUMN_ALIASES)){const at=norm.findIndex(n=>names.includes(n));if(at>=0)idx[key]=at}
  return idx;
}
function checkImport(rows){
  const idx=mapHeaders(rows[0]);
  if(['code','name','format','supplier'].some(k=>idx[k]===undefined))return {error:'The file needs columns for part code, part name, format and supplier code.'};
  const get=(r,k)=>idx[k]===undefined?'':String(r[idx[k]]??'').trim();
  const seen=new Set(),formatOf=new Map();
  for(const i of db.items)if(!formatOf.has(i.code))formatOf.set(i.code,i.format);
  const out=rows.slice(1).map((r,n)=>{
    const errors=[],line=n+2,code=get(r,'code'),name=get(r,'name'),fmtRaw=get(r,'format'),supRaw=get(r,'supplier');
    const format=normalizeFormat(fmtRaw);
    const sup=suppliers.find(s=>s.code===supRaw||s.name.toLowerCase()===supRaw.toLowerCase());
    if(!code)errors.push('Part code is required.');
    if(!name)errors.push('Part name is required.');
    if(!format)errors.push('Format must be Single Part or Assembly.');
    if(!sup)errors.push('Unknown supplier code.');
    const existing=sup&&code?db.items.find(i=>i.code===code&&i.supplier===sup.id):null;
    if(code&&sup){const key=code+'|'+sup.id;if(seen.has(key))errors.push('Duplicate of an earlier row in this file.');seen.add(key)}
    if(code&&format&&formatOf.has(code)&&formatOf.get(code)!==format)errors.push('This part code already exists in a different format.');
    const qtyRaw=get(r,'qty'),qty=qtyRaw===''?null:Number(qtyRaw.replace(/,/g,''));
    if(qty!==null&&(!Number.isFinite(qty)||qty<0))errors.push('Quantity per year must be a number.');
    const cadRaw=get(r,'cadence'),cadence=cadRaw===''?null:Number(cadRaw);
    if(cadence!==null&&![1,3].includes(cadence))errors.push('Review months must be 1 or 3.');
    const nd=parseDateInput(get(r,'next'));if(nd.error)errors.push('Date must be YYYY-MM-DD or DD/MM/YYYY.');
    const kids=get(r,'children')===''?null:parseChildList(get(r,'children'),code);if(kids&&kids.error)errors.push(kids.error);
    if(existing&&format&&existing.format!==format&&codeHasQuotes(code))errors.push('The format cannot change after quotations exist for this part.');
    if(!errors.length&&format)formatOf.set(code,format);
    return {line,code,name,format:format||fmtRaw,supplier:sup?.id,supplierText:supRaw,existing:existing?.id||null,errors,
      data:{family:get(r,'family'),rtp:get(r,'rtp'),drawing:get(r,'drawing'),qty,cadence,next:nd.value||null,children:kids&&!kids.error?kids.list:null},status:errors.length?'error':existing?'update':'new'};
  });
  return {rows:out};
}
function importDialog(){
  if(portal!=='roki'||user?.role!=='Issue')return;importRows=null;
  dialog('Import parts from file',`<p>Upload a CSV file with one row per part and supplier. Part codes usually come from SAP. In Excel, use Save As › CSV UTF-8.</p><div class="field"><label for="import-file">CSV file</label><input type="file" id="import-file" accept=".csv,.txt,text/csv"></div><p style="margin-top:12px"><button type="button" class="link-button" data-action="template">Download CSV template</button></p><div id="import-preview" aria-live="polite"></div><details class="import-help"><summary>Columns</summary><p>${wfText('Optional part_family groups equivalent parts with different codes.','เพิ่มคอลัมน์ part_family เพื่อจัดกลุ่มชิ้นส่วนเทียบเท่าที่คนละรหัสได้')}</p><p>part_code, part_name, format (Single Part or Assembly), supplier_code, rtp_code, drawing, annual_qty, components (code:qty;code:qty), review_months (1 or 3), next_review (YYYY-MM-DD or DD/MM/YYYY).</p><p>Rows for an existing part and supplier update it; empty cells keep the current value. A row with review months or a next review date is added to the price update schedule. Nothing is imported until you confirm, and importing never sends a notification.</p></details>`,
  actionButton('Import valid rows','import-confirm',true,'id="import-go" disabled'),'wide');
}
const statusLabel={new:['New','green'],update:['Update','blue'],error:['Error','red']};
function renderImportPreview(){
  const box=document.getElementById('import-preview'),go=document.getElementById('import-go');if(!box)return;
  if(!importRows){box.innerHTML='';go.disabled=true;return}
  if(importRows.error){box.innerHTML=`<div class="highlight-note">${esc(importRows.error)}</div>`;go.disabled=true;return}
  const rows=importRows.rows,c={new:0,update:0,error:0};rows.forEach(r=>c[r.status]++);
  go.disabled=c.new+c.update===0;
  box.innerHTML=`<div class="import-summary">${statusPill(c.new+' new','green')}${statusPill(c.update+' updates','blue')}${statusPill(c.error+' errors',c.error?'red':'gray')}</div><div class="table-wrap import-table"><table class="data-table"><thead><tr><th>Line</th><th>Part code</th><th>Part name</th><th>Format</th><th>Supplier</th><th>Result</th></tr></thead><tbody>${rows.slice(0,200).map(r=>`<tr class="${r.status==='error'?'overdue':''}"><td>${r.line}</td><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(r.format)}</td><td>${esc(r.supplier?supplierName(r.supplier):r.supplierText)}</td><td>${statusPill(...statusLabel[r.status])}${r.errors.map(e=>`<small class="err">${esc(e)}</small>`).join('')}</td></tr>`).join('')}</tbody></table></div>${rows.length>200?`<small>Showing the first 200 of ${rows.length} rows.</small>`:''}`;
}
async function readImportFile(input){
  const file=input.files[0];if(!file)return;
  importRows=null;
  if(/\.xlsx?$/i.test(file.name)){importRows={error:'Excel files are not read directly. In Excel, choose Save As › CSV UTF-8, then upload that file.'};return renderImportPreview()}
  if(file.size>1024*1024){importRows={error:'Use a file smaller than 1 MB.'};return renderImportPreview()}
  try{
    const rows=parseCSV(await file.text());
    importRows=rows.length<2?{error:'The file has no data rows.'}:checkImport(rows);
  }catch{importRows={error:'The selected file could not be read.'}}
  renderImportPreview();
}
function confirmImport(){
  if(portal!=='roki'||user?.role!=='Issue'||!importRows||importRows.error)return;
  const good=importRows.rows.filter(r=>r.status!=='error');if(!good.length)return toast('There are no valid rows to import.');
  let added=0,updated=0;
  for(const r of good){
    const d=r.data,same=db.items.filter(i=>i.code===r.code);
    let pair=r.existing?db.items.find(i=>i.id===r.existing):null;
    if(!pair){pair={id:nextItemId(),code:r.code,supplier:r.supplier,price:null,last:null,qty:0,cadence:3,next:null,rtp:'',drawing:same[0]?.drawing||'',children:structuredClone(same[0]?.children||[])};db.items.push(pair);added++}else updated++;
    if(d.rtp)pair.rtp=d.rtp;if(d.qty!==null)pair.qty=d.qty;
    if(d.cadence!==null)pair.cadence=d.cadence;
    if(d.next)pair.next=d.next;else if((d.cadence!==null)&&!pair.next)pair.next=addMonths(pair.last||TODAY,pair.cadence);
    for(const i of db.items.filter(i=>i.code===r.code)){i.name=r.name;i.format=r.format;if(d.family)i.family=d.family;if(d.drawing)i.drawing=d.drawing;if(d.children)i.children=structuredClone(d.children)}
  }
  const skipped=importRows.rows.length-good.length;
  audit(`Imported ${good.length} parts from file (${added} new, ${updated} updated)`);
  if(!persistOrWarn())return;importRows=null;closeDialog();render();
  toast(`Imported ${good.length} rows (${added} new, ${updated} updated). ${skipped} skipped.`);
}
function downloadTemplate(){
  const rows=[TEMPLATE_HEAD,['17999-TST-0001','SAMPLE COVER','Single Part','40110020','S001571-099-01','M206-F-26','25000','','3','2027-01-15',''],['17999-TST-0002','SAMPLE CASE ASSY','Assembly','40110020','S001571-099-02','04','2400','17999-TST-0001:1;17222-K1Z-J000:1','1','','']];
  download('roki-parts-template.csv','﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'));
}

/* ---------- Price update schedule ---------- */
function schedule(){
  const scheduled=db.items.filter(isScheduled),unscheduled=db.items.length-scheduled.length;
  const items=scheduled.filter(i=>`${i.code} ${i.name} ${supplierName(i.supplier)}`.toLowerCase().includes(search.toLowerCase())&&(!filterSupplier||i.supplier===filterSupplier)&&(!filterStatus||dueState(i)===filterStatus));
  return heading('Supplier price review','Price update schedule',wfText('Plan review dates. Create an internal request and complete Check and Approve before sending to suppliers.','วางแผนวันทบทวน สร้างคำขอภายในและผ่าน Check กับ Approve ก่อนส่งให้ Supplier'),(user.role==='Issue'?wfLink('request-new','Create price request','สร้างคำขอเสนอราคา',true)+actionButton('Add to schedule','add-schedule'):''))
  +`<div class="highlight-note">${icon('clock')}　${wfText('Review dates only flag items to review. Create and approve an internal request before Issue sends it to suppliers.','วันทบทวนใช้เตือนรายการที่ควรทบทวน ต้องสร้างและอนุมัติคำขอภายในก่อน Issue จะส่งให้ Supplier')}</div><section class="panel"><div class="panel-title"><div><h2>Item–supplier review list</h2><small>${wfText("Review date","วันที่ทบทวน")}: ${date(TODAY)} · Each supplier is tracked separately.</small></div><div class="actions">${unscheduled?statusPill(unscheduled+' not scheduled','gray'):''}${statusPill(scheduled.filter(i=>i.next<=TODAY).length+' pairs due','amber')}</div></div><div class="filters"><div class="search">${icon('search')}<input id="search" value="${esc(search)}" placeholder="Search item or supplier…"></div><select id="supplier-filter"><option value="">All suppliers</option>${suppliers.map(s=>`<option value="${s.id}" ${filterSupplier===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select><select id="status-filter"><option value="">All review dates</option>${['Overdue','Due today','Upcoming'].map(s=>`<option value="${s}" ${filterStatus===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="table-wrap"><table class="data-table schedule-table"><thead><tr><th><input type="checkbox" id="select-all" aria-label="Select all visible item supplier pairs" ${items.length&&items.every(i=>selected.has(i.id))?'checked':''}></th><th>Item / supplier</th><th class="num">Current price</th><th>Next review</th><th>${wfText("Review timing","สถานะรอบทบทวน")}</th><th>${wfText("Latest request progress","ความคืบหน้าคำขอล่าสุด")}</th><th></th></tr></thead><tbody>${items.map(i=>{const status=dueState(i);const notice=[...db.notifications].reverse().find(n=>n.items.includes(i.id));return `<tr ${detailRowAttrs('part/'+i.id)} class="${status==='Overdue'?'overdue':status==='Due today'?'due':''}"><td><input type="checkbox" data-select="${i.id}" ${user.role!=='Issue'||wfActive(i.id)||rfqReserved(i.id)?'disabled':''} aria-label="Select ${esc(i.code+' '+supplierName(i.supplier))}" ${selected.has(i.id)?'checked':''}></td><td><strong>${esc(i.code)} · ${esc(i.name)}</strong><small>${esc(supplierName(i.supplier))}</small></td><td class="num price">${priceText(i)}</td><td>${date(i.next)}<small>${cadenceText(i.cadence)}</small></td><td>${statusPill(status,status==='Overdue'?'red':status==='Due today'?'amber':'gray')}</td><td>${rfqReserved(i.id)?rfqBadge(rfqReserved(i.id))+`<small><a class="link-button" href="#request-register/${rfqReserved(i.id).id}">${esc(rfqReserved(i.id).id)}</a></small>`:notice?statusPill(workflowRequestState(notice,i.id)[1],workflowRequestState(notice,i.id)[2]):statusPill(wfText('Not requested','ยังไม่ได้ส่งคำขอ'),'gray')}${notice?`<small>${esc(notice.created)}</small><a class="link-button" href="#request-tracking">${wfText('Track request','ติดตามคำขอ')}</a>`:''}</td><td>${user.role==='Issue'?`<button class="date-button" data-schedule="${i.id}">Edit schedule</button>`:''}</td></tr>`}).join('')}</tbody></table>${!items.length?`<div class="empty">${scheduled.length?'No item–supplier pairs match these filters.':'No item–supplier pairs are scheduled yet. Use Add to schedule to choose parts.'}</div>`:''}</div><div class="selection-bar"><span><strong>${selected.size}</strong> item–supplier pairs selected · ${new Set([...selected].map(id=>db.items.find(i=>i.id===id)?.supplier)).size} suppliers</span><button class="button primary" data-action="notify" ${!selected.size||user.role!=='Issue'?'disabled':''}>${wfText('Create internal request','สร้างคำขอภายในโรกิ')}</button></div></section><section class="panel" style="margin-top:22px"><div class="panel-title"><h2>Notification log</h2><span class="badge gray">Demo deliveries</span></div>${db.notifications.length?[...db.notifications].reverse().map(n=>`<div class="notification-card"><div><h3>${esc(supplierName(n.supplier))} · ${n.items.length} item${n.items.length===1?'':'s'}</h3><p>${n.items.map(id=>esc(db.items.find(i=>i.id===id)?.code||'')).join(', ')} · Response due ${date(n.due)}</p><small>${esc(n.by)} · ${esc(n.created)}</small></div>${statusPill('Sent in demo','green')}</div>`).join(''):'<div class="empty">No notifications sent.</div>'}</section>`;
}
/* Add parts to the schedule: every row is an existing part × supplier pair */
function scheduleAddDialog(){
  if(portal!=='roki'||user?.role!=='Issue')return;
  const rows=[...db.items].sort((a,b)=>a.code.localeCompare(b.code)||a.supplier.localeCompare(b.supplier));
  dialog('Add to schedule',`<p>Choose the parts to review regularly. Each supplier of a part is scheduled separately.</p>
  <div class="filters dialog-filters"><div class="search">${icon('search')}<input id="sa-search" placeholder="Search part or supplier…"></div><select id="sa-supplier"><option value="">All suppliers</option>${suppliers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
  <div class="table-wrap sa-table"><table class="data-table"><thead><tr><th><input type="checkbox" id="sa-all" aria-label="Select all visible item supplier pairs"></th><th>Item / supplier</th><th>Schedule</th></tr></thead><tbody>${rows.map(i=>`<tr data-sa-row data-sup="${i.supplier}" data-text="${esc((i.code+' '+i.name+' '+supplierName(i.supplier)).toLowerCase())}"><td><input type="checkbox" data-sa="${i.id}" aria-label="Select ${esc(i.code+' '+supplierName(i.supplier))}" ${i.next?'':'checked'}></td><td><strong>${esc(i.code)} · ${esc(i.name)}</strong><small>${esc(supplierName(i.supplier))}</small></td><td>${i.next?`${statusPill('Scheduled','gray')}<small>${date(i.next)} · ${cadenceText(i.cadence)}</small>`:statusPill('Not scheduled','amber')}</td></tr>`).join('')}</tbody></table></div>
  <div class="form-grid dialog-grid"><div class="field"><label for="sa-cadence">Review interval</label><select id="sa-cadence"><option value="1">Every month</option><option value="3" selected>Every 3 months</option></select></div><div class="field"><label for="sa-next">First review date</label><input id="sa-next" type="date"><small>Leave empty to calculate it from the last approved price.</small></div></div>
  <p class="dialog-note"><span id="sa-count"></span> Pairs that are already scheduled are changed to the interval and date above. Creating a schedule never sends a notification.</p>`,
  actionButton('Add to schedule','save-schedule-add',true),'wide');
  saCount();
}
const saRows=()=>[...document.querySelectorAll('[data-sa-row]')];
function saFilter(){
  const q=(document.getElementById('sa-search')?.value||'').toLowerCase(),s=document.getElementById('sa-supplier')?.value||'';
  saRows().forEach(r=>{r.hidden=!((!q||r.dataset.text.includes(q))&&(!s||r.dataset.sup===s))});saCount();
}
function saCount(){
  const el=document.getElementById('sa-count');if(!el)return;
  const n=saRows().filter(r=>!r.hidden&&r.querySelector('[data-sa]').checked).length;
  el.textContent=`${n} item–supplier pairs selected.`;
}
function saveScheduleAdd(){
  if(portal!=='roki'||user?.role!=='Issue')return;
  const ids=saRows().filter(r=>!r.hidden&&r.querySelector('[data-sa]').checked).map(r=>r.querySelector('[data-sa]').dataset.sa);
  if(!ids.length)return toast('Select at least one part.');
  const cad=Number(document.getElementById('sa-cadence').value)||3,nextInput=document.getElementById('sa-next').value;
  for(const id of ids){const it=db.items.find(i=>i.id===id);if(!it)continue;it.cadence=cad;it.next=nextInput||addMonths(it.last||TODAY,cad)}
  audit(`Added ${ids.length} item–supplier pairs to the price update schedule`);
  if(!persistOrWarn())return;closeDialog();render();toast('Added to the schedule. No notification was sent.');
}
let scheduleEdit=null;
function editSchedule(id){
  if(portal!=='roki'||user?.role!=='Issue')return;const item=db.items.find(i=>i.id===id);if(!item)return;scheduleEdit=id;
  dialog('Edit price review schedule',`<p>${esc(item.code)} · ${esc(supplierName(item.supplier))}</p><div class="field"><label for="next-review">Next review date *</label><input id="next-review" type="date" value="${item.next||''}"></div><div class="field"><label for="cadence">Review interval</label><select id="cadence"><option value="1" ${item.cadence===1?'selected':''}>Every month</option><option value="3" ${item.cadence!==1?'selected':''}>Every 3 months</option></select></div><p style="margin-top:18px">Saving a schedule never sends a notification. Next review dates are managed manually in this demo.</p>`,actionButton('Remove from schedule','remove-schedule')+actionButton('Save schedule','save-schedule',true));
}
function saveScheduleEdit(){
  if(portal!=='roki'||user?.role!=='Issue')return;const item=db.items.find(i=>i.id===scheduleEdit),value=document.getElementById('next-review').value;
  if(!item)return;if(!value)return toast('Choose a next review date.');
  item.next=value;item.cadence=Number(document.getElementById('cadence').value);
  audit('Updated price review schedule · '+item.code+' / '+supplierName(item.supplier));
  if(!persistOrWarn())return;closeDialog();render();toast('Schedule saved. No notification was sent.');
}
function removeFromSchedule(){
  if(portal!=='roki'||user?.role!=='Issue')return;const item=db.items.find(i=>i.id===scheduleEdit);if(!item)return;
  item.next=null;selected.delete(item.id);audit('Removed from price review schedule · '+item.code+' / '+supplierName(item.supplier));
  if(!persistOrWarn())return;closeDialog();render();toast('Removed from the schedule. No notification was sent.');
}

/* ---------- event wiring (called first from workspace.js's click handler) ---------- */
function handleCatalogClick(b){
  if(b.dataset.editPart){partDialog(b.dataset.editPart);return true}
  const a=b.dataset.action;if(!a)return false;
  const map={'add-part':()=>partDialog(),'save-part':savePart,'delete-part':deletePartDialog,'confirm-delete-part':confirmDeletePart,'import-parts':importDialog,'import-confirm':confirmImport,'template':downloadTemplate,'add-schedule':scheduleAddDialog,'save-schedule-add':saveScheduleAdd,'save-schedule':saveScheduleEdit,'remove-schedule':removeFromSchedule};
  if(!map[a])return false;map[a]();return true;
}
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='import-file')readImportFile(t);
  else if(t.id==='sa-supplier')saFilter();
  else if(t.id==='sa-all'){saRows().filter(r=>!r.hidden).forEach(r=>{r.querySelector('[data-sa]').checked=t.checked});saCount()}
  else if(t.dataset&&t.dataset.sa!==undefined)saCount();
});
document.addEventListener('input',e=>{if(e.target.id==='sa-search')saFilter()});
