import {chromium,expect} from '@playwright/test';import fs from 'node:fs';
const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultNavigationTimeout(90000);
 await page.route('**/local-projects/corner-1911.json',r=>r.fulfill({json:JSON.parse(fs.readFileSync('reports/corner-1911.json','utf8'))}));
 await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5197/')+'?project=corner-1911');await page.getByRole('button',{name:'Построение мебели',exact:true}).click();
 const repair=page.getByRole('button',{name:'Убрать планки стыков верхних модулей',exact:true});await expect(repair).toBeVisible();await repair.click();await expect(repair).toHaveCount(0);
 await page.getByRole('button',{name:'Отменить',exact:true}).click();await expect(repair).toBeVisible();await repair.click();await page.reload();await page.getByRole('button',{name:'Построение мебели',exact:true}).click();await expect(repair).toHaveCount(0);
 await page.waitForTimeout(1200);await page.screenshot({path:'reports/corner-fixed-1911.png'});console.log(JSON.stringify({legacyRepair:true,undo:true,reload:true}));
}finally{await browser.close();}
