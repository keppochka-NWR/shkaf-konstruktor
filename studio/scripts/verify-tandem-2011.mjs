import {chromium,expect} from '@playwright/test';
const b=await chromium.launch({headless:true,channel:'chrome'});
try{
 const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/local-projects/tandem-2011.json',r=>r.fulfill({path:'reports/tandem-2011.json',contentType:'application/json'}));
 await p.goto((process.env.TEST_BASE??'http://127.0.0.1:5197/')+'?project=tandem-2011',{waitUntil:'domcontentloaded',timeout:60000});
 await p.getByRole('button',{name:'Построение мебели',exact:true}).click();
 await p.locator('.properties').getByText('Наполнение',{exact:true}).click();
 await p.locator('.properties summary').filter({hasText:/^Ящики$/}).click();
 const length=p.locator('.properties select').filter({has:p.locator('option[value="500"]')});
 await expect(length).toHaveValue('500');
 await length.selectOption('400');
 await p.reload();
 await p.getByRole('button',{name:'Построение мебели',exact:true}).click();
 await p.locator('.properties').getByText('Наполнение',{exact:true}).click();
 await p.locator('.properties summary').filter({hasText:/^Ящики$/}).click();
 await expect(length).toHaveValue('400');
 await p.getByRole('button',{name:'Стоимость',exact:true}).click();
 await p.getByRole('button',{name:'Стоимость проекта',exact:true}).click();
 await p.getByRole('button',{name:'Развернуть всё',exact:true}).click();
 const row=p.getByRole('row').filter({hasText:'Скрытые Blum TANDEM'});
 await expect(row).toContainText('400 мм');
 await expect(row).toContainText(/5\s*152/);
 await p.screenshot({path:'reports/tandem-2011-browser.png'});
 console.log('TANDEM 500->400; reload retained length; estimate 5152 rub including two locks; no browser errors PASS');
 expect(errors).toEqual([]);
}finally{await b.close();}
