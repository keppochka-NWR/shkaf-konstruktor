import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
const page=await browser.newPage({viewport:{width:1600,height:1000}});let signed=false,expired=false,posts=0,offline=false;
await page.route('**/api/studio/**',async route=>{
 const path=new URL(route.request().url()).pathname;
 if(path.endsWith('/auth/login')) { signed=true;return route.fulfill({json:{email:'test',login:'test',name:'Test',role:'admin',active:true}}); }
 if(path.endsWith('/assistant/status'))return route.fulfill({status:offline?404:signed?200:401,json:signed?{configured:true,ownerPilot:true}:{detail:'Войдите в кабинет.'}});
 if(path.includes('/assistant/history/'))return route.fulfill({json:{messages:[]}});
 if(path.endsWith('/assistant')){posts++;if(expired){signed=false;return route.fulfill({status:401,json:{detail:'Войдите в кабинет.'}});}return route.fulfill({json:{message:'Проверка пройдена',warnings:[],questions:[],rooms:[],furniture:[]}});}
 return route.fulfill({status:404,json:{detail:'not found'}});
});
await page.goto('http://127.0.0.1:5197/?rooms=1&workspace=assistant-access-test');
await page.getByRole('button',{name:'Помощник · анализ ДП',exact:true}).click();
const pane=page.getByLabel('Помощник конструктора',{exact:true}), input=pane.getByLabel('Сообщение помощнику',{exact:true}), send=pane.getByRole('button',{name:'Отправить',exact:true});
await input.fill('Черновик с вложением');
await pane.locator('input[type=file]').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
await expect(send).toBeDisabled();await pane.getByRole('button',{name:'Войти в кабинет',exact:true}).click();
await pane.getByLabel('Логин',{exact:true}).fill('test');await pane.getByLabel('Пароль',{exact:true}).fill('test');await pane.getByRole('button',{name:'Войти',exact:true}).click();
await expect(send).toBeEnabled();await expect(input).toHaveValue('Черновик с вложением');await expect(pane.getByRole('button',{name:'Убрать вложение test.pdf',exact:true})).toBeVisible();
await send.click();await expect(pane.getByText('Проверка пройдена',{exact:true})).toBeVisible();
expired=true;await input.fill('Сохрани при истечении сессии');await send.click();await expect(input).toHaveValue('Сохрани при истечении сессии');await expect(send).toBeDisabled();await expect(pane.locator('.yo-chat-user')).toHaveCount(1);
await pane.getByRole('button',{name:'Войти в кабинет',exact:true}).click();await pane.getByLabel('Пароль',{exact:true}).fill('test');await pane.getByRole('button',{name:'Войти',exact:true}).click();await expect(send).toBeEnabled();
expired=false;await send.click();await expect(pane.locator('.yo-chat-user')).toHaveCount(2);
offline=true;await pane.getByRole('button',{name:'Закрыть помощника'}).click();await page.getByRole('button',{name:'Помощник · анализ ДП',exact:true}).click();await expect(pane.getByText('Сервер помощника недоступен. Повторите проверку подключения.',{exact:true})).toBeVisible();await expect(send).toBeDisabled();
offline=false;await pane.getByRole('button',{name:'Проверить подключение',exact:true}).click();await expect(pane.getByText('Astra · пилот для владельца',{exact:true})).toBeVisible();
await page.screenshot({path:'reports/assistant-access-1811.png'});console.log(JSON.stringify({login:true,draftAndAttachmentRetained:true,expiredSessionRetry:true,noDuplicateFailedMessages:true,offlineRetry:true,posts}));
} finally {await browser.close();}

