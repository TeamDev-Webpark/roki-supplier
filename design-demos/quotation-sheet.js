'use strict';
/* Printable quotation sheet, laid out like the customer's QT workbook (docs/sample -QT.xls):
   letterhead → supplier / part header → cost columns A–E (original beside revised) → (A+…+E), profit, spare, total
   → remark and beginning date → Supplier and WEBPARK signature boxes.
   Everything that the formula library lets WEBPARK configure still comes from the template: title, header fields,
   section titles, printed columns, blank rows, signature boxes, notes and form code.
   Loaded after workspace.js, so these definitions replace the earlier formColumn / printView everywhere
   (quotation page, blank-form preview, reference-quotation dialog and the formula-library live preview). */

const qsLetterless=s=>sectionHeading(s).replace(/\s*\(\s*[A-Z]\s*\)\s*$/,'');
const qsIsNumber=(s,key)=>key==='amount'||s.fields.find(f=>f[0]===key)?.[2]==='number';
function qsColumnWidth(columns,key,index,result){
  const weight=(k,i)=>i===result?1.1:['name','partNo','code','machine'].includes(k)?1.65:1;
  return weight(key,index)*100/columns.reduce((sum,[k],i)=>sum+weight(k,i),0);
}
const qsMoney=(v,blank)=>blank||v==null||!Number.isFinite(Number(v))?'—':cash(v);
function qsBlank(costs){return totals(costs).total===0}

function formColumn(title,costs,meta,item,q,cfgOverride){
  const cfg=cfgOverride||cfgOf(costs),t=totals(costs,cfg),secs=cfg.sections,tpl=templateOf(cfg,costs.format),empty=t.total===0;
  const value=(s,r,key,isResult)=>{
    if(isResult){const a=rowAmount(cfg,s,r);return `<td class="num qs-amount">${empty&&!a?'—':qsMoney(a)}</td>`}
    const f=s.fields.find(x=>x[0]===key);if(!f)return '<td></td>';
    if(f[2]==='number')return `<td class="num">${r[key]==null||r[key]===''?'':Number(r[key]).toLocaleString('en-US',{maximumFractionDigits:6})}</td>`;
    return `<td>${esc(plain(r[key]))}</td>`;
  };
  const section=s=>{
    const rows=costs[s.key]||[],x=t.sections[s.key],cols=s.printCols?.length?sectionPrintCols(s):[...s.fields.map(f=>[f[0],f[1]]),['amount','Amount']],blank=Math.max(0,(tpl.blankRows||0)-rows.length);
    const resultIndex=cols.findLastIndex(([key])=>key==='amount');
    const adj=(s.adj||[]).filter(a=>costs[a.key]).map(a=>`<tr class="qs-adj"><td colspan="${cols.length-1}">${esc(a.label)} ${costs[a.key]}%${a.choices?` × ${adjChoice(costs,a).of==='self'?s.letter:(secs.find(y=>y.key===adjChoice(costs,a).of)||s).letter}`:''}</td><td class="num">${qsMoney(x.adjustments[a.key],empty)}</td></tr>`).join('');
    return `<section class="qs-sec" data-qs-section="${esc(s.letter)}"><header class="qs-sec-head"><span class="qs-letter">${esc(s.letter)}</span><strong>${esc(qsLetterless(s))}</strong><span class="qs-sec-total">${qsMoney(t[s.letter],empty)}</span></header>
      <table class="qt-table qs-table"><colgroup>${cols.map(([key],index)=>`<col style="width:${qsColumnWidth(cols,key,index,resultIndex)}%">`).join('')}</colgroup><thead><tr>${cols.map(c=>`<th class="${qsIsNumber(s,c[0])?'num':''}">${esc(c[1])}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r=>`<tr>${cols.map((c,i)=>value(s,r,c[0],i===resultIndex)).join('')}</tr>`).join('')}${!rows.length&&!blank?`<tr><td colspan="${cols.length}" class="blank">${wfText('No lines','ไม่มีรายการ')}</td></tr>`:''}${Array.from({length:blank},()=>`<tr class="qt-blank-row">${cols.map(()=>'<td>&nbsp;</td>').join('')}</tr>`).join('')}${adj}</tbody>
      <tfoot><tr class="qt-total"><td colspan="${cols.length-1}">${wfText('Total','รวม')} ${esc(s.letter)}</td><td class="num">${qsMoney(t[s.letter],empty)}</td></tr></tfoot></table></section>`;
  };
  const head=tpl.header.filter(h=>h.show||(h.key==='supplierRef'&&meta.supplierRef)).map(h=>`<div><dt>${esc(h.key==='qty'&&meta.qtyPeriod?qtyLabelOf(meta.qtyPeriod,item.format):h.label)}</dt><dd>${esc(printHeaderValue(h.key,meta,item))}</dd></div>`).join('');
  const letters=secs.map(s=>s.letter).join('+');
  return `<div class="qt-col"><div class="qt-col-title">${esc(title)}</div><dl class="qt-head">${head}</dl>${secs.map(section).join('')}
    <table class="qt-table qt-sum"><colgroup><col style="width:64%"><col style="width:12%"><col style="width:24%"></colgroup><tbody>
      <tr><td>(${letters})</td><td class="qs-code">${esc(secs.at(-1)?.letter||'')}</td><td class="num">${qsMoney(t.subtotal,empty)}</td></tr>
      <tr><td>${wfText('Profit & admin cost','กำไรและค่าบริหาร')} · ${costs.profit}% ${wfText('of','ของ')} ${esc(profitBase(costs,cfg).short)}</td><td class="qs-code">F</td><td class="num">${qsMoney(t.profit,empty)}</td></tr>
      ${costs.spare?`<tr><td>${wfText('Spare part cost','ค่าอะไหล่ (Spare part)')} · ${costs.spare}% ${wfText('of','ของ')} ${esc(spareBase(costs,cfg).short)}</td><td class="qs-code"></td><td class="num">${qsMoney(t.spare,empty)}</td></tr>`:''}
      <tr class="qt-grand"><td>${wfText('Unit price','ราคาต่อหน่วย')} · THB / pc</td><td class="qs-code">${esc(secs.at(-1)?.letter||'')}+F</td><td class="num">${qsMoney(t.total,empty)}</td></tr>
    </tbody></table>
    <div class="qt-remark"><b>${wfText('Remark','หมายเหตุ')}:</b> <span data-i18n-skip>${esc(meta.remark||'—')}</span><div class="qt-begin">${wfText('Beginning','เริ่มใช้')}: <b>${meta.effective?date(meta.effective):'____/____/______'}</b>${meta.ending&&!tpl.header.some(h=>h.key==='ending'&&h.show)?` · ${wfText('Ending','สิ้นสุด')}: <b>${date(meta.ending)}</b>`:''}</div></div></div>`;
}

/* The comparison a reader looks for first: original vs revised per cost category, and the change. */
function qsSummary(q,b,blank){
  const cfg=cfgOf(q.costs),tq=totals(q.costs),tb=b?totals(b.costs,cfgOf(b.costs)):null;
  const row=(label,key,cur,old,strong)=>{const d=old==null||blank?null:cur-old;return `<tr class="${strong?'qs-strong':''}"><td><span class="qs-key">${esc(key)}</span>${esc(label)}</td>${b?`<td class="num">${qsMoney(old)}</td>`:''}<td class="num">${qsMoney(cur,blank)}</td>${b?`<td class="num qs-delta ${d>0?'up':d<0?'down':''}">${d==null?'—':(d>0?'+':'')+cash(d)}</td>`:`<td class="num">${blank||!tq.total?'—':(cur/tq.total*100).toFixed(1)+'%'}</td>`}</tr>`};
  const rows=cfg.sections.map(s=>row(qsLetterless(s),s.letter,tq[s.letter],tb?(tb[s.letter]??0):null)).join('')
    +row(wfText('Profit & admin cost','กำไรและค่าบริหาร'),'F',tq.profit,tb?.profit)
    +(q.costs.spare||b?.costs.spare?row(wfText('Spare part cost','ค่าอะไหล่'),'',tq.spare,tb?.spare):'')
    +row(wfText('Unit price','ราคาต่อหน่วย'),'',tq.total,tb?.total,true);
  const diff=b&&!blank?tq.total-tb.total:null;
  const kpi=b?`<div class="qs-kpi"><div><small>${wfText('Original price','ราคาเดิม')} · Rev. ${esc(b.revision)}</small><strong>฿${cash(tb.total)}</strong></div><span class="qs-arrow">→</span><div class="qs-kpi-main"><small>${wfText('Proposed price','ราคาที่เสนอ')}</small><strong>${blank?'—':'฿'+cash(tq.total)}</strong></div><div class="qs-kpi-change ${diff>0?'up':diff<0?'down':''}"><small>${wfText('Change','เปลี่ยนแปลง')}</small><strong>${diff==null?'—':(diff>0?'+':'')+cash(diff)}</strong><span>${diff==null?'':signedPct(tq.total,tb.total)}</span></div></div>`
    :`<div class="qs-kpi"><div class="qs-kpi-main"><small>${wfText('Unit price','ราคาต่อหน่วย')} · THB / pc</small><strong>${blank?'—':'฿'+cash(tq.total)}</strong></div><div><small>${wfText('Previous approved price','ราคาอนุมัติครั้งก่อน')}</small><strong>${q.previous==null?wfText('First quotation','เสนอราคาครั้งแรก'):'฿'+cash(q.previous)}</strong></div></div>`;
  return `<section class="qs-summary">${kpi}<table class="qt-table qs-sum-table"><thead><tr><th>${wfText('Cost category','หมวดต้นทุน')}</th>${b?`<th class="num">${wfText('Original','เดิม')}</th>`:''}<th class="num">${b?wfText('Revised','ที่เสนอ'):wfText('THB / pc','บาท / ชิ้น')}</th><th class="num">${b?wfText('Change','เปลี่ยนแปลง'):wfText('Share','สัดส่วน')}</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function printView(id){
  const q=visibleQuotes().find(q=>q.id===id)||previewQuote(id);
  if(!q)return `<div class="empty">${wfText('Quotation unavailable for this account.','บัญชีนี้ไม่มีสิทธิ์ดูใบเสนอราคานี้')} <a href="#quotes" class="link-button">${wfText('Return to quotations','กลับรายการใบเสนอราคา')}</a></div>`;
  const item=quotationIdentity(q),sup=suppliers.find(s=>s.id===q.supplier),b=q.baseline,sig=signatures(q),tpl=templateOf(cfgOf(q.costs),q.costs.format),blank=!!q.preview||qsBlank(q.costs);
  const signed=(document,template,version)=>{
    const evidence=version==='current'?sig:signatures(document);
    const box=(def,webpark)=>{
      const entry=evidence[def.stage];
      const pending=version==='current'&&def.stage&&!['Approved','Rejected','Reverted'].includes(q.status);
      return `<div class="qt-sign"><small>${esc(def.label)}</small><div class="qt-signed ${entry&&webpark?'esign':entry?'':'pending'}">${entry?`${esc(entry.user)}<em>${esc(entry.at)}</em><span class="qs-confirmation-method">${webpark?wfText('e-signed','ลงนามอิเล็กทรอนิกส์'):wfText('confirmed in system','ยืนยันในระบบ')}</span>`:pending?wfText('Pending','รอดำเนินการ'):'—'}</div></div>`;
    };
    return `<div class="qs-sign-document" data-signature-version="${version}"><div class="qs-sign-caption">${wfText('Approval record','บันทึกการลงนาม')} · ${esc(document.id||document.quote||'—')}</div><div class="qt-signs"><div><h3>Supplier</h3><div class="qt-sign-row">${template.sign.supplier.map(d=>box(d,false)).join('')}</div></div><div><h3>WEBPARK</h3><div class="qt-sign-row">${template.sign.roki.map(d=>box(d,true)).join('')}</div></div></div></div>`;
  };
  const back=q.preview?`<a href="#request-detail/${q.preview.nid}/${q.item}" class="button">${wfText('Back to request','กลับหน้าคำขอ')}</a>`:`<a href="#quote/${q.id}" class="button">${wfText('Back to quotation','กลับใบเสนอราคา')}</a>`;
  const note=q.preview?`<div class="highlight-note blue">${wfText('Preview of the blank quotation sheet issued by WEBPARK. Amounts, the revision reason and signatures are filled in as the Supplier and WEBPARK complete each step.','พรีวิวใบเสนอราคาที่ WEBPARK ส่งให้ ยังไม่มีข้อมูล ตัวเลข เหตุผล และลายเซ็นจะเติมเมื่อ Supplier และ WEBPARK ดำเนินการแต่ละขั้น')}</div>`
    :q.status!=='Approved'?`<div class="highlight-note">${wfText('Status','สถานะ')}: ${esc(wfQuoteLabel(q.status,stageLabels[q.status]?.[0]||q.status))}. ${wfText('Signature boxes fill in as each step is completed.','ช่องลายเซ็นจะเติมเมื่อแต่ละขั้นดำเนินการเสร็จ')}</div>`:'';
  const metaOf=x=>({date:x.quoteDate||x.date,drawing:x.drawing,qty:x.quantity,remark:x.remark,effective:x.effective,ending:x.ending,qtyPeriod:x.qtyPeriod,supplierRef:x.supplierRef});
  const baselineTemplate=b?templateOf(cfgOf(b.costs),b.costs.format):null;
  const facts=[[wfText('Supplier code','รหัสซัพพลายเออร์'),sup.code],[wfText('Supplier','ซัพพลายเออร์'),sup.name],[wfText('Part no.','เลขชิ้นส่วน'),item.code],[wfText('Part name','ชื่อชิ้นส่วน'),item.name],[wfText('Form','ประเภทฟอร์ม'),typeof quotationFormLabel==='function'?quotationFormLabel(q.costs.format):q.costs.format],[wfText('Formula','สูตรคำนวณ'),formulaLabel(q.costs.fv)],[wfText('Beginning','เริ่มใช้'),q.effective?date(q.effective):'—'],[wfText('Ending','สิ้นสุด'),q.ending?date(q.ending):'—']];
  return `<div class="no-print">${heading(q.preview?wfText('Quotation form preview','พรีวิวใบเสนอราคา'):wfText('Quotation form','ใบเสนอราคา')+' · '+q.id,item.name,wfText('Printable layout of the quotation sheet. Use Print / save PDF to file or share it.','รูปแบบเอกสารสำหรับพิมพ์ กดพิมพ์ / บันทึก PDF เพื่อเก็บหรือส่งต่อ'),`${back}<button type="button" class="button primary" data-action="print">${icon('download')}${wfText('Print / save PDF','พิมพ์ / บันทึก PDF')}</button>`)}${note}</div>
  <style>@page {size:A4 ${q.costs.format==='Assembly'?'landscape':'portrait'}; margin:8mm}</style>
  <article class="qt-form qs ${q.costs.format==='Assembly'?'qs-a4-landscape':'qs-a4-portrait'} ${b?'qs-compare':''}" data-quotation-sheet="${esc(q.id)}">
    <header class="qt-letterhead">${logo()}<div class="qs-company"><strong>${esc(CompanyBrand.name)}</strong><span>${wfText('Purchasing','ฝ่ายจัดซื้อ')}</span></div>
      <div class="qt-title">${esc(tpl.title)}<small>${esc(q.id)}${q.revision?' · Rev. '+esc(q.revision):''}</small><span class="qs-status">${q.preview?`<span class="badge gray">${wfText('Blank form','ฟอร์มเปล่า')}</span>`:statusBadge(q.status)}</span></div></header>
    <dl class="qs-facts">${facts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v||'—')}</dd></div>`).join('')}</dl>
    ${b&&(b.quantity==null||!b.drawing)?`<p class="muted-note">${wfText('Some original header data was not recorded; unknown values are shown as —.','ข้อมูลหัวใบต้นฉบับบางส่วนไม่ได้บันทึกไว้ จะแสดง — แทนค่าที่ไม่ทราบ')}</p>`:''}
    ${qsSummary(q,b,blank)}
    <div class="qt-cols ${b?'two':''}">${b?formColumn(costTitleOf(baselineTemplate,b.revision),b.costs,metaOf({...b,quoteDate:b.date}),b.itemSnapshot||item,q):''}${formColumn(costTitleOf(tpl,q.revision),q.costs,metaOf(q),item,q)}</div>
    <footer class="qs-signatures ${b?'qs-two':''}">${b?signed(b,baselineTemplate,'original'):''}${signed(q,tpl,'current')}</footer>
    ${tpl.notes.length?`<div class="qt-notes">${tpl.notes.map(n=>`<p>${esc(n)}</p>`).join('')}</div>`:''}
    <p class="qt-foot">${(q.terms?termsLines(q.terms):[wfText('This unit price excludes VAT','ราคาต่อหน่วยนี้ไม่รวมภาษีมูลค่าเพิ่ม')]).map(esc).join(' · ')} · ${wfText('Approval records from the demo system','สร้างโดยระบบราคาซัพพลายเออร์ WEBPARK · ลายเซ็นอิเล็กทรอนิกส์เป็นการจำลอง')}${tpl.formCode?` · <span class="qt-formcode">${esc(tpl.formCode)}</span>`:''}</p>
  </article>`;
}
