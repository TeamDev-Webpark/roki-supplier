'use strict';
/* "Calculation formulas" page (ROKI): edit how each quotation format is calculated.
   Works on a draft copy of the current formula set; Save creates a new version (with a reason) and never changes
   quotations already issued — they keep the version in costs.fv. See quote-model.js for the formula data and engine. */

let fmFormat='Single Part',fmDraft=null,fmSample='';
const canEditFormulas=()=>portal==='roki'&&user&&['Issue','Approve'].includes(user.role);
const fmBase=()=>selectedFormulaVersion().formats;
const fmCfg=()=>fmDraft[fmFormat];
const fmDirty=()=>JSON.stringify(fmDraft)!==JSON.stringify(fmBase());
function fmInit(){if(!fmDraft)fmDraft=structuredClone(fmBase())}
function fmReset(){fmDraft=null;fmInit()}

/* path helpers: "sections.0.fields.2.4.def" inside the format being edited */
function fmGet(path){return path.split('.').reduce((o,k)=>o?.[k],fmCfg())}
function fmSet(path,value){
  const keys=path.split('.'),last=keys.pop();
  let o=fmCfg();for(const k of keys){if(o[k]===undefined||o[k]===null)o[k]=/^\d+$/.test(k)?{}:{};o=o[k]}
  o[last]=value;
}
const fmInput=(path,type,attrs='')=>{const v=fmGet(path);return `data-fp="${path}" data-ft="${type}" ${canEditFormulas()?'':'disabled'} ${attrs}`+(type==='b'?(v?' checked':''):` value="${esc(v??'')}"`)};
const fmSelect=(path,type,options)=>`<select data-fp="${path}" data-ft="${type}" ${canEditFormulas()?'':'disabled'}>${options.map(([v,l])=>`<option value="${esc(v)}" ${String(fmGet(path))===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
const MODES=[['none','No rounding (keep full precision)'],['round','Round to nearest'],['truncate','Cut off extra decimals'],['ceil','Round up']];

function fmSectionCard(s,si){
  const numeric=s.fields.filter(f=>f[2]==='number'||f[2]==='choice'||f[2]==='origin').map(f=>f[0]),secs=fmCfg().sections;
  const rowChoices=s.fields.filter(f=>f[2]==='choice'&&(f[3]||[]).length===2);
  const rule=f=>f[4]&&f[4].positive?'positive':f[4]&&f[4].req?'required':'none';
  return `<section class="panel fm-section"><div class="panel-title"><div><h2>${esc(s.letter)} · ${esc(s.label)}</h2><small>Columns usable in the formula (a choice counts as 0, 1, 2…): ${numeric.map(k=>`<code>${esc(k)}</code>`).join(' ')||'—'}</small></div></div><div class="body-pad">
  <div class="form-grid fm-grid"><div class="field"><label>Section label</label><input ${fmInput(`sections.${si}.label`,'s','maxlength="40"')}></div>
  <div class="field fm-wide"><label>Row formula</label><input class="mono" ${fmInput(`sections.${si}.expr`,'s','maxlength="200" spellcheck="false"')}><small>Amount of one row from its number columns. Use + - * / ^ ( ) and min, max, round, abs, sqrt, if(condition, a, b).</small></div></div>
  <div class="workflow-tabs">${canEditFormulas()?`<button class="button" data-remove-formula-section="${si}">${wfText("Remove category","ลบหมวดต้นทุน")}</button><button class="button" data-move-formula-section="${si}" data-direction="-1">↑</button><button class="button" data-move-formula-section="${si}" data-direction="1">↓</button>`:''}</div><h3>Columns</h3><div class="table-wrap"><table class="data-table fm-table"><thead><tr><th>Key</th><th>Label</th><th>Type</th><th>Rule</th><th>Default</th><th></th></tr></thead><tbody>${s.fields.map((f,fi)=>`<tr><td><input class="mono" ${fmInput(`sections.${si}.fields.${fi}.0`,'s','maxlength="30" spellcheck="false"')}></td><td><input ${fmInput(`sections.${si}.fields.${fi}.1`,'s','maxlength="60"')}></td><td>${f[2]==='origin'||f[2]==='choice'?'<span class="badge gray">Choice</span>':fmSelect(`sections.${si}.fields.${fi}.2`,'s',[['text','Text'],['number','Number']])}</td><td>${f[2]==='number'?`<select data-fr="sections.${si}.fields.${fi}" ${canEditFormulas()?'':'disabled'}>${[['none','Optional'],['required','Required'],['positive','Above zero']].map(([v,l])=>`<option value="${v}" ${rule(f)===v?'selected':''}>${l}</option>`).join('')}</select>`:`<select data-fr="sections.${si}.fields.${fi}" ${canEditFormulas()?'':'disabled'}>${[['none','Optional'],['required','Required']].map(([v,l])=>`<option value="${v}" ${rule(f)===v?'selected':''}>${l}</option>`).join('')}</select>`}</td><td>${f[2]==='number'?`<input type="number" step="any" min="0" class="narrow-input" data-fp="sections.${si}.fields.${fi}.4.def" data-ft="n" ${canEditFormulas()?'':'disabled'} value="${esc((f[4]&&f[4].def)||0)}">`:'—'}</td><td>${canEditFormulas()?`<button type="button" class="remove-row" data-fm-remove-field="${si}.${fi}" aria-label="Remove column ${esc(f[0])}">×</button>`:''}</td></tr>`).join('')}</tbody></table></div>
  ${canEditFormulas()?`<div class="cost-row-tools"><button type="button" class="button" data-fm-add-field="${si}">${icon('plus')}Add column</button></div>`:''}
  <h3>Percentage adjustments</h3>${(s.adj||[]).length?`<div class="table-wrap"><table class="data-table fm-table"><thead><tr><th>Label</th><th class="num">Default %</th><th>Applies to</th><th>Suppliers can change</th><th></th></tr></thead><tbody>${s.adj.map((a,ai)=>`<tr><td><input ${fmInput(`sections.${si}.adj.${ai}.label`,'s','maxlength="40"')}></td><td class="num"><input type="number" min="0" max="100" step="any" class="narrow-input" ${fmInput(`sections.${si}.adj.${ai}.percent`,'n')}></td><td>${a.choices?'<span class="badge gray">Chosen by supplier</span>':fmSelect(`sections.${si}.adj.${ai}.of`,'s',[['self','This section'],...rowChoices.map(f=>[`rows:${f[0]}`,`Lines marked “${f[1]}”: ${f[3][1]}`]),...secs.filter(x=>x.key!==s.key).map(x=>[x.key,`${x.label} (${x.letter})`])])}</td><td><label class="check"><input type="checkbox" data-fp="sections.${si}.adj.${ai}.lock" data-ft="nb" ${canEditFormulas()?'':'disabled'} ${a.lock?'':'checked'}> Yes</label></td><td>${canEditFormulas()&&!a.choices?`<button type="button" class="remove-row" data-fm-remove-adj="${si}.${ai}" aria-label="Remove adjustment ${esc(a.label)}">×</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No percentage adjustments in this section.</div>'}
  ${canEditFormulas()?`<div class="cost-row-tools"><button type="button" class="button" data-fm-add-adj="${si}">${icon('plus')}Add adjustment</button></div>`:''}
  </div></section>`;
}
function fmGlobalPanel(){
  const cfg=fmCfg(),secs=cfg.sections;
  return `<section class="panel"><div class="panel-title"><div><h2>Profit, spare part cost and total</h2><small>Applied after the section totals</small></div></div><div class="body-pad"><div class="form-grid fm-grid">
  <div class="field"><label>Profit & admin · default %</label><input type="number" min="0" max="100" step="any" ${fmInput('profit.percent','n')}></div>
  <div class="field"><label>Profit & admin · default basis</label>${fmSelect('profit.base','s',[['subtotal','Subtotal'],...secs.map(s=>[s.key,`${s.label} (${s.letter})`])])}</div>
  <div class="field"><label>Suppliers can change profit & admin</label><label class="check"><input type="checkbox" data-fp="profit.lock" data-ft="nb" ${canEditFormulas()?'':'disabled'} ${cfg.profit.lock?'':'checked'}> Yes</label></div>
  <div class="field fm-wide"><label>Bases a supplier may choose</label><div class="fm-checks">${[['subtotal','Subtotal'],...secs.map(s=>[s.key,`${s.label} (${s.letter})`])].map(([k,l])=>`<label class="check"><input type="checkbox" data-fm-basis="${k}" ${canEditFormulas()?'':'disabled'} ${cfg.profit.bases.includes(k)?'checked':''}> ${esc(l)}</label>`).join('')}</div></div>
  <div class="field"><label>Spare part cost · default %</label><input type="number" min="0" max="100" step="any" ${fmInput('spare.percent','n')}></div>
  <div class="field"><label>Spare part cost · based on</label>${fmSelect('spare.base','s',secs.map(s=>[s.key,`${s.label} (${s.letter})`]))}</div>
  <div class="field"><label>Suppliers can change spare part cost</label><label class="check"><input type="checkbox" data-fp="spare.lock" data-ft="nb" ${canEditFormulas()?'':'disabled'} ${cfg.spare.lock?'':'checked'}> Yes</label></div>
  <div class="field fm-wide"><label>Total unit price formula</label><input class="mono" ${fmInput('total','s','maxlength="200" spellcheck="false"')}><small>Available names: <code>subtotal</code> <code>profit</code> <code>spare</code> ${secs.map(s=>`<code>${esc(s.letter)}</code>`).join(' ')}</small></div>
  </div><h3>Rounding</h3><div class="form-grid fm-grid"><div class="field"><label>Decimals</label><input type="number" min="0" max="4" step="1" ${fmInput('rounding.decimals','i')}></div>
  <div class="field"><label>Each line</label>${fmSelect('rounding.row','s',MODES)}</div><div class="field"><label>Section totals</label>${fmSelect('rounding.section','s',MODES)}</div><div class="field"><label>Profit & admin</label>${fmSelect('rounding.profit','s',MODES)}</div><div class="field"><label>Spare part cost</label>${fmSelect('rounding.spare','s',MODES)}</div><div class="field"><label>Total</label>${fmSelect('rounding.total','s',MODES)}</div></div></div></section>`;
}
function fmSampleQuotes(){return db.quotes.filter(q=>q.format===fmFormat&&visibleQuotes().includes(q)).sort((a,b)=>(a.status==='Approved'?0:1)-(b.status==='Approved'?0:1)||b.id.localeCompare(a.id))}
function fmErrors(){return FORMULA_FORMATS.flatMap(f=>validateFormatConfig(fmDraft[f]).map(e=>[f,e]))}
function fmPreview(){
  const quotes=fmSampleQuotes();if(!quotes.length)return '<div class="empty">No quotations of this format to test with yet.</div>';
  const q=quotes.find(x=>x.id===fmSample)||quotes[0],cur=totals(q.costs),cfg=fmCfg(),secs=cfg.sections;
  const draftCosts=costsUnder(q.costs,cfg),dr=totals(draftCosts,cfg),ok=v=>Number.isFinite(v);
  const row=(label,a,b,cls='')=>`<tr class="${cls}"><td>${label}</td><td class="num">${ok(a)?cash(a):'—'}</td><td class="num price">${ok(b)?cash(b):'—'}</td><td class="num delta ${ok(a)&&ok(b)&&b<a?'down':ok(a)&&ok(b)&&b>a?'up':'same'}">${ok(a)&&ok(b)?(b-a>0?'+':'')+cash(r2(b-a)):'—'}</td></tr>`;
  const old=formulaVersion(q.costs.fv||1).formats[q.format];
  return `<div class="field fm-sample"><label for="fm-sample">Test with quotation</label><select id="fm-sample">${quotes.map(x=>`<option value="${x.id}" ${x.id===q.id?'selected':''}>${esc(x.id)} · ${esc(itemOf(x).code)} · ${esc(supplierName(x.supplier))}</option>`).join('')}</select></div><div class="table-wrap"><table class="data-table compare-table"><thead><tr><th>Cost category</th><th class="num">Formulas it was issued with · v${q.costs.fv||1}</th><th class="num">Your draft</th><th class="num">Change · THB</th></tr></thead><tbody>${secs.map(s=>row(`<span class="letter">${esc(s.letter)}</span>${esc(s.label)}`,cur[s.letter],dr[s.letter])).join('')}${row('Subtotal',cur.subtotal,dr.subtotal,'subtotal')}${row('Profit & admin',cur.profit,dr.profit)}${row('Spare part cost',cur.spare,dr.spare)}${row('Total quoted unit price',cur.total,dr.total,'total-row')}</tbody></table></div><p class="muted-note" style="padding:12px 20px">The same costs are recalculated as a new quotation would be under your draft. Issued quotations are not changed.</p>`;
}
function fmStatus(){
  const errors=fmErrors(),dirty=fmDirty(),reason=(document.getElementById('fm-reason')?.value||'').trim();
  return {errors,dirty,reason,canSave:canEditFormulas()&&dirty&&!errors.length&&!!reason};
}
function fmErrorsHtml(){
  const {errors,dirty}=fmStatus();
  if(errors.length)return `<div class="highlight-note fm-errors" role="alert"><strong>Fix before saving</strong>${errors.map(([f,e])=>`<div>${esc(f)} · ${esc(e)}</div>`).join('')}</div>`;
  return dirty?'<div class="highlight-note blue">Draft is valid. Add a reason and save to create a new version.</div>':'';
}
function fmHistory(){
  const vs=FORMULAS.versions.filter(v=>v.setId===selectedFormulaSet().id).slice().reverse(),cur=selectedFormulaSet().current;
  return `<section class="panel" style="margin-top:22px"><div class="panel-title"><div><h2>Version history</h2><small>Every change is kept with who made it and why</small></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Version</th><th>Effective</th><th>Changed by</th><th>Reason</th><th>What changed</th><th></th></tr></thead><tbody>${vs.map(v=>`<tr ${detailRowAttrs('formula-version/'+v.version)}><td><strong>${detailRecordLink('formula-version/'+v.version,'v'+v.version)}</strong>${v.version===cur?` ${statusPill('Current','green')}`:''}</td><td>${date(v.effective)}<small>${esc(v.at)}</small></td><td>${esc(v.by)}</td><td class="reason-cell">${esc(v.reason)}</td><td class="reason-cell">${(v.changes||[]).length?v.changes.map(c=>`<div>${esc(c.join(' · '))}</div>`).join(''):'—'}</td><td>${canEditFormulas()&&v.version!==cur?`<button class="date-button" data-fm-load="${v.version}">Use as draft</button>`:''}<small>${db.quotes.filter(q=>(q.costs.fv||1)===v.version).length} quotations</small></td></tr>`).join('')}</tbody></table></div></section>`;
}
function formulasView(){
  if(portal!=='roki')return '<div class="empty">This page is unavailable in this portal. <a href="#overview">Return to overview</a></div>';
  ensureFormulaCategory();fmInit();
  const cur=selectedFormulaVersion(),cfg=fmCfg(),dirty=fmDirty();
  return heading('Settings','Calculation formulas','Set how each quotation format is calculated. Every save creates a new version, and issued quotations keep the version they were made with.')
  +formulaLibrary()+`<div class="highlight-note blue">${icon('settings')}　Current version <strong>v${cur.version}</strong> · effective ${date(cur.effective)} · ${esc(cur.by)}.${canEditFormulas()?'':' Only WEBPARK Issue and Approve accounts can change formulas.'}</div>

  <div class="page-grid fm-grid-page"><div class="stack">${cfg.sections.map((s,si)=>fmSectionCard(s,si)).join('')}${canEditFormulas()?`<button class="button" data-add-formula-section>${wfText("Add cost category","เพิ่มหมวดต้นทุน")}</button>`:''}${fmGlobalPanel()}</div>
  <aside class="stack fm-aside"><section class="panel"><div class="panel-title"><h2>Live check</h2><span class="badge gray">THB / pc</span></div><div id="fm-preview">${fmPreview()}</div></section>
  <section class="panel"><div class="panel-title"><h2>Save</h2>${dirty?statusPill('Unsaved changes','amber'):statusPill('No changes','gray')}</div><div class="body-pad"><div id="fm-errors">${fmErrorsHtml()}</div><div class="field"><label for="fm-reason">Reason for change *</label><textarea id="fm-reason" maxlength="1000" ${canEditFormulas()?'':'disabled'} placeholder="Why are the formulas changing?"></textarea></div><div class="actions fm-actions"><button type="button" class="button" data-fm-discard ${dirty?'':'disabled'}>Discard changes</button><button type="button" class="button primary" data-fm-save id="fm-save" disabled>Save as new version</button></div></div></section></aside></div>`+fmHistory();
}
/* typing refreshes only the live check, messages and buttons, so focus is not lost */
function fmRefresh(){
  const p=document.getElementById('fm-preview');if(!p)return;
  p.innerHTML=fmPreview();document.getElementById('fm-errors').innerHTML=fmErrorsHtml();
  const st=fmStatus(),save=document.getElementById('fm-save');if(save)save.disabled=!st.canSave;
  const d=document.querySelector('[data-fm-discard]');if(d)d.disabled=!st.dirty;
}
function fmRender(){const reason=document.getElementById('fm-reason')?.value||'';render();const r=document.getElementById('fm-reason');if(r){r.value=reason;fmRefresh()}}
function nextKey(cfg,prefix){const used=new Set(cfg.sections.flatMap(s=>[...s.fields.map(f=>f[0]),...(s.adj||[]).map(a=>a.key)]));let n=1;while(used.has(prefix+n))n++;return prefix+n}

function fmSave(){
 if(!canEditFormulas())return;const st=fmStatus();if(st.errors.length)return toast('Fix the highlighted formula problems before saving.');if(!st.dirty||!st.reason)return toast('Add a reason and change the formula before saving.');
 const cur=selectedFormulaVersion(),set=selectedFormulaSet(),version=Math.max(...FORMULAS.versions.map(v=>v.version))+1,changes=FORMULA_FORMATS.flatMap(f=>diffFormat(f,cur.formats[f],fmDraft[f]));
 if(!rfqCommit(()=>{FORMULAS.versions.push({version,setId:set.id,effective:TODAY,by:user.name,at:timestamp(),reason:st.reason,changes,formats:structuredClone(fmDraft)});set.current=version;if(set.id==='standard')FORMULAS.current=version;db.audit.unshift({action:'Saved formula '+set.name+' v'+version,user:user.name,at:timestamp(),reason:st.reason})}))return;
 fmReset();render();toast(wfText('New formula version saved. Sent forms are unchanged.','บันทึกเวอร์ชันใหม่แล้ว แบบฟอร์มที่ส่งไปแล้วไม่เปลี่ยน'));
}

function handleFormulaClick(b){
  if(portal!=='roki')return false;
  const d=b.dataset;
  if(d.fmTab){switchFormulaCategory(d.fmTab);return true}
  if(!('fmSave' in d||'fmDiscard' in d||'fmAddField' in d||'fmRemoveField' in d||'fmAddAdj' in d||'fmRemoveAdj' in d||'fmLoad' in d))return false;
  if(!canEditFormulas()){toast('Only WEBPARK Issue and Approve accounts can change formulas.');return true}
  if('fmSave' in d)fmSave();
  else if('fmDiscard' in d){fmReset();fmRender()}
  else if('fmAddField' in d){const s=fmCfg().sections[+d.fmAddField];s.fields.push(fld(nextKey(fmCfg(),'col'),'New column','number',null,{}));fmRender()}
  else if('fmRemoveField' in d){const [si,fi]=d.fmRemoveField.split('.').map(Number),s=fmCfg().sections[si];if(s.fields.length>1)s.fields.splice(fi,1);fmRender()}
  else if('fmAddAdj' in d){const s=fmCfg().sections[+d.fmAddAdj];(s.adj=s.adj||[]).push({key:nextKey(fmCfg(),'adj'),label:'New adjustment',percent:0,of:'self',lock:false});fmRender()}
  else if('fmRemoveAdj' in d){const [si,ai]=d.fmRemoveAdj.split('.').map(Number);fmCfg().sections[si].adj.splice(ai,1);fmRender()}
  else if('fmLoad' in d){fmDraft=structuredClone(formulaVersion(+d.fmLoad).formats);fmRender();toast('Loaded as a draft. Add a reason and save to apply it as a new version.')}
  return true;
}
function fmOnInput(el){
  if(!fmDraft||!canEditFormulas())return;
  if(el.dataset.fp){
    const t=el.dataset.ft;let v=el.value;
    if(t==='n')v=el.value===''?NaN:Number(el.value);
    else if(t==='i')v=el.value===''?NaN:Math.trunc(Number(el.value));
    else if(t==='b')v=el.checked;
    else if(t==='nb')v=!el.checked;               /* checkbox shown as “suppliers can change”, stored as lock */
    fmSet(el.dataset.fp,v);
    if(el.dataset.fp.endsWith('.2')&&/fields\.\d+\.2$/.test(el.dataset.fp)){fmRender();return}   /* column type changed */
    fmRefresh();
  }else if(el.dataset.fr){
    const f=fmGet(el.dataset.fr);f[4]=f[4]||{};delete f[4].req;delete f[4].positive;
    if(el.value==='required')f[4].req=true;if(el.value==='positive')f[4].positive=true;fmRefresh();
  }else if(el.dataset.fmBasis){
    const bases=fmCfg().profit.bases,k=el.dataset.fmBasis,at=bases.indexOf(k);
    if(el.checked&&at<0)bases.push(k);if(!el.checked&&at>=0)bases.splice(at,1);fmRefresh();
  }else if(el.id==='fm-sample'){fmSample=el.value;fmRefresh()}
  else if(el.id==='fm-reason')fmRefresh();
}
document.addEventListener('input',e=>{if(e.target.matches&&e.target.matches('[data-fp],[data-fr],[data-fm-basis],#fm-sample,#fm-reason'))fmOnInput(e.target)});
document.addEventListener('change',e=>{if(e.target.matches&&e.target.matches('select[data-fp],select[data-fr],[data-fm-basis],input[type=checkbox][data-fp],#fm-sample'))fmOnInput(e.target)});
