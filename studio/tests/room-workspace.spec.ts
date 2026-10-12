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
 await expect(page.locator('.empty-room-app .viewport canvas')).toBeVisible();
 await page.getByRole('button',{name:'Дальше: Коммуникации'}).click();await page.getByRole('button',{name:'Окно',exact:true}).click();
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


test('empty project: delete last module, undo, reload and export without losing room',async({page})=>{
 await page.goto('/?rooms=1');const width=page.getByLabel('Ширина пустой комнаты');await width.fill('4100');await width.press('Enter');
 await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
 await page.getByRole('button',{name:/^(3 )?Корпуса$/}).click();
 await page.getByRole('button',{name:'Удалить выбранный модуль',exact:true}).click();
 await expect(page.locator('.empty-room-app')).toBeVisible();await expect(width).toHaveValue('4100');
 await page.keyboard.press('Control+z');await expect(page.getByLabel('Название модуля')).toBeVisible();
 await page.getByRole('button',{name:'Удалить выбранный модуль',exact:true}).click();await page.reload();
 await expect(width).toHaveValue('4100');
 const doc=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),KEY);expect(doc.rooms[0].project.modules).toEqual([]);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать все комнаты',exact:true}).click();
 const stream=await (await download).createReadStream(),chunks:Buffer[]=[];for await(const c of stream!)chunks.push(c);
 expect(JSON.parse(Buffer.concat(chunks).toString()).rooms[0].project.modules).toEqual([]);
 await page.screenshot({path:'reports/empty-room-unified.png',fullPage:true});
 await page.setViewportSize({width:1280,height:720});expect((await page.locator('.empty-room-app canvas').boundingBox())!.height).toBeGreaterThan(200);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1600,height:1000});
 await page.getByRole('button',{name:'Добавить первый шкаф'}).click();await expect(page.getByLabel('Название модуля')).toBeVisible();
});

test('kitchen through controls: drawers, Gola, wall cabinets, worktop, persistence and zoom bounds',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?rooms=1');await page.getByRole('button',{name:'Нижний кухонный',exact:true}).click();await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await page.getByRole('button',{name:/^(4 )?Наполнение$/}).filter({hasText:'Наполнение'}).first().click();
 await page.getByLabel('Ящики нижнего модуля',{exact:true}).selectOption('3');await page.getByLabel('Профиль Gola',{exact:true}).check();
 await expect(page.getByRole('button',{name:'Добавить пантограф',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:/^(3 )?Корпуса$/}).click();
 await page.getByRole('button',{name:'Под мойку 600',exact:true}).click();await page.getByRole('button',{name:'Нижний распашной 600',exact:true}).click();
 await page.getByRole('button',{name:'Навесной 600',exact:true}).click();await page.getByRole('button',{name:'Навесной 600',exact:true}).click();
 await page.getByRole('button',{name:'Столешница над нижними',exact:true}).click();
 const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).rooms[0].project,KEY);
 const before=await read(),top=before.modules.find((m:any)=>m.module.worktop);expect(top.y).toBe(820);expect(before.modules).toHaveLength(6);
 const facadePlanes=before.modules.filter((a:any)=>a.module.kitchen?.role==='base').map((a:any)=>a.z+a.module.depth+(a.module.faceAir??2)+(a.module.facadeT??16));expect(new Set(facadePlanes).size).toBe(1);
 await page.getByRole('button',{name:'План',exact:true}).click();
 const worktop=page.getByRole('button',{name:/На плане:.*Столешница/});const box=await worktop.boundingBox();expect(box).toBeTruthy();
 await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height-3);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+25,box!.y+box!.height+70,{steps:10});await page.mouse.up();
 const moved=await read(),after=moved.modules.find((m:any)=>m.id===top.id);expect(after.y).toBe(top.y);expect(after.z).not.toBe(top.z);
 await page.getByRole('button',{name:'Отменить',exact:true}).click();await page.reload();await page.getByRole('button',{name:'3D',exact:true}).click();await page.getByRole('button',{name:'Вписать модель',exact:true}).click();
 await page.getByRole('button',{name:'Показать помещение',exact:true}).click();await page.getByRole('button',{name:'Вписать модель',exact:true}).click();
 const scene=page.getByTestId('scene'),canvas=scene.locator('canvas'),region=page.getByRole('region',{name:'Рабочая область'});
 const cb=await canvas.boundingBox(),vb=await region.boundingBox();expect(Math.abs(cb!.height-vb!.height)).toBeLessThan(2);
 await page.mouse.move(cb!.x+cb!.width/2,cb!.y+cb!.height/2);for(let i=0;i<6;i++){await page.mouse.wheel(0,-180);await page.waitForTimeout(80);}
 await page.waitForTimeout(500);
 const overlaps=await page.evaluate(()=>{const scene=document.querySelector('.scene')!,r=scene.getBoundingClientRect();const controls=[...document.querySelectorAll('.view-tabs,.interaction-bar,.scene-tools,.section-picker,.orbit-help')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());return [...scene.querySelectorAll<HTMLElement>('.model-dimension')].filter(e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden').filter(e=>{const b=e.getBoundingClientRect();return b.left<r.left||b.right>r.right||b.top<r.top||b.bottom>r.bottom||controls.some(c=>b.left<c.right&&b.right>c.left&&b.top<c.bottom&&b.bottom>c.top);}).map(e=>e.textContent);});
 expect(overlaps).toEqual([]);await page.screenshot({path:'reports/kitchen-zoom-ui.png',fullPage:true});
 await page.getByRole('button',{name:'Вписать модель',exact:true}).click();const tip=page.getByRole('button',{name:'Понятно',exact:true});if(await tip.isVisible())await tip.click();await page.screenshot({path:'reports/kitchen-built-ui.png',fullPage:true});expect(errors).toEqual([]);
});


test('kitchen correction: depth without shelves, reversible facades and supports',async({page})=>{
 await page.goto('/?rooms=1');
 await page.getByRole('button',{name:'Нижний кухонный',exact:true}).click();
 await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await page.getByRole('button',{name:/^(3 )?Корпуса$/}).click();
 await page.getByLabel('Назначение кухонного модуля',{exact:true}).selectOption('sink');
 await page.getByLabel('Глубина',{exact:true}).fill('460');await page.getByLabel('Глубина',{exact:true}).press('Tab');
 await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.getByLabel('Глубина',{exact:true})).toHaveValue('460');
 await page.getByLabel('Опоры под корпусом',{exact:true}).uncheck();
 await expect(page.getByRole('alert')).toHaveCount(0);
 await page.getByRole('button',{name:/^(5 )?Фасады$/}).click();
 await page.getByLabel('Распашные фасады',{exact:true}).uncheck();
 await expect(page.getByLabel('Распашные фасады',{exact:true})).toBeVisible();
 await page.getByLabel('Распашные фасады',{exact:true}).check();
 await page.reload();await page.getByRole('button',{name:/^(3 )?Корпуса$/}).click();
 await expect(page.getByLabel('Глубина',{exact:true})).toHaveValue('460');
 await expect(page.getByLabel('Опоры под корпусом',{exact:true})).not.toBeChecked();
 await page.getByLabel('Опоры под корпусом',{exact:true}).check();
 await expect(page.getByRole('alert')).toHaveCount(0);
});
test('Premial bottle pullout: one-click template, handedness, invalid resize, persistence',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/?rooms=1&workspace=premial-regression-'+Date.now());
 await page.getByRole('button',{name:'Нижний кухонный',exact:true}).click();
 await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await page.getByRole('button',{name:/^(3 )?Корпуса$/}).click();
 await page.getByRole('checkbox',{name:'Все настройки',exact:true}).check();
 await page.getByRole('button',{name:'Бутылочница 200',exact:true}).click();
 const props=page.getByRole('complementary').last();
 await props.getByText('Наполнение кухни',{exact:true}).click();
 const select=page.getByRole('combobox',{name:'Бутылочница Premial',exact:true});
 await expect(select).toHaveValue('060502');
 await select.selectOption('060503');
 const depth=page.getByRole('spinbutton',{name:'Глубина',exact:true});
 await depth.fill('450');await depth.press('Tab');
 await expect(depth).toHaveValue('557');
 await expect(page.getByRole('alert')).toContainText('457');
 await page.reload();
 if(!await select.isVisible()) await props.getByText('Наполнение кухни',{exact:true}).click();
 await expect(select).toHaveValue('060503');
 await expect(props.getByText('Петли',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Прозрачный корпус',exact:true}).click();
 await page.getByRole('button',{name:'Скрыть фасады',exact:true}).click();
 await page.getByRole('button',{name:'Приблизить выбранный корпус',exact:true}).click();
 await page.waitForTimeout(1200);
 await page.screenshot({path:'reports/premial-allegro-ui.png'});
 await select.selectOption('');
 await expect(props.getByText('Петли',{exact:true})).toHaveCount(1);
});
