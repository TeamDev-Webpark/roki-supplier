'use strict';
/* Company presentation only. Workflow keys, portal URLs and saved records keep their existing IDs. */
window.CompanyBrand={
  name:'WEBPARK',
  // Original supplied logo files, shared by both portals.
  logoHorizontal:'assets/Logo Webpark Horizental.png',
  logoVertical:'assets/Logo Webpark Vertical.png',
  text(value){
    return typeof value==='string'?value.replace(/\broki\b/gi,'WEBPARK').replace(/โรกิ|โรกี|โรกี้/g,'WEBPARK'):value;
  }
};
