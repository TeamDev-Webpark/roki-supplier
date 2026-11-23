'use strict';
/* Thai / English switch.
   The app renders English templates; this layer translates the DOM after each render, so data values
   (part numbers, supplier names, user-entered remarks) are never changed, and switching back to English
   just re-renders. Strings are matched exactly, then by pattern, then piece by piece around " · " and " / ".
   Add new UI text to dictionary/patterns in i18n-th.js. In Thai mode `window.__i18nMissing` lists text that is
   still untranslated (used by verify-i18n.cjs). */
(function(){
  const KEY='roki-lang';
  let lang='en';
  try{lang=localStorage.getItem(KEY)==='th'?'th':'en'}catch{}
  const TH=window.I18N_TH||{dict:{},patterns:[],months:{}};
  const dict=TH.dict,patterns=TH.patterns,months=TH.months;
  Object.assign(dict,{'WEBPARK | Purchasing Workspace':'WEBPARK | พื้นที่ทำงานฝ่ายจัดซื้อ','WEBPARK | Supplier Workspace':'WEBPARK | พื้นที่ทำงาน Supplier'});
  const missing=new Set();
  const monthRe=new RegExp('\\b(\\d{1,2}) ('+Object.keys(months).join('|')+')\\.? (\\d{4})\\b','g');
  const hasLatin=s=>/[A-Za-z]{3,}/.test(s);

  function translatePart(s){
    if(Object.prototype.hasOwnProperty.call(dict,s))return dict[s];
    const canonical=s.replace(/\bWEBPARK\b/g,'ROKI');
    if(canonical!==s){
      if(Object.prototype.hasOwnProperty.call(dict,canonical))return dict[canonical];
      for(const [re,fn] of patterns){const m=re.exec(canonical);if(m)return fn(...m.slice(1))}
    }
    for(const [re,fn] of patterns){const m=re.exec(s);if(m)return fn(...m.slice(1))}
    return null;
  }
  function translateCore(core){
    let out=translatePart(core);
    if(out!==null)return out;
    for(const sep of [' · ',' / ',' — ']){
      if(core.includes(sep)){
        const parts=core.split(sep).map(p=>translateCore(p));
        if(parts.some((p,i)=>p!==core.split(sep)[i]))return parts.join(sep);
      }
    }
    return core;
  }
  function t(str){
    if(typeof str!=='string')return str;
    if(lang!=='th')return CompanyBrand.text(str);
    const m=/^(\s*)([\s\S]*?)(\s*)$/.exec(str);
    if(!m[2]||m[2]===CompanyBrand.name||/^(?:N|RFQ)-[A-Za-z0-9-]+$/.test(m[2]))return str;
    let core=translateCore(m[2]);
    core=core.replace(monthRe,(_,d,mo,y)=>`${d} ${months[mo]} ${y}`);
    if(core===m[2]&&hasLatin(core)&&!/[฀-๿]/.test(core)&&!/^[\w.+-]+@[\w.-]+$/.test(core))missing.add(core);
    return CompanyBrand.text(m[1]+core+m[3]);
  }
  const ATTRS=['placeholder','aria-label','title','alt'];
  function apply(root){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
    let n=root.nodeType===1?root:walker.nextNode();
    while(n){
      const el=n.nodeType===1?n:n.parentElement;
      if(el?.closest('[data-i18n-skip]')){n=walker.nextNode();continue}
      if(n.nodeType===3){
        const p=n.parentNode&&n.parentNode.nodeName;
        if(p!=='SCRIPT'&&p!=='STYLE'){const v=t(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v}
      }else if(n.nodeType===1){
        for(const a of ATTRS){const v=n.getAttribute(a);if(v){const tv=t(v);if(tv!==v)n.setAttribute(a,tv)}}
        if(n.tagName==='INPUT'&&n.readOnly&&n.type==='text'){const tv=t(n.value);if(tv!==n.value)n.value=tv}
      }
      n=walker.nextNode();
    }
  }
  function setLang(l){
    lang=l==='th'?'th':'en';
    try{localStorage.setItem(KEY,lang)}catch{}
    document.documentElement.lang=lang;
    if(typeof closeDialog==='function')closeDialog();
    /* keep what is being typed in the quotation form across the re-render */
    const keep={};['remark','effective','quantity','drawing'].forEach(id=>{const el=document.getElementById(id);if(el)keep[id]=el.value});
    if(typeof render==='function')render();
    for(const id in keep){const el=document.getElementById(id);if(el)el.value=keep[id]}
    const base=document.body.dataset.title||document.title;document.title=t(base);
  }
  function switcher(){
    return `<div class="lang-switch" role="group" aria-label="Language / ภาษา">${['en','th'].map(l=>`<button type="button" data-lang="${l}" class="${lang===l?'active':''}" aria-pressed="${lang===l}" lang="${l}">${l==='en'?'EN':'ไทย'}</button>`).join('')}</div>`;
  }
  document.documentElement.lang=lang;
  document.addEventListener('click',e=>{const b=e.target.closest('[data-lang]');if(b&&b.dataset.lang!==lang){e.stopPropagation();setLang(b.dataset.lang)}},true);
  /* translate anything added after the initial render: render(), dialogs, toasts */
  const start=()=>{
    if(!document.body.dataset.title)document.body.dataset.title=document.title;
    document.title=t(document.body.dataset.title);
    apply(document.body);
    new MutationObserver(list=>{for(const m of list)for(const node of m.addedNodes){if(node.nodeType===1)apply(node);else if(node.nodeType===3&&node.parentNode){const v=t(node.nodeValue);if(v!==node.nodeValue)node.nodeValue=v}}}).observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.I18N={lang:()=>lang,set:setLang,t,apply,switcher,missing};
  window.__i18nMissing=missing;
})();
