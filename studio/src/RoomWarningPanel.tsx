import {roomWarnings} from './roomWarnings';
import type {Project} from './project';
export function RoomWarnings({project,select}:{project:Project;select:(id:string)=>void}){
  const warnings=roomWarnings(project);
  if(!warnings.length)return null;
  return <div className="room-warnings"><h3>Проверьте расстановку</h3>{warnings.map(w=><button key={w.moduleId+(w.openingId??':ceiling')} onClick={()=>select(w.moduleId)}>{w.message}</button>)}<p>Подсказки не запрещают расстановку. У двери отмечена условная зона подхода 900 мм, у окна — 100 мм от стены. Направление открывания и радиаторы пока не учитываются.</p></div>;
}
