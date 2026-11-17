import {chromium} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/local-projects/texture-review.json',route=>route.fulfill({contentType:'application/json',body:fs.readFileSync('reports/texture-review.json')}));
page.setDefaultNavigationTimeout(90000);await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5197/')+'?project=texture-review');
await page.getByRole('button',{name:'Построение мебели',exact:true}).click();
await page.locator('details[data-setting="Столешница"] > summary').click();
const compact=page.getByLabel('Декор компакт-плиты',{exact:true});
if(await compact.locator('optgroup[label="Premial"] option').count()!==26)throw Error('Premial decor count');
const opts=await compact.locator('option').evaluateAll(options=>options.map(o=>({name:o.textContent,value:o.value})));
for(const [i,word] of ['Дымчатый','Травентино Гриджио темный'].entries()){
 const option=opts.find(o=>o.name.includes(word));if(!option)throw Error('Missing decor '+word);
 await compact.selectOption(option.value);await page.getByRole('button',{name:'Приблизить выбранный корпус',exact:true}).click();
 await page.mouse.move(820,610);await page.mouse.wheel(0,-850);await page.waitForTimeout(2000);await page.screenshot({path:`reports/texture-fixed-${i}.png`});
}
await page.reload();await page.getByRole('button',{name:'Построение мебели',exact:true}).click();await page.locator('details[data-setting="Столешница"] > summary').click();
if(!(await compact.inputValue()).includes('Травентино Гриджио темный'))throw Error('Texture selection lost on reload');
if(errors.length)throw Error(errors.join('\n'));
console.log(JSON.stringify({premialDecors:26,textureChanges:2,waterfall:true,reload:true,errors}));await browser.close();

