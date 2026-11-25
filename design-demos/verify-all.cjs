'use strict';
/* Runs every browser check. Usage: npm install && npm run verify   (set CHROME_PATH if Chrome/Edge is not found,
   or BASE_URL to test an already running server). */
const {spawnSync}=require('node:child_process');
// Direct sourcing replaces the earlier pre-send approval workflow.
const checks=['verify-view-consistency','verify-sidebar-navigation','verify-request-drawings','verify-direct-sourcing','verify-approval-handoff','verify-queue-topup','verify-first-cycle','verify-demo-fill','verify-quote-fill','verify-quote-preview','verify-schedule-register','verify-sourcing-pages','verify-operations-desk','verify-document-details','verify-supplier-request-policy','verify-demo-reset','verify-formula-categories','verify-customer-sheets','verify-bom-links','verify-request-details','verify-formula-library','verify-fixed-fields','verify-table-sort','verify-report-center'];
let failed=0;
for(const name of checks){
  const r=spawnSync(process.execPath,[`${__dirname}/${name}.cjs`],{stdio:'inherit'});
  if(r.status!==0){failed++;console.error('FAIL '+name)}
}
console.log(failed?`\n${failed} of ${checks.length} checks failed`:`\nAll ${checks.length} checks passed`);
process.exit(failed?1:0);
