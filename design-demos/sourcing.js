'use strict';
/* Direct sourcing: Issue dispatches a version-bound blank form; Supplier submits to Check. */
let reviewCadence='',reviewScope='due',fmSetId='standard';
function ensureFormulaSets(s){
 if(!s.sets){s.sets=[{id:'standard',name:'สูตรมาตรฐานชิ้นส่วน',formats:['Single Part','Assembly'],current:s.current}];for(const v of s.versions)v.setId='standard';
  const base=structuredClone(s.versions.find(v=>v.version===s.current)||s.versions[0]),version=Math.max(...s.versions.map(v=>v.version))+1;
  base.version=version;base.setId='assembly';base.reason='Separate assembly pricing model';base.formats.Assembly.profit.percent=8;base.by='WEBPARK';
  s.versions.push(base);s.sets.push({id:'assembly',name:'สูตรชุดประกอบ',formats:['Assembly'],current:version});
 }return s;
}
function formulaSetOf(v){return FORMULAS.sets.find(s=>s.id===v?.setId)||FORMULAS.sets[0]}
function formulaLabel(version){const v=FORMULAS.versions.find(v=>v.version===Number(version));return v?`${formulaSetOf(v).name} · v${v.version}`:wfText('Formula unavailable','ไม่พบสูตร')}
function selectedFormulaSet(){return FORMULAS.sets.find(s=>s.id===fmSetId)||FORMULAS.sets[0]}
function selectedFormulaVersion(){return FORMULAS.versions.find(v=>v.version===selectedFormulaSet().current)}
function formulaChoices(format,selected){return FORMULAS.sets.filter(s=>s.formats.includes(format)&&!s.retired).map(s=>`<optgroup label="${esc(s.name)}">${FORMULAS.versions.filter(v=>v.setId===s.id&&v.effective<=TODAY).slice().reverse().map(v=>`<option value="${v.version}" ${v.version===Number(selected)?'selected':''}>${esc(s.name)} · v${v.version}${v.version===s.current?wfText(' (latest)',' (ล่าสุด)'):''}</option>`).join('')}</optgroup>`).join('')}
function suggestedFormula(i,r){
 const prior=deskLatestNotice(i.id,n=>!!n.forms?.[i.id])?.forms[i.id];
 /* the part master's formula set comes first, so each part uses the sheet it belongs to (Injection, Rubber, Steel, QT-ASSY…) */
 return r?.specs?.[i.id]?.formulaVersion||formulaSetCurrent(i)||prior?.formulaVersion||activeQuote(i.id)?.costs.fv||'';
}
function prepareSourcingData(){
 db.formulas=promoteDueFormulaVersions(ensureFormulaExamples(ensureCustomerSets(ensureFormulaSets(db.formulas))));setFormulaStore(db.formulas);
 if(db.sourcingFlowVersion!==2){
  for(const r of db.priceRequests||[]){
   if(r.deliveryStatus!=='Sent'&&!['Rejected','Cancelled'].includes(r.status)){
    r.legacyApprovalStatus=r.approvalStatus||r.status;r.status='Draft';r.approvalStatus='NotRequired';r.flowVersion=2;
    r.trail.push({action:'workflow-update',user:'System',role:'System',at:timestamp(),reason:'Direct sourcing workflow: the creator can review the form and send directly to Supplier.'});
   }
  }
  for(const q of db.quotes)if(!['Approved','Rejected'].includes(q.status)){
   q.flowVersion=2;
  }
  for(const [index,cadence]of [1,3,0].entries()){
   const source=db.items.find(i=>cadence===1?i.format==='Assembly':i.format==='Single Part'),base=db.quotes.find(q=>q.item===source.id&&q.status==='Approved');
   if(!base)continue;const id='i'+(Math.max(...db.items.map(i=>Number(i.id.slice(1))||0))+1),item={...structuredClone(source),id,code:'WP-REVIEW-'+(cadence||'NEW')+'-001',name:cadence===1?'CASE ASSY — monthly review':cadence===3?'AIR COVER — quarterly review':'BRACKET — first quotation',children:[],qty:12000,next:TODAY,cadence:cadence||3,demoScenario:'direct-'+(cadence||'new')};
   delete item.price;delete item.last;db.items.push(item);
   if(cadence){const q={...structuredClone(base),id:'Q-DIRECT-BASE-'+index,item:id,supplier:item.supplier,itemSnapshot:partIdentity(item),requestedBy:null,baseline:null,versions:[],demoScenario:item.demoScenario};db.quotes.push(q);db.history.push({item:id,quote:q.id,effective:q.effective,price:q.total,reason:'Approved reference for review scenario'});item.price=q.total}
  }
  db.sourcingFlowVersion=2;
 }
}
function validateDraftCosts(c){for(const s of sectionsOf(c))for(const row of c[s.key]||[])for(const f of s.fields)if(f[2]==='number'&&row[f[0]]!=null&&(!Number.isFinite(row[f[0]])||row[f[0]]<0))return wfText('Costs must be valid non-negative numbers.','ต้นทุนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');return ''}
function requestFormRows(items,r){
 return `<div class="request-form-guide"><strong>${wfText('Set the form; Supplier enters the costs','กำหนดแบบฟอร์ม · Supplier เป็นผู้กรอกต้นทุน')}</strong><p>${wfText('Each part can use its own formula and version. No WEBPARK approval is required before sending. Existing prices remain reference only.','แต่ละรายการเลือกสูตรและเวอร์ชันต่างกันได้ ส่งตรงโดยไม่ต้องอนุมัติภายในก่อน ราคาเดิมใช้เพื่ออ้างอิงเท่านั้น')}</p></div><div class="request-specs">${items.map(i=>{const spec=r?.specs?.[i.id],ref=activeQuote(i.id);return `<section class="request-spec" data-spec-item="${i.id}"><h3>${esc(i.code)} · ${esc(i.name)}</h3><p>${esc(supplierName(i.supplier))} · ${esc(quotationFormLabel(i.format))}</p><div class="form-grid"><div class="field"><label>${wfText('Review interval *','รอบทบทวน *')}</label><select data-request-cadence="${i.id}">${[1,3,6,12].map(m=>`<option value="${m}" ${(i.cadence||3)===m?'selected':''}>${m===1?wfText('Every month','ทุกเดือน'):wfText('Every '+m+' months','ทุก '+m+' เดือน')}</option>`).join('')}</select><small>${wfText('The system sends the review request automatically each time this interval ends.','ระบบส่งคำขอทบทวนให้ Supplier อัตโนมัติทุกครั้งเมื่อครบรอบนี้')}</small></div>${(()=>{const fixed=i.formulaSet&&formulaSetCurrent(i);const cur=suggestedFormula(i,r);
 if(fixed)return `<div class="field fm-wide"><label>${wfText('Formula and version','สูตรและเวอร์ชัน')}</label><select data-request-formula="${i.id}" disabled><option value="${cur}" selected>${esc(formulaLabel(cur))}</option></select><small>${wfText('Set when the part was added to the part master; the latest version is used. Change it in Parts & assemblies.','กำหนดไว้ตั้งแต่เพิ่มชิ้นส่วนเข้าระบบ ใช้เวอร์ชันล่าสุดอัตโนมัติ แก้ไขได้ที่หน้าชิ้นส่วนและชุดประกอบ')}</small></div>`;
 return `<div class="field fm-wide"><label>${wfText('Formula and version *','สูตรและเวอร์ชัน *')}</label><select data-request-formula="${i.id}"><option value="">${wfText('Choose a formula','เลือกสูตร')}</option>${formulaChoices(i.format,cur)}</select><small>${wfText('This part has no formula set yet. Your choice is saved to the part master so it is not asked again.','ชิ้นส่วนนี้ยังไม่มีชุดสูตรในข้อมูลหลัก ที่เลือกไว้จะถูกบันทึกลงข้อมูลชิ้นส่วน ไม่ต้องเลือกซ้ำ')}</small></div>`})()}<div class="field"><label>${wfText('Production volume *','จำนวนผลิตอ้างอิง *')}</label><input type="number" min="1" step="1" data-request-qty="${i.id}" value="${esc(spec?.quantity||i.qty||1)}"></div><div class="field"><label>${wfText('Drawing revision *','แบบ / Revision *')}</label><input data-request-drawing="${i.id}" maxlength="100" value="${esc(spec?.drawing||i.drawing||'A01')}"></div><div class="field"><label>${wfText('Requested effective date *','วันที่ต้องการเริ่มใช้ราคา *')}</label><input type="date" data-request-effective="${i.id}" min="${TODAY}" value="${esc(spec?.effective>=TODAY?spec.effective:addMonths(TODAY,1))}"></div>${requestExtraFields(i,spec)}<div class="field"><label>${wfText('Approved reference','ราคาปัจจุบันที่อนุมัติแล้ว')}</label><p>${ref?cash(ref.total)+' THB':wfText('First quotation','เสนอราคาครั้งแรก')}</p>${approvedReferenceButton(i.id)}</div></div>${requestSupplyTable(i,spec)}</section>`}).join('')}</div>`;
}
function readRequestSpecs(items){
 const out={};for(const id of items){const i=db.items.find(i=>i.id===id),version=Number(document.querySelector(`[data-request-formula="${id}"]`)?.value),v=FORMULAS.versions.find(v=>v.version===version),quantity=Number(document.querySelector(`[data-request-qty="${id}"]`)?.value),drawing=document.querySelector(`[data-request-drawing="${id}"]`)?.value.trim(),effective=document.querySelector(`[data-request-effective="${id}"]`)?.value;
  if(!v||!formulaSetOf(v).formats.includes(i.format)||!Number.isInteger(quantity)||quantity<=0||!drawing||!effective||effective<TODAY){toast(wfText('Select a valid formula, positive volume, drawing revision and effective date for every part.','ระบุสูตร จำนวนผลิตมากกว่า 0 แบบ/Revision และวันที่เริ่มใช้ราคาให้ครบทุกชิ้นส่วน'));return null}
  if(!i.formulaSet)i.formulaSet=formulaSetOf(v).id;   /* kept on the part master, never asked again */
  const extra=readRequestExtras(i);if(extra.error){toast(extra.error);return null}
  const cadence=Number(document.querySelector(`[data-request-cadence="${id}"]`)?.value)||i.cadence||3;i.cadence=cadence;
  out[id]={formulaVersion:version,quantity,drawing,effective,reviewDueDate:i.next||null,cadence,requestedOn:TODAY,...extra};
 }return out;
}
function blankRequestCosts(i,spec){
 const cfg=formulaVersion(spec.formulaVersion).formats[i.format],baseline=activeQuote(i.id)?.costs;
 const c={format:i.format,fv:spec.formulaVersion,profit:cfg.profit.percent,basis:cfg.profit.base,spare:cfg.spare.percent};
 for(const s of cfg.sections){
  const rows=baseline&&Array.isArray(baseline[s.key])?baseline[s.key]:(s.letter==='A'||s.key==='process'?[blankRow(s)]:[]);
  c[s.key]=rows.map(old=>Object.fromEntries(s.fields.map(f=>{
   const key=f[0],flags=f[4]||{};
   /* amounts the Supplier must enter stay blank; quantities, weights and the formula's own parameters (loss %, maintenance %, units per piece…) are pre-set */
   if(f[2]==='number')return [key,/qty|weight|scrap|runner|cavity|time|volume/i.test(key)||flags.def!==undefined?(old[key]??flags.def??(isPositive(f)?1:0)):null];
   if(f[2]==='origin'||f[2]==='choice')return [key,old[key]??(flags.def!==undefined?flags.def:f[3][0])];
   return [key,old[key]??''];
  })));
  for(const a of s.adj||[]){c[a.key]=a.percent;if(a.ofKey)c[a.ofKey]=a.of}
 }
 if(typeof syncComponents==='function')syncComponents(c,i);   /* one row per BOM component, sub-part prices linked */
 return c;
}
function requestSpecTable(r){return `<div class="table-wrap"><table class="data-table"><thead><tr><th>${wfText('Part / Supplier','ชิ้นส่วน / Supplier')}</th><th>${wfText('Form and formula','แบบฟอร์มและสูตร')}</th><th>${wfText('Quotations','ใบเสนอราคา')}</th></tr></thead><tbody>${r.items.map(id=>{const i=db.items.find(i=>i.id===id),spec=r.specs?.[id],n=db.notifications.find(n=>n.priceRequestId===r.id&&n.items.includes(id));return `<tr ${detailRowAttrs('process/'+id+'/'+r.id)}><td>${detailRecordLink('part/'+id,i?.code||id)}<small>${esc(i?.name)} · ${esc(supplierName(i?.supplier))}</small>${wfLink('process/'+id+'/'+r.id,'Track workflow','ติดตามขั้นตอน')}</td><td>${spec?`<strong>${esc(formulaLabel(spec.formulaVersion))}</strong><small>${spec.quantity.toLocaleString()} pcs · ${esc(spec.drawing)}</small><small>${wfText('Effective','เริ่มใช้')}: ${date(spec.effective)}</small>`:wfText('Earlier request — see linked quotation formula','คำขอเดิม · ดูสูตรจากใบเสนอราคาที่เชื่อมโยง')}${n?.forms?.[id]?`<a class="button" data-blank-form="${n.id}" href="#print/preview~${n.id}~${id}">${wfText('View requested form','ดูแบบฟอร์มที่ส่ง')}</a>`:''}</td><td>${quotationAccessLinks(id,{request:r,notice:n,compact:true})}</td></tr>`}).join('')}</tbody></table></div>`}
function receivedFormPanel(n,ids=n.items){return detailPanel(wfText('Requested forms and fixed formula versions','แบบฟอร์มที่ได้รับและเวอร์ชันสูตรที่ใช้'),ids.map(id=>{const f=n.forms?.[id],i=db.items.find(i=>i.id===id);return f?`<div class="audit-entry"><strong>${esc(i.code)} · ${esc(formulaLabel(f.formulaVersion))}</strong><small>${f.quantity.toLocaleString()} pcs · ${esc(f.drawing)} · ${date(f.effective)}</small><a class="button" data-blank-form="${n.id}" href="#print/preview~${n.id}~${id}">${wfText('View blank cost form','ดูแบบฟอร์มต้นทุนที่ยังไม่กรอกราคา')}</a></div>`:''}).join('')||`<p>${wfText('Earlier request: its quotation retains its original formula version.','คำขอจากโฟลเดิม ใบเสนอราคายังคงใช้สูตรเดิมที่บันทึกไว้')}</p>`)}
function formulaSetDialog(rename=false){if(!canEditFormulas())return;dialog(wfText('Formula set','ชุดสูตรคำนวณ'),`<div class="field"><label>${wfText('Name *','ชื่อชุดสูตร *')}</label><input id="formula-name" maxlength="120" value="${rename?esc(selectedFormulaSet().name):''}"></div>${rename?'':`<div class="field"><label>${wfText('Use for','ใช้กับ')}</label><input id="formula-scope" type="hidden" value="${fmFormat}"><p><strong>${esc(quotationFormLabel(fmFormat))}</strong></p></div><div class="field"><label>${wfText('Start from','เริ่มจาก')}</label><select id="formula-start-from">${FORMULAS.sets.filter(x=>x.formats.includes(fmFormat)&&!x.retired).map(x=>`<option value="${x.id}" ${x.id===selectedFormulaSet().id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><p>${wfText('Starts as a copy of the chosen formula (including its form template and worked examples). Edit columns, expressions, percentages, rounding and the printed form independently.','เริ่มจากสำเนาสูตรที่เลือก (รวมแม่แบบฟอร์มและตัวอย่างยืนยัน) แล้วแก้คอลัมน์ นิพจน์ เปอร์เซ็นต์ การปัดเศษ และใบพิมพ์ได้แยกกัน')}</p>`}`,`<button class="button primary" data-save-formula-set="${rename?'rename':'new'}">${wfText('Save','บันทึก')}</button>`)}
document.addEventListener('change',e=>{if(e.target.id==='formula-set'){if(fmDraft&&fmDirty()){e.target.value=fmSetId;return toast(wfText('Save or discard your changes first.','บันทึกหรือยกเลิกการแก้ไขก่อนเปลี่ยนชุดสูตร'))}fmSetId=e.target.value;formulaCategorySelections.set(fmFormat,fmSetId);fmDraft=null;if(!selectedFormulaSet().formats.includes(fmFormat))fmFormat=selectedFormulaSet().formats[0];fmSample='';render()}if(e.target.id==='review-cadence'){reviewCadence=e.target.value;render()}if(e.target.id==='review-scope'){reviewScope=e.target.value;render()}});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-create-formula'))return formulaSetDialog();if(b.hasAttribute('data-rename-formula'))return formulaSetDialog(true);
 if(b.dataset.saveFormulaSet&&canEditFormulas()){
  const name=document.getElementById('formula-name').value.trim();if(!name)return toast(wfText('Enter a name.','กรอกชื่อชุดสูตร'));
  if(FORMULAS.sets.some(s=>s.name.toLowerCase()===name.toLowerCase()&&(b.dataset.saveFormulaSet!=='rename'||s.id!==selectedFormulaSet().id)))return toast(wfText('Use a unique formula name.','ชื่อนี้มีแล้ว กรุณาใช้ชื่ออื่น'));
  if(!rfqCommit(()=>{if(b.dataset.saveFormulaSet==='rename')selectedFormulaSet().name=name;else{const version=Math.max(...FORMULAS.versions.map(v=>v.version))+1,id=uid('formula'),scope=document.getElementById('formula-scope').value;const from=FORMULAS.sets.find(x=>x.id===document.getElementById('formula-start-from')?.value&&x.formats.includes(scope))||selectedFormulaSet(),fromVersion=FORMULAS.versions.find(v=>v.version===from.current);FORMULAS.versions.push({...structuredClone(fromVersion),version,setId:id,by:user.name,at:timestamp(),effective:TODAY,reason:'New formula set: '+name+' (from '+from.name+')',changes:[]});FORMULAS.sets.push({id,name,formats:scope==='both'?['Single Part','Assembly']:[scope],current:version,examples:structuredClone(from.examples||[])});fmSetId=id}}))return;
  fmDraft=null;fmFormat=selectedFormulaSet().formats[0];closeDialog();render();return;
 }
 if(b.dataset.removeFormulaSection!==undefined&&canEditFormulas()){
  const cfg=fmCfg();if(cfg.sections.length<=1)return;const removed=cfg.sections.splice(Number(b.dataset.removeFormulaSection),1)[0];
  cfg.profit.bases=cfg.profit.bases.filter(k=>k!==removed.key);if(!cfg.profit.bases.length)cfg.profit.bases=['subtotal'];if(cfg.profit.base===removed.key)cfg.profit.base=cfg.profit.bases[0];if(cfg.spare.base===removed.key)cfg.spare.base=cfg.sections[0].key;
  for(const s of cfg.sections)for(const a of s.adj||[])if(a.of===removed.key)a.of='self';fmRender();return;
 }
 if(b.dataset.moveFormulaSection!==undefined&&canEditFormulas()){
  const cfg=fmCfg(),i=Number(b.dataset.moveFormulaSection),next=i+Number(b.dataset.direction);if(next>=0&&next<cfg.sections.length){[cfg.sections[i],cfg.sections[next]]=[cfg.sections[next],cfg.sections[i]];fmRender()}return;
 }
 if(b.hasAttribute('data-add-formula-section')&&canEditFormulas()){
  fmInit();const cfg=fmCfg(),letter='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(k=>!cfg.sections.some(s=>s.letter===k)),key='section'+(Math.max(0,...cfg.sections.map(s=>Number(s.key.replace('section',''))||0))+1);if(!letter)return;
  cfg.sections.push({key,letter,label:'Additional cost',expr:'rate*qty',fields:[fld('name','Description','text',null,{req:true}),fld('rate','Unit cost','number'),fld('qty','Quantity','number',null,{positive:true,def:1})],adj:[]});fmRender();return;
 }
 if(b.dataset.blankForm){const n=db.notifications.find(n=>n.id===b.dataset.blankForm&&(portal==='roki'||n.supplier===user.supplier)),i=db.items.find(i=>i.id===b.dataset.blankItem),f=n?.forms?.[i?.id];if(!f)return;
  dialog(wfText('Blank quotation form','แบบฟอร์มใบเสนอราคาที่ยังไม่กรอก'),`<h3>${esc(i.code)} · ${esc(i.name)}</h3><p>${esc(formulaLabel(f.formulaVersion))} · ${f.quantity.toLocaleString()} pcs · ${esc(f.drawing)}</p><p>${wfText('Supplier fills the costs; the selected formulas calculate the purchase price.','Supplier กรอกต้นทุน แล้วระบบใช้สูตรที่ระบุคำนวณราคาซื้อ')}</p>${sectionsOf(f.costs).map(s=>`<section class="panel body-pad"><h3>${esc(s.letter)} · ${esc(s.label)}</h3><code>${esc(s.expr)}</code><div class="table-wrap"><table class="data-table"><thead><tr>${s.fields.map(field=>'<th>'+esc(field[1])+'</th>').join('')}</tr></thead><tbody>${f.costs[s.key].map(row=>'<tr>'+s.fields.map(field=>'<td>'+(row[field[0]]==null||row[field[0]]===''?'<span class="muted-note">'+wfText('To be entered','รอกรอก')+'</span>':esc(row[field[0]]))+'</td>').join('')+'</tr>').join('')}</tbody></table></div><strong>${wfText('Awaiting Supplier input','รอ Supplier กรอกต้นทุน')}</strong></section>`).join('')}`,'');
 }
});
