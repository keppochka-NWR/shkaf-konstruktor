import {chromium,expect} from '@playwright/test';import fs from 'node:fs';
const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/local-projects/maestro-1911.json',r=>r.fulfill({json:JSON.parse(fs.readFileSync('reports/maestro-1911.json','utf8'))}));
 await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5197/')+'?project=maestro-1911');await page.getByRole('button',{name:'Построение мебели',exact:true}).click();
 await page.locator('.properties').getByText('Наполнение',{exact:true}).click();await page.getByText('Ящики Premial МАЭСТРО 7D',{exact:true}).click();
 const system=page.getByRole('combobox',{name:'Система ящиков',exact:true});await expect(system).toHaveValue('maestro-7d');
 await page.getByRole('combobox',{name:'Цвет МАЭСТРО',exact:true}).selectOption('grey');
 await page.screenshot({path:'reports/maestro-grey-1911.png'});
 await system.selectOption('axis-pro');await expect(page.getByRole('combobox',{name:'Цвет Axis PRO',exact:true})).toBeVisible();
 await system.selectOption('maestro-7d');await page.getByRole('combobox',{name:'Цвет МАЭСТРО',exact:true}).selectOption('grey');
 await page.reload();await page.getByRole('button',{name:'Построение мебели',exact:true}).click();await page.locator('.properties').getByText('Наполнение',{exact:true}).click();await page.getByText('Ящики Premial МАЭСТРО 7D',{exact:true}).click();await expect(system).toHaveValue('maestro-7d');await expect(page.getByRole('combobox',{name:'Цвет МАЭСТРО',exact:true})).toHaveValue('grey');
 await page.getByRole('button',{name:'Открыть фасады',exact:true}).click();await page.waitForTimeout(600);await page.screenshot({path:'reports/maestro-open-1911.png'});expect(errors).toEqual([]);console.log('Maestro UI system/color/switch/reload/open PASS');
}finally{await browser.close();}
