import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1400,height:900}});let apiRequests=0;
 page.on('request',r=>{if(r.url().includes('/api/studio/assistant'))apiRequests++;});
 await page.goto('https://keppochka-nwr.github.io/shkaf-konstruktor/studio/?rooms=1&workspace=assistant-public-check-1811');
 await page.getByRole('button',{name:'Помощник · анализ ДП',exact:true}).click();
 const pane=page.getByLabel('Помощник конструктора',{exact:true});
 await expect(pane.getByText('На этой публичной странице помощник не подключён. Откройте серверную версию конструктора и войдите в кабинет.',{exact:true})).toBeVisible();
 await pane.getByLabel('Сообщение помощнику',{exact:true}).fill('Черновик');
 await expect(pane.getByRole('button',{name:'Отправить',exact:true})).toBeDisabled();
 await expect(pane.getByRole('button',{name:'Войти в кабинет',exact:true})).toHaveCount(0);
 if(apiRequests)throw Error('Public page contacted missing assistant API');
 await page.screenshot({path:'reports/assistant-public-1811.png'});
 console.log(JSON.stringify({publicExplanation:true,noMisleadingLogin:true,sendDisabled:true,apiRequests}));
} finally {await browser.close();}
