// A5 raw-ui (аудит 11.10.2026): подсказка этапа для сырого модуля Базиса и пределы полей KitchenPanel — те же, что у validate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,validate,grooveInsetMax,RULES} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {STAGES,RAW_FILLING_HINT,stageHint} from '../src/stages';

const hintOf=(id:string)=>STAGES.find(s=>s.id===id)!.hint;

// этапы по решению Макса 14.10: «Наполнение»/«Фасады» слиты в «Построение мебели» (bodies), старые id нормализуются
test('подсказка этапа: «Построение мебели» с выбранным сырым модулем Базиса — про Базис, остальные этапы и шкафы студии — прежние',()=>{
  assert.equal(stageHint('bodies',true),RAW_FILLING_HINT);
  assert.equal(stageHint('filling',true),RAW_FILLING_HINT);
  assert.match(RAW_FILLING_HINT,/Базис/);
  assert.equal(stageHint('bodies',false),hintOf('bodies'));
  assert.equal(stageHint('bodies'),hintOf('bodies'));
  assert.equal(stageHint('filling'),hintOf('bodies'));
  for(const s of STAGES)if(s.id!=='bodies')assert.equal(stageHint(s.id,true),s.hint,s.id);
});

test('«Паз от задней кромки»: предел поля = предел validate — кухня до depth−32 (k20 m05: 119 принимается), шкаф 30',()=>{
  const k=kitchenBase({...initialModule(),sections:[section()]},600);
  k.backType='groove';
  assert.equal(grooveInsetMax(k),k.depth-32);
  assert.ok(grooveInsetMax(k)>=119,'глубина кухонного модуля даёт место пазу 119');
  const groove=(m:typeof k)=>validate(m).filter(e=>/Паз/.test(e));
  k.grooveInset=119;assert.deepEqual(groove(k),[]);
  k.grooveInset=grooveInsetMax(k);assert.deepEqual(groove(k),[]);
  k.grooveInset=grooveInsetMax(k)+1;assert.equal(groove(k).length,1);
  const w={...initialModule(),sections:[section()],backType:'groove' as const};
  assert.equal(grooveInsetMax(w),30);
  w.grooveInset=30;assert.deepEqual(groove(w as typeof k),[]);
  w.grooveInset=31;assert.equal(groove(w as typeof k).length,1);
});

test('«Высота опор»: нижний предел поля — RULES.feetMin (15), как в validate, а не 55',()=>{
  assert.equal(RULES.feetMin,15);
  const k=kitchenBase({...initialModule(),sections:[section()]},600);
  assert.ok(k.feet,'у кухонного модуля есть опоры');
  const feet=(h:number)=>validate({...k,feet:{...k.feet!,height:h}}).filter(e=>/Ножки/.test(e));
  assert.deepEqual(feet(RULES.feetMin),[]);
  assert.equal(feet(RULES.feetMin-1).length,1);
});
