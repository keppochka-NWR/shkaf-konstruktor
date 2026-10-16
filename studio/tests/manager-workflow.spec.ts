import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function furniture(page:Page){await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();}
async function add(page:Page,kind:string){if(/кухонный|Столешница|Кухня/.test(kind))await page.getByRole('tab',{name:'Кухонные модули',exact:true}).click();await page.getByRole('button',{name:kind,exact:true}).click();await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();}
async function state(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project);}
async function download(page:Page,name:string){const wait=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();const file=await wait;expect(await file.failure()).toBeNull();const bytes=await readFile((await file.path())!);expect(bytes.length).toBeGreaterThan(80);return {bytes,name:file.suggestedFilename()};}

test('palette: reduced base depth and expanded wall depth keep shelves inside with designed setbacks',async({page})=>{
 await page.goto('/');await page.getByRole('tab',{name:'Кухонные модули',exact:true}).click();await page.getByRole('button',{name:'Нижний кухонный',exact:true}).click();await page.getByLabel('Глубина новой мебели').fill('450');await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveCount(0);expect((await state(page)).modules[0].module.sections[0].shelfDepth).toBe(447.5);
 await furniture(page);await page.getByRole('tab',{name:'Кухонные модули',exact:true}).click();await page.getByRole('button',{name:'Навесной кухонный',exact:true}).click();await page.getByLabel('Глубина новой мебели').fill('450');await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveCount(0);expect((await state(page)).modules[1].module.sections[0].shelfDepth).toBe(428);
});
test('palette: entered worktop thickness is used in model and survives reload',async({page})=>{
 await page.goto('/');await add(page,'Нижний кухонный');await furniture(page);await page.getByRole('tab',{name:'Кухонные модули',exact:true}).click();await page.getByRole('button',{name:'Столешница',exact:true}).click();
 await page.getByLabel('Ширина новой мебели').fill('600');await page.getByLabel('Высота новой мебели').fill('50');await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);
 const top=(await state(page)).modules.find((a:any)=>a.module.worktop).module;expect(top.height).toBe(50);expect(top.worktop.thickness).toBe(50);await page.reload();expect((await state(page)).modules.find((a:any)=>a.module.worktop).module.height).toBe(50);
});
test('documents: each tab previews and downloads, archive contains a coherent project',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await add(page,'Стеллаж');await page.getByRole('button',{name:'Выдать документы',exact:true}).click();
 const panel=page.locator('.output-panel');
 // производственные документы выдаются с номером заказа (аудит магазина п.9)
 await panel.locator('.output-tabs').getByRole('button',{name:'Карты листов и деталировка',exact:true}).click();await expect(page.getByRole('button',{name:'Скачать комплект ZIP',exact:true})).toBeDisabled();
 await page.getByLabel('Номер заказа').fill('9990001');await page.getByLabel('Номер заказа').press('Enter');
 for(const [tab,button] of [['Карты листов и деталировка','Деталировка CSV'],['Расстановка','Скачать план (HTML)'],['Спецификация','Скачать HTML'],['Ведомость','Скачать ведомость (HTML для печати)'],['Бирки деталей','Скачать бирки (HTML для печати)'],['Стоимость','Скачать итоговую стоимость']]){
  await panel.locator('.output-tabs').getByRole('button',{name:tab,exact:true}).click();const result=await download(page,button);expect(result.bytes.toString()).not.toContain('NaN');
 }
 await panel.locator('.output-tabs').getByRole('button',{name:'Чертежи модулей',exact:true}).click();await expect(panel.locator('svg').first()).toBeVisible();
 await panel.getByRole('button',{name:'Коммерческое предложение',exact:true}).click();await page.getByLabel('Клиент для КП').fill('Проверка 10001');await page.getByLabel('Клиент для КП').press('Enter');await page.getByRole('button',{name:'Подставить текущую смету',exact:true}).click();
 await page.getByRole('button',{name:'Предпросмотр КП',exact:true}).click();await expect(page.frameLocator('iframe[title="Предпросмотр коммерческого предложения"]').getByText('Проверка 10001',{exact:false}).first()).toBeVisible();const quote=await download(page,'Скачать КП (HTML)');expect(quote.bytes.toString()).toContain('Проверка 10001');expect(quote.bytes.toString()).not.toContain('введена менеджером');
 await panel.locator('.output-tabs').getByRole('button',{name:'Ведомость',exact:true}).click();const zip=await download(page,'Скачать комплект ZIP');expect(zip.bytes.subarray(0,2).toString()).toBe('PK');expect(errors).toEqual([]);
});
test('client: copy project keeps room and furniture and changes remain independent; whole folder downloads',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Клиент',exact:true}).click();await page.getByLabel('Имя клиента или номер заказа').fill('10001');await page.getByLabel('Имя клиента или номер заказа').press('Enter');await page.getByRole('button',{name:'10001',exact:true}).click();
 await add(page,'Стеллаж');await page.getByRole('button',{name:'Ещё проект',exact:true}).click();await page.getByRole('menuitem',{name:/Копия этого проекта/}).click();await expect(page.getByRole('tablist',{name:'Проекты клиента'}).getByRole('tab')).toHaveCount(2);await expect(page.getByRole('tablist',{name:'Проекты клиента'}).getByRole('tab',{selected:true})).toContainText('вариант');
 await furniture(page);await page.getByRole('tab',{name:'Кухонные модули',exact:true}).click();await page.getByRole('button',{name:'Удалить выбранный модуль',exact:true}).click();await expect(page.getByRole('heading',{name:'Комната 1',exact:true})).toBeVisible();
 await page.getByRole('tablist',{name:'Проекты клиента'}).getByRole('tab').first().click();await expect(page.getByLabel('Название модуля')).toBeVisible();await page.getByRole('button',{name:'10001',exact:true}).click();const file=await download(page,'Скачать папку клиента');const bundle=JSON.parse(file.bytes.toString());expect(bundle).toBeTruthy();expect(file.bytes.toString()).toContain('10001');
 await page.getByRole('button',{name:'Новый клиент',exact:true}).click();await expect(page.getByRole('tablist',{name:'Проекты клиента'}).getByRole('tab')).toHaveCount(1);await expect(page.getByRole('heading',{name:'Комната 1',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('tablist',{name:'Проекты клиента'}).getByRole('tab')).toHaveCount(1);
});
test('room: window and door edit, invalid size rejection, download and import retain geometry',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Окно',exact:true}).click();
 await page.getByLabel('Стена проёма 1').selectOption('left');await page.getByLabel('Ширина проёма 1',{exact:true}).fill('1100');await page.getByLabel('Ширина проёма 1',{exact:true}).press('Enter');
 // Close the selected-object dialog, if opened by adding the window.
 const close=page.getByRole('button',{name:/Закрыть параметры/});if(await close.isVisible())await close.click();
 const before=(await state(page)).room;await page.getByLabel('Ширина пустой комнаты').fill('-1');await page.getByLabel('Ширина пустой комнаты').press('Enter');await expect(page.getByRole('alert').first()).toBeVisible();expect((await state(page)).room).toEqual(before);
 const file=await download(page,'Скачать все комнаты');await page.getByRole('button',{name:'Добавить комнату',exact:true}).click();await page.locator('.rooms-bar input[type=file]').setInputFiles({name:'rooms.json',mimeType:'application/json',buffer:file.bytes});await expect(page.getByLabel('Активная комната').locator('option')).toHaveCount(1);expect((await state(page)).room).toEqual(before);
});
test('quote: Escape cancels a draft instead of committing it',async({page})=>{
 await page.goto('/');await add(page,'Пустой шкаф');await page.getByRole('button',{name:'Выдать документы',exact:true}).click();await page.getByRole('button',{name:'Коммерческое предложение',exact:true}).click();
 const input=page.getByLabel('Клиент для КП');await input.fill('Uncommitted draft');await input.press('Escape');expect((await state(page)).offer?.customer||'').toBe('');
});

test('presentation downloads a real PNG file',async({page})=>{
 await page.goto('/');await add(page,'Пустой шкаф');await page.getByRole('button',{name:'Показать клиенту',exact:true}).click();
 await page.getByRole('button',{name:'Сохранить изображение',exact:true}).click();await expect(page.getByAltText('Изображение мебели для клиента')).toBeVisible();
 const {bytes,name}=await download(page,'Скачать PNG');expect(name).toMatch(/\.png$/);expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
});
