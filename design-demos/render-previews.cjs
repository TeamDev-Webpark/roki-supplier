'use strict';
/* Regenerates the reference screenshots in previews/ from the running demo (English and Thai). */
const {run,reset,login}=require('./_env.cjs');
run('render-previews',async({base,context,shot})=>{
  const page=await context.newPage();
  await reset(page,base,'roki');
  for(const lang of ['en','th']){
    await page.evaluate(l=>localStorage.setItem('roki-lang',l),lang);
    const sfx=lang==='th'?'-th':'';
    await login(page,base,'roki','r-check','quote/Q-2025-0041');await page.reload();await page.locator('.compare-table').waitFor();await shot(page,`roki-comparison-quotation${sfx}.png`);
    await page.goto(base+'roki.html#print/Q-2026-0046');await page.reload();await page.locator('.qt-form').waitFor();await shot(page,`roki-print-quotation${sfx}.png`);
    await page.goto(base+'roki.html#reports/17253-KWN-9000');await page.reload();await page.locator('.price-chart').waitFor();await shot(page,`roki-price-history${sfx}.png`);
    await page.goto(base+'roki.html#quote/Q-2026-0105');await page.reload();await page.locator('.compare-table').waitFor();await shot(page,`roki-assembly-quotation${sfx}.png`);
  }
});
