'use strict';
/* Assemblies and sub-parts: the part list holds each part's components (its BOM). A new cost form gets one component row
   per BOM entry, and where the component is itself a part of the same supplier with an approved quotation, its price is
   LINKED: the row takes that quotation's unit price, the way the Excel sheets link a sub-part sheet into its parent.
   The unrounded total is used (quotation.totalRaw), exactly as the Excel link does, so parent and sub-part never disagree by rounding. */
function linkedPrice(code,supplierId){
  const pair=db.items.find(x=>x.code===code&&x.supplier===supplierId);
  if(!pair)return null;
  const q=latestApproved(pair.id);
  return {pair,quote:q||null,price:q?(q.totalRaw??q.total):null};
}
function applyLink(row,code,supplierId){
  const lp=linkedPrice(code,supplierId);
  if(!lp){delete row.link;delete row.linkQuote;delete row.linkMissing;return false}
  row.link=code;
  if(lp.price==null){row.rate=0;row.linkMissing=true;delete row.linkQuote}
  else{row.rate=lp.price;row.linkQuote=lp.quote.id;delete row.linkMissing}
  return true;
}
/* make the component rows follow the part's BOM: add the missing rows, link prices, drop the empty starter row */
function syncComponents(c,item){
  const sec=sectionsOf(c).find(s=>s.key==='components');
  if(!sec||!item)return c;
  const kids=item.children||[];
  c.components=c.components||[];
  if(kids.length)c.components=c.components.filter(r=>r.partNo||r.name||r.link||(r.rate!=null&&Number(r.rate)>0));
  for(const ch of kids){
    let row=c.components.find(r=>r.partNo===ch.code);
    if(!row){row=blankRow(sec);row.partNo=ch.code;row.qty=ch.qty;c.components.push(row)}
    const known=db.items.find(x=>x.code===ch.code);
    if(!row.name)row.name=known?known.name:'';
    applyLink(row,ch.code,item.supplier);
  }
  return c;
}
function refreshLinks(c,supplierId){let n=0;for(const r of c.components||[])if(r.link&&applyLink(r,r.link,supplierId))n++;return n}
function missingLinks(c){
  return (c.components||[]).some(r=>r.link&&r.linkMissing)?'A linked part has no approved price yet. Wait for its quotation to be approved, or unlink it and enter the price.':'';
}
function linkNote(r,index){
  if(!r.link)return '';
  return `<small class="link-note ${r.linkMissing?'bad':''}">${r.linkMissing?'No approved price yet':'Linked price'}${r.linkQuote?` · <a class="link-button" href="#quote/${esc(r.linkQuote)}">${esc(r.linkQuote)}</a>`:''} <button type="button" class="link-button" data-unlink="${index}">Unlink</button></small>`;
}
/* “Update prices” and “Unlink” in the cost form */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-unlink],[data-action="refresh-links"]');
  if(!b||!window.formCosts||portal!=='supplier')return;
  if(b.dataset.unlink!==undefined){
    const r=window.formCosts.components[+b.dataset.unlink];
    if(r){delete r.link;delete r.linkQuote;delete r.linkMissing;refreshRows();refreshTotals()}
    return;
  }
  const item=db.items.find(i=>i.id===editorItem);
  const n=refreshLinks(window.formCosts,item?item.supplier:user.supplier);
  refreshRows();refreshTotals();toast(n?`Updated ${n} linked part price${n===1?'':'s'}.`:'No linked parts to update.');
});
