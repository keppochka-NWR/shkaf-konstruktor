import{chromium,expect}from'@playwright/test';import fs from'node:fs';
const b=await chromium.launch({headless:true,channel:'chrome'});try{
for(const name of ['lights-2011-saved-project.json','resize-2111-saved.json']){
 const p=await b.newPage({viewport:{width:1500,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/local-projects/tandem-2011.json',r=>r.fulfill({path:'reports/tandem-2011.json',contentType:'application/json'}));await p.goto((process.env.TEST_BASE??'http://127.0.0.1:5198/')+'?project=tandem-2011',{waitUntil:'domcontentloaded',timeout:60000});await p.getByRole('button',{name:'Построение мебели',exact:true}).click();
 const filename='reports/'+name,expected=JSON.parse(fs.readFileSync(filename,'utf8'));console.log('Importing',name);const chooser=p.waitForEvent('filechooser');await p.getByRole('button',{name:'Открыть',exact:true}).click();await(await chooser).setFiles(filename);await expect(p.getByRole('textbox',{name:'Название модуля',exact:true})).toHaveValue(expected.modules[0].module.name);
 const done=p.waitForEvent('download');await p.getByRole('button',{name:'Сохранить проект файлом',exact:true}).click();const d=await done;const actual=JSON.parse(fs.readFileSync(await d.path(),'utf8'));expect(actual.modules).toEqual(expected.modules);expect(errors).toEqual([]);await p.close();
}
console.log('PASS opened downloaded lighting and resized files through Open; exported modules exactly preserved');
}finally{await b.close()}
