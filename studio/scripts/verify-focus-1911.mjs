import {chromium,expect} from '@playwright/test';import fs from 'node:fs';
const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/local-projects/focus-review.json',r=>r.fulfill({json:JSON.parse(fs.readFileSync('reports/focus-review.json','utf8'))}));
 await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5197/')+'?project=focus-review');await page.getByRole('button',{name:'Построение мебели',exact:true}).click();
 await page.locator('.properties').getByText('Наполнение',{exact:true}).click();
 const select=page.locator('select[aria-label="Выкатная корзина"]');
 async function show(){for(const d of await select.locator('xpath=ancestor::details').all())if(await d.getAttribute('open')===null)await d.locator('summary').first().click();}
 await show();await select.selectOption('090535');await expect(select).toHaveValue('090535');console.log(await select.locator('option').evaluateAll(xs=>xs.map(x=>({value:x.value,disabled:x.disabled,text:x.textContent}))));await expect(select.locator('option[value="090537"]')).toHaveAttribute('disabled','');
 await page.getByRole('button',{name:'Скрыть фасады',exact:true}).click();await page.getByRole('button',{name:'Приблизить выбранный корпус',exact:true}).click();await page.keyboard.press('Escape');await page.screenshot({path:'reports/focus-review-installed.png'});
 await page.reload();await page.getByRole('button',{name:'Построение мебели',exact:true}).click();await show();await expect(select).toHaveValue('090535');
 await select.selectOption('');await expect(select).toHaveValue('');await page.getByRole('button',{name:'Отменить',exact:true}).click();await expect(select).toHaveValue('090535');
 expect(errors).toEqual([]);console.log('FOCUS: install, incompatible width disabled, reload, remove, undo PASS');
}finally{await browser.close();}
