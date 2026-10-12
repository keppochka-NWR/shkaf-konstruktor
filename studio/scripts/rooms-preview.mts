import {chromium} from '@playwright/test';
import {newProject} from '../src/project';
import {migrateRoomDocument,ROOM_DOCUMENT_KEY} from '../src/roomDocument';
const p=newProject();p.modules[0].x=500;p.modules[0].z=80;
p.room.openings=[{id:'window',type:'window',wall:'back',offset:2000,width:1200,height:1200,sill:900,reveal:150,windowSill:{width:1300,thick:30,overhang:100,offset:1950}}];
p.room.fixtures=[{id:'radiator',type:'radiator',wall:'back',offset:2150,fromFloor:150,width:900,height:500,depth:100,wallGap:30,serviceClearance:100},{id:'pipe',type:'pipe',wall:'left',offset:1600,fromFloor:0,width:45,height:2700,depth:45,diameter:25,insulation:10,round:true}];
p.room.survey={notes:'Контрольный пример, не заказ клиента',readings:[],surfaces:{back:{datum:'Лазерная плоскость',u:[0,2000,4000],v:[0,1350,2700],offsets:[[0,0,0],[20,30,10],[50,80,30]],measured:[[true,true,true],[true,true,true],[true,true,true]]}}};
const document=migrateRoomDocument(p),browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(({document,key})=>localStorage.setItem(key,JSON.stringify(document)),{document,key:ROOM_DOCUMENT_KEY});await page.goto('http://127.0.0.1:5185/?rooms=1');await page.locator('canvas').waitFor();await page.screenshot({path:'reports/rooms-3d-preview.png',fullPage:true});console.log(JSON.stringify({pageErrors:errors}));await browser.close();
