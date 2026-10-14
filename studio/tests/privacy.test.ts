import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

// Правило Макса: фамилии и имена клиентских папок — никогда в код, тесты, документы.
// Ключи заказов и имена файлов примеров — только номера заказов (или дата для заказов без номера).

const ORDER_KEY=/^\d+-\d[\d_]*(-[a-z]{1,3})?$/; // 1-6990041, 4-03_06_26-su

test('examples/orders: file names are order numbers, not client names',()=>{
  const files=readdirSync('examples/orders').filter(f=>f.endsWith('.project.json'));
  assert.ok(files.length>=7);
  for(const f of files)assert.match(f.replace(/\.project\.json$/,''),ORDER_KEY,f);
});

test('scripts/orders.ts: project keys and titles carry order numbers only',()=>{
  const src=readFileSync('scripts/orders.ts','utf8');
  const keys=[...src.matchAll(/^  "([^"]+)": \{/gm)].map(m=>m[1]);
  assert.ok(keys.length>=6,'order keys found: '+keys.length);
  for(const k of keys)assert.match(k,ORDER_KEY,k);
  for(const m of src.matchAll(/^    title: "([^"]+)"/gm)){
    // заголовок: «<номер> — …» или «<дата> — …», без слова с заглавной буквы сразу после номера
    assert.doesNotMatch(m[1],/^\d{7} [А-ЯЁ][а-яё]+/,'title starts with order number and a capitalised word: '+m[1].replace(/[А-ЯЁа-яё]/g,'*'));
  }
});

test('ClientWorkspace: client placeholder shows an order number without a name (goes into the public bundle)',()=>{
  const src=readFileSync('src/ClientWorkspace.tsx','utf8');
  const m=src.match(/placeholder="([^"]*)"/g)!.map(s=>s.slice(13,-1)).find(s=>s.startsWith('Например'));
  assert.ok(m,'placeholder found');
  assert.match(m!,/^Например: \d{7}$/);
});

const py=spawnSync('py',['-I','-c','print(1)'],{encoding:'utf8'});
const hasPy=py.status===0;

function scan(dir:string,args:string[]){
  const r=spawnSync('py',['-I','scripts/privacy-scan.py',dir,...args],{encoding:'utf8'});
  return {code:r.status,out:(r.stdout||'')+(r.stderr||'')};
}

test('privacy-scan: tokens from index.json, names-dir and tokens file; output is masked',{skip:!hasPy&&'py not installed'},()=>{
  const t=mkdtempSync(join(tmpdir(),'privacy-'));
  try{
    // синтетические «фамилии» — таких людей нет
    mkdirSync(join(t,'projects'));mkdirSync(join(t,'files'));
    writeFileSync(join(t,'index.json'),JSON.stringify([{path:'База\\Кухни\\Зюквалов кухня\\a.b3d'},{path:'База\\Кухни\\Прихожая\\b.b3d'}]));
    writeFileSync(join(t,'projects','7000001-фыргунов.json'),'{}');
    writeFileSync(join(t,'projects','kitchen-x.json'),'{}');
    writeFileSync(join(t,'tokens.txt'),'# комментарий\nquxbarov\n\n');
    writeFileSync(join(t,'files','clean.md'),'прихожая 7000001, кухня со шкафом, qux\n');
    writeFileSync(join(t,'files','dirty.md'),'заказ Зюквалова\nклиент fyrgunov\nmail quxbarov@x\n');
    const common=['--index',join(t,'index.json'),'--names-dir',join(t,'projects'),'--tokens',join(t,'tokens.txt'),'--decors','none'];
    const d=scan(join(t,'files','dirty.md'),common);
    assert.equal(d.code,1,d.out);
    assert.match(d.out,/dirty\.md:1 /);assert.match(d.out,/dirty\.md:2 /);assert.match(d.out,/dirty\.md:3 /);
    assert.doesNotMatch(d.out,/Зюквалов|fyrgunov|quxbarov/i,'tokens never printed');
    assert.match(d.out,/З\*+|f\*+|q\*+/);
    const c=scan(join(t,'files','clean.md'),common);
    assert.equal(c.code,0,c.out);
    assert.match(c.out,/источники: index 1, names-dir 1, tokens 1/);
    // явно указанный файл токенов отсутствует — ошибка, а не «0 совпадений»
    const e=scan(join(t,'files','clean.md'),['--index',join(t,'index.json'),'--tokens',join(t,'missing.txt'),'--decors','none']);
    assert.equal(e.code,2);
  }finally{rmSync(t,{recursive:true,force:true});}
});
