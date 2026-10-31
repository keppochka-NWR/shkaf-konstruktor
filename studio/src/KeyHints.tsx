// Нижняя строка клавиш (Макс 31.10: «основные клавиши выделить на основном фоне, чтобы бросались в глаза»): клавиши — плашками
// на сплошной полосе, по контексту режима; «?» — полный список (окно «Как пользоваться»). Полный текст — в подсказке .view-keys.
import {HelpCircle} from 'lucide-react';
import type {ReactNode} from 'react';

export const KEYS_TITLE='W — сверху, S — спереди, A — слева, D — справа, E — 3D, P — план. Q — вспомогательная линия (спереди, сверху, сбоку и на «Плане»; линии «Сверху» и «Плана» общие): щёлкните линию, наберите размер и Enter; щелчок по линии и Delete — убрать. Тяните за угол выбранного корпуса — два размера сразу; во время тяги наберите «600;2400» и Enter — точные размеры в порядке плашки (одно число — первый размер, «;2400» — второй). R — повернуть выбранный корпус (или отмеченную группу) на 90° по часовой, Shift+R — против. Ctrl+Z — назад, Ctrl+Y — вперёд. Esc — закрыть меню, отменить перетаскивание, снять выделение детали, затем модуля';

const K=({k}:{k:string})=><kbd>{k}</kbd>;
/** Одна подсказка: плашки клавиш и короткое слово. */
function Hint({keys,children,className}:{keys:string[];children:ReactNode;className?:string}){
 return <span className={'key-hint'+(className?' '+className:'')}>{keys.map(k=><K key={k} k={k}/>)}<span>{children}</span></span>;
}

export function KeyHints({mode,moveAll,group,snapping,focus,onHelp}:{mode:string;moveAll:boolean;group:number;snapping:boolean;focus:boolean;onHelp:()=>void}){
 // что делает мышь в текущем режиме — одна фраза (сценарии читают «Отмеченные корпуса двигаются вместе»)
 const action=mode==='move'?(moveAll?'Тяните любой корпус — движется вся композиция':group>1?'Отмеченные корпуса двигаются вместе':'Тяните корпус'):mode==='fill'?'Полки и ящики — по высоте, перегородки — по ширине':mode==='select'?'Нажмите на деталь, чтобы выбрать':'Перетащите, чтобы повернуть';
 return <div className="orbit-help key-hints" role="note" aria-label="Клавиши">
  <span className="key-action">{focus?'Крупный вид · ':''}{action}</span>
  {mode==='move'&&(snapping?<><Hint keys={['Shift']}>группа</Hint><Hint keys={['Alt']}>к линии</Hint><Hint keys={['Ctrl']}>к пересечению</Hint></>:<span className="key-off">привязки выключены (галочка слева)</span>)}
  <span className="view-keys" title={KEYS_TITLE}><Hint keys={['W','A','S','D']}>виды</Hint><Hint keys={['E']}>3D</Hint><Hint keys={['Q']}>линия</Hint><Hint keys={['R']}>поворот</Hint><Hint keys={['Esc']}>снять</Hint></span>
  <Hint keys={['Колесо']} className="key-wide">масштаб</Hint>
  <b className="rmb-hint"><Hint keys={['ПКМ']}>меню действий</Hint></b>
  <button type="button" className="key-help" aria-label="Все клавиши и приёмы" title="Все клавиши и приёмы" onClick={onHelp}><HelpCircle size={15}/></button>
 </div>;
}
