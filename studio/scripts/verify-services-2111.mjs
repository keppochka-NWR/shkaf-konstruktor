import{chromium,expect}from'@playwright/test';
const b=await chromium.launch({headless:true,channel:'chrome'});try{
 const p=await b.newPage({viewport:{width:1600,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/local-projects/tandem-2011.json',r=>r.fulfill({path:'reports/tandem-2011.json',contentType:'application/json'}));
 await p.goto((process.env.TEST_BASE??'http://127.0.0.1:5197/')+'?project=tandem-2011');await p.getByRole('button',{name:'Построение мебели',exact:true}).click();
 async function open(){await p.getByRole('button',{name:'Стоимость',exact:true}).click();await p.getByRole('button',{name:'Стоимость проекта',exact:true}).click();await p.locator('summary').filter({hasText:'Доставка, подъём, монтаж и дополнительные услуги'}).click();}
 await open();await p.getByRole('checkbox',{name:'Монтаж — 15% стоимости каркасов и фасадов',exact:true}).check();
 await p.getByRole('combobox',{name:'Тариф подъёма'}).selectOption('floors');await p.getByRole('spinbutton',{name:'Количество оплачиваемых этажей'}).fill('4');await p.getByRole('spinbutton',{name:'Количество оплачиваемых этажей'}).press('Enter');
 await p.getByRole('checkbox',{name:'Доставка',exact:true}).check();await expect(p.locator('.sales-total')).toHaveText('Требует уточнения');
 await p.getByRole('spinbutton',{name:'Стоимость доставки',exact:true}).fill('1500');await p.getByRole('spinbutton',{name:'Стоимость доставки',exact:true}).press('Enter');
 await p.getByRole('button',{name:'Развернуть всё',exact:true}).click();
 await expect(p.getByRole('row').filter({hasText:'Монтаж — 15%'})).toContainText(/6\s*900/);
 await expect(p.getByRole('row').filter({hasText:'Подъём по этажам'})).toContainText('600');
 await p.reload();await p.getByRole('button',{name:'Построение мебели',exact:true}).click();await open();
 await expect(p.getByRole('spinbutton',{name:'Стоимость доставки',exact:true})).toHaveValue('1500');
 await expect(p.getByRole('spinbutton',{name:'Количество оплачиваемых этажей'})).toHaveValue('4');
 const floors=p.getByRole('spinbutton',{name:'Количество оплачиваемых этажей'});await floors.fill('2.5');await floors.press('Enter');await expect(p.getByRole('alert').filter({hasText:'Введите целое число'})).toBeVisible();await floors.press('Escape');await expect(floors).toHaveValue('4');
 await p.getByRole('checkbox',{name:'Замер',exact:true}).check();const qty=p.getByRole('spinbutton',{name:'Количество: Замер',exact:true}),rate=p.getByRole('spinbutton',{name:'Цена: Замер',exact:true});await qty.fill('2');await qty.press('Enter');await rate.fill('700');await rate.press('Enter');
 await p.getByRole('combobox',{name:'Тариф подъёма'}).selectOption('fixed');
 await p.getByRole('button',{name:'Развернуть всё',exact:true}).click();await expect(p.getByRole('row').filter({hasText:'Подъём — фиксированно'})).toContainText('800');
 await expect(p.getByRole('row').filter({hasText:'Замер'})).toContainText(/1\s*400/);await p.getByRole('row').filter({hasText:'Монтаж — 15%'}).scrollIntoViewIfNeeded();await p.screenshot({path:'reports/services-2011-browser.png'});
 expect(errors).toEqual([]);console.log('Services input, unknown rate, totals, mutually exclusive lift tariffs, reload PASS');
}finally{await b.close();}
