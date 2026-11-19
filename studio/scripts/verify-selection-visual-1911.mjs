import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultNavigationTimeout(90000);
 await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5197/')+'?rooms=1&workspace=selection-1911');
 await page.getByRole('button',{name:'Добавить первый шкаф',exact:true}).click();
 await page.evaluate(()=>{const key='garderyob-rooms-v1:selection-1911',d=JSON.parse(localStorage.getItem(key));const first=d.rooms[0].project.modules[0];d.rooms[0].project.room.width=5000;d.rooms[0].project.modules=[0,1,2].map(i=>({...structuredClone(first),id:'selection-'+i,x:100+i*first.module.width,z:500}));localStorage.setItem(key,JSON.stringify(d));});
 await page.reload();await page.getByRole('button',{name:'Построение мебели',exact:true}).click();
 await page.getByRole('button',{name:'Спереди',exact:true}).click();
 await page.getByRole('button',{name:'Приблизить выбранный корпус',exact:true}).click();
 const dims=page.getByRole('button',{name:'Показать размеры',exact:true});if(await dims.getAttribute('aria-pressed')==='true')await dims.click();
 await page.waitForTimeout(700);
 const canvas=page.locator('.scene canvas'),box=await canvas.boundingBox();await canvas.click({position:{x:box.width/2,y:box.height/2}});
 await expect(page.getByRole('status',{name:'Выбранная деталь',exact:true})).toBeVisible();
 await page.screenshot({path:'reports/selection-detail-1911b.png'});await page.keyboard.press('Tab');await page.screenshot({path:'reports/selection-module-1911b.png'});await page.keyboard.press('Tab');await page.screenshot({path:'reports/selection-group-1911b.png'});console.log('visual stages captured');process.exitCode=0;
}finally{await browser.close();}
