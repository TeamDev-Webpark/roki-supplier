'use strict';
/* Click a column header to sort a table (ascending → descending → original order), like the up/down chevrons on a data grid.
   Tables with data-sort-page sort their source rows before pagination. Other desk tables expand before sorting.
   Editing tables (cost entry, formula editor) keep their plain headers. */
(function(){
  const SKIP='.cost-table,.fm-table,.fm-ex-table,.qt-form table,[data-no-sort]';
  const ACTION=/^(action|actions|ดำเนินการ|เลือก|select)$/i;
  const MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,'ม.ค.':0,'ก.พ.':1,'มี.ค.':2,'เม.ย.':3,'พ.ค.':4,'มิ.ย.':5,'ก.ค.':6,'ส.ค.':7,'ก.ย.':8,'ต.ค.':9,'พ.ย.':10,'ธ.ค.':11};
  const states=new Map();   /* table signature → {col, dir} */
  const ICON='<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path class="up" d="M4 6.5 8 3l4 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path class="down" d="M4 9.5 8 13l4-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const signature=t=>t.dataset.sortPage?'paged:'+t.dataset.sortPage:(t.closest('[data-desk-section]')?.dataset.deskSection||t.dataset.deskTable||t.dataset.queue||'')+'|'+[...t.tHead.rows[0].cells].map(c=>c.textContent.trim()).join('/');
  function value(cell){
    const text=(cell?.innerText||'').replace(/\s+/g,' ').trim();if(!text||text==='—'||text==='-')return null;
    const d=text.match(/(\d{1,2})\s+([A-Za-z]{3}|[ก-ฮ]{1,3}\.?[ก-ฮ]{1,3}\.)\s+(\d{4})/);
    if(d){const m=MONTHS[d[2].toLowerCase()];if(m!==undefined)return Date.UTC(+d[3],m,+d[1])}
    const n=text.replace(/[฿,%\s+]/g,'').match(/^-?\d+(\.\d+)?/);
    if(n&&n[0].length>=text.replace(/[฿,%\s+]/g,'').length*0.5)return parseFloat(n[0]);
    return text.toLowerCase();
  }
  function compare(a,b){
    if(a===null&&b===null)return 0;if(a===null)return 1;if(b===null)return -1;
    if(typeof a==='number'&&typeof b==='number')return a-b;
    return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});
  }
  function compareDirection(a,b,direction){
    if(a===null||b===null)return compare(a,b);
    return direction==='asc'?compare(a,b):compare(b,a);
  }
  window.sortPaginatedRows=(key,rows,columns)=>{
    const sort=states.get('paged:'+key),read=sort&&columns[sort.col];
    if(!read)return rows;
    return rows.map(row=>({row,value:read(row)??null}))
      .sort((a,b)=>compareDirection(a.value,b.value,sort.dir)).map(entry=>entry.row);
  };
  function applySort(table){
    const st=states.get(signature(table)),body=table.tBodies[0];if(!body)return;
    const rows=[...body.rows];
    if(!table._orig||table._orig.length!==rows.length||!rows.every(r=>table._orig.includes(r)))table._orig=rows.slice();
    const heads=[...table.tHead.rows[0].cells];
    heads.forEach((h,i)=>{if(h.dataset.sortable!=='1')return;h.setAttribute('aria-sort',st&&st.col===i?(st.dir==='asc'?'ascending':'descending'):'none');h.classList.toggle('sorted',!!st&&st.col===i)});
    if(table.dataset.sortPage)return;
    if(!st){table._orig.forEach(r=>body.appendChild(r));return}
    const keyed=table._orig.map(r=>({r,v:value(r.cells[st.col])}));
    keyed.sort((x,y)=>compareDirection(x.v,y.v,st.dir));
    keyed.forEach(k=>body.appendChild(k.r));
  }
  function decorate(table){
    if(table.dataset.sortReady==='1'||table.matches(SKIP)||!table.tHead||!table.tBodies[0]||!table.tHead.rows[0])return;
    table.dataset.sortReady='1';
    [...table.tHead.rows[0].cells].forEach((th,i)=>{
      const label=th.textContent.trim();
      if(!label||ACTION.test(label)||th.querySelector('input,button'))return;
      th.dataset.sortable='1';
      const b=document.createElement('button');b.type='button';b.className='th-sort';b.dataset.sortCol=String(i);
      while(th.firstChild)b.appendChild(th.firstChild);
      const ico=document.createElement('span');ico.className='sort-ico';ico.innerHTML=ICON;b.appendChild(ico);th.appendChild(b);
    });
    applySort(table);
  }
  function scan(root){(root||document).querySelectorAll('table').forEach(decorate)}
  document.addEventListener('click',e=>{
    const b=e.target.closest('button.th-sort');if(!b)return;
    const table=b.closest('table'),col=Number(b.dataset.sortCol),sig=signature(table),cur=states.get(sig);
    if(!cur||cur.col!==col)states.set(sig,{col,dir:'asc'});else if(cur.dir==='asc')states.set(sig,{col,dir:'desc'});else states.delete(sig);
    if(table.dataset.sortPage){deskState(table.dataset.sortPage).page=1;return render()}
    const pager=table.closest('.panel,.desk-panel')?.querySelector('[data-desk-key]');
    if(pager&&typeof deskState==='function'){const s=deskState(pager.dataset.deskKey);if(s.size<1000){s.size=1000;s.page=1;if(typeof render==='function')return render()}}
    applySort(table);
  });
  let queued=false;
  const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;observer.disconnect();try{scan()}finally{observer.observe(document.body,{childList:true,subtree:true})}})});
  function start(){scan();observer.observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
