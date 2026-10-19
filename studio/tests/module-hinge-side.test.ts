// Меню корпуса «Фасады → Открывание»: перевесить все одностворчатые фасады корпуса на одну сторону (хотелка Макса 16.10).
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,section} from '../src/model';
import {setModuleHingeSide,singleLeafDoors} from '../src/facadeEditing';

const narrow=()=>({...initialModule(),width:450,height:2000,depth:550,doors:true,sections:[section()]});

test('одностворчатый корпус: петли справа, потом слева — меняется только сторона', () => {
  const m=narrow();
  assert.equal(singleLeafDoors(m).length,1);
  assert.equal(singleLeafDoors(m)[0].hinge,'left');
  assert.equal(setModuleHingeSide(m,'right'),1);
  assert.deepEqual(parts(m).filter(p=>p.role==='door').map(p=>p.hinge),['right']);
  setModuleHingeSide(m,'left');
  assert.deepEqual(parts(m).filter(p=>p.role==='door').map(p=>p.hinge),['left']);
});

test('двустворчатый корпус: пару не трогаем — понятная ошибка', () => {
  const m={...narrow(),width:900};
  const doors=parts(m).filter(p=>p.role==='door');
  assert.equal(doors.length,2);
  assert.equal(singleLeafDoors(m).length,0);
  assert.throws(()=>setModuleHingeSide(m,'right'),/одностворчатых/);
});
