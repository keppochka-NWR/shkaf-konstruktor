import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,renameSync,readFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

// scripts/parts-snapshot.ts: переименованный файл проекта с теми же деталями — не отличие,
// эталон .qa/parts-baseline.json подхватывает новый ключ сам (старый ключ не печатается).
const script=resolve('scripts/parts-snapshot.ts');
const run=(cwd:string,...args:string[])=>{const r=spawnSync(process.execPath,[fileURLToPath(import.meta.resolve('tsx/cli')),script,...args],{cwd,encoding:'utf8'});return {code:r.status,out:(r.stdout||'')+(r.stderr||'')};};

test('parts-snapshot treats a renamed project file with identical parts as a rename, not a diff',{timeout:120000},()=>{
  const t=mkdtempSync(join(tmpdir(),'snap-'));
  try{
    mkdirSync(join(t,'examples','orders'),{recursive:true});
    copyFileSync('examples/orders/1-6990041.project.json',join(t,'examples','orders','1-6990041.project.json'));
    const w=run(t,'--write');assert.equal(w.code,0,w.out);
    const same=run(t);assert.equal(same.code,0,same.out);assert.match(same.out,/шкафы без изменений/);assert.doesNotMatch(same.out,/переименован/);
    renameSync(join(t,'examples','orders','1-6990041.project.json'),join(t,'examples','orders','1-0000001.project.json'));
    const ren=run(t);assert.equal(ren.code,0,ren.out);
    assert.match(ren.out,/переименован \(детали те же\): → examples\/orders\/1-0000001\.project\.json#0/);
    assert.match(ren.out,/шкафы без изменений/);
    assert.doesNotMatch(ren.out,/1-6990041/,'old key is never printed');
    const base=JSON.parse(readFileSync(join(t,'.qa','parts-baseline.json'),'utf8')) as Record<string,unknown>;
    assert.ok(Object.keys(base).some(k=>k.startsWith('examples/orders/1-0000001.project.json#')),'baseline rewritten with the new key');
    assert.ok(!Object.keys(base).some(k=>k.includes('1-6990041')),'old key removed from baseline');
    const again=run(t);assert.equal(again.code,0,again.out);assert.doesNotMatch(again.out,/переименован/);
  }finally{rmSync(t,{recursive:true,force:true});}
});
