import {surfacePoint,surfaceOffset,type Surface} from './roomSurvey';
import {moveComposition} from './operations';
import {openingZone,roomWarnings} from './roomWarnings';
import {useEffect,useRef,useState} from 'react';
import {projectErrors,bounds,moduleFootprint,localToRoom,snapComposition,snapPlacement,type Project,type Opening} from './project';
import {FIXTURES,fixtureBox,fixtureLabel} from './fixtures';
import {candidateLines,guidesInView,guideSegment,makeGuide,nearestPlanLine,parseTyped,placeGuide,snapMoveToGuides,v3,carcassCorners,PLAN_LOOK,type Guide,type GuideLine,type V3} from './guides';
import {cornerPullFromDelta,typedCornerPull,parseCornerTyped,cornerHandleTitle,DIM_WORD,type CornerPull,type CornerPlan,type End} from './cornerStretch';
import {editsText} from './historyShortcuts';
import {altKeyupGuard,acrossSegments,ctrlDragStarts,wheelGuard,historyGuard,snapMode,isPointMode,toView,fromView,viewDelta,toSegments,pointSnap,snapDelta,nearestOutlineCorner,hitText,POINT_SNAP_PX,type SnapMode,type Seg2,type P2,type PointHit} from './pointSnap';
import './guides.css';
// Привязки клавишами (решение Макса 29.10.2026, pointSnap.ts) — как в сцене: Alt — точка на ближайшей линии (вспомогательные,
// контуры корпусов, стены), Ctrl — ближайшее пересечение двух линий, Shift — без привязки. Для угла, переноса корпуса и линии Q.
// Ctrl+щелчок по корпусу без движения — по-прежнему отметить его; Ctrl+протяжка — перенос с привязкой к пересечениям.
type PtrLike={clientX:number;clientY:number;altKey:boolean;ctrlKey:boolean;metaKey:boolean;shiftKey:boolean;pointerId?:number};
// План = вид сверху (решение Макса 29.10.2026: вспомогательные линии Q и ручки углов — везде, включая «План»): ручки углов выбранного
// корпуса — ширина + глубина, противоположный угол на месте (те же правила, привязки, отмена и отказ, что в виде «Сверху» — App.planCorner);
// линии Q общие с видом «Сверху» (те же координаты помещения, look = +Y, guides.ts PLAN_LOOK); перетаскивание корпуса привязывается к ним.
// Во время тяги за угол можно набрать «600;2400» (ширина;глубина) и Enter.
type Corner={mid:string;ends:[End,End];start:{x:number;y:number};origin:[number,number];pointerId:number;moved:boolean;pull?:CornerPull;typed:string;mouse:[number,number];mode:SnapMode;segs?:Seg2[]};
type Tool={phase:'pick';lines:GuideLine[];hover?:GuideLine}|{phase:'place';base:GuideLine;typed:string;at?:number;dist?:number;segs?:Seg2[]};
const DIMS:['width','depth']=['width','depth'];
const PICK_HINT='Q: наведите на линию (край корпуса, деталь, стена, другая линия) и щёлкните · Esc — отмена';
type Props={stretchable?:boolean;cornerPlan?:(pull:CornerPull)=>CornerPlan;onCorner?:(pull:CornerPull)=>boolean;guides?:Guide[];onGuides?:(next:Guide[])=>boolean;onToggleModule?:(id:string)=>void;hiddenModuleIds?:string[];onModuleContext?:(mid:string,x:number,y:number)=>void;onEnvironmentContext?:(kind: 'opening'|'fixture'|'obstacle',id:string)=>void;showModules?:boolean;groupIds?:string[];moveAll:boolean;snapping:boolean;project:Project;active:string;onSelect:(id:string)=>void;onRoom:()=>void;selectedObstacle?:string;onObstacleSelect:(id:string)=>void;selectedOpening?:string;onOpeningSelect:(id:string)=>void;selectedFixture?:string;onFixtureSelect?:(id:string)=>void;onDimension?:(kind:'room'|'opening'|'fixture',id:string,field:string,value:number)=>void;update:(p:Project)=>boolean};
type Drag={kind:'module'|'opening'|'obstacle'|'fixture';id:string;start:{x:number;y:number};origin:{x:number;z:number};pointerId:number;ref?:P2;segs?:Seg2[]};
export function RoomPlan({stretchable,cornerPlan,onCorner,guides,onGuides,onToggleModule,hiddenModuleIds=[],onModuleContext,onEnvironmentContext,showModules=true,groupIds=[],moveAll,snapping,project,active,onSelect,onRoom,selectedOpening,onOpeningSelect,selectedObstacle,onObstacleSelect,selectedFixture,onFixtureSelect,onDimension,update}:Props){
  const svg=useRef<SVGSVGElement>(null),drag=useRef<Drag|null>(null),[preview,setPreview]=useState<Project|null>(null);
  const p=preview||project,r=p.room,margin=Math.max(r.width,r.depth)*0.1;
  const [measuring,setMeasuring]=useState(false),[firstPoint,setFirstPoint]=useState<[number,number]|null>(null);
  const [coords,setCoords]=useState(['0','0','1000','0']);
  const [dimError,setDimError]=useState(''),[sliceHeight,setSliceHeight]=useState(1000);
  function addDimension(from:[number,number],to:[number,number]){
    if(Math.hypot(to[0]-from[0],to[1]-from[1])<1){setDimError('Выберите две разные точки.');return false;}
    const next={...project,dimensions:[...(project.dimensions??[]),{id:crypto.randomUUID(),from,to}]};
    const error=projectErrors(next,project.modules.length===0)[0];if(error){setDimError(error);return false;}
    if(!update(next))return false;setDimError('');setFirstPoint(null);return true;
  }
  function measurePoint(e:React.PointerEvent){
    if(!measuring||e.button!==0)return;e.stopPropagation();e.preventDefault();
    const pt=point(e),q:[number,number]=[Math.max(0,Math.min(r.width,Math.round(pt.x))),Math.max(0,Math.min(r.depth,Math.round(pt.y)))];
    if(firstPoint)addDimension(firstPoint,q);else setFirstPoint(q);
  }
  const warnings=roomWarnings(p);
  const problem=preview?projectErrors(preview,project.modules.length===0)[0]:undefined;
  function point(e:{clientX:number;clientY:number}){const pt=new DOMPoint(e.clientX,e.clientY),matrix=svg.current?.getScreenCTM();return matrix?pt.matrixTransform(matrix.inverse()):pt;}
  // ── Ручки углов и вспомогательные линии Q (решение Макса 29.10.2026) ──────────────────────────────────────────────────────────
  const box=useRef<HTMLDivElement>(null),corner=useRef<Corner|null>(null),mouse=useRef<[number,number]|null>(null);
  const [badge,setBadge]=useState<{text:string;invalid:boolean;x:number;y:number}|null>(null);
  const [tool,setTool]=useState<Tool|null>(null),[selGuide,setSelGuide]=useState<string|null>(null);
  const planGuides=guidesInView(guides,PLAN_LOOK),center:V3={x:r.width/2,y:0,z:r.depth/2};
  const seg=(g:Guide)=>{const [a,b]=guideSegment({n:v3(g.n),at:g.at},PLAN_LOOK,center);return {id:g.id,a,b};};
  function toRoom(clientX:number,clientY:number):V3{const q=new DOMPoint(clientX,clientY),m=svg.current?.getScreenCTM(),t=m?q.matrixTransform(m.inverse()):q;return {x:t.x,y:0,z:t.y};}
  /** мм на пиксель экрана (толщина линий, размер ручек, допуск привязки). */
  function mmPx(){const m=svg.current?.getScreenCTM();return m&&m.a?1/m.a:(r.width+margin*2)/900;}
  /** Допуск привязки 10 px, как в сцене; потолок 60 мм (в сцене 30): план не масштабируется колесом, 1 px здесь ≈ 10 мм,
   *  и 30 мм были бы 3 px — привязку было бы не поймать. */
  const snapTol=()=>Math.min(60,Math.max(2,10*mmPx()));
  // ── Alt/Ctrl/Shift (pointSnap.ts) ──
  const [mark,setMark]=useState<PointHit|null>(null),modeRef=useRef<SnapMode>('snap');
  const ctrlPress=useRef<{id:string;x:number;y:number;pointerId:number}|null>(null);
  /** Допуск привязки к точке, мм: 14 px (без потолка — Alt/Ctrl нажаты нарочно). */
  const pointTol=()=>Math.max(1,POINT_SNAP_PX*mmPx());
  /** Линии плана для Alt/Ctrl: вспомогательные, контуры видимых корпусов (кроме тех, что тянутся), кромки выбранного, стены. */
  function planSegs(exclude:string[]):Seg2[]{
    const mods=showModules?project.modules.filter(a=>!hiddenModuleIds.includes(a.id)&&!exclude.includes(a.id)):[];
    return toSegments(candidateLines(mods,PLAN_LOOK,active,project.room,guides),PLAN_LOOK);
  }
  const showMark=(hit:PointHit|undefined)=>setMark(m=>hit?(m&&m.p.h===hit.p.h&&m.p.v===hit.p.v&&m.kind===hit.kind?m:hit):null);
  const modeText=(mode:SnapMode,hit:PointHit|undefined)=>mode==='snap'?'':hitText(hit,mode)+' · ';
  function say(text:string,invalid:boolean,clientX?:number,clientY?:number){
    const el=box.current;if(!el)return;const b=el.getBoundingClientRect(),[cx,cy]=clientX!==undefined&&clientY!==undefined?[clientX,clientY]:mouse.current??[b.left+b.width/2,b.top+120];
    setBadge({text,invalid,x:Math.max(8,Math.min(cx-b.left,b.width-8))+el.scrollLeft,y:Math.max(40,cy-b.top-22)+el.scrollTop});
  }
  const moduleOf=(id:string)=>project.modules.find(x=>x.id===id);
  function startCorner(e:React.PointerEvent,ends:[End,End]){
    if(e.button!==0||!onCorner||tool||drag.current||corner.current)return;e.preventDefault();e.stopPropagation();
    const pt=point(e);corner.current={mid:active,ends,start:{x:pt.x,y:pt.y},origin:[e.clientX,e.clientY],pointerId:e.pointerId,moved:false,typed:'',mouse:[e.clientX,e.clientY],mode:snapMode(e)};
    svg.current?.setPointerCapture(e.pointerId);
    say('Тяните угол: ширина и глубина · цифры «ширина;глубина» + Enter — точно',false,e.clientX,e.clientY);
  }
  function cornerByMouse(c:Corner){
    const a=moduleOf(c.mid);if(!a||!cornerPlan)return;
    const P=toRoom(c.mouse[0],c.mouse[1]);let delta:V3={x:P.x-c.start.x,y:0,z:P.z-c.start.y},hit:PointHit|undefined;
    if(isPointMode(c.mode)){
      // Alt/Ctrl: сам угол — на точку линии / в пересечение (размеры точно, без шага 10 мм)
      c.segs??=planSegs([c.mid]);const q=localToRoom(a,c.ends[0]==='hi'?a.module.width:0,c.ends[1]==='hi'?a.module.depth:0);
      const r=snapDelta(c.mode,toView({x:q.x,y:0,z:q.z},PLAN_LOOK),toView(delta,PLAN_LOOK),c.segs,pointTol());hit=r.hit;delta=viewDelta(r.delta.h,r.delta.v,PLAN_LOOK);
    }
    showMark(hit);
    const pull=cornerPullFromDelta(a,DIMS,c.ends,delta,c.mode==='snap',snapTol(),planGuides);
    c.pull=pull;const plan=cornerPlan(pull);
    setPreview(plan.preview?{...project,modules:plan.preview}:null);
    say(plan.problem||modeText(c.mode,hit)+DIMS.map(d=>DIM_WORD[d]+' '+plan[d]).join(' × ')+' мм'+(plan.snapped.length?' · по: '+plan.snapped.join(', '):'')+' · цифры «ширина;глубина» + Enter — точно',!!plan.problem,...c.mouse);
  }
  function cornerTypedShow(c:Corner){
    const a=moduleOf(c.mid);if(!a)return;setMark(null);
    const head='Размер (ширина;глубина): '+c.typed+'▏',t=typedCornerPull(a,DIMS,c.ends,c.typed);
    if(t.problem){setPreview(null);say(head+' · '+t.problem,true,...c.mouse);return;}
    const plan=t.pull&&cornerPlan?.(t.pull);
    if(!plan){setPreview(null);say(head+' · Enter — применить, Esc — отмена',false,...c.mouse);return;}
    setPreview(plan.preview?{...project,modules:plan.preview}:null);
    say(head+' · '+(plan.problem||DIMS.map(d=>DIM_WORD[d]+' '+plan[d]).join(' × ')+' мм · Enter — применить, Esc — отмена'),!!plan.problem,...c.mouse);
  }
  function endCorner(){const c=corner.current;corner.current=null;if(c&&svg.current?.hasPointerCapture(c.pointerId))svg.current.releasePointerCapture(c.pointerId);setPreview(null);setBadge(null);setMark(null);}
  /** Enter (или отпустили кнопку) с набранным — одной отменой; ≤ 0 — отказ в плашке, остальное проверяет App (как поле панели). */
  function applyTyped(c:Corner){
    const a=moduleOf(c.mid);if(!a){endCorner();return true;}
    const t=typedCornerPull(a,DIMS,c.ends,c.typed);if(t.problem){cornerTypedShow(c);return false;}
    endCorner();if(t.pull)onCorner?.(t.pull);return true;
  }
  function cornerKey(c:Corner,e:KeyboardEvent){
    const k=e.key,part=c.typed.split(';').at(-1)??'';
    if(k==='Escape'){endCorner();return true;}
    if(k==='Enter'||k==='NumpadEnter'){applyTyped(c);return true;}
    if(k==='Backspace')c.typed=c.typed.slice(0,-1);
    else if(/^[0-9]$/.test(k)){if(c.typed.length<15)c.typed+=k;}
    else if(k===';'||e.code==='Semicolon'){if(!c.typed.includes(';'))c.typed+=';';}
    else if(k===','||k==='.'||e.code==='Comma'||e.code==='Period'||e.code==='NumpadDecimal'){if(!part.includes('.'))c.typed+='.';}
    else return false;
    if(c.typed)cornerTypedShow(c);else if(c.moved)cornerByMouse(c);else{setPreview(null);say('Тяните угол: ширина и глубина · цифры «ширина;глубина» + Enter — точно',false,...c.mouse);}
    return true;
  }
  function startTool(){
    if(!onGuides)return;endCorner();cancel();setSelGuide(null);setMeasuring(false);setFirstPoint(null);
    const t:Tool={phase:'pick',lines:candidateLines(showModules?project.modules.filter(a=>!hiddenModuleIds.includes(a.id)):[],PLAN_LOOK,active,project.room,guides)};
    setTool(t);if(mouse.current)toolMove(t,...mouse.current);else say(PICK_HINT,false);
  }
  function cancelTool(){setTool(null);setBadge(null);setMark(null);}
  function toolMove(t:Tool,clientX:number,clientY:number):Tool{
    let P=toRoom(clientX,clientY);
    if(t.phase==='pick'){setMark(null);const hover=nearestPlanLine(t.lines,P,10*mmPx()),n={...t,hover};setTool(n);say(hover?'Q: '+hover.what+' — щёлкните, чтобы строить от неё':PICK_HINT,false,clientX,clientY);return n;}
    // Alt/Ctrl: линия проходит через точку на линии / пересечение у курсора (без набранного числа)
    const mode=modeRef.current,segs=t.segs??planSegs([]);let hit:PointHit|undefined;
    if(isPointMode(mode)&&!t.typed){hit=pointSnap(mode,toView(P,PLAN_LOOK),mode==='line'?acrossSegments(segs,toView(t.base.n,PLAN_LOOK)):segs,pointTol());if(hit)P=fromView(hit.p,PLAN_LOOK,P);}
    showMark(hit);
    const pl=placeGuide(t.base,P,parseTyped(t.typed),!!hit),n={...t,at:pl.at,dist:pl.dist,segs};setTool(n);
    say((isPointMode(mode)&&!t.typed?hitText(hit,mode)+' · ':'')+(t.typed?'Размер: '+t.typed+'▏':'Расстояние '+pl.dist)+' мм · Enter — поставить · Esc — отмена',false,clientX,clientY);return n;
  }
  function placeNow(t:Tool){
    if(t.phase!=='place'||t.at===undefined||!onGuides)return;
    const list=guides??[],n=t.base.n,at=t.at,dup=planGuides.some(g=>Math.abs(g.at-at)<.05&&Math.abs(g.n[0]-n.x)+Math.abs(g.n[1]-n.y)+Math.abs(g.n[2]-n.z)<.01);
    cancelTool();if(!dup)onGuides([...list,makeGuide('g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),PLAN_LOOK,n,at)]);
  }
  function removeGuides(ids:string[]){setSelGuide(null);setBadge(null);if(onGuides&&ids.length)onGuides((guides??[]).filter(g=>!ids.includes(g.id)));}
  /** Щелчки Q и выбор линии — раньше корпусов (фаза захвата), затем линейка. */
  function downCapture(e:React.PointerEvent){
    if(e.button!==0)return;
    if(tool){
      e.preventDefault();e.stopPropagation();modeRef.current=snapMode(e);const t=toolMove(tool,e.clientX,e.clientY);
      if(t.phase==='pick'){if(t.hover)toolMove({phase:'place',base:t.hover,typed:''},e.clientX,e.clientY);}else placeNow(t);
      return;
    }
    if(!measuring&&!(e.target as Element).closest?.('.plan-corner')){
      const g=nearestPlanLine(planGuides.map(seg),toRoom(e.clientX,e.clientY),6*mmPx());
      if(g){e.preventDefault();e.stopPropagation();setSelGuide(g.id);say('Вспомогательная линия · Delete — убрать · Esc — снять выбор',false,e.clientX,e.clientY);return;}
      if(selGuide){setSelGuide(null);setBadge(null);}
    }
    measurePoint(e);
  }
  // Для сценариев мышью (scripts/stretch-guides-scenario.ts), только чтение — как у сцены: корпуса и линии проекта на «Плане»
  useEffect(()=>{const w=window as unknown as {__arrangement?:()=>unknown[];__guides?:()=>unknown};w.__arrangement=()=>project.modules.map(a=>({id:a.id,x:a.x,z:a.z,w:a.module.width,y:a.y??0,h:a.module.height,d:a.module.depth}));w.__guides=()=>project.guides??[];});
  // Q, цифры, «;», Enter, Esc, Delete — раньше App (фаза захвата на window; App пропускает defaultPrevented)
  useEffect(()=>{
    const on=(e:KeyboardEvent)=>{
      if(editsText(e.target))return;
      // Ctrl+Z/Ctrl+Y посреди тяги (Ctrl зажат ради привязки) — не отменять (критик 29.10 п.6)
      if(historyGuard(e,!!(corner.current||drag.current||ctrlPress.current))){e.preventDefault();e.stopPropagation();return;}
      const c=corner.current;
      if(c){if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&cornerKey(c,e)){e.preventDefault();e.stopPropagation();}return;}
      if(e.code==='KeyQ'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){if(!onGuides)return;e.preventDefault();if(e.repeat)return;if(tool)cancelTool();else startTool();return;}
      if(tool){
        if(e.key==='Escape'){e.preventDefault();cancelTool();return;}
        if(tool.phase==='place'){
          const typed=/^[0-9]$/.test(e.key)?(tool.typed.length<7?tool.typed+e.key:tool.typed):(e.key===','||e.key==='.')&&!/[.,]/.test(tool.typed)?tool.typed+e.key:e.key==='Backspace'?tool.typed.slice(0,-1):undefined;
          if(typed!==undefined){e.preventDefault();const n={...tool,typed};if(mouse.current)toolMove(n,...mouse.current);else setTool(n);return;}
          if(e.key==='Enter'||e.key==='NumpadEnter'){e.preventDefault();placeNow(mouse.current?toolMove(tool,...mouse.current):tool);return;}
        }
        if(e.key==='Delete'||e.key==='Enter')e.preventDefault();
        return;
      }
      if(selGuide){
        if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeGuides([selGuide]);return;}
        if(e.key==='Escape'){e.preventDefault();setSelGuide(null);setBadge(null);}
      }
    };
    window.addEventListener('keydown',on,true);return()=>window.removeEventListener('keydown',on,true);
  });
  function start(e:React.PointerEvent,kind:Drag['kind'],id:string){if(e.button!==0)return;
    // Ctrl+щелчок без движения — отметить корпус (как раньше, при отпускании); Ctrl+протяжка — перенос с привязкой к пересечениям
    if(kind==='module'&&(e.ctrlKey||e.metaKey)&&onToggleModule){e.preventDefault();e.stopPropagation();ctrlPress.current={id,x:e.clientX,y:e.clientY,pointerId:e.pointerId};svg.current?.setPointerCapture(e.pointerId);return;}
    (e.currentTarget as SVGGElement).focus();e.stopPropagation();beginDrag(kind,id,e.clientX,e.clientY,e.pointerId);}
  function beginDrag(kind:Drag['kind'],id:string,clientX:number,clientY:number,pointerId:number){const a=project.modules.find(a=>a.id===id),o=project.room.openings?.find(o=>o.id===id),ob=project.room.obstacles?.find(o=>o.id===id),fx=project.room.fixtures?.find(f=>f.id===id);const pt=point({clientX,clientY});drag.current={kind,id,start:{x:pt.x,y:pt.y},origin:kind==='module'?{x:a!.x,z:a!.z}:kind==='obstacle'?{x:ob!.x,z:ob!.z}:kind==='fixture'?{x:fx!.offset,z:0}:{x:o!.offset,z:0},pointerId};svg.current?.setPointerCapture(pointerId);if(kind==='module')onSelect(id);else {onRoom();if(kind==='obstacle')onObstacleSelect(id);else if(kind==='fixture')onFixtureSelect?.(id);else onOpeningSelect(id);}}
  function move(e:PtrLike){
    mouse.current=[e.clientX,e.clientY];const mode=snapMode(e);modeRef.current=mode;
    const c=corner.current;
    if(c){c.mouse=[e.clientX,e.clientY];c.mode=mode;if(c.typed){cornerTypedShow(c);return;}if(!c.moved&&Math.hypot(e.clientX-c.origin[0],e.clientY-c.origin[1])<3)return;c.moved=true;cornerByMouse(c);return;}
    if(tool){toolMove(tool,e.clientX,e.clientY);return;}
    // Ctrl+нажатие на корпус потянули — обычный перенос из точки нажатия (дальше — с привязкой Ctrl)
    const cp=ctrlPress.current;
    if(cp&&!drag.current){if(!ctrlDragStarts(e.clientX-cp.x,e.clientY-cp.y))return;ctrlPress.current=null;beginDrag('module',cp.id,cp.x,cp.y,cp.pointerId);}
    const d=drag.current;if(!d)return;const pt=point(e),n=structuredClone(project);
    if(d.kind==='module'){const a=n.modules.find(a=>a.id===d.id)!;const raw={x:d.origin.x+pt.x-d.start.x,z:d.origin.z+pt.y-d.start.y,y:a.y??0};let pos:{x:number;y:number;z:number},hit:PointHit|undefined;
      if(isPointMode(mode)){
        // Alt/Ctrl: угол корпуса, ближайший к месту захвата, — на линию / в пересечение (корпуса, что едут вместе, не в счёт)
        const orig={...a,x:d.origin.x,z:d.origin.z};d.ref??=nearestOutlineCorner(carcassCorners(orig),PLAN_LOOK,toView({x:d.start.x,y:0,z:d.start.y},PLAN_LOOK));
        d.segs??=planSegs(moveAll?project.modules.map(x=>x.id):groupIds.includes(d.id)?groupIds:[d.id]);
        const r=snapDelta(mode,d.ref,toView({x:raw.x-d.origin.x,y:0,z:raw.z-d.origin.z},PLAN_LOOK),d.segs,pointTol()),dv=viewDelta(r.delta.h,r.delta.v,PLAN_LOOK);hit=r.hit;
        pos=hit?{x:Math.round((d.origin.x+dv.x)*10)/10,y:raw.y,z:Math.round((d.origin.z+dv.z)*10)/10}:{x:Math.round(raw.x),y:raw.y,z:Math.round(raw.z)};
      }else{
        pos=!snapping||mode==='free'?{x:Math.round(raw.x),y:raw.y,z:Math.round(raw.z)}:moveAll?snapComposition(project,d.id,raw):groupIds.includes(d.id)?snapComposition(project,d.id,raw,35,groupIds):snapPlacement(project,d.id,raw);pos.y=raw.y;
        // края корпуса — к вспомогательным линиям плана (общие с «Сверху»), ближе обычной привязки
        if(snapping&&mode==='snap'&&planGuides.length)pos={...snapMoveToGuides(a,raw,pos,planGuides,snapTol()),y:raw.y};
      }
      showMark(hit);if(moveAll||groupIds.includes(d.id))n.modules=moveComposition(project,d.id,pos,moveAll?undefined:groupIds).modules;else Object.assign(a,pos);}
    else if(d.kind==='obstacle'){const o=n.room.obstacles!.find(o=>o.id===d.id)!;o.x=Math.round(d.origin.x+pt.x-d.start.x);o.z=Math.round(d.origin.z+pt.y-d.start.y);if(snapping&&mode==='snap'){const tol=35;if(Math.abs(o.x)<=tol)o.x=0;else if(Math.abs(o.x+o.width-r.width)<=tol)o.x=r.width-o.width;if(Math.abs(o.z)<=tol)o.z=0;else if(Math.abs(o.z+o.depth-r.depth)<=tol)o.z=r.depth-o.depth;}}
    else if(d.kind==='fixture'){const f=n.room.fixtures!.find(f=>f.id===d.id)!,horizontal=f.wall==='back'||f.wall==='front',length=horizontal?r.width:r.depth;f.offset=Math.max(0,Math.min(length-f.width,Math.round((d.origin.x+(horizontal?pt.x-d.start.x:pt.y-d.start.y))/10)*10));}
    else{const o=n.room.openings!.find(o=>o.id===d.id)!,horizontal=o.wall==='back'||o.wall==='front',length=horizontal?r.width:r.depth;o.offset=Math.max(0,Math.min(length-o.width,Math.round((d.origin.x+(horizontal?pt.x-d.start.x:pt.y-d.start.y))/10)*10));}
    setPreview(n);
  }
  function finish(e:React.PointerEvent){
    const c=corner.current;
    if(c){
      // отпустили с набранным размером — применяется набранное (как Enter); иначе — по мыши
      if(c.typed&&parseCornerTyped(c.typed)){const a=moduleOf(c.mid),problem=a&&typedCornerPull(a,DIMS,c.ends,c.typed).problem;if(!applyTyped(c)){endCorner();if(problem)window.dispatchEvent(new CustomEvent('studio-note',{detail:{title:'Размер не применён',text:problem}}));}return;}
      endCorner();if(c.moved&&c.pull)onCorner?.(c.pull);return;
    }
    const cp=ctrlPress.current;if(cp&&!drag.current){ctrlPress.current=null;if(svg.current?.hasPointerCapture(e.pointerId))svg.current.releasePointerCapture(e.pointerId);onToggleModule?.(cp.id);return;}
    const d=drag.current;if(!d)return;if(preview)update(preview);drag.current=null;setPreview(null);setMark(null);if(svg.current?.hasPointerCapture(e.pointerId))svg.current.releasePointerCapture(e.pointerId);}
  function cancel(){if(corner.current)endCorner();drag.current=null;ctrlPress.current=null;setPreview(null);setMark(null);}
  // Нажали/отпустили Alt, Ctrl, Shift без движения мыши — привязка пересчитывается сразу (угол, перенос, линия Q)
  useEffect(()=>{
    const on=(e:KeyboardEvent)=>{
      if(!['Alt','Control','Shift','Meta'].includes(e.key))return;
      const m={altKey:e.altKey,ctrlKey:e.ctrlKey,metaKey:e.metaKey,shiftKey:e.shiftKey};modeRef.current=snapMode(m);
      // Alt не уводит фокус в меню браузера: при тяге — и нажатие, отпускание — всегда, кроме полей ввода (критик 29.10, блокер)
      if(e.key==='Alt'&&(corner.current||drag.current||tool||(e.type==='keyup'&&altKeyupGuard(e))))e.preventDefault();
      const at=mouse.current,c=corner.current;if(!at)return;
      if(c){if(c.moved&&!c.typed){c.mode=modeRef.current;cornerByMouse(c);}return;}
      if(drag.current){if(preview)move({clientX:at[0],clientY:at[1],...m});return;}
      if(tool?.phase==='place')toolMove(tool,at[0],at[1]);
    };
    // Ctrl+колесо во время тяги и линии Q не масштабирует страницу браузера (критик 29.10 п.5)
    const wheel=(e:WheelEvent)=>{if(wheelGuard(e,!!(corner.current||drag.current||ctrlPress.current||tool)))e.preventDefault();};
    window.addEventListener('keydown',on);window.addEventListener('keyup',on);window.addEventListener('wheel',wheel,{passive:false,capture:true});
    return()=>{window.removeEventListener('keydown',on);window.removeEventListener('keyup',on);window.removeEventListener('wheel',wheel,{capture:true});};
  });
  function keyboard(e:React.KeyboardEvent,kind:Drag['kind'],id:string){
    if(e.ctrlKey||e.metaKey||e.altKey||drag.current)return;
    const select=()=>{if(kind==='module')onSelect(id);else {onRoom();if(kind==='obstacle')onObstacleSelect(id);else onOpeningSelect(id);}};
    if(e.key==='Enter'||e.key===' '){e.preventDefault();select();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();select();const step=e.shiftKey?100:10,n=structuredClone(project);
    if(kind==='module'){const a=n.modules.find(a=>a.id===id)!;if(e.key==='ArrowLeft')a.x-=step;if(e.key==='ArrowRight')a.x+=step;if(e.key==='ArrowUp')a.z-=step;if(e.key==='ArrowDown')a.z+=step;}
    else if(kind==='obstacle'){const o=n.room.obstacles!.find(o=>o.id===id)!;if(e.key==='ArrowLeft')o.x-=step;if(e.key==='ArrowRight')o.x+=step;if(e.key==='ArrowUp')o.z-=step;if(e.key==='ArrowDown')o.z+=step;}
    else if(kind==='fixture'){const f=n.room.fixtures!.find(f=>f.id===id)!,horizontal=f.wall==='back'||f.wall==='front';if(horizontal&&(e.key==='ArrowUp'||e.key==='ArrowDown')||!horizontal&&(e.key==='ArrowLeft'||e.key==='ArrowRight'))return;f.offset+=(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)*step;}
    else {const o=n.room.openings!.find(o=>o.id===id)!,horizontal=o.wall==='back'||o.wall==='front';if(horizontal&&(e.key==='ArrowUp'||e.key==='ArrowDown')||!horizontal&&(e.key==='ArrowLeft'||e.key==='ArrowRight'))return;o.offset+=(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)*step;}
    if(kind==='module'&&(moveAll||groupIds.includes(id))){const a=n.modules.find(a=>a.id===id)!;n.modules=moveComposition(project,id,{x:a.x,y:a.y??0,z:a.z},moveAll?undefined:groupIds).modules;}
    update(n);
  }
  function opening(o:Opening,index:number){const horizontal=o.wall==='back'||o.wall==='front',x=horizontal?o.offset:o.wall==='left'?0:r.width,z=horizontal?o.wall==='back'?0:r.depth:o.offset;return <g onContextMenu={e=>{e.preventDefault();onEnvironmentContext?.('opening',o.id);}} key={o.id} tabIndex={0} role="button" aria-label={'На плане: '+(o.type==='window'?'Окно':'Дверь')+' '+(index+1)+', ширина '+Math.round(o.width)+' мм'} aria-pressed={selectedOpening===o.id} onPointerDown={e=>start(e,'opening',o.id)} onKeyDown={e=>keyboard(e,'opening',o.id)} style={{cursor:horizontal?'ew-resize':'ns-resize'}}><rect x={horizontal?x:x-190} y={horizontal?z-180:z} width={horizontal?o.width:290} height={horizontal?280:o.width} fill="transparent" pointerEvents="all"/><line x1={x} y1={z} x2={x+(horizontal?o.width:0)} y2={z+(horizontal?0:o.width)} stroke="#fafaf8" strokeWidth={90}/><line x1={x} y1={z} x2={x+(horizontal?o.width:0)} y2={z+(horizontal?0:o.width)} stroke={selectedOpening===o.id?'#325bee':o.type==='window'?'#78a9bd':'#b29a7b'} strokeWidth={selectedOpening===o.id?65:45}/><text x={x+(horizontal?o.width/2:-110)} y={z+(horizontal?-85:o.width/2)} fontSize={70} textAnchor="middle" fill="#607180">{o.type==='window'?'Окно':'Дверь'} {index+1} · {o.width}</text></g>;}
  const u=mmPx(),act=p.modules.find(x=>x.id===active);
  const showCorners=!!act&&showModules&&!!stretchable&&!!onCorner&&!!cornerPlan&&!hiddenModuleIds.includes(act.id)&&!tool&&!measuring;
  return <div className="room-plan" ref={box}><div className="plan-measure-tools"><button className="outline" aria-pressed={measuring} onClick={()=>{setMeasuring(!measuring);setFirstPoint(null);}}>Линейка · {measuring?'завершить':'поставить размер'}</button>
    {onGuides&&<button className="outline" aria-pressed={!!tool} title="Вспомогательная линия (Q): щёлкните край корпуса, стену или другую линию, наберите расстояние и Enter (сторона — где мышь; щелчок без числа — на расстоянии мыши). Щелчок по линии и Delete — убрать. Линии общие с видом «Сверху»" onClick={e=>{e.currentTarget.blur();if(tool)cancelTool();else startTool();}}>Вспомогательная линия · Q</button>}
    {/* «Убрать…» — поверх плана (как в сцене), не в строке инструментов: появление кнопки не переносит строку и не масштабирует план */}
    {onGuides&&planGuides.length>0&&<button type="button" className="clear-guides" title="Убрать вспомогательные линии плана (они же — в виде «Сверху»); Ctrl+Z — вернуть" onClick={e=>{e.currentTarget.blur();removeGuides(planGuides.map(g=>g.id));}}>Убрать вспомогательные линии ({planGuides.length})</button>}{measuring&&<span role="status">{firstPoint?'Укажите вторую точку':'Укажите первую точку'} · Esc — выход</span>}<details><summary>Размер по координатам</summary><form onSubmit={e=>{e.preventDefault();addDimension([Number(coords[0]),Number(coords[1])],[Number(coords[2]),Number(coords[3])]);}}>{coords.map((v,i)=><label key={i}>{['Начало X','Начало Z','Конец X','Конец Z'][i]}<input required type="number" min="0" max="20000" value={v} onChange={e=>setCoords(coords.map((old,j)=>j===i?e.target.value:old))}/></label>)}<button type="submit" className="outline">Добавить размер</button></form></details>{dimError&&<span role="alert">{dimError}</span>}</div><svg ref={svg} role="group" aria-label="План комнаты. Перетаскивайте корпуса, окна и двери." viewBox={`${-margin} ${-margin} ${r.width+margin*2} ${r.depth+margin*2}`} onPointerDownCapture={downCapture} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onKeyDown={e=>{if(e.key==='Escape'){cancel();setMeasuring(false);setFirstPoint(null);}}}>
    <defs><pattern id="room-plan-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="#e1e3e2" strokeWidth="3"/></pattern></defs>
    <rect width={r.width} height={r.depth} fill="url(#room-plan-grid)" stroke="#717b84" strokeWidth={55}/>
    <text x={r.width/2} y={-margin*.72} fontSize={90} textAnchor="middle" fill="#5b6570" style={onDimension?{cursor:'pointer',textDecoration:'underline'}:undefined} onClick={()=>onDimension?.('room','','width',r.width)}>{r.width} мм</text><text x={-margin*.72} y={r.depth/2} transform={`rotate(-90 ${-margin*.72} ${r.depth/2})`} fontSize={90} textAnchor="middle" fill="#5b6570" style={onDimension?{cursor:'pointer',textDecoration:'underline'}:undefined} onClick={()=>onDimension?.('room','','depth',r.depth)}>{r.depth} мм</text>
    {r.openings?.map(o=>{const z=openingZone(r,o),hit=warnings.some(w=>w.openingId===o.id);return <rect key={'zone-'+o.id} x={z.x} y={z.z} width={z.w} height={z.d} fill={hit?'#edac43':'#b8cbd6'} fillOpacity={.18} stroke={hit?'#b77514':'#93a8b5'} strokeWidth={5} strokeDasharray="20 14" pointerEvents="none"><title>{o.type==='door'?'Условная зона подхода к двери: 900 мм':'Зона у окна: 100 мм'}</title></rect>;})}
    {r.openings?.map(opening)}
    {(()=>{
      // Размерная цепочка выбранного проёма или объекта: от угла · ширина · до угла. Клик по числу — правка.
      const o=r.openings?.find(o=>o.id===selectedOpening),f=(r.fixtures||[]).find(f=>f.id===selectedFixture);
      const item=o?{kind:'opening' as const,id:o.id,wall:o.wall,offset:o.offset,width:o.width}:f?{kind:'fixture' as const,id:f.id,wall:f.wall,offset:f.offset,width:f.width}:null;
      if(!item||!onDimension)return null;
      const horizontal=item.wall==='back'||item.wall==='front',len=horizontal?r.width:r.depth,rest=len-item.offset-item.width;
      const off=Math.max(160,margin*0.45),side=item.wall==='back'?-off:item.wall==='front'?r.depth+off:item.wall==='left'?-off:r.width+off;
      const seg=(a:number,b:number,text:string,field:string,value:number,strong=false)=>{
        const x1=horizontal?a:side,x2=horizontal?b:side,y1=horizontal?side:a,y2=horizontal?side:b,mx=(x1+x2)/2,my=(y1+y2)/2;
        const tick=(x:number,y:number)=>horizontal?<line x1={x} y1={y-40} x2={x} y2={y+40} stroke="#325bee" strokeWidth={6}/>:<line x1={x-40} y1={y} x2={x+40} y2={y} stroke="#325bee" strokeWidth={6}/>;
        return <g key={field} className="plan-dim" role="button" tabIndex={0} aria-label={`Изменить: ${text}`} onPointerDown={e=>e.stopPropagation()} onClick={()=>onDimension(item.kind,item.id,field,value)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onDimension(item.kind,item.id,field,value);}}} style={{cursor:'pointer'}}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#325bee" strokeWidth={6}/>{tick(x1,y1)}{tick(x2,y2)}
          <rect x={mx-(horizontal?text.length*22:text.length*22)} y={my-46} width={text.length*44} height={92} rx={18} fill="#fff" stroke="#325bee" strokeWidth={strong?8:4}/>
          <text x={mx} y={my+24} textAnchor="middle" fontSize={strong?68:60} fontWeight={strong?700:500} fill="#1f3a8f" pointerEvents="none">{text}</text>
        </g>;
      };
      return <g>
        {item.offset>0&&seg(0,item.offset,String(Math.round(item.offset)),'offset',item.offset)}
        {seg(item.offset,item.offset+item.width,String(Math.round(item.width)),'width',item.width,true)}
        {rest>0&&seg(item.offset+item.width,len,String(Math.round(rest)),'end',rest)}
      </g>;
    })()}
    {(['back','front','left','right'] as const).map(side=>{const grid=r.survey?.surfaces[side];if(!grid)return null;const us=grid.u,points=us.map(u=>surfacePoint(r,side,u,Math.min(sliceHeight,r.height))),uncertain=us.some(u=>surfaceOffset(grid,u,Math.min(sliceHeight,r.height)).outside);return <polyline key={'measured-'+side} aria-label={'Измеренное сечение '+side} points={points.map(p=>p.x+','+p.z).join(' ')} fill="none" stroke={uncertain?'#b77514':'#078579'} strokeWidth={14} strokeDasharray={uncertain?'30 15':undefined} pointerEvents="none"/>;})}
    {showModules&&p.modules.map((a,i)=>{if(hiddenModuleIds.includes(a.id))return null;const b=bounds(a),front1=localToRoom(a,a.module.corner?a.module.corner.sideDepth:0,a.module.depth),front2=localToRoom(a,a.module.width,a.module.corner?a.module.corner.sideDepth:a.module.depth);return <g key={a.id} onContextMenu={e=>{e.preventDefault();onModuleContext?.(a.id,e.clientX,e.clientY);}} role="button" tabIndex={0} aria-label={'На плане: '+a.module.name} aria-pressed={a.id===active} onPointerDown={e=>start(e,'module',a.id)} onKeyDown={e=>keyboard(e,'module',a.id)} style={{cursor:'grab'}}><polygon points={moduleFootprint(a).map(p=>p.x+','+p.z).join(' ')} fill={a.id===active?'#dce5ff':groupIds.includes(a.id)?'#cde6df':(a.y??0)>0?'#e4dfd4':'#e6e9e7'} fillOpacity={(a.y??0)>0?.65:1} stroke={problem&&a.id===drag.current?.id?'#c63838':warnings.some(w=>w.moduleId===a.id)?'#b77514':a.id===active?'#325bee':'#87958e'} strokeWidth={a.id===active?14:8} strokeDasharray={(a.y??0)>0?'35 20':undefined}/><line x1={front1.x} y1={front1.z} x2={front2.x} y2={front2.z} stroke={a.id===active?'#325bee':'#6b8072'} strokeWidth={28}/><text x={b.x+b.w/2} y={b.z+b.d/2-25} fontSize={75} textAnchor="middle" fill="#283747" pointerEvents="none">{i+1}</text><text x={b.x+b.w/2} y={b.z+b.d/2+65} fontSize={48} textAnchor="middle" fill="#586776" pointerEvents="none">{a.module.width} × {a.module.depth}</text></g>;})}
    {(r.fixtures||[]).map((f,i)=>{const b=fixtureBox(r,f),spec=FIXTURES[f.type],horizontal=f.wall==='back'||f.wall==='front',t=Math.max(b.w&&b.d?(horizontal?b.d:b.w):0,40);const x=horizontal?b.x:f.wall==='left'?b.x:b.x+b.w-t,z=horizontal?(f.wall==='back'?b.z:b.z+b.d-t):b.z,w=horizontal?b.w:t,d=horizontal?t:b.d;const hit=warnings.some(w=>w.fixtureId===f.id);return <g key={f.id} role="button" tabIndex={0} aria-label={'На плане: '+fixtureLabel(f,i)} aria-pressed={selectedFixture===f.id} onContextMenu={e=>{e.preventDefault();onEnvironmentContext?.('fixture',f.id);}} onPointerDown={e=>start(e,'fixture',f.id)} onKeyDown={e=>keyboard(e,'fixture',f.id)} style={{cursor:horizontal?'ew-resize':'ns-resize'}}><rect x={x} y={z} width={w} height={d} fill={f.color??'#'+spec.color.toString(16).padStart(6,'0')} stroke={selectedFixture===f.id?'#325bee':hit?'#b77514':'#7d7466'} strokeWidth={selectedFixture===f.id?12:6}/><text x={x+w/2} y={horizontal?(f.wall==='back'?z-30:z+d+65):z+d/2+20} textAnchor="middle" fontSize={44} fill="#4c5a66" pointerEvents="none">О{i+1}</text></g>;})}
    {(r.obstacles||[]).map((o,i)=><g key={o.id} role="button" tabIndex={0} aria-label={'На плане: объект П'+(i+1)+' '+o.name} aria-pressed={selectedObstacle===o.id} onContextMenu={e=>{e.preventDefault();onEnvironmentContext?.('obstacle',o.id);}} onPointerDown={e=>start(e,'obstacle',o.id)} onKeyDown={e=>keyboard(e,'obstacle',o.id)} style={{cursor:'grab'}}><rect x={o.x} y={o.z} width={o.width} height={o.depth} fill={o.type==='radiator'?'#cbdce3':'#cbbda9'} fillOpacity={.75} stroke={selectedObstacle===o.id?'#325bee':warnings.some(w=>w.obstacleId===o.id)?'#b77514':'#85715c'} strokeWidth={selectedObstacle===o.id?14:8} strokeDasharray={o.y>0?'25 15':undefined}/><text x={o.x+o.width/2} y={o.z+o.depth/2+20} textAnchor="middle" fontSize={60} pointerEvents="none">П{i+1}</text></g>)}
  {p.dimensions?.map(d=><g key={d.id} pointerEvents="none"><line x1={d.from[0]} y1={d.from[1]} x2={d.to[0]} y2={d.to[1]} stroke="#b23a65" strokeWidth={7}/>{[d.from,d.to].map((q,i)=><circle key={i} cx={q[0]} cy={q[1]} r={15} fill="#b23a65"/>)}<text x={(d.from[0]+d.to[0])/2} y={(d.from[1]+d.to[1])/2-32} textAnchor="middle" fontSize={65} stroke="white" strokeWidth={15} paintOrder="stroke" fill="#92234d">{Math.round(Math.hypot(d.to[0]-d.from[0],d.to[1]-d.from[1]))} мм</text></g>)}{firstPoint&&<circle cx={firstPoint[0]} cy={firstPoint[1]} r={22} fill="#b23a65" pointerEvents="none"/>}
    {planGuides.map(g=>{const {a,b}=seg(g),sel=g.id===selGuide;return <line key={'guide-'+g.id} className="plan-guide" data-guide={g.id} data-at={g.at} x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke={sel?'#e8590c':'#2f6fdb'} strokeWidth={u*(sel?2.4:1.6)} strokeDasharray={`${u*10} ${u*6}`} pointerEvents="none"/>;})}
    {tool?.phase==='pick'&&tool.hover&&<line className="plan-guide-hover" x1={tool.hover.a.x} y1={tool.hover.a.z} x2={tool.hover.b.x} y2={tool.hover.b.z} stroke="#e8590c" strokeWidth={u*3} pointerEvents="none"/>}
    {tool?.phase==='place'&&tool.at!==undefined&&(()=>{const [a,b]=guideSegment({n:tool.base.n,at:tool.at},PLAN_LOOK,center);return <line className="plan-guide-ghost" x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke="#e8590c" strokeWidth={u*2} strokeDasharray={`${u*8} ${u*5}`} pointerEvents="none"/>;})()}
    {showCorners&&(['lo','hi'] as const).flatMap(w=>(['lo','hi'] as const).map(d=>{const q=localToRoom(act,w==='hi'?act.module.width:0,d==='hi'?act.module.depth:0),hs=u*16,on=corner.current?.ends.join('-')===w+'-'+d;return <rect key={'corner-'+w+d} className="plan-corner" data-corner={w+'-'+d} role="button" aria-label="Растянуть за угол: ширина и глубина" x={q.x-hs/2} y={q.z-hs/2} width={hs} height={hs} rx={u*3} fill={on?'#1f3fc4':'#325bee'} stroke="#fff" strokeWidth={u*2} style={{cursor:'move',touchAction:'none'}} onPointerDown={e=>startCorner(e,[w,d])}><title>{cornerHandleTitle(DIMS)}</title></rect>;}))}
    {/* метка привязки Alt/Ctrl — поверх ручек углов */}
    {mark&&(()=>{const P=fromView(mark.p,PLAN_LOOK,{x:0,y:0,z:0}),s=u*7,at=mark.p.h+';'+mark.p.v;return mark.kind==='cross'
      ?<g className="plan-snap-mark" data-kind="cross" data-at={at} stroke="#e8590c" strokeWidth={u*2}><line x1={P.x-s} y1={P.z-s} x2={P.x+s} y2={P.z+s}/><line x1={P.x-s} y1={P.z+s} x2={P.x+s} y2={P.z-s}/></g>
      :<circle className="plan-snap-mark" data-kind="line" data-at={at} cx={P.x} cy={P.z} r={s} fill="#ffffff88" stroke="#e8590c" strokeWidth={u*2}/>;})()}</svg>
    {badge&&<div className={'drag-badge plan-badge'+(badge.invalid?' invalid':'')} role="status" style={{left:badge.x,top:badge.y,bottom:'auto',right:'auto',transform:'translate(-50%,-100%)'}}>{badge.text}</div>}{r.survey&&<label className="plan-slice">Сечение стен на высоте, мм <input aria-label="Высота сечения стен" type="number" min={0} max={r.height} value={sliceHeight} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v)&&v>=0&&v<=r.height)setSliceHeight(v);}}/><span> Зелёная линия — измеренная сетка; пунктир — недостаточно точек. Мебель остаётся прямой.</span></label>}{!!p.dimensions?.length&&<details className="plan-measure-list"><summary>Пользовательские размеры ({p.dimensions.length})</summary>{p.dimensions.map((d,i)=><div key={d.id}><span>{i+1}. {Math.round(Math.hypot(d.to[0]-d.from[0],d.to[1]-d.from[1]))} мм · ({d.from.join('; ')}) → ({d.to.join('; ')})</span><button className="text-action" aria-label={'Удалить размер '+(i+1)} onClick={()=>update({...project,dimensions:project.dimensions?.filter(x=>x.id!==d.id)})}>Удалить</button></div>)}<p>Размеры привязаны к координатам помещения. После перестановки мебели проверьте их заново.</p></details>}<div className={"plan-help"+(problem?" invalid":"")} role={problem?"alert":undefined}>{problem||warnings.find(w=>w.moduleId===active)?.message||warnings[0]?.message||(moveAll?"Двигается вся композиция · ":groupIds.includes(active)?"Двигается отмеченная группа · ":"")+(snapping?"Shift — без привязки · Alt — к линии · Ctrl — к пересечению · Толстая линия — фасад · Пунктир — верхний модуль":"Привязки отключены · Толстая линия — фасад · Пунктир — верхний модуль")+(onGuides?" · Q — вспомогательная линия":"")+(stretchable&&onCorner?" · Угол выбранного корпуса — ширина и глубина («600;550» + Enter)":"")}</div><p className="field-note plan-keyboard-help">Выберите корпус, проём или объект замера: стрелки — 10 мм, Shift + стрелки — 100 мм. Проёмы двигаются вдоль своей стены. Клавиши работают без привязок.{onCorner&&' Угол выбранного корпуса: тяните — ширина и глубина, противоположный угол на месте; во время тяги наберите «ширина;глубина» (одно число — только ширина, «;550» — только глубина) и Enter, Esc — отмена.'}{onGuides&&' Q — вспомогательная линия (общая с видом «Сверху»): щёлкните край корпуса или стену, наберите расстояние и Enter; щелчок по линии и Delete — убрать.'}</p></div>;
}
