import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const key='garderyob-rooms-v1:carcass-1911';
 await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5197/')+'?rooms=1&workspace=carcass-1911');
 await page.getByRole('button',{name:'Добавить первый шкаф',exact:true}).click();
 await page.evaluate(key=>{const d=JSON.parse(localStorage.getItem(key));const first=d.rooms[0].project.modules[0];d.rooms[0].project.room.width=5000;d.rooms[0].project.modules=[0,1,2].map(i=>({...structuredClone(first),id:'carcass-'+i,x:100+i*700,z:500,module:{...structuredClone(first.module),decor:i===1?'Белый':'Дуб Ботан',facadeDecor:'Белый',drawerFacadeDecor:'Белый'}}));const top=structuredClone(first);top.id='top';top.x=2500;top.module={...top.module,name:'Столешница',width:1200,height:38,depth:600,doors:false,feet:undefined,plinthHeight:0,backType:'none',worktop:{material:'postforming',thickness:38,overhang:24,cutouts:[]}};d.rooms[0].project.modules.push(top);localStorage.setItem(key,JSON.stringify(d));},key);
 await page.reload();await page.getByRole('button',{name:'Построение мебели',exact:true}).click();
 const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).rooms[0].project.modules,key);
 const before=await read();
 await page.keyboard.press('Escape');
 const change=async()=>{await page.getByRole('button',{name:'Цвет всех каркасов ЛДСП',exact:true}).click();await expect(page.getByRole('heading',{name:'Цвет всех каркасов ЛДСП',exact:true})).toBeVisible();await page.getByRole('textbox',{name:'Найти декор',exact:true}).fill('Графит');await page.screenshot({path:'reports/carcass-picker-1911.png'});await page.locator('.decor-grid button').filter({hasText:'Графит'}).first().click();};
 await change();
 await expect.poll(async()=>(await read()).slice(0,3).map(a=>a.module.decor)).toEqual(['Графит','Графит','Графит']);
 let after=await read();for(let i=0;i<3;i++){expect(after[i].module.facadeDecor).toBe(before[i].module.facadeDecor);expect(after[i].module.drawerFacadeDecor).toBe(before[i].module.drawerFacadeDecor);}expect(after[3].module).toEqual(before[3].module);
 await page.getByRole('button',{name:'Отменить',exact:true}).click();await expect.poll(async()=>(await read()).map(a=>a.module.decor)).toEqual(before.map(a=>a.module.decor));
 await change();await page.reload();await expect.poll(async()=>(await read()).slice(0,3).map(a=>a.module.decor)).toEqual(['Графит','Графит','Графит']);
 await page.getByRole('button',{name:'Построение мебели',exact:true}).click();
 await page.screenshot({path:'reports/carcass-applied-1911.png'});
 await page.evaluate(key=>{const d=JSON.parse(localStorage.getItem(key)),p=d.rooms[0].project;p.modules=[p.modules[3],...p.modules.slice(0,3)];localStorage.setItem(key,JSON.stringify(d));},key);
 await page.reload();await page.getByRole('button',{name:'Построение мебели',exact:true}).click();await change();
 await expect.poll(async()=>(await read()).slice(1).map(a=>a.module.decor)).toEqual(['Графит','Графит','Графит']);
 expect((await read())[0].module).toEqual(before[3].module);
 console.log('PASS: global carcass picker without selection; all 3 changed; facade/drawer/worktop unchanged; one undo; saved and reopened');
}finally{await browser.close();}
