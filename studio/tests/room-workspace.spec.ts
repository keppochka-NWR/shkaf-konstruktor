import { test, expect } from '@playwright/test';
import {newProject} from '../src/project';
const KEY='garderyob-rooms-v1';
test.beforeEach(async({page},info)=>{if(!info.title.startsWith('visibility and compact'))await page.addInitScript(()=>localStorage.setItem('yo-compact-top','0'));});
test('right-click rehangs the selected facade and supports undo redo reload',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await page.getByRole('button',{name:'Спереди',exact:true}).click();
 await page.getByRole('button',{name:'Приблизить выбранный корпус',exact:true}).click();
 await page.waitForTimeout(700);const canvas=page.locator('.scene canvas'),b=(await canvas.boundingBox())!;
 await canvas.click({button:'right',position:{x:b.width/2,y:b.height/2}});
 await page.getByRole('menuitem',{name:/^Фасад\./}).click();
 await expect(page.getByRole('menuitem',{name:/^Открывание\./})).toBeVisible();
 await page.getByRole('menuitem',{name:/^Открывание\./}).click();
 await page.getByRole('menuitem',{name:/^Петли справа\./}).click();
 const hinges=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project.modules[0].module.sections[0].doorHinges);
 expect((await hinges())[0]).toBe('right');await page.keyboard.press('Control+z');expect(await hinges()).toBeUndefined();
 await page.keyboard.press('Control+y');expect((await hinges())[0]).toBe('right');await page.reload();expect((await hinges())[0]).toBe('right');
});
async function openSettings(page:any,title:string){
 const summary=page.locator('.properties details:not(.settings-category)>summary').filter({hasText:new RegExp('^'+title)}).first();
 const parent=summary.locator('xpath=ancestor::details[contains(@class,"settings-category")]');
 if(await parent.count()&&!await parent.evaluate((e:HTMLDetailsElement)=>e.open))await parent.locator(':scope>summary').click();
 if(!await summary.evaluate((e:HTMLElement)=>(e.parentElement as HTMLDetailsElement).open))await summary.click();
}
async function kitchenCatalog(page:any,presets=false){
 await page.getByRole('tab',{name:'Кухонные модули',exact:true}).click();
 if(presets){const details=page.locator('.catalog-presets');if(!await details.evaluate((e:HTMLDetailsElement)=>e.open))await details.locator(':scope>summary').click();}
}

test('unified workflow keeps communications through furniture, undo and reload',async({page})=>{
 await page.goto('/');await expect(page.locator('.app')).toHaveAttribute('data-stage','room');
 await expect(page.locator('.stage-step')).toHaveCount(3);
 await page.getByText('Трубы, радиаторы и объекты на стенах',{exact:true}).click();
 await page.getByLabel('Тип объекта',{exact:true}).selectOption('socket');
 await page.locator('.fixture-add').getByRole('button',{name:'Добавить',exact:true}).click();
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project);
 const fixtures=(await state()).room.fixtures;expect(fixtures).toHaveLength(1);
 await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 for(const title of ['Полки','Ящики','Штанги','Опоры','Подсветка','Фасад','Ручки','Тип открывания']){
  const summary=page.locator('.properties summary').getByText(title,{exact:true});await expect(summary).toBeAttached();
  expect(await summary.evaluate(e=>(e.closest('details') as HTMLDetailsElement).open)).toBe(false);
 }
 expect((await state()).room.fixtures).toEqual(fixtures);
 await page.getByRole('button',{name:'Помещение',exact:true}).click();
 await expect(page.getByLabel('Тип объекта',{exact:true})).toBeVisible();
 await page.getByLabel('Тип объекта',{exact:true}).selectOption('vent');
 await page.locator('.fixture-add').getByRole('button',{name:'Добавить',exact:true}).click();
 expect((await state()).room.fixtures).toHaveLength(2);
 await page.keyboard.press('Control+z');expect((await state()).room.fixtures).toEqual(fixtures);
 await page.reload();await expect(page.locator('.app')).toHaveAttribute('data-stage','room');expect((await state()).room.fixtures).toEqual(fixtures);
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await page.screenshot({path:'.qa/unified-furniture.png'});
 for(const width of [1600,1100,920,500]){await page.setViewportSize({width,height:1000});
  const brand=page.locator('.header .brand strong');await expect(brand).toBeVisible();
  const rows=await brand.evaluate(e=>{const r=document.createRange();r.selectNode(e.firstChild!);return [...r.getClientRects()].map(x=>x.top);});expect(new Set(rows).size).toBe(1);
 }
});

test('straight kitchen creates the entered dimensions without self-overlap',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await kitchenCatalog(page);await page.getByRole('button',{name:'Кухня прямая',exact:true}).click();
 for(const [name,value] of [['Ширина','2000'],['Высота','900'],['Глубина','600']])await page.getByLabel(name+' новой мебели',{exact:true}).fill(value);
 await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveCount(0);
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project);
 const saved=await state(),base=saved.modules.filter((a:any)=>a.module.kitchen?.role==='base');
 expect(base.length).toBeGreaterThan(1);expect(base.reduce((s:number,a:any)=>s+a.module.width,0)).toBe(2000);
 expect(base.every((a:any)=>a.module.height===900&&a.module.depth===600)).toBe(true);
 const top=saved.modules.find((a:any)=>a.module.worktop);expect(top.y).toBe(900);expect(top.module.depth).toBe(643);
 await page.screenshot({path:'.qa/unified-kitchen.png'});
 await page.keyboard.press('Control+z');expect((await state()).modules).toHaveLength(0);
 await page.keyboard.press('Control+y');expect((await state()).modules).toEqual(saved.modules);
 await page.reload();expect((await state()).modules).toEqual(saved.modules);
});

test('apply facade style to all is one reversible saved command',async({page})=>{
 await page.goto('/');const p=newProject();p.modules[0].module.facadeDecor='Графит';p.modules[0].module.doors=true;
 const target=structuredClone(p.modules[0]);target.id='second';target.x=1600;target.module.facadeDecor='Белый';target.module.doors=false;p.modules.push(target);
 await page.evaluate(p=>localStorage.setItem('module-studio-v3',JSON.stringify(p)),p);await page.reload();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();await openSettings(page,'Фасад');
 const modules=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project.modules);
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('module-studio-v3')!).modules);await page.getByRole('button',{name:'Применить ко всем модулям',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveCount(0);expect((await modules())[1].module.facadeDecor).toBe('Графит');expect((await modules())[1].module.doors).toBe(false);
 await page.keyboard.press('Control+z');expect(await modules()).toEqual(before);
 await page.keyboard.press('Control+y');await page.reload();expect((await modules())[1].module.facadeDecor).toBe('Графит');
});

test('unified Ctrl+Z undoes furniture, room commands and last-module removal; Russian layout and redo work',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
 await page.getByLabel('Название модуля').fill('История');await page.getByLabel('Название модуля').press('Enter');
 await page.getByRole('button',{name:'Добавить комнату',exact:true}).click();
 await page.keyboard.press('Control+z');await expect(page.getByLabel('Название модуля')).toHaveValue('История');
 await page.getByRole('button',{name:'Отменить',exact:true}).click();await expect(page.getByLabel('Название модуля')).not.toHaveValue('История');
 await page.keyboard.press('Control+z');await expect(page.getByText('Помещение · без мебели',{exact:true})).toBeVisible();
 await page.keyboard.press('Control+Shift+z');await expect(page.getByLabel('Название модуля')).toBeVisible();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();await page.getByRole('button',{name:'Удалить выбранный модуль',exact:true}).click();
 await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'я',code:'KeyZ',ctrlKey:true,bubbles:true,cancelable:true})));
 await expect(page.getByLabel('Название модуля')).toBeVisible();
 await page.getByLabel('Название модуля').focus();const before=await page.evaluate(()=>localStorage.getItem('garderyob-rooms-v1'));
 await page.keyboard.press('Control+z');expect(await page.evaluate(()=>localStorage.getItem('garderyob-rooms-v1')),'typing undo does not undo the room').toBe(before);
});

test('shelf module exposes a direct facade action in section controls, supports undo and reload',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Стеллаж',exact:true}).click();await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();await openSettings(page,'Фасад');
 await page.getByRole('button',{name:'Добавить распашные фасады',exact:true}).click();
 const hasDoors=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project.modules[0].module.doors);
 expect(await hasDoors()).toBe(true);await page.keyboard.press('Control+z');expect(await hasDoors()).toBe(false);
 await page.keyboard.press('Control+y');expect(await hasDoors()).toBe(true);await page.reload();expect(await hasDoors()).toBe(true);
});

test('drawer front increase shifts fixed upper drawers as one undoable command',async({page})=>{
 await page.goto('/');const p=newProject();p.modules[0].module.height=2000;p.modules[0].module.doors=false;
 const s=p.modules[0].module.sections[0];s.shelves=[];s.drawers=3;s.drawerConfigs=[0,200,400].map(y=>({slide:'ball',height:160,length:450,y}));
 await page.evaluate(p=>localStorage.setItem('module-studio-v3',JSON.stringify(p)),p);await page.reload();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();await openSettings(page,'Ящики');
 const input=page.getByLabel('Высота фасада ящика',{exact:true});await input.fill('350');await input.press('Enter');
 const values=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project.modules[0].module.sections[0].drawerConfigs);
 expect((await values()).map((c:any)=>c.y)).toEqual([0,353,553]);
 await page.keyboard.press('Control+z');expect((await values()).map((c:any)=>c.y)).toEqual([0,200,400]);
 await page.keyboard.press('Control+y');expect((await values()).map((c:any)=>c.y)).toEqual([0,353,553]);
 await page.reload();expect((await values()).map((c:any)=>c.y)).toEqual([0,353,553]);
});

test('ordinary URL: empty start, last module deletion, undo, reload and re-add',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.getByRole('heading',{name:'Комната 1',exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Проекты клиента'})).toBeVisible();
 await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 const del=page.getByRole('button',{name:'Удалить выбранный модуль',exact:true});await expect(del).toBeEnabled();await del.click();
 await expect(page.getByText('Помещение · без мебели',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Отменить изменение заказа'}).click();await expect(page.getByLabel('Название модуля')).toBeVisible();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();await del.click();await page.reload();
 await expect(page.getByText('Помещение · без мебели',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Добавить первый шкаф'}).click();await expect(page.getByLabel('Название модуля')).toBeVisible();
 expect(errors).toEqual([]);
});

test('ordinary URL: old project retained, new project empty, copy keeps all rooms',async({page})=>{
 await page.goto('/');const old=newProject();old.modules[0].module.name='Прежний шкаф';
 await page.evaluate(p=>localStorage.setItem('module-studio-v3',JSON.stringify(p)),old);await page.reload();
 await expect(page.getByLabel('Название модуля')).toHaveValue('Прежний шкаф');
 await page.getByRole('button',{name:'Ещё проект',exact:true}).click();await page.getByRole('menuitem',{name:/^Новый проект/}).click();
 await expect(page.getByText('Помещение · без мебели',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Добавить комнату',exact:true}).click();
 await page.getByRole('button',{name:'Ещё проект',exact:true}).click();await page.getByRole('menuitem',{name:/^Копия этого проекта/}).click();
 await expect(page.getByLabel('Активная комната').locator('option')).toHaveCount(2);await page.reload();
 await expect(page.getByLabel('Активная комната').locator('option')).toHaveCount(2);
 await page.getByRole('tab',{name:/^Проект 1 /}).click();await expect(page.getByLabel('Название модуля')).toHaveValue('Прежний шкаф');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('module-studio-v3')!).modules[0].module.name)).toBe('Прежний шкаф');
});

test('ordinary URL: explicit new project without furniture has no hidden default module',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
 await page.getByRole('button',{name:'Новый проект / восстановить',exact:true}).click();
 await page.getByRole('button',{name:'Создать проект без мебели',exact:true}).click();
 await expect(page.getByText('Помещение · без мебели',{exact:true})).toBeVisible();await page.reload();
 await expect(page.getByText('Помещение · без мебели',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project.modules.length)).toBe(0);
});
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
 await page.getByRole('button',{name:'Окно',exact:true}).click();
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
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await page.getByRole('button',{name:'Удалить выбранный модуль',exact:true}).click();
 await expect(page.locator('.empty-room-app')).toBeVisible();await expect(width).toHaveValue('4100');
 await page.keyboard.press('Control+z');await expect(page.getByLabel('Название модуля')).toBeVisible();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();await page.getByRole('button',{name:'Удалить выбранный модуль',exact:true}).click();await page.reload();
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
 await page.goto('/?rooms=1');await kitchenCatalog(page);await page.getByRole('button',{name:'Нижний кухонный',exact:true}).click();await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();await openSettings(page,'Ящики');
 await page.getByLabel('Ящики нижнего модуля',{exact:true}).selectOption('3');await openSettings(page,'Тип открывания');await page.getByLabel('Профиль Gola',{exact:true}).check();
 await expect(page.getByRole('button',{name:'Добавить пантограф',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await kitchenCatalog(page,true);await page.getByRole('button',{name:'Под мойку 600',exact:true}).click();await page.getByRole('button',{name:'Нижний распашной 600',exact:true}).click();
 await page.getByRole('button',{name:'Навесной 600',exact:true}).click();await page.getByRole('button',{name:'Навесной 600',exact:true}).click();
 await kitchenCatalog(page,true);await page.getByRole('button',{name:'Столешница над нижними',exact:true}).click();
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
 await kitchenCatalog(page);await page.getByRole('button',{name:'Нижний кухонный',exact:true}).click();
 await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await openSettings(page,'Корпус');
 await page.getByLabel('Назначение кухонного модуля',{exact:true}).selectOption('sink');
 await page.getByLabel('Глубина',{exact:true}).fill('460');await page.getByLabel('Глубина',{exact:true}).press('Tab');
 await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.getByLabel('Глубина',{exact:true})).toHaveValue('460');
 await page.getByLabel('Опоры под корпусом',{exact:true}).uncheck();
 await expect(page.getByRole('alert')).toHaveCount(0);
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await openSettings(page,'Фасады');await page.getByLabel('Распашные фасады',{exact:true}).uncheck();
 await expect(page.getByLabel('Распашные фасады',{exact:true})).toBeVisible();
 await page.getByLabel('Распашные фасады',{exact:true}).check();
 await page.reload();await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await openSettings(page,'Корпус');
 await expect(page.getByLabel('Глубина',{exact:true})).toHaveValue('460');
 await expect(page.getByLabel('Опоры под корпусом',{exact:true})).not.toBeChecked();
 await page.getByLabel('Опоры под корпусом',{exact:true}).check();
 await expect(page.getByRole('alert')).toHaveCount(0);
});
test('Premial bottle pullout: one-click template, handedness, invalid resize, persistence',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/?rooms=1&workspace=premial-regression-'+Date.now());
 await kitchenCatalog(page);await page.getByRole('button',{name:'Нижний кухонный',exact:true}).click();
 await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await page.getByRole('checkbox',{name:'Все настройки',exact:true}).check();
 await kitchenCatalog(page,true);await page.getByRole('button',{name:'Бутылочница 200',exact:true}).click();
 const props=page.getByRole('complementary').last();
 await openSettings(page,'Ящики и бутылочницы');
 const select=page.getByRole('combobox',{name:'Бутылочница Premial',exact:true});
 await expect(select).toHaveValue('060502');
 await select.selectOption('060503');
 await openSettings(page,'Корпус');const depth=page.getByRole('spinbutton',{name:'Глубина',exact:true});
 await depth.fill('450');await depth.press('Tab');
 await expect(depth).toHaveValue('557');
 await expect(page.getByRole('alert')).toContainText('457');
 await page.reload();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 if(!await select.isVisible()) await openSettings(page,'Ящики и бутылочницы');
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


test('Premial sink: real cutout, persistence, invalid edit and small viewport camera',async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:1280,height:720});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?rooms=1&workspace=premial-sink-regression-'+Date.now());
 await kitchenCatalog(page);await page.getByRole('button',{name:'Нижний кухонный',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Ширина новой мебели',exact:true}).fill('800');
 await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await page.getByRole('checkbox',{name:'Все настройки',exact:true}).check();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await openSettings(page,'Корпус');await page.getByRole('combobox',{name:'Назначение кухонного модуля',exact:true}).selectOption({label:'Под мойку'});
 await kitchenCatalog(page,true);await page.getByRole('button',{name:'Столешница над нижними',exact:true}).click();
 await openSettings(page,'Столешница');await page.getByRole('button',{name:'+ под мойку',exact:true}).click();
 await page.getByRole('combobox',{name:'Модель мойки',exact:true}).selectOption('210245');
 await page.getByRole('checkbox',{name:'Показать сифон для компоновки',exact:true}).check();
 const cw=page.getByRole('spinbutton',{name:'Ширина выреза',exact:true});await cw.fill('500');await cw.press('Tab');
 await expect(cw).toHaveValue('560');await expect(page.getByRole('alert')).toContainText('PRODIGY');
 await page.reload();await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();await openSettings(page,'Столешница');await expect(page.getByRole('combobox',{name:'Модель мойки',exact:true})).toHaveValue('210245');
 await expect(page.getByRole('checkbox',{name:'Показать сифон для компоновки',exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Скрыть фасады',exact:true}).click();
 await page.getByRole('button',{name:'Прозрачный корпус',exact:true}).click();
 await page.getByRole('button',{name:'Показать помещение',exact:true}).click();
 await page.getByRole('button',{name:'Показать размеры',exact:true}).click();
 await page.getByRole('button',{name:'Вписать модель',exact:true}).click();
 const viewport=page.locator('.viewport');
 expect(await viewport.evaluate(e=>e.scrollTop)).toBe(0);
 const r=await viewport.boundingBox(),c=await page.locator('.scene canvas').boundingBox();expect(Math.abs(r!.y-c!.y)).toBeLessThan(1);
 await page.setViewportSize({width:1600,height:1000});
 const tip=page.getByRole('button',{name:'Понятно',exact:true});if(await tip.isVisible())await tip.click();
 await page.getByRole('button',{name:'Вписать модель',exact:true}).click();
 await page.waitForTimeout(1200);await page.screenshot({path:'reports/premial-sink-ui.png'});
 expect(errors).toEqual([]);
});


test('sidebars resize by dragging, persist across empty and furnished rooms, and fit smaller windows',async({page})=>{
 await page.goto('/');
 const left=page.getByRole('separator',{name:'Ширина левой панели'}),right=page.getByRole('separator',{name:'Ширина правой панели'});
 const drag=async(locator:any,dx:number)=>{const b=(await locator.boundingBox())!;await page.mouse.move(b.x+b.width/2,b.y+80);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+80,{steps:6});await page.mouse.up();};
 await drag(left,90);await drag(right,-80);
 await expect(left).toHaveAttribute('aria-valuenow','340');await expect(right).toHaveAttribute('aria-valuenow','380');
 expect(Math.round((await page.locator('.library').boundingBox())!.width)).toBe(340);
 await page.reload();await expect(left).toHaveAttribute('aria-valuenow','340');
 await page.getByRole('button',{name:'Добавить первый шкаф'}).click();await expect(right).toHaveAttribute('aria-valuenow','380');
 await right.focus();await right.press('ArrowLeft');await expect(right).toHaveAttribute('aria-valuenow','390');
 await left.dblclick();await expect(left).toHaveAttribute('aria-valuenow','250');
 await page.setViewportSize({width:920,height:800});await expect.poll(async()=> (await page.locator('.viewport').boundingBox())!.width).toBeGreaterThanOrEqual(319);
 await page.setViewportSize({width:500,height:800});await expect(left).toBeHidden();
});

test('visibility and compact header preserve the document and restore all modules',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await expect(page.getByRole('button',{name:'Заказ и инструменты',exact:true})).toBeVisible();
 const compactY=(await page.locator('.workspace').boundingBox())!.y;
 await page.getByRole('button',{name:'Заказ и инструменты',exact:true}).click();
 await expect(page.getByLabel('Активная комната',{exact:true})).toBeVisible();
 expect((await page.locator('.workspace').boundingBox())!.y).toBeGreaterThan(compactY+100);
 await page.getByRole('button',{name:'Свернуть верхнюю панель',exact:true}).click();
 const state=()=>page.evaluate(()=>localStorage.getItem('garderyob-rooms-v1'));
 await page.getByRole('button',{name:'Копировать с наполнением',exact:true}).click();
 const before=await state();
 await page.locator('.module-item').first().click({button:'right'});
 await page.getByRole('menuitem',{name:/^Корпус\./}).click();await page.getByRole('menuitem',{name:/^Скрыть модуль\./}).click();
 await expect(page.getByRole('button',{name:'Показать все скрытые (1)',exact:true})).toBeVisible();
 await page.locator('.module-item').last().click({button:'right'});await page.getByRole('menuitem',{name:/^Корпус\./}).click();await page.getByRole('menuitem',{name:/^Скрыть модуль\./}).click();
 await expect(page.locator('.module-hidden')).toHaveCount(2);
 expect(await state()).toBe(before);
 await page.getByRole('button',{name:'План',exact:true}).click();
 await expect(page.locator('svg [aria-label^="На плане:"]')).toHaveCount(0);
 await page.getByRole('button',{name:'Показать все скрытые (2)',exact:true}).click();
 await expect(page.locator('svg [aria-label^="На плане:"]')).toHaveCount(2);
 await page.locator('svg [aria-label^="На плане:"]').first().click({button:'right'});
 await page.getByRole('menuitem',{name:/^Корпус\./}).click();await page.getByRole('menuitem',{name:/^Скрыть модуль\./}).click();
 await page.locator('.module-item').first().click();
 await expect(page.locator('.module-hidden')).toHaveCount(0);
 await expect(page.locator('svg [aria-label^="На плане:"]')).toHaveCount(2);
 expect(await state()).toBe(before);
 await page.reload();await expect(page.getByRole('button',{name:'Заказ и инструменты',exact:true})).toBeVisible();
 await page.screenshot({path:'.qa/compact-visibility.png'});
});


test('top and bottom facade menus save Premial selection with undo and reload',async({page})=>{
 await page.goto('/?rooms=1');
 await kitchenCatalog(page);await page.getByRole('button',{name:'Навесной кухонный',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Высота новой мебели',exact:true}).fill('500');
 await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await page.getByRole('button',{name:'Построение мебели',exact:true}).click();
 await page.getByRole('button',{name:'Спереди',exact:true}).click();
 await page.getByRole('button',{name:'Приблизить выбранный корпус',exact:true}).click();
 const opening=async()=>{await page.waitForTimeout(500);const canvas=page.locator('.scene canvas'),b=(await canvas.boundingBox())!;await canvas.click({button:'right',position:{x:b.width/2,y:b.height/2}});await page.getByRole('menuitem',{name:/^Фасад\./}).click();await page.getByRole('menuitem',{name:/^Открывание\./}).click();};
 const section=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project.modules[0].module.sections[0]);
 await opening();await page.getByRole('menuitem',{name:/^Петли снизу\./}).click();
 expect((await section()).doorHinges).toContain('bottom');
 await opening();await page.getByRole('menuitem',{name:'Петли сверху',exact:true}).click();await page.getByRole('menuitem',{name:/^Подъёмник СЕМПРЕ\./}).click();
 expect((await section()).doorLifts).toContain('sempre');
 await page.keyboard.press('Control+z');expect((await section()).doorHinges).toContain('bottom');expect((await section()).doorLifts).toBeUndefined();
 await page.keyboard.press('Control+y');expect((await section()).doorLifts).toContain('sempre');
 await page.reload();expect((await section()).doorLifts).toContain('sempre');
});


test('facade editor via right click: film, enamel, cancel, undo and reload',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await page.getByRole('button',{name:'Спереди',exact:true}).click();
 await page.getByRole('button',{name:'Приблизить выбранный корпус',exact:true}).click();
 const open=async()=>{await page.waitForTimeout(700);const canvas=page.locator('.scene canvas'),b=(await canvas.boundingBox())!;await canvas.click({button:'right',position:{x:b.width/2,y:b.height/2}});await page.getByRole('menuitem',{name:/^Фасад\./}).click();await page.getByRole('menuitem',{name:/^Редактировать фасад\./}).click();await expect(page.getByRole('region',{name:'Редактор фасадов'})).toBeVisible();await expect(page.locator('.modal-backdrop')).toHaveCount(0);};
 const value=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project.modules[0].module.vernissage);
 await open();await page.getByRole('region',{name:'Редактор фасадов'}).getByLabel('Основа фасадов',{exact:true}).selectOption('vernissage');
 await expect(page.getByRole('region',{name:'Редактор фасадов'}).getByLabel('Фрезеровка Вернисаж',{exact:true})).toBeVisible();
 await page.getByRole('region',{name:'Редактор фасадов'}).getByLabel('Покрытие Вернисаж',{exact:true}).selectOption('enamel-matte');
 await page.getByRole('region',{name:'Редактор фасадов'}).getByLabel('Цвет эмали Вернисаж',{exact:true}).fill('RAL 9003');
 await page.getByRole('button',{name:'Отмена',exact:true}).click();expect(await value()).toBeUndefined();
 await open();await page.getByRole('region',{name:'Редактор фасадов'}).getByLabel('Основа фасадов',{exact:true}).selectOption('vernissage');
 await page.getByRole('button',{name:'Применить к корпусу',exact:true}).click();expect((await value()).cover).toBe('film');
 await open();await page.getByRole('region',{name:'Редактор фасадов'}).getByLabel('Покрытие Вернисаж',{exact:true}).selectOption('enamel-matte');
 await page.getByRole('region',{name:'Редактор фасадов'}).getByLabel('Цвет эмали Вернисаж',{exact:true}).fill('RAL 9003');
 await page.screenshot({path:'.qa/facade-editor/editor.png',fullPage:true});
 await page.getByRole('button',{name:'Применить к корпусу',exact:true}).click();expect((await value()).cover).toBe('enamel-matte');
 await page.keyboard.press('Control+z');expect((await value()).cover).toBe('film');
 await page.keyboard.press('Control+y');await page.reload();expect((await value()).enamelColor).toBe('RAL 9003');
});


test('Ctrl module group: list, plan and scene selection, selected facade apply and undo',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await page.getByRole('button',{name:'Копировать с наполнением',exact:true}).click();
 await page.getByRole('button',{name:'Копировать с наполнением',exact:true}).click();
 const items=page.locator('.module-list .module-item');await expect(items).toHaveCount(3);
 await items.nth(0).click({modifiers:['Control']});await items.nth(2).click({modifiers:['Control']});
 await expect(page.getByRole('button',{name:'Фасады выделенных (2)',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Фасады выделенных (2)',exact:true}).click();
 await expect(page.getByRole('region',{name:'Редактор фасадов'}).getByLabel('Область применения фасадов',{exact:true})).toHaveValue('group');
 await page.getByRole('region',{name:'Редактор фасадов'}).getByLabel('Основа фасадов',{exact:true}).selectOption('vernissage');
 await page.getByRole('button',{name:'Применить к выделенным (2)',exact:true}).click();
 const covers=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project.modules.map((a:any)=>a.module.vernissage?.cover??null));
 expect(await covers()).toEqual(['film',null,'film']);await page.keyboard.press('Control+z');expect(await covers()).toEqual([null,null,null]);
 await page.keyboard.press('Control+y');expect(await covers()).toEqual(['film',null,'film']);
 await items.nth(0).click({modifiers:['Control']});await expect(page.getByRole('button',{name:'Фасады выделенных (1)',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Снять выделение',exact:true}).click();
 await page.getByRole('button',{name:'План',exact:true}).click();
 await expect(page.locator('.room-plan')).toBeVisible();
 await page.locator('.room-plan g[role="button"]').filter({has:page.locator('polygon')}).first().click({modifiers:['Control']});
 await expect(page.getByRole('button',{name:'Фасады выделенных (1)',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Снять выделение',exact:true}).click();
 await page.getByRole('button',{name:'Спереди',exact:true}).click();
 await items.nth(1).click();await page.getByRole('button',{name:'Приблизить выбранный корпус',exact:true}).click();await page.waitForTimeout(700);
 const canvas=page.locator('.scene canvas'),b=(await canvas.boundingBox())!;await canvas.click({modifiers:['Control'],position:{x:b.width/2,y:b.height/2}});
 await expect(page.getByRole('button',{name:'Фасады выделенных (1)',exact:true})).toBeVisible();
 await page.reload();expect(await covers()).toEqual(['film',null,'film']);
});


test('context menu separates facade and body actions without changing project',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 const state=()=>page.evaluate(()=>localStorage.getItem('garderyob-rooms-v1'));
 const before=await state();
 await page.locator('.module-item').first().click({button:'right'});
 const menu=page.getByRole('menu');
 await expect(menu.getByRole('menuitem')).toHaveCount(2);
 await menu.getByRole('menuitem',{name:/^Корпус\./}).click();
 await expect(menu.getByRole('menuitem',{name:/^Размеры\./})).toBeVisible();
 await expect(menu.getByRole('menuitem',{name:/^Петли\./})).toHaveCount(0);
 await expect(menu.getByRole('menuitem',{name:/^Редактировать фасад\./})).toHaveCount(0);
 await menu.getByRole('button',{name:'Назад',exact:true}).click();
 await menu.getByRole('menuitem',{name:/^Фасад\./}).click();
 await expect(menu.getByRole('menuitem',{name:/^Редактировать фасад\./})).toBeVisible();
 await expect(menu.getByRole('menuitem',{name:/^Скрыть модуль\./})).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(menu.getByRole('menuitem')).toHaveCount(2);
 await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);
 expect(await state()).toBe(before);
 await page.getByRole('button',{name:'Спереди',exact:true}).click();
 await page.getByRole('button',{name:'Приблизить выбранный корпус',exact:true}).click();await page.waitForTimeout(700);
 const canvas=page.locator('.scene canvas'),b=(await canvas.boundingBox())!;
 await canvas.click({button:'right',position:{x:b.width/2,y:b.height/2}});
 await expect(menu.getByRole('menuitem')).toHaveCount(2);
 await menu.getByRole('menuitem',{name:/^Фасад\./}).click();
 await expect(menu.getByRole('menuitem',{name:/^Открывание\./})).toBeVisible();
 await expect(menu.getByRole('menuitem',{name:/^Скрыть модуль\./})).toHaveCount(0);
 await page.waitForTimeout(600);await page.screenshot({path:'.qa/context-submenus.png'});
 await menu.getByRole('button',{name:'Назад',exact:true}).click();await page.waitForTimeout(600);await page.screenshot({path:'.qa/context-submenus-root.png'});
});


test('middle mouse rotates camera in edit modes without changing furniture',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Добавить первый шкаф'}).click();
 await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 const document=()=>page.evaluate(()=>localStorage.getItem('garderyob-rooms-v1'));
 const camera=()=>page.evaluate(()=>{const key=Object.keys(sessionStorage).find(k=>k.startsWith('garderyob-camera:'));return key?JSON.parse(sessionStorage.getItem(key)!):null;});
 const before=await document();
 const canvas=page.locator('.scene canvas');
 for(const mode of ['Выбрать','Двигать корпуса','Наполнение','Свободная камера']){
  await page.getByRole('button',{name:mode,exact:true}).click();
  const b=(await canvas.boundingBox())!;
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
  await page.mouse.down({button:'middle'});await page.mouse.move(b.x+b.width/2+80,b.y+b.height/2+40,{steps:8});await page.mouse.up({button:'middle'});
  await page.waitForTimeout(350);const first=await camera();expect(first).not.toBeNull();
  await page.mouse.down({button:'middle'});await page.mouse.move(b.x+b.width/2-80,b.y+b.height/2-25,{steps:8});await page.mouse.up({button:'middle'});
  await page.waitForTimeout(350);const second=await camera();
  expect(second.position).not.toEqual(first.position);
  // Orbit changes the angle, not the distance to its target (middle button used to dolly).
  const dist=(s:any)=>Math.hypot(...s.position.map((v:number,i:number)=>v-s.target[i]));
  expect(dist(second)).toBeCloseTo(dist(first),3);
  expect(await document()).toBe(before);await expect(page.getByRole('menu')).toHaveCount(0);
 }
});

test('kitchen facade sides: choose both, floor default, undo redo and reload through UI',async({page})=>{
 await page.goto('/');await kitchenCatalog(page);await page.getByRole('button',{name:'Нижний кухонный',exact:true}).click();
 await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();
 await page.getByRole('button',{name:'Построение мебели',exact:true}).click();await openSettings(page,'Корпус');
 await page.getByLabel('Левая боковина — материал фасадов',{exact:true}).check();
 await expect(page.getByLabel('Фасадные боковины до пола',{exact:true})).toBeChecked();
 await page.getByLabel('Правая боковина — материал фасадов',{exact:true}).check();
 const sides=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project.modules[0].module.kitchen.facadeSides);
 expect(await sides()).toMatchObject({left:true,right:true});
 await page.locator('.scene canvas').click({position:{x:10,y:10}});await page.keyboard.press('Control+z');expect((await sides()).right).not.toBe(true);
 await page.keyboard.press('Control+y');expect((await sides()).right).toBe(true);await page.reload();expect(await sides()).toMatchObject({left:true,right:true});
 await page.getByRole('button',{name:'Построение мебели',exact:true}).click();await openSettings(page,'Корпус');
 await expect(page.getByLabel('Правая боковина — материал фасадов',{exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Приблизить выбранный корпус',exact:true}).click();await page.waitForTimeout(700);
 await page.screenshot({path:'.qa/release/facade-sides.png',fullPage:true});
});

test('facade preview panel fits laptop viewport and never saves an unapplied draft',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 await page.goto('/');await page.getByRole('button',{name:'Свернуть верхнюю панель',exact:true}).click();await page.getByRole('button',{name:'Добавить первый шкаф'}).click();await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
 await page.getByRole('button',{name:'Спереди',exact:true}).click();await page.getByRole('button',{name:'Приблизить выбранный корпус',exact:true}).click();
 await page.waitForTimeout(700);const canvas=page.locator('.scene canvas'),b=(await canvas.boundingBox())!;
 await canvas.click({button:'right',position:{x:b.width/2,y:b.height/2}});await page.getByRole('menuitem',{name:/^Фасад\./}).click();await page.getByRole('menuitem',{name:/^Редактировать фасад\./}).click();
 const panel=page.getByRole('region',{name:'Редактор фасадов'});await expect(panel).toBeVisible();await expect(page.locator('.modal-backdrop')).toHaveCount(0);
 const before=await page.evaluate(()=>localStorage.getItem('garderyob-rooms-v1'));
 await panel.getByLabel('Основа фасадов',{exact:true}).selectOption('vernissage');
 await panel.getByLabel('Покрытие Вернисаж',{exact:true}).selectOption('enamel-matte');
 const apply=panel.getByRole('button',{name:'Применить к корпусу',exact:true});await apply.scrollIntoViewIfNeeded();const box=(await apply.boundingBox())!;expect(box.y+box.height).toBeLessThanOrEqual(720);
 const pb=(await panel.boundingBox())!,cb=(await canvas.boundingBox())!;expect(pb.x).toBeGreaterThanOrEqual(cb.x+cb.width-1);
 expect(await page.evaluate(()=>localStorage.getItem('garderyob-rooms-v1'))).toBe(before);
 await page.screenshot({path:'.qa/release/panel-laptop.png'});await panel.getByRole('button',{name:'Отмена',exact:true}).click();
 expect(await page.evaluate(()=>localStorage.getItem('garderyob-rooms-v1'))).toBe(before);
});
