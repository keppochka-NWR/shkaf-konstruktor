import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const b=await chromium.launch({channel:'chrome'});try{
const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.TEST_URL||'http://127.0.0.1:5222/facades-app/',{waitUntil:'networkidle'});
const family=p.locator('[name="family"]');await family.selectOption('MDF');const choose=async(mode,id)=>{await p.locator('#'+mode+'Choice').click();await p.locator('[data-choice="'+id+'"]').click();};
await choose('design','98');await choose('color','0');const field=name=>p.locator('[name="'+name+'"]');await field('t').fill('19');await field('t').press('Tab');const total=p.locator('#grandTotal');
const val=async()=>Number((await total.innerText()).replace(/[^0-9]/g,''));expect(await val()).toBe(6500);
await field('w').fill('300');expect(await val()).toBe(4500);await field('w').press('Tab');await field('qty').fill('2');await field('qty').press('Tab');expect(await val()).toBe(9100);
await choose('color',await p.evaluate(()=>FACADE_CATALOG.films.find(f=>f.category==='5').id));expect(await val()).not.toBe(9100);
const downloaded=p.waitForEvent('download');await p.locator('#save').click();const order=JSON.parse(fs.readFileSync(await(await downloaded).path(),'utf8'));order.parts[0].drilling={enabled:true,side:'left',center:22,diameter:35,depth:12,ys:[100,616]};await p.locator('#file').setInputFiles({name:'check.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(order))});await expect(p.locator('#drawing [data-projected-hole]')).toHaveCount(2);const cost=await total.innerText();await p.locator('#quote').click();await expect(p.frameLocator('#quoteFrame').locator('body')).toContainText(cost);await expect(p.frameLocator('#quoteFrame').locator('body')).toContainText('Присадка чашек петель');expect(errors).toEqual([]);console.log('PASS base 6500, resized 4500, qty 9100, film category switch, drilling front projection, quote',cost);
}finally{await b.close()}
