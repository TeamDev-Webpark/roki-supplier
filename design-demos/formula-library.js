'use strict';
/* Formula library, second layer: everything the customer's documents show besides the arithmetic.
   - readable formulas and a column picker
   - form template: title, form code, header fields, cost titles, notes, signature boxes, blank grid lines
   - per-section heading and printed columns (order, header text), live form preview
   - choice columns (units, Yes/No, repayment …)
   - worked examples: the customer's filled forms, re-calculated with the draft on every change
   - governance: effective date, usage, retire, version differences
   Loaded after formulas.js; formulas.js calls these builders. */

const fmCols=s=>s.fields.map(f=>f[0]);
const fieldLabel=f=>String(f[1]).replace(/ · .*/,'');
function readableFormula(s){
  const names=Object.fromEntries(s.fields.map(f=>[f[0],fieldLabel(f)]));
  const text=String(s.expr||'').replace(/[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/g,m=>'\u0000'+m).replace(/[A-Za-z_][A-Za-z0-9_]*/g,m=>m.startsWith('\u0000')?m:(names[m]||m)).replace(/\u0000/g,'')
    .replace(/\*/g,' × ').replace(/\//g,' ÷ ').replace(/\s+/g,' ').trim();
  return text||'—';
}
function fmSectionExtras(s,si){
  const can=canEditFormulas()?'':'disabled';
  return `<div class="fm-readable"><small>${wfText('In words','อ่านเป็นภาษาคน')}</small><div data-fm-readable="${si}">${esc(readableFormula(s))}</div><div class="fm-chips">${s.fields.map(f=>`<button type="button" class="chip" data-fm-insert="${si}|${esc(f[0])}" ${can} title="${esc(f[1])}">${esc(f[0])}</button>`).join('')}</div></div>`;
}
function fmSectionPrint(s,si){
  const can=canEditFormulas()?'':'disabled',cols=sectionPrintCols(s),keys=['amount',...s.fields.map(f=>f[0])];
  return `<h3>${wfText('Printed form','ในใบพิมพ์')}</h3><div class="form-grid fm-grid"><div class="field fm-wide"><label>${wfText('Heading on the form','หัวตารางในฟอร์ม')}</label><input data-fp="sections.${si}.title" data-ft="s" maxlength="90" ${can} value="${esc(s.title||'')}" placeholder="${esc(`${s.label} breakdown (${s.letter})`)}"></div></div>
  <div class="table-wrap"><table class="data-table fm-table"><thead><tr><th>${wfText('Column','คอลัมน์')}</th><th>${wfText('Header on the form','หัวคอลัมน์ในฟอร์ม')}</th><th></th></tr></thead><tbody>${cols.map((c,ci)=>`<tr><td><code>${esc(c[0])}</code></td><td><input data-fm-pc-header="${si}.${ci}" maxlength="50" ${can} value="${esc(c[1])}"></td><td class="fm-row-actions">${canEditFormulas()?`<button type="button" class="remove-row" data-fm-pc-up="${si}.${ci}" aria-label="Move up">↑</button><button type="button" class="remove-row" data-fm-pc-down="${si}.${ci}" aria-label="Move down">↓</button><button type="button" class="remove-row" data-fm-pc-remove="${si}.${ci}" aria-label="Remove printed column ${esc(c[0])}">×</button>`:''}</td></tr>`).join('')}</tbody></table></div>
  ${canEditFormulas()?`<div class="cost-row-tools"><select data-fm-pc-new="${si}" aria-label="Column to add">${keys.map(k=>`<option value="${esc(k)}">${esc(k==='amount'?wfText('amount (calculated)','amount (ยอดที่คำนวณ)'):k)}</option>`).join('')}</select><button type="button" class="button" data-fm-pc-add="${si}">${icon('plus')}${wfText('Add printed column','เพิ่มคอลัมน์ในใบพิมพ์')}</button><button type="button" class="button" data-fm-pc-reset="${si}">${wfText('Use all columns','ใช้ทุกคอลัมน์')}</button></div>`:''}`;
}
function fmChoiceEditor(f,si,fi){
  if(f[2]!=='choice')return '';
  return `<input class="mono fm-options" data-fm-options="${si}.${fi}" ${canEditFormulas()?'':'disabled'} value="${esc((f[3]||[]).join(', '))}" aria-label="Options of ${esc(f[0])}" placeholder="kg, g"><small>${wfText('Options, separated by commas. In a formula a choice is 0 for the first option, 1 for the second…','ตัวเลือก คั่นด้วยจุลภาค ในสูตร ตัวเลือกแรกเป็น 0 ตัวที่สองเป็น 1…')}</small>`;
}

/* ---------- form template ---------- */
function fmTemplatePanel(){
  const cfg=fmCfg(),tpl=templateOf(cfg,fmFormat),can=canEditFormulas()?'':'disabled';
  const stageSel=(path,v)=>`<select data-fp="${path}" data-ft="s" ${can}>${SIGN_STAGES.map(([k,l])=>`<option value="${k}" ${k===(v||'')?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
  const signList=(who,label)=>`<div class="fm-sign-list"><h4>${label}</h4>${tpl.sign[who].map((d,i)=>`<div class="fm-sign-row"><input data-fp="template.sign.${who}.${i}.label" data-ft="s" maxlength="40" ${can} value="${esc(d.label)}" aria-label="${esc(label)} box ${i+1}">${stageSel(`template.sign.${who}.${i}.stage`,d.stage)}${canEditFormulas()?`<button type="button" class="remove-row" data-fm-sign-remove="${who}.${i}" aria-label="Remove signature box ${esc(d.label)}">×</button>`:''}</div>`).join('')}${canEditFormulas()?`<button type="button" class="button" data-fm-sign-add="${who}">${icon('plus')}${wfText('Add signature box','เพิ่มช่องลงนาม')}</button>`:''}</div>`;
  return `<section class="panel"><div class="panel-title"><div><h2>${wfText('Form template','แม่แบบฟอร์ม')}</h2><small>${wfText('How the quotation form looks when filled and printed. Follows the customer’s document.','หน้าตาของฟอร์มตอนกรอกและพิมพ์ ตามเอกสารของลูกค้า')}</small></div></div><div class="body-pad"><div class="form-grid fm-grid">
  <div class="field"><label>${wfText('Form title','ชื่อฟอร์ม')}</label><input data-fp="template.title" data-ft="s" maxlength="80" ${can} value="${esc(tpl.title)}"></div>
  <div class="field"><label>${wfText('Form code (bottom of the form)','รหัสฟอร์ม (ท้ายฟอร์ม)')}</label><input data-fp="template.formCode" data-ft="s" maxlength="120" ${can} value="${esc(tpl.formCode)}" placeholder="APQ1.0.2 Rev.No:6"></div>
  <div class="field"><label>${wfText('Blank grid lines per section','จำนวนบรรทัดว่างต่อหมวด')}</label><input type="number" min="0" max="30" step="1" data-fp="template.blankRows" data-ft="i" ${can} value="${esc(tpl.blankRows||0)}"></div>
  <div class="field"><label>${wfText('Original column title','ชื่อคอลัมน์ต้นฉบับ')}</label><input data-fp="template.costTitle.original" data-ft="s" maxlength="60" ${can} value="${esc(tpl.costTitle.original)}"></div>
  <div class="field fm-wide"><label>${wfText('Revision column title','ชื่อคอลัมน์ฉบับแก้ไข')}</label><input data-fp="template.costTitle.revise" data-ft="s" maxlength="60" ${can} value="${esc(tpl.costTitle.revise)}"><small>${wfText('Use {ordinal} for 1st, 2nd… or {n} for the revision number (Cost Rev.10).','ใช้ {ordinal} สำหรับ 1st, 2nd… หรือ {n} สำหรับเลขฉบับ (Cost Rev.10)')}</small></div></div>
  <h3>${wfText('Header fields','ช่องหัวฟอร์ม')}</h3><div class="table-wrap"><table class="data-table fm-table"><thead><tr><th>${wfText('Show','แสดง')}</th><th>${wfText('Field','ช่อง')}</th><th>${wfText('Label on the form','ชื่อที่แสดงในฟอร์ม')}</th></tr></thead><tbody>${tpl.header.map((h,i)=>`<tr><td><input type="checkbox" data-fp="template.header.${i}.show" data-ft="b" ${can} ${h.show?'checked':''} aria-label="Show ${esc(h.key)}"></td><td><code>${esc(h.key)}</code></td><td><input data-fp="template.header.${i}.label" data-ft="s" maxlength="40" ${can} value="${esc(h.label)}"></td></tr>`).join('')}</tbody></table></div>
  <small class="muted-note">${wfText('The quantity label follows the volume period of the request (Qty/Y, Qty/M, Qty/2Y). “Quotation No.” adds a field for the Supplier’s own quotation number.','ป้ายปริมาณเปลี่ยนตามหน่วยปริมาณของคำขอ (Qty/Y, Qty/M, Qty/2Y) ช่อง “Quotation No.” เพิ่มช่องเลขที่ใบของ Supplier')}</small>
  <h3>${wfText('Notes printed under the columns','หมายเหตุใต้ตาราง')}</h3><textarea data-fm-notes rows="5" ${can} placeholder="${wfText('One note per line','บรรทัดละ 1 หมายเหตุ')}">${esc(tpl.notes.join('\n'))}</textarea>
  <h3>${wfText('Signature boxes','ช่องลงนาม')}</h3><div class="fm-sign-grid">${signList('supplier',wfText('For Supplier sign only','สำหรับซัพพลายเออร์ลงนาม'))}${signList('roki',wfText('For ROKI sign only','สำหรับ ROKI ลงนาม'))}</div>
  <small class="muted-note">${wfText('A box with a stage fills in from the approval trail; “Blank line” leaves a signature line (for example “Checked by” on the Supplier side of the Excel sheets).','ช่องที่ผูกกับขั้นตอนจะเติมจากประวัติอนุมัติเอง “Blank line” เว้นเป็นเส้นลงนาม (เช่น Checked by ฝั่ง Supplier ในชีต Excel)')}</small></div></section>`;
}
function fmFormPreview(){
  const cfg=fmCfg(),quotes=fmSampleQuotes(),ex=(selectedFormulaSet().examples||[]).filter(e=>e.format===fmFormat);
  const q=quotes.find(x=>x.id===fmSample)||quotes[0],source=ex[0]||null;
  const costs=source?costsUnder(source.costs,cfg):q?costsUnder(q.costs,cfg):null;
  if(!costs)return '<div class="empty">No quotation or example of this format to preview with yet.</div>';
  const item=q?itemOf(q):{code:'—',name:source?.name||'',rtp:'',format:fmFormat},tpl=templateOf(cfg,fmFormat);
  const meta={date:q?.quoteDate||TODAY,drawing:q?.drawing||'—',qty:q?.quantity||null,remark:q?.remark||'',effective:q?.effective||TODAY,ending:q?.ending||null,qtyPeriod:q?.qtyPeriod||null,supplierRef:q?.supplierRef||'—'};
  return `<div class="qt-form qs qt-preview"><div class="qt-letterhead"><div class="qt-title" style="margin-left:0">${esc(tpl.title)}</div></div><div class="qt-cols">${formColumn(costTitleOf(tpl,0),costs,meta,item,q||{},cfg)}</div>${tpl.notes.length?`<div class="qt-notes">${tpl.notes.map(n=>`<p>${esc(n)}</p>`).join('')}</div>`:''}<div class="qt-signs"><div><h3>Supplier</h3><div class="qt-sign-row">${tpl.sign.supplier.map(d=>`<div class="qt-sign"><small>${esc(d.label)}</small><div class="qt-signed blank-line"></div></div>`).join('')}</div></div><div><h3>ROKI</h3><div class="qt-sign-row">${tpl.sign.roki.map(d=>`<div class="qt-sign"><small>${esc(d.label)}</small><div class="qt-signed blank-line"></div></div>`).join('')}</div></div></div>${tpl.formCode?`<p class="qt-foot">${esc(tpl.formCode)}</p>`:''}</div>`;
}

/* ---------- worked examples ---------- */
function fmExamples(){return (selectedFormulaSet().examples||[]).filter(e=>e.format===fmFormat)}
function fmExampleResults(){return runFormulaExamples(fmCfg(),fmExamples())}
function fmExamplesHtml(){
  const res=fmExampleResults(),pass=res.filter(r=>r.pass).length,ok=v=>Number.isFinite(v)?cash(v):'—';
  const addable=db.quotes.filter(q=>q.format===fmFormat&&visibleQuotes().includes(q)).sort((a,b)=>b.id.localeCompare(a.id)).slice(0,60);
  return `<div class="fm-ex-summary">${res.length?statusPill(`${pass} / ${res.length} ${wfText('examples match','ตัวอย่างตรงกัน')}`,pass===res.length?'green':'red'):statusPill(wfText('No examples yet','ยังไม่มีตัวอย่าง'),'gray')}</div>
  ${res.length?`<div class="table-wrap"><table class="data-table fm-ex-table"><thead><tr><th>${wfText('Customer form','ฟอร์มลูกค้า')}</th><th class="num">${wfText('Must give','ต้องได้')}</th><th class="num">${wfText('Draft gives','ร่างนี้ได้')}</th><th>${wfText('Result','ผล')}</th></tr></thead><tbody>${res.map(r=>`<tr class="${r.pass?'':'overdue'}"><td><strong>${esc(r.ex.name)}</strong><small>${esc(r.ex.source||'')}</small>${r.pass?'':`<small class="err">${r.diffs.map(d=>`${esc(d.key)}: ${ok(d.expected)} → ${ok(d.got)}`).join(' · ')}</small>`}</td><td class="num">${ok(r.ex.expected.total)}</td><td class="num price">${ok(r.t.total)}</td><td>${statusPill(r.pass?wfText('Match','ตรง'):wfText('Differs','ไม่ตรง'),r.pass?'green':'red')}${canEditFormulas()&&!r.ex.builtin?`<button type="button" class="remove-row" data-fm-ex-del="${esc(r.ex.id)}" aria-label="Remove example ${esc(r.ex.name)}">×</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:''}
  ${canEditFormulas()?`<div class="cost-row-tools"><select id="fm-ex-quote" aria-label="Quotation to keep as an example"><option value="">${wfText('Keep a quotation as an example…','เก็บใบเสนอราคาเป็นตัวอย่าง…')}</option>${addable.map(q=>`<option value="${esc(q.id)}">${esc(q.id)} · ${esc(itemOf(q).code)} · ฿${cash(q.total)}</option>`).join('')}</select><button type="button" class="button" data-fm-ex-add>${icon('plus')}${wfText('Add example','เพิ่มตัวอย่าง')}</button></div><p class="muted-note" style="padding:0 20px 14px">${wfText('The quotation’s costs and the results it gave are kept; later formula changes must reproduce them, or say why they differ.','เก็บต้นทุนและผลของใบนั้นไว้ สูตรที่แก้ภายหลังต้องให้ผลเดิม หรือระบุเหตุผลที่ต่าง')}</p>`:''}`;
}
function fmExamplesPanel(){return `<section class="panel"><div class="panel-title"><div><h2>${wfText('Worked examples','ตัวอย่างยืนยัน')}</h2><small>${wfText('Filled forms from the customer, calculated again with this draft','ฟอร์มที่ลูกค้ากรอกแล้ว คำนวณซ้ำด้วยร่างสูตรนี้')}</small></div></div><div id="fm-examples">${fmExamplesHtml()}</div></section>`}

/* ---------- save options: effective date and examples that differ ---------- */
function fmSaveOptions(){
  const eff=document.getElementById('fm-effective')?.value||TODAY,ack=!!document.getElementById('fm-ex-ack')?.checked,failing=fmExampleResults().filter(r=>!r.pass);
  if(eff<TODAY)return {error:wfText('The effective date cannot be in the past.','วันที่มีผลต้องไม่ย้อนหลัง')};
  if(failing.length&&!ack)return {error:wfText('Some customer examples no longer match. Tick “Save although examples differ” and explain in the reason.','มีตัวอย่างลูกค้าที่ไม่ตรงแล้ว ติ๊ก “บันทึกแม้ตัวอย่างไม่ตรง” และอธิบายในเหตุผล')};
  return {effective:eff,failing:failing.length};
}
function fmSavePanelExtras(){
  const failing=fmExampleResults().filter(r=>!r.pass).length;
  return `<div class="field"><label for="fm-effective">${wfText('Effective from','มีผลตั้งแต่')}</label><input id="fm-effective" type="date" min="${TODAY}" value="${TODAY}" ${canEditFormulas()?'':'disabled'}><small>${wfText('A later date keeps the current version for new requests until then.','ถ้าเป็นวันถัดไป คำขอใหม่จะใช้เวอร์ชันเดิมจนถึงวันนั้น')}</small></div><div id="fm-ex-ack-box">${failing?`<label class="check"><input type="checkbox" id="fm-ex-ack"> ${wfText('Save although examples differ','บันทึกแม้ตัวอย่างไม่ตรง')} (${failing})</label>`:''}</div>`;
}

/* ---------- usage, retire, differences ---------- */
function fmUsage(set){
  const versions=FORMULAS.versions.filter(v=>v.setId===set.id).map(v=>v.version);
  return {
    parts:db.items.filter(i=>i.formulaSet===set.id).length,
    requests:db.notifications.filter(n=>Object.values(n.forms||{}).some(f=>versions.includes(Number(f.formulaVersion)))).length,
    quotes:db.quotes.filter(q=>versions.includes(q.costs?.fv||1)).length,
    byVersion:Object.fromEntries(versions.map(v=>[v,db.quotes.filter(q=>(q.costs?.fv||1)===v).length]))
  };
}
function fmStatusPanel(){
  const set=selectedFormulaSet(),u=fmUsage(set);
  return `<div class="fm-usage">${statusPill(set.retired?wfText('Retired','เลิกใช้แล้ว'):wfText('Active','ใช้งานอยู่'),set.retired?'gray':'green')}<span>${u.parts} ${wfText('parts use this set by default','ชิ้นส่วนใช้ชุดนี้เป็นค่าเริ่มต้น')}</span><span>${u.requests} ${wfText('requests','คำขอ')}</span><span>${u.quotes} ${wfText('quotations','ใบเสนอราคา')}</span>${canEditFormulas()?`<button type="button" class="button" data-fm-retire>${set.retired?wfText('Use this set again','กลับมาใช้ชุดนี้'):wfText('Retire this set','เลิกใช้ชุดนี้')}</button>`:''}</div>${set.retired?`<p class="muted-note">${wfText('A retired set is hidden from new requests and the part master. Existing requests and quotations keep working.','ชุดที่เลิกใช้จะไม่แสดงในคำขอใหม่และข้อมูลชิ้นส่วน คำขอและใบเสนอราคาเดิมยังใช้งานได้')}</p>`:''}`;
}
const dv=v=>v===undefined||v===null||v===''?'—':String(v);
function versionDiffLines(prev,cur,format){
  const out=[];if(!prev)return out;
  const a=prev.formats[format],b=cur.formats[format];if(!a||!b)return out;
  for(const s of b.sections){
    const o=a.sections.find(x=>x.key===s.key),w=`${s.letter} · ${s.label}`;
    if(!o){out.push(`${w}: ${wfText('section added','เพิ่มหมวด')}`);continue}
    if(o.label!==s.label)out.push(`${w}: ${wfText('label','ชื่อ')} “${dv(o.label)}” → “${dv(s.label)}”`);
    if(o.expr!==s.expr)out.push(`${w}: ${wfText('formula','สูตร')} ${dv(o.expr)} → ${dv(s.expr)}`);
    const ok=o.fields.map(f=>f[0]),nk=s.fields.map(f=>f[0]);
    for(const k of nk.filter(k=>!ok.includes(k)))out.push(`${w}: ${wfText('column added','เพิ่มคอลัมน์')} ${k}`);
    for(const k of ok.filter(k=>!nk.includes(k)))out.push(`${w}: ${wfText('column removed','ลบคอลัมน์')} ${k}`);
    for(const f of s.fields){const g=o.fields.find(x=>x[0]===f[0]);if(g&&JSON.stringify(g)!==JSON.stringify(f))out.push(`${w}: ${wfText('column changed','แก้คอลัมน์')} ${f[0]}`)}
    for(const x of s.adj||[]){const y=(o.adj||[]).find(z=>z.key===x.key);if(!y)out.push(`${w}: ${wfText('adjustment added','เพิ่มรายการปรับ')} ${x.label}`);else if(JSON.stringify(y)!==JSON.stringify(x))out.push(`${w}: ${x.label} ${y.percent}% → ${x.percent}%${y.lock!==x.lock?` (${x.lock?wfText('locked','ล็อก'):wfText('unlocked','ปลดล็อก')})`:''}`)}
    if(JSON.stringify(o.printCols||null)!==JSON.stringify(s.printCols||null)||(o.title||'')!==(s.title||''))out.push(`${w}: ${wfText('printed layout changed','แก้รูปแบบในใบพิมพ์')}`);
  }
  for(const k of ['profit','spare','rounding'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))out.push(`${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`);
  if(a.total!==b.total)out.push(`${wfText('total formula','สูตรยอดรวม')}: ${a.total} → ${b.total}`);
  if(JSON.stringify(a.template||null)!==JSON.stringify(b.template||null))out.push(wfText('form template changed','แก้แม่แบบฟอร์ม'));
  return out;
}
function fmVersionDetails(v){
  const set=FORMULAS.sets.find(s=>s.id===v.setId),vs=FORMULAS.versions.filter(x=>x.setId===v.setId).sort((a,b)=>a.version-b.version),prev=vs[vs.findIndex(x=>x.version===v.version)-1];
  const lines=set?set.formats.flatMap(f=>versionDiffLines(prev,v,f).map(l=>`${f} · ${l}`)):[];
  return lines.length?`<details class="fm-diff"><summary>${lines.length} ${wfText('differences from the previous version','ความต่างจากเวอร์ชันก่อน')}</summary><ul>${lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul></details>`:'';
}

/* ---------- events ---------- */
function fmMaterializeTemplate(){const cfg=fmCfg();if(!cfg.template)cfg.template=templateOf(cfg,fmFormat);return cfg.template}
function fmMaterializePrint(si){const s=fmCfg().sections[si];if(!s.printCols)s.printCols=sectionPrintCols(s).map(c=>[...c]);return s}
function fmReadableRefresh(){fmCfg().sections.forEach((s,si)=>{const el=document.querySelector(`[data-fm-readable="${si}"]`);if(el)el.textContent=readableFormula(s)})}
document.addEventListener('click',e=>{
  if(portal!=='roki')return;
  const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  const mine=['fmInsert','fmPcUp','fmPcDown','fmPcRemove','fmPcAdd','fmPcReset','fmSignAdd','fmSignRemove','fmAddChoice','fmExAdd','fmExDel','fmRetire'].some(k=>k in d);
  if(!mine)return;
  e.stopPropagation();
  if(!canEditFormulas())return toast(wfText('Only WEBPARK Issue and Approve accounts can change formulas.','เฉพาะบัญชี WEBPARK Issue และ Approve เท่านั้นที่แก้สูตรได้'));
  if('fmInsert' in d){
    const [si,key]=d.fmInsert.split('|'),input=document.querySelector(`[data-fp="sections.${si}.expr"]`);if(!input)return;
    const at=input.selectionStart??input.value.length,end=input.selectionEnd??at;input.value=input.value.slice(0,at)+key+input.value.slice(end);input.focus();input.setSelectionRange(at+key.length,at+key.length);input.dispatchEvent(new Event('input',{bubbles:true}));return;
  }
  if('fmPcUp' in d||'fmPcDown' in d||'fmPcRemove' in d){
    const [si,ci]=(d.fmPcUp??d.fmPcDown??d.fmPcRemove).split('.').map(Number),s=fmMaterializePrint(si);
    if('fmPcRemove' in d){if(s.printCols.length>1)s.printCols.splice(ci,1)}
    else{const to=ci+('fmPcUp' in d?-1:1);if(to>=0&&to<s.printCols.length)[s.printCols[ci],s.printCols[to]]=[s.printCols[to],s.printCols[ci]]}
    return fmRender();
  }
  if('fmPcAdd' in d){const si=+d.fmPcAdd,key=document.querySelector(`[data-fm-pc-new="${si}"]`).value,s=fmMaterializePrint(si),f=s.fields.find(x=>x[0]===key);s.printCols.push([key,key==='amount'?'Amount':fieldLabel(f)]);return fmRender()}
  if('fmPcReset' in d){delete fmCfg().sections[+d.fmPcReset].printCols;return fmRender()}
  if('fmSignAdd' in d){const t=fmMaterializeTemplate();t.sign[d.fmSignAdd].push({label:wfText('Checked by','ตรวจสอบโดย'),stage:''});return fmRender()}
  if('fmSignRemove' in d){const [who,i]=d.fmSignRemove.split('.'),t=fmMaterializeTemplate();if(t.sign[who].length>1)t.sign[who].splice(+i,1);return fmRender()}
  if('fmAddChoice' in d){const s=fmCfg().sections[+d.fmAddChoice];s.fields.push(CH(nextKey(fmCfg(),'choice'),'New choice',['Option 1','Option 2'],'Option 1'));return fmRender()}
  if('fmExAdd' in d){
    const q=db.quotes.find(x=>x.id===document.getElementById('fm-ex-quote')?.value);if(!q)return toast(wfText('Choose a quotation first.','เลือกใบเสนอราคาก่อน'));
    const set=selectedFormulaSet();
    if(!rfqCommit(()=>{(set.examples=set.examples||[]).push(exampleFromQuote(q,`${q.id} · ${itemOf(q).code}`));db.audit.unshift({action:'Kept '+q.id+' as an example of '+set.name,user:user.name,at:timestamp()})}))return;
    return fmRender();
  }
  if('fmExDel' in d){const set=selectedFormulaSet();if(!rfqCommit(()=>{set.examples=(set.examples||[]).filter(x=>x.id!==d.fmExDel||x.builtin)}))return;return fmRender()}
  if('fmRetire' in d){const set=selectedFormulaSet();if(!rfqCommit(()=>{set.retired=!set.retired;db.audit.unshift({action:(set.retired?'Retired':'Reactivated')+' formula set '+set.name,user:user.name,at:timestamp()})}))return;return fmRender()}
},true);
document.addEventListener('input',e=>{
  if(portal!=='roki'||!fmDraft||!canEditFormulas())return;
  const el=e.target;
  if(el.dataset&&el.dataset.fmPcHeader!==undefined){const [si,ci]=el.dataset.fmPcHeader.split('.').map(Number),s=fmMaterializePrint(si);s.printCols[ci][1]=el.value;fmRefresh();return}
  if(el.dataset&&el.dataset.fmNotes!==undefined){fmMaterializeTemplate().notes=el.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);fmRefresh();return}
  if(el.dataset&&el.dataset.fmOptions!==undefined){
    const [si,fi]=el.dataset.fmOptions.split('.').map(Number),f=fmCfg().sections[si].fields[fi],opts=el.value.split(',').map(x=>x.trim()).filter(Boolean);
    if(opts.length){f[3]=opts;f[4]=f[4]||{};if(!opts.includes(f[4].def))f[4].def=opts[0]}
    fmReadableRefresh();fmRefresh();return;
  }
  if(el.dataset&&el.dataset.fp&&/\.expr$/.test(el.dataset.fp))setTimeout(fmReadableRefresh,0);
},true);
