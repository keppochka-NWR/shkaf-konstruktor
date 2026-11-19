import {chromium,expect} from '@playwright/test';import fs from 'node:fs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});const base=process.env.REVIEW_URL||'http://127.0.0.1:5197/';
 await page.goto(base+'?rooms=1&workspace=default-premial-1911');await page.getByRole('button',{name:'Добавить первый шкаф',exact:true}).click();
 await page.getByRole('button',{name:'Построение мебели',exact:true}).click();await page.getByRole('checkbox',{name:'Все настройки',exact:true}).check();
 const guides=page.locator('select[aria-label="Направляющие ящика"]').first();
 for(const el of await guides.locator('xpath=ancestor::details').all())if(await el.getAttribute('open')===null)await el.locator('summary').first().click();
 await expect(guides).toHaveValue('hidden-premial-soft');await page.screenshot({path:'reports/premial-default-1911.png'});
 await page.reload();await page.getByRole('button',{name:'Построение мебели',exact:true}).click();for(const el of await guides.locator('xpath=ancestor::details').all())if(await el.getAttribute('open')===null)await el.locator('summary').first().click();await expect(guides).toHaveValue('hidden-premial-soft');
 await page.route('**/local-projects/maestro-1911.json',r=>r.fulfill({json:JSON.parse(fs.readFileSync('reports/maestro-1911.json','utf8'))}));
 await page.goto(base+'?project=maestro-1911');await page.getByRole('button',{name:'Построение мебели',exact:true}).click();
 await page.locator('.properties').getByText('Наполнение',{exact:true}).click();await page.getByText('Ящики Premial МАЭСТРО 7D',{exact:true}).click();
 const system=page.getByRole('combobox',{name:'Система ящиков',exact:true});await expect(system).toHaveValue('maestro-7d');await expect(system.locator('option[value="indigo"]')).toHaveCount(0);
 console.log('PASS: ordinary drawers default Premial soft-close and reload; kitchen Maestro default; Indigo not offered');
}finally{await browser.close();}
