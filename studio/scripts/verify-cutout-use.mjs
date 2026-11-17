import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,channel:"chrome"});const page=await browser.newPage({viewport:{width:1600,height:1000}});
if(process.env.FIXTURE_ROOT){const {readFileSync}=await import('node:fs');const {join}=await import('node:path');await page.route('**/local-projects/*.json',route=>route.fulfill({contentType:'application/json',body:readFileSync(join(process.env.FIXTURE_ROOT,new URL(route.request().url()).pathname.split('/').pop()))}));}
await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5197/')+'?project=kitchen-cut-repair-review');
await page.getByRole('button',{name:'Дальше: Построение мебели',exact:true}).click();
await page.locator('details[data-setting="Столешница"] > summary').click();
await page.getByRole('button',{name:'Убрать',exact:true}).click();
await page.waitForTimeout(300);
if(await page.getByLabel('Модель мойки',{exact:true}).count())throw Error('Delete failed: '+await page.locator('body').innerText());
await page.getByRole('button',{name:'Отменить',exact:true}).click();
await page.getByLabel('Модель мойки',{exact:true}).waitFor();
const left=page.getByLabel('Вырез 1: Слева',{exact:true});await left.fill('720');await left.press('Enter');
await page.waitForTimeout(300);if(await left.inputValue()!=='720')throw Error('offset not applied');
const rect=page.getByRole('button',{name:'Передвинуть вырез',exact:true});await rect.scrollIntoViewIfNeeded();const box=await rect.boundingBox();
await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2,{steps:12});await page.mouse.up();await page.waitForTimeout(300);
const moved=await left.inputValue();if(moved==='720')throw Error('Drag did not apply');
for(const [side,value] of [['Справа','1000'],['Сзади','110'],['Спереди','100']]){
 const field=page.getByLabel('Вырез 1: '+side,{exact:true});await field.fill(value);await field.press('Enter');await page.waitForTimeout(200);
 if(await field.inputValue()!==value)throw Error('Offset failed: '+side);
}
const snap=page.getByLabel('Привязка выреза 1',{exact:true});await snap.selectOption('0');await page.waitForTimeout(200);
await page.getByLabel('Модель мойки',{exact:true}).selectOption('89337703');await page.waitForTimeout(200);
if(await page.getByLabel('Модель мойки',{exact:true}).inputValue()!=='89337703')throw Error('Lemana selection failed');
await page.getByLabel('Модель мойки',{exact:true}).selectOption('210217');await page.waitForTimeout(300);
if(await page.getByLabel('Модель мойки',{exact:true}).inputValue()!=='210217')throw Error('Model not changed');
await page.reload();
if(await page.getByRole('button',{name:'Дальше: Построение мебели',exact:true}).count())await page.getByRole('button',{name:'Дальше: Построение мебели',exact:true}).click();
await page.locator('details[data-setting="Столешница"] > summary').click();
if(await page.getByLabel('Модель мойки',{exact:true}).inputValue()!=='210217')throw Error('Reload lost model');
await page.getByRole('button',{name:'Передвинуть вырез',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'reports/cutout-repair-use.png'});
console.log(JSON.stringify({delete:true,undo:true,offset:720,dragTo:moved,model:'210217',reload:true,options:await page.getByLabel('Модель мойки',{exact:true}).locator('option').count()}));await browser.close();


