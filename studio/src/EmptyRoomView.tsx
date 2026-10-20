import {PanelTopOpen,PanelTopClose} from 'lucide-react';
import './editor-visibility.css';
import {WorkspacePanels} from './WorkspacePanels';
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {Download,Plus,RotateCcw,Box,FileText} from 'lucide-react';
import {EditorBrand} from './EditorBrand';
import {StageBar} from './StageBar';
import {STAGES,stageIndex,normalizeStage,rememberStage,type Stage} from './stages';
import {Scene,type View} from './Scene';
import {RoomPlan} from './RoomPlan';
import {RoomEditor} from './RoomEditor';
import {RoomFixtures} from './RoomFixtures';
import {RoomObstacles} from './RoomObstacles';
import {RoomSurveyEditor} from './RoomSurveyEditor';
import {RoomObjectProperties,type EnvironmentSelection} from './RoomObjectProperties';
import {newProject,appendModule,appendModuleGroup,applyAutoFillers,type Project,type Room} from './project';
import {ModulePalette} from './ModulePalette';
export function EmptyRoomView({project,update,viewKey,title,bar,onAdd,onDownload}:{project:Project;update:(p:Project)=>boolean;viewKey:string;title:string;bar:ReactNode;onAdd:()=>void;onDownload:()=>void}){
 const dummy=useMemo(()=>newProject().modules[0],[]),[plan,setPlan]=useState(false),[view,setView]=useState<View>('iso'),[fit,setFit]=useState(0),[stage,setStage]=useState<Stage>('room'),[advanced,setAdvanced]=useState(false),[selected,setSelected]=useState<EnvironmentSelection|null>(null);
 useEffect(()=>{setSelected(null);},[viewKey]);
 const [compactTop,setCompactTop]=useState(()=>{try{return localStorage.getItem('yo-compact-top')!=='0';}catch{return true;}});
 const toggleTop=()=>setCompactTop(v=>{try{localStorage.setItem('yo-compact-top',v?'0':'1');}catch{}return !v;});
 const change=(room:Room)=>update({...project,room});
 const pick=(kind:EnvironmentSelection['kind'],id:string)=>setSelected({kind,id});
 const go=(s:Stage)=>{setStage(normalizeStage(s));setSelected(null);};
 // T1 (18.10): первая мебель открывает редактор на «Построении мебели», а не возвращает на «Помещение».
 const addFirst=(ok:boolean)=>{if(ok)rememberStage('bodies');return ok;};
 const add=()=>{rememberStage('bodies');onAdd();};
 return <div className={'app empty-room-app'+(advanced?' advanced':'')+(compactTop?' compact-top':'')} data-stage={stage} style={{'--stage':STAGES[stageIndex(stage)].color} as React.CSSProperties}>
 <header className="header"><EditorBrand/><button className="top-toggle" aria-label={compactTop?"Заказ и инструменты":"Свернуть верхнюю панель"} aria-expanded={!compactTop} onClick={toggleTop}>{compactTop?<PanelTopOpen size={18}/>:<PanelTopClose size={18}/>}<span>{compactTop?'Заказ и инструменты':'Свернуть верхнюю панель'}</span></button><div className="document-name"><strong>{title}</strong><span>Помещение · без мебели</span></div><div className="header-actions"><button className="outline" onClick={add}><Plus size={16}/>Добавить первый шкаф</button><button className="primary" onClick={onDownload}><Download size={16}/><span>Скачать документ</span></button></div></header>
 <div className="editor-order-area" hidden={compactTop}>{bar}</div>
 <StageBar stage={stage} advanced={advanced} onStage={go} onAdvanced={setAdvanced} done={{}}/>
 <WorkspacePanels>
 <aside className="library"><div className="panel-heading"><span className="eyebrow">ПОМЕЩЕНИЕ</span><h1>{title}</h1><p>{project.room.width} × {project.room.depth} × {project.room.height} мм</p></div>
 <div className="stage-note"><b>{stage==='room'?'Начните с размеров комнаты':stage==='fixtures'?'Что мешает установке мебели?':'Комната готова к расстановке'}</b><p>{stage==='room'?'Введите размеры справа. Затем добавьте окна, двери и коммуникации.':stage==='fixtures'?'Добавьте объекты справа. Нажмите правой кнопкой по объекту, чтобы изменить его параметры.':'Добавьте первый шкаф, чтобы перейти к корпусам, наполнению и фасадам.'}</p></div>
 <div className="project-modules"><ModulePalette source={dummy.module} onAdd={m=>addFirst(update(applyAutoFillers(appendModule(project,m))))} onAddGroup={group=>addFirst(update(applyAutoFillers(appendModuleGroup(project,group).project)))}/></div>
 <div className="library-bottom"><p>Другие комнаты сохранены и скрыты. Переключение комнаты — в панели заказа сверху.</p></div></aside>
 <section className="viewport" aria-label="Рабочая область">
 <div className="view-header"><div className="view-tabs">{([{id:'iso',label:'3D'},{id:'front',label:'Спереди'},{id:'side',label:'Сбоку'},{id:'top',label:'Сверху'}] as const).map(v=><button key={v.id} aria-pressed={!plan&&view===v.id} onClick={()=>{setView(v.id);setPlan(false);setFit(f=>f+1);}}>{v.label}</button>)}<button aria-pressed={plan} aria-label="Показать план комнаты" onClick={()=>setPlan(true)}>План</button></div><span className="scale-label">РАЗМЕРЫ В ММ</span></div>
 <div className="interaction-bar"><button aria-pressed={!plan} onClick={()=>setPlan(false)}><RotateCcw size={16}/>Свободная камера</button><button onClick={()=>setFit(f=>f+1)}>Вписать комнату</button></div>
 {plan?<RoomPlan project={project} active="" moveAll={false} snapping={false} onSelect={()=>{}} onRoom={()=>{}} onObstacleSelect={id=>pick('obstacle',id)} onOpeningSelect={id=>pick('opening',id)} onFixtureSelect={id=>pick('fixture',id)} onEnvironmentContext={pick} update={update}/>:(          <Scene key={viewKey}
            viewKey={viewKey}
            module={dummy.module}
            arrangement={[dummy]}
            activeId={dummy.id}
            hideFurniture
            room={project.room}
            captureReady={() => {}}
            mode="orbit"
            moveAll={false}
            snap={(_, p) => p}
            onMoveModule={() => false}
            moveProblem={() => undefined}
            onMoveDivider={() => false}
            dividerProblem={() => undefined}
            partProblem={() => undefined}
            onMovePart={() => false}
            onDropItem={() => false}
            onTransfer={() => false}
            onObstacleSelect={(id) => pick("obstacle", id)}
            onFixtureSelect={(id) => pick("fixture", id)}
            onEnvironmentContext={pick}
            transparent={false}
            onModuleSelect={() => {}}
            onDimension={() => {}}
            onGap={() => {}}
            onPartSelect={() => {}}
            selected=""
            onSelect={() => {}}
            view={view}
            fit={fit}
            openDoors={false}
            exploded={false}
            dimensions={false}
            roomDimensions
          />)}
 </section>
 <aside className="properties"><section className="property-section"><h2>{stage==='fixtures'?'Коммуникации':'Замер помещения'}</h2>
 {(advanced||stage==='room')&&<><details><summary>Точки замера и кривые стены</summary><RoomSurveyEditor room={project.room} onChange={change}/></details>
 {(['width','depth','height'] as const).map(axis=><label className="number-field" key={axis}><span>{{width:'Ширина комнаты',depth:'Глубина комнаты',height:'Высота комнаты'}[axis]}</span><div><input type="number" aria-label={{width:'Ширина пустой комнаты',depth:'Глубина пустой комнаты',height:'Высота пустой комнаты'}[axis]} key={project.room[axis]} defaultValue={project.room[axis]} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.currentTarget.value=String(project.room[axis]);e.currentTarget.blur();}}} onBlur={e=>{const n=e.target.value.trim()?Number(e.target.value):NaN;if(n!==project.room[axis]&&!change({...project.room,[axis]:n}))e.target.value=String(project.room[axis]);}}/><span>мм</span></div></label>)}</>}
 {(advanced||stage==='room'||stage==='fixtures')&&<><details open><summary>Двери и окна</summary><RoomEditor room={project.room} part="openings" onSelect={id=>pick('opening',id)} onChange={change}/></details><details><summary>Трубы, радиаторы и объекты на стенах</summary><RoomFixtures room={project.room} onSelect={id=>pick('fixture',id)} onChange={change} onImport={r=>change(r.room)}/></details><details><summary>Колонны и отдельные препятствия</summary><RoomObstacles room={project.room} onSelect={id=>pick('obstacle',id)} onChange={change}/></details></>}
 {['bodies','filling','facades'].includes(stage)&&<><p className="field-note">В этой комнате пока нет мебели. Добавьте шкаф, чтобы настроить корпуса, наполнение и фасады.</p><button className="primary full" onClick={add}>Добавить шкаф в комнату</button></>}
 {stage==='docs'&&<><p className="field-note">Сохраните помещение с замером и проёмами. Деталировка появится после добавления мебели.</p><button className="outline full" onClick={onDownload}>Скачать документ комнат</button></>}
 </section></aside></WorkspacePanels>
 <div className="project-dock"><nav className="dock-bar" aria-label="Навигация по проекту"><button aria-pressed={stage!=='docs'} onClick={()=>go('room')}><Box size={17}/>Проект</button><button aria-pressed={stage==='docs'} onClick={()=>go('docs')}><FileText size={17}/>Документы</button><span className="empty-room-total">В комнате пока нет мебели</span></nav></div>
 {selected&&<RoomObjectProperties room={project.room} selection={selected} onChange={change} onClose={()=>setSelected(null)}/>}
 </div>;
}
