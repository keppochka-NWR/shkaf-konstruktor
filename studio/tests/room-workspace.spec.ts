import { test, expect } from '@playwright/test';
const KEY='garderyob-rooms-v1';
test('P1: room isolation, cabinet edits, persistence, document undo and legacy isolation', async ({page}) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?rooms=1');
  await expect(page.getByRole('heading',{name:'Комната 1',exact:true})).toBeVisible();
  const w=page.getByLabel('Ширина пустой комнаты');await w.fill('4100');await w.press('Enter');
  await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
  const name=page.getByLabel('Название модуля');await name.fill('Шкаф первой комнаты');await name.press('Enter');
  await page.getByRole('button',{name:'Добавить комнату',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Комната 2',exact:true})).toBeVisible();
  await expect(page.getByLabel('Название модуля')).toHaveCount(0);
  await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
  await name.fill('Шкаф второй комнаты');await name.press('Enter');
  await page.getByLabel('Активная комната').selectOption({label:'Комната 1'});
  await expect(name).toHaveValue('Шкаф первой комнаты');
  await page.reload();await expect(name).toHaveValue('Шкаф первой комнаты');
  expect(await page.evaluate(()=>localStorage.getItem('module-studio-v3'))).toBeNull();
  await page.getByRole('button',{name:'Удалить комнату',exact:true}).click();
  await page.getByRole('button',{name:'Подтвердить удаление комнаты'}).click();
  await expect(name).toHaveValue('Шкаф второй комнаты');
  await page.getByRole('button',{name:'Отменить изменение заказа'}).click();
  await expect(name).toHaveValue('Шкаф первой комнаты');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).rooms.length,KEY)).toBe(2);
  await page.screenshot({path:'reports/p1-rooms.png',fullPage:true});
  expect(errors).toEqual([]);
});
test('P1: stale writer is rejected without applying room edit',async({page,context})=>{
  await page.goto('/?rooms=1');await page.getByRole('button',{name:'Сохранить комнаты',exact:true}).click();
  const other=await context.newPage();await other.goto('/?rooms=1');
  await page.getByRole('button',{name:'Добавить комнату',exact:true}).click();
  await other.getByRole('button',{name:'Добавить комнату',exact:true}).click();
  await expect(other.getByRole('alert')).toContainText('другой вкладке');
  await expect(other.getByRole('heading',{name:'Комната 1',exact:true})).toBeVisible();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).rooms.length,KEY)).toBe(2);
});
test('P1: invalid imported file does not replace saved document; full export contains all rooms',async({page})=>{
  await page.goto('/?rooms=1');await page.getByRole('button',{name:'Добавить комнату',exact:true}).click();
  const before=await page.evaluate(key=>localStorage.getItem(key),KEY);
  await page.locator('.rooms-bar input[type=file]').setInputFiles({name:'future.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'garderyob-rooms',version:99}))});
  await expect(page.getByRole('alert')).toContainText('Неподдерживаемый');
  expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBe(before);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать все комнаты'}).click();
  const file=await download;expect(file.suggestedFilename()).toContain('комнаты');
  const stream=await file.createReadStream();const chunks:Buffer[]=[];for await(const c of stream!)chunks.push(c);
  const doc=JSON.parse(Buffer.concat(chunks).toString());expect(doc.rooms).toHaveLength(2);
});
test('P1: corrupt storage is not replaced by a sample',async({page})=>{
  await page.goto('/?rooms=1');
  await page.evaluate(key=>localStorage.setItem(key,'{broken'),KEY);await page.reload();
  await expect(page.getByRole('heading',{name:'Документ комнат не удалось открыть'})).toBeVisible();
  expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBe('{broken');
});
test('P1: recovery restores backup and keeps the damaged source',async({page})=>{
  await page.goto('/?rooms=1');await page.getByRole('button',{name:'Сохранить комнаты',exact:true}).click();
  await page.getByRole('button',{name:'Добавить комнату',exact:true}).click();
  await page.evaluate(key=>localStorage.setItem(key,'{broken'),KEY);await page.reload();
  await page.getByRole('button',{name:'Восстановить предыдущую копию'}).click();
  await expect(page.getByRole('heading',{name:'Комната 1',exact:true})).toBeVisible();
  expect(await page.evaluate(key=>Object.keys(localStorage).some(k=>k.startsWith(key+':damaged:')&&localStorage.getItem(k)==='{broken'),KEY)).toBe(true);
  await page.reload();await expect(page.getByRole('heading',{name:'Комната 1',exact:true})).toBeVisible();
});


test('P2/P3: empty room 3D, right-click properties and measured surface survive reload',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?rooms=1');
 await expect(page.locator('.empty-room-canvas canvas')).toBeVisible();
 await page.getByText('Двери и окна',{exact:true}).click();await page.getByRole('button',{name:'Окно',exact:true}).click();
 let dialog=page.getByRole('dialog',{name:'Параметры объекта помещения'});await expect(dialog).toBeVisible();
 await dialog.getByLabel('Глубина откосов',{exact:true}).fill('150');await dialog.getByLabel('Глубина откосов',{exact:true}).press('Enter');
 await dialog.getByRole('button',{name:'Закрыть параметры'}).click();await page.getByRole('button',{name:'Показать план комнаты'}).click();
 await page.getByRole('button',{name:/На плане: Окно 1/}).click({button:'right'});await expect(dialog.getByLabel('Глубина откосов',{exact:true})).toHaveValue('150');
 await dialog.getByLabel('Ширина проёма',{exact:true}).fill('1100');await dialog.getByLabel('Ширина проёма',{exact:true}).press('Enter');await dialog.getByRole('button',{name:'Закрыть параметры'}).click();
 await page.getByText('Общий план · замер · панели · варианты · передача',{exact:true}).click();
 const survey=page.locator('.room-tools .survey-editor');await survey.getByText('Левая стена',{exact:true}).click();await survey.getByRole('button',{name:'Добавить сетку Левая стена'}).click();
 const point=survey.getByLabel('left U0 V0',{exact:true});await expect(point).toHaveValue('');await point.fill('20');await point.press('Enter');
 await page.reload();const d=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),KEY);expect(d.rooms[0].project.room.openings[0].width).toBe(1100);expect(d.rooms[0].project.room.survey.surfaces.left.offsets[0][0]).toBe(20);expect(d.rooms[0].project.room.survey.surfaces.left.measured[0][0]).toBe(true);
 expect(errors).toEqual([]);
});

test('P1b/P5/P6: adjacent room, editable panel, approved snapshot and full export',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?rooms=1');
 const tools=()=>page.locator('.room-tools');await tools().locator('summary').first().click();
 await tools().getByRole('button',{name:'Достроить комнату с общей дверью'}).click();await expect(page.getByLabel('Активная комната')).toHaveValue(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).activeRoomId,KEY));
 await tools().getByRole('button',{name:'Добавить панель в комнату'}).click();
 // First furniture mounts the editor; tools reopen with the same persisted document.
 if(await tools().getAttribute('open')===null)await tools().locator('summary').first().click();
 await expect(tools().getByRole('button',{name:'Панель — параметры'})).toBeVisible();
 await tools().getByLabel('Название варианта').fill('Согласованный 1');await tools().getByRole('button',{name:'Зафиксировать согласованный вариант'}).click();
 await tools().getByRole('button',{name:'Панель — параметры'}).click();await tools().getByLabel('Длина панели',{exact:true}).fill('700');await tools().getByRole('button',{name:'Применить панель'}).click();
 const d=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),KEY),r=d.rooms.find((r:any)=>r.id===d.activeRoomId);expect(r.project.modules[0].module.width).toBe(700);expect(r.variants[0].project.modules[0].module.width).toBe(600);expect(d.links).toHaveLength(1);
 await tools().getByRole('button',{name:'Открыть копию варианта'}).click();expect(await page.evaluate(key=>{const d=JSON.parse(localStorage.getItem(key)!);return d.rooms.find((r:any)=>r.id===d.activeRoomId).project.modules[0].module.width;},KEY)).toBe(600);
 await page.screenshot({path:'reports/rooms-plan-tools.png',fullPage:true});expect(errors).toEqual([]);
});

test('P1: writer lock is transferred after owning tab closes',async({page,context})=>{
 await page.goto('/?rooms=1');await page.getByRole('button',{name:'Сохранить комнаты',exact:true}).click();const other=await context.newPage();await other.goto('/?rooms=1');await page.close();
 await expect(other.getByText(/Ожидается доступ к записи/)).toHaveCount(0);await other.getByRole('button',{name:'Добавить комнату',exact:true}).click();await expect(other.getByRole('heading',{name:'Комната 2',exact:true})).toBeVisible();
});


test('P1 cloud response cannot overwrite edits made while saving',async({page})=>{
 let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});let sent!:()=>void;const started=new Promise<void>(resolve=>{sent=resolve;});
 await page.route('**/api/studio/**',async route=>{const request=route.request();if(request.url().endsWith('/me'))return route.fulfill({json:{email:'fixture@example.test'}});if(request.method()==='GET')return route.fulfill({json:{items:[]}});sent();await pending;return route.fulfill({json:{id:'saved-fixture',revision:1}});});
 await page.goto('/?rooms=1');await page.locator('.room-tools>summary').click();await page.getByText('Сохранение на сервере',{exact:true}).click();await page.getByRole('button',{name:'Проверить подключение'}).click();await page.getByRole('button',{name:'Сохранить комнаты на сервер'}).click();await started;
 await page.getByRole('button',{name:'Добавить комнату',exact:true}).click();release();await expect(page.getByText(/В заказе уже есть новые правки/)).toBeVisible();
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).rooms.length,KEY)).toBe(2);
});
