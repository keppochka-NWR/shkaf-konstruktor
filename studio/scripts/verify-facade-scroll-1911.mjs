import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5197/')+'?rooms=1&workspace=facade-scroll-1911');
 await page.getByRole('button',{name:'Добавить первый шкаф',exact:true}).click();
 await page.getByRole('button',{name:'Построение мебели',exact:true}).click();
 const adv=page.getByRole('checkbox',{name:'Все настройки',exact:true});await adv.check();
 const open=page.locator('[data-search="facade-decor"]');
 for(const el of await open.locator('xpath=ancestor::details').all()){if(!await el.getAttribute('open'))await el.locator('summary').first().click();}
 await open.click();
 for(const size of [{width:1366,height:768},{width:1024,height:600}]){
 await page.setViewportSize(size);
 for(const brand of ['AGT','Eterno']){
 const region=page.getByRole('region',{name:'Каталог и настройки фасадов'});
 await page.getByRole('combobox',{name:'Основа фасадов',exact:true}).selectOption(brand);
 const before=await region.evaluate(e=>({h:e.clientHeight,s:e.scrollHeight}));expect(before.s).toBeGreaterThan(before.h);
 await region.hover();await page.mouse.wheel(0,100000);await expect.poll(()=>region.evaluate(e=>e.scrollTop)).toBeGreaterThan(100);
 const last=region.locator('.decor-grid button:not(:disabled)').last();await expect(last).toBeInViewport();await last.click();await expect(last).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Применить к корпусу',exact:true})).toBeInViewport();await expect(page.getByRole('button',{name:'Отмена',exact:true})).toBeInViewport();
 await page.screenshot({path:`reports/facade-scroll-${brand}-${size.height}.png`});
 await region.hover();await page.mouse.wheel(0,-100000);await expect(page.getByRole('combobox',{name:'Основа фасадов',exact:true})).toBeInViewport();
 }
 }
 await page.getByRole('button',{name:'Применить к корпусу',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 console.log('PASS: AGT/Eterno wheel to last decor and back; select last; Apply/Cancel visible at 1366x768 and 1024x600; Apply closes');
}finally{await browser.close();}
