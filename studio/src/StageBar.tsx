import {ChevronLeft,ChevronRight,Check,SlidersHorizontal} from 'lucide-react';
import {STAGES,stageIndex,nextStage,prevStage,type Stage} from './stages';
type Props={stage:Stage;advanced:boolean;onStage:(s:Stage)=>void;onAdvanced:(v:boolean)=>void;done:Partial<Record<Stage,boolean>>};
/** Полоса этапов над рабочей областью: цветные шаги, подсказка, «Назад» / «Дальше», переключатель «Все настройки». */
export function StageBar({stage,advanced,onStage,onAdvanced,done}:Props){
  const i=stageIndex(stage),current=STAGES[i];
  return <nav className="stage-bar" aria-label="Этапы работы" style={{'--stage':current.color} as React.CSSProperties}>
    <ol className="stage-steps">
      {STAGES.map((s,k)=><li key={s.id}><button className={'stage-step'+(s.id===stage?' current':'')+(k<i?' passed':'')} style={{'--step':s.color} as React.CSSProperties} aria-current={s.id===stage?'step':undefined} onClick={()=>onStage(s.id)}><span className="stage-num">{done[s.id]&&s.id!==stage?<Check size={13}/>:s.n}</span><span className="stage-title">{s.title}</span></button></li>)}
    </ol>
    <p className="stage-hint" aria-live="polite"><b>{current.n}. {current.title}.</b> {current.hint}</p>
    <div className="stage-actions">
      <button className="outline" disabled={i===0} onClick={()=>onStage(prevStage(stage))}><ChevronLeft size={15}/> Назад</button>
      <button className="primary" disabled={i===STAGES.length-1} onClick={()=>onStage(nextStage(stage))}>Дальше: {STAGES[Math.min(STAGES.length-1,i+1)].title} <ChevronRight size={15}/></button>
      <label className="stage-advanced" title="Показать все панели независимо от этапа"><input type="checkbox" checked={advanced} onChange={e=>onAdvanced(e.target.checked)}/><SlidersHorizontal size={14}/> Все настройки</label>
    </div>
  </nav>;
}
