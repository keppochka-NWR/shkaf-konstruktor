import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const b=await chromium.launch({headless:true,channel:'chrome'});
try{
 const p=await b.newPage({viewport:{width:1500,height:1050}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.TEST_BASE||'http://127.0.0.1:5213/facades-app/',{waitUntil:'networkidle',timeout:60000});
 await p.locator('[name="family"]').selectOption('MDF');await p.locator('#designChoice').click();await p.locator('[data-choice="98"]').click();
 await expect(p.locator('#drawing [data-source="studio"]')).toHaveCount(1);
 await expect(p.locator('#parts [data-source="studio"]')).toHaveCount(1);
 await expect(p.locator('#drawing [data-passport-sample]')).toHaveCount(0);
 await p.locator('#colorChoice').click();await p.locator('#galleryGrid button').first().click();
 await p.screenshot({path:'reports/milling-2111-standard.png',fullPage:true});
 const original=await p.locator('#drawing [data-source="studio"]').innerHTML();
 await p.locator('[name="w"]').fill('300');await p.locator('[name="w"]').press('Tab');
 await p.locator('[name="h"]').fill('1800');await p.locator('[name="h"]').press('Tab');
 await expect(p.locator('#drawing [data-source="studio"]')).toHaveAttribute('data-width-mm','300');
 await expect(p.locator('#drawing [data-source="studio"]')).toHaveAttribute('data-height-mm','1800');
 expect(await p.locator('#drawing [data-source="studio"]').innerHTML()).not.toBe(original);
 await p.screenshot({path:'reports/milling-2111-tall.png',fullPage:true});
 await p.locator('#back').click();await expect(p.locator('#drawing [data-source="studio"]')).toHaveCount(0);await p.locator('#front').click();
 const download=p.waitForEvent('download');await p.locator('#save').click();await (await download).saveAs('reports/milling-2111.json');
 await p.reload({waitUntil:'networkidle'});await expect(p.locator('#drawing [data-source="studio"]')).toHaveAttribute('data-height-mm','1800');
 await p.locator('#file').setInputFiles('reports/milling-2111.json');await p.locator('#quote').click();
 await expect(p.frameLocator('#quoteFrame').locator('[data-source="studio"]')).toHaveCount(2);
 const quote=p.waitForEvent('download');await p.locator('#downloadQuote').click();await (await quote).saveAs('reports/milling-2111-quote.html');
 const html=fs.readFileSync('reports/milling-2111-quote.html','utf8');expect(html).toContain('data-source="studio"');expect(html).not.toContain('data-passport-sample');expect(html).not.toContain('<script');
 expect(errors).toEqual([]);console.log('PASS #98 on facade and thumbnail, physical resize, film, rear separation, reload, downloaded project and standalone quote',p.url());
}finally{await b.close()}
