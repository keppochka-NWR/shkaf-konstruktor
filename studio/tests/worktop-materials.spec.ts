import {test,expect,type Page} from '@playwright/test';

// Задача Макса 19.10.2026: материал столешницы руками менеджера — панель и правая кнопка по столешнице.
// Запуск: WT_URL=http://127.0.0.1:5291 npx playwright test -c playwright.worktop.config.ts
const SHOTS=process.env.WT_SHOTS??'';
async function state(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('garderyob-rooms-v1')!).rooms[0].project);}
async function add(page:Page,kind:string){await page.getByRole('tab',{name:'Кухонные модули',exact:true}).click();await page.getByRole('button',{name:kind,exact:true}).click();await page.getByRole('button',{name:'Добавить в комнату',exact:true}).click();}
const top=async(page:Page)=>(await state(page)).modules.find((a:any)=>a.module.worktop);
const shot=async(page:Page,name:string)=>{if(SHOTS)await page.screenshot({path:`${SHOTS}/${name}.png`});};

test('столешница: материал в панели и через правую кнопку — толщина, высота, смета',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await add(page,'Нижний кухонный');
  await page.getByRole('button',{name:/^(?:2 )?Построение мебели$/}).click();
  await add(page,'Столешница');
  await expect(page.getByRole('alert')).toHaveCount(0);
  let t=await top(page);expect(t.module.worktop.material).toBe('postforming');expect(t.module.height).toBe(38);
  // панель: выбор «Компакт 12»
  const sel=page.getByLabel('Материал столешницы',{exact:true});
  // группа «Столешница» в панели свёрнута (open у Group не применяется) — менеджеру нужен лишний клик, чтобы увидеть материал
  if(!(await sel.isVisible()))await page.locator('.kitchen-panel summary',{hasText:'Столешница'}).first().click();
  await expect(sel).toBeVisible();
  await sel.selectOption('compact-12');
  t=await top(page);expect(t.module.worktop).toMatchObject({material:'compact',thickness:12});expect(t.module.height).toBe(12);
  await expect(page.getByText('Толщина по материалу: 12 мм',{exact:false})).toBeVisible();
  await shot(page,'01-panel-compact-12');
  // акрил: галочка подклейки 12 ↔ 40
  await sel.selectOption('acrylic-12');
  await page.getByLabel('С подклейкой до 40 мм').check();
  t=await top(page);expect(t.module.worktop).toMatchObject({material:'acrylic',thickness:40});expect(t.module.height).toBe(40);
  await shot(page,'02-panel-acrylic-40');
  // правая кнопка по столешнице в списке модулей → «Материал столешницы ›» → «Кварц 20»
  await page.locator('.module-item').last().click({button:'right'});
  await page.getByRole('menuitem',{name:/^Материал столешницы\./}).click();
  await shot(page,'03-radial-worktop-material');
  await page.getByRole('menuitem',{name:/^Кварц 20\./}).click();
  t=await top(page);expect(t.module.worktop).toMatchObject({material:'quartz',thickness:20});expect(t.module.height).toBe(20);
  // перезагрузка — сохраняется
  await page.reload();t=await top(page);expect(t.module.worktop).toMatchObject({material:'quartz',thickness:20});
  await shot(page,'04-after-reload-quartz-20');
  // смета: строки кварца за м² и торец — «после финального расчёта конструктором»
  await page.getByRole('button',{name:'Стоимость',exact:true}).click();await page.getByRole('button',{name:'Стоимость проекта',exact:true}).click();
  await expect(page.getByText(/Столешница кварц 20 мм/).first()).toBeVisible();await expect(page.getByText(/Обработка лицевого торца: кварц 20 мм/).first()).toBeVisible();
  await shot(page,'05-cost-quartz-20');
  expect(errors).toEqual([]);
});
