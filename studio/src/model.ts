import { drawerHasHandle, SLIDES, type DrawerConfig } from "./hardware";
import {caseworkParts,caseworkErrors,type Casework} from './casework';
import { handleById, HANDLES, HANDLE_MARGIN } from "./handles";
import { meshById, MESH_WIDTH_TOLERANCE } from "./mesh";
import { aluProfile, aluColor, aluInsert, aluLabel, ALU_EXTRAS, type AluFacade } from "./alu";
export const RULES = {
  panel: 16,
  back: 3,
  plinth: 80,
  plinthInset: 2, // цоколь шкафа утоплен от переда на 2 мм (правило Макса 06.09.2026); фасады опускаются на цоколь
  facadeFloorGap: 30, // низ распашного фасада и нижнего накладного фасада ящика — 30 мм от пола, регулировка по цоколю
  shelfDepthMinus: 25,
  shelfGap: 1,
  minW: 250,
  maxW: 1300, // ТЗ Макса 1200, но заказ Цецегова 7212718 — шкаф и антресоль 1244; СТП 900 — предупреждение по логистике выше 900
  minH: 250, // антресоли заказов 300–372
  maxH: 2500, // шкафы Имомкуловой 2412 (боковина 2396 из листа 2750); было 2200
  minD: 200, // заказы цеха: шкафы 240 (Корижин), стеллажи 200 (Дельта КИП)
  maxD: 700,
  minSection: 180,
  maxSections: 4,
  maxShelves: 10,
  maxDrawers: 5,
  drawerH: 140,
  drawerStep: 40,
  drawerSideGap: 13,
  drawerFrontGap: 3,
  rodDiameter: 25,
  rodMountScrews: 6, // Штанга 25мм.fr3d: два фланца, по три самореза 3,5×16.
  rodTopOffset: 70,
  rodMinClear: 900,
  shelfMinClear: 80,
  sheetW: 2750,
  sheetH: 1830,
  hdfW: 2800,
  hdfH: 2070,
  // Conservative preview envelope from G code/RULES.md; production release requires confirmation.
  sheetMargin: 10,
  faceGap: 2,
  doorMax: 600,
  drawerFiller: 16,
  // Подсветка в стойках: врезной LED-профиль (LR39 15×6, Мега-Трейд) — условная геометрия для сцены и метража.
  lightProfileW: 15,
  lightProfileT: 3,
  lightFrontOffset: 60,
  lightRetailPerM: 3000, // прайс цеха «Подсветка врезная в стойках полного свечения», розница за пог.м
  meshDoorClear: 20, // сетка Лемана за распашной дверью: дверь 16 + зазор 4 перед рамой
  cornerFillerExtra: 40, // угловая фальш глубже корпуса на 40 мм (правило Макса 06.09.2026)
  cornerSnap: 60, // расстояние, в пределах которого примыкающий под 90° корпус считается стыком
  // Фальши цеха: планка 100×16 торцом (Макс, 06.09.2026); к стене +5 мм (регламент по ФП).
  fillerStrip: 100,
  fillerGap: 3, // зазор между фальш-планкой из фасада и соседним фасадом
  wallSnap: 25,
  wallFillerEdgeGap: 5,
  wallFillerMin: 60,
  wallFillerMax: 150,
  // Опоры регулируемые INTEGRATO TECH G (МДМ 127,40 ₽): 4 на нижний корпус, 6 при ширине от 900.
  legsPerModule: 4,
  legsWideW: 900,
  legsWide: 6,
  // Видимый крепёж по СТП — евровинты (конфирматы 5×50): по 2 на стык горизонтали с боковиной, 50 мм от переда и зада.
  confirmatD: 7,
  confirmatL: 50,
  confirmatInset: 50,
  // Эксцентриковая стяжка D15 (СТП присадка: бочонок 15,3 в пласти, центр 34 от торца, шток 5 в торец)
  eccBarrelD: 15,
  eccBarrelH: 13,
  eccCenter: 34,
  logisticsW: 900, // корпус шире 900 в сборе не во все лифты входит — предупреждение
  // Стол: столешница ЛДСП 16 на боковинах-опорах; высота 650–800, ширина до 2400 (лист 2750), царга 60–150
  deskMinH: 650,
  deskMaxH: 800,
  deskMaxW: 2400,
  deskApronMin: 60,
  deskApronMax: 150,
  deskTop: 32, // столешница всегда 32: две плиты 16 склейкой, кромка 2 по периметру
  deskGrilleRear: 30, // решётка от задней кромки столешницы
  deskGrilleMinW: 200,
  slopeMinLow: 150, // низкая сторона мансардного скоса: хотя бы полка-ниша (антресоль 430 → низ 200)
  slopeMinDrop: 50,
  // Каркасы на ножках и стяжках (заказы цеха: Байков, Семиклетова, Ошарина, Корижин): ножки M6×18 или 1033 h=100; стяжки 100–200.
  feetMin: 15,
  feetMax: 150,
  railMin: 60,
  railMax: 300,
  topStripMin: 30,
  topStripMax: 150,
  sidePanelMaxH: 3000,
  sidePanelMaxD: 800,
  glassTop: 4, // стеклянная крыша: закалённое стекло 4 мм (АТБ), полировка кромки
  glassTopTemper: 880, // закалка 4 мм, ₽/м² (АТБ 01.01.2026)
  glassTopPolishPerM: 100, // полировка прямолинейная 4 мм, ₽/пог.м (прайс МВМ 13.01.26)
  doorMaxLow: 640, // ширина фасада до 640 при высоте до 920 (Перечень для производства), выше — 600
  doorLowH: 920,
  doorMinH: 360, // минимальная высота распашного фасада
  straightenerH: 1900, // фасад выше 1900 и шире 500 — рекомендуется выпрямитель
  straightenerW: 500,
} as const;
export type Section = {
  id: string;
  weight: number;
  shelves: number[];
  drawers: number;
  rod: boolean;
  drawerConfigs?: DrawerConfig[];
  pantograph?: boolean;
  rodAt?: number;
  /** Индексы жёстких полок (на конфирматах/эксцентриках, в точную ширину проёма); остальные съёмные на полкодержателях. */
  fixed?: number[];
};
export type Module = {
  casework?: Casework;
  version: 1;
  name: string;
  width: number;
  height: number;
  depth: number;
  decor: string;
  facadeDecor: string;
  drawerFacadeDecor?: string;
  doors: boolean;
  sections: Section[];
  backType?: "nailed" | "groove" | "board" | "none";
  grooveInset?: number;
  grooveDepth?: number;
  hingeSide?: "left" | "right";
  plinthHeight?: number;
  /** Подсветка врезная в стойках полного свечения: LED-профиль на внутренних гранях боковин и перегородок, на всю высоту проёма. Розница 3000 ₽/пог.м поверх коэффициента (прайс цеха). */
  standLight?: boolean;
  /** Ручка распашных фасадов и ящиков — id из каталога handles.ts; по умолчанию UZ 819 128. */
  handleId?: string;
  /** Угловая фальш-панель: 16 мм ЛДСП снаружи боковины, на всю высоту, глубиной корпус + 40. Ставится автоматически, когда к этой боковине под 90° примыкает другой корпус (applyCornerFillers). */
  cornerFiller?: "left" | "right";
  /** Вид угловой фальши: plank — планка 100×16 торцом снаружи боковины с выступом 40 (сосед примыкает к боковине);
   *  strip — фальш-планка из фасада вровень с фасадами (фасад этого корпуса упирается в боковину соседа). */
  cornerKind?: "plank" | "strip";
  /** Фальшпанели к стене по регламенту цеха: ставятся автоматически, когда боковина у стены и в корпусе есть фасады/ящики.
   *  Только «торцом» (Макс, 06.09): планка width×16 на всю высоту снаружи боковины, заподлицо с фасадом, +5 мм к стене. */
  wallFiller?: Partial<Record<"left" | "right", WallFiller>>;
  /** Распашные фасады в алюминиевой рамке (alu.ts): профиль, цвет, вставка. Без поля — ЛДСП 16. Фасады ящиков остаются ЛДСП. */
  alu?: AluFacade;
  /** Крыша из стекла вместо ЛДСП: id вставки из alu.ts (стекло, сатин, лакобель, зеркало), закалённое 4 мм с полировкой. */
  topGlass?: string;
  /** Основание на ножках вместо цоколя (заказы цеха: ножки M6×18 или регулируемые 1033 h=100): боковины стоят на ножках. */
  feet?: { height: number };
  /** Дно / крыша: 'none' — без панели (открытый каркас на стяжках). По умолчанию панели есть. */
  bottomType?: "panel" | "none";
  topType?: "panel" | "none";
  /** Стяжки — вертикальные планки между боковинами сзади или спереди, снизу или сверху (высота 60–300). */
  rails?: { place: "rear-bottom" | "rear-top" | "front-bottom" | "front-top"; height: number }[];
  /** Распашные фасады: накладные (по умолчанию) или вкладные в проём; открывание ручкой (по умолчанию) или push-to-open без ручек. */
  doorMount?: "overlay" | "inset";
  doorOpen?: "handle" | "push";
  /** Планка под крышей спереди (фальшпанель над фасадами), высота 30–150; фасады укорачиваются. */
  topStrip?: number;
  /** Боковая фальшпанель до потолка снаружи боковины: своя высота (от пола) и глубина, заподлицо с фасадом. */
  sidePanels?: Partial<Record<"left" | "right", { height: number; depth: number }>>;
  /** Штанга: круглая D25 (по умолчанию) или овальная 15×30 (труба-штанга овальная 3000). */
  rodType?: "round" | "oval";
  /** Скос под мансардный потолок: крыша наклонная, у стороны side корпус ниже — lowHeight. Фасады и задник трапецией, полки — до низкой высоты. */
  slope?: { side: "left" | "right"; lowHeight: number };
  /** Крепёж корпуса по СТП: видимый — евровинты (конфирматы), скрытый — эксцентриковые стяжки. По умолчанию евровинты. */
  fastening?: "confirmat" | "eccentric";
  /** Скос фронта в плане (Шаин 6724055): у стороны side корпус мельче — depth; фасады и цоколь идут под углом, боковины разной глубины,
   *  дно/крыша/полки трапецией (в раскрое — габарит с пометкой «скос»), задник прямой. */
  skew?: { side: "left" | "right"; depth: number };
  /** Стол (Имомкулова 6785429): столешница ЛДСП на опорах-боковинах и задней царге. sides — какие опоры свои;
   *  отсутствующая опора — столешница опирается на соседний корпус (стяжки эксцентрик + шкант). Без дна, цоколя, задника и фасадов. */
  desk?: {
    sides: "both" | "left" | "right" | "none";
    /** Высота царги. */
    apron: number;
    /** Смещение царги от задней кромки столешницы вперёд (под батарею), мм. По умолчанию 0. */
    apronOffset?: number;
    /** Подстолье отдельно от столешницы: ширина по внешним граням опор и отступ от левого края столешницы. По умолчанию — вся ширина. */
    baseWidth?: number;
    baseX?: number;
    /** Глубина опор; по умолчанию — глубина столешницы. Опоры прижаты к задней кромке. */
    baseDepth?: number;
    /** Вентиляционная решётка в столешнице над батареей: отступ от левого края, ширина, глубина (от задней кромки 30). */
    grille?: { x: number; width: number; depth: number };
  };
};
export const RAIL_PLACES: Record<NonNullable<Module["rails"]>[number]["place"], string> = { "rear-bottom": "сзади снизу", "rear-top": "сзади сверху", "front-bottom": "спереди снизу", "front-top": "спереди сверху" };
export type WallFiller = { kind: "edge"; width: number };
export type Part = {
  edgeColor?: string;
  id: string;
  name: string;
  sectionId?: string;
  size: [number, number, number];
  position: [number, number, number];
  length: number;
  width: number;
  thickness: number;
  material: "board" | "hdf" | "metal" | "alu" | "glass";
  decor: string;
  role: "body" | "shelf" | "drawer" | "door" | "rod" | "flange" | "pantograph" | "handle" | "hinge" | "light" | "fastener";
  hinge?: "left" | "right";
  grain: "length";
  grainAxis: 0 | 1 | 2;
  edge: [number, number, number, number];
  /** Поворот детали вокруг оси Z (градусы) — наклонная крыша скоса. */
  rotZ?: number;
  /** Трапеция: высота левого и правого края (фасады и задник под скосом); size[1] — большая высота. */
  taper?: [number, number];
  /** Поворот вокруг вертикали (градусы) — фасады и цоколь при скосе фронта в плане. */
  rotY?: number;
  /** Трапеция в плане: глубина левого и правого края от задней грани (дно, крыша, полки при скосе фронта); size[2] — большая глубина. */
  taperZ?: [number, number];
};
export type SectionBox = {
  id: string;
  x: number;
  width: number;
  bottom: number;
  top: number;
};
export const id = () => crypto.randomUUID();
export const section = (): Section => ({
  id: id(),
  weight: 1,
  shelves: [],
  drawers: 0,
  rod: false,
});
export function drawerConfig(m: Module, s: Section, j: number): DrawerConfig {
  return (
    s.drawerConfigs?.[j] || {
      slide: "ball",
      height: RULES.drawerH,
      length:
        [...SLIDES.ball.lengths].reverse().find((l) => l <= m.depth - rearClear(m) - (m.doors ? 44 : 25)) ||
        250,
    }
  );
}
export function plinth(m:Module){return m.feet?0:(m.plinthHeight ?? RULES.plinth);}
/** Уровень низа корпуса над полом: цоколь или высота ножек. */
export function baseLevel(m:Module){return m.feet?m.feet.height:plinth(m);}
export function hasBottom(m:Module){return m.bottomType!=='none';}
export function hasTop(m:Module){return m.topType!=='none';}
/** Верхняя плоскость дна (или низ проёма без дна) и нижняя плоскость крыши (или верх боковин без крыши). */
export function innerBottom(m:Module){return baseLevel(m)+(hasBottom(m)?RULES.panel:0);}
export function innerTop(m:Module){const topT=hasTop(m)?(m.topGlass?RULES.glassTop:RULES.panel):0;return (m.slope?m.slope.lowHeight:m.height)-topT;}
/** Высота верхней плоскости корпуса в точке x (для скоса линейно от высокой стороны к низкой). */
export function slopeAt(m:Module,x:number){if(!m.slope)return m.height;const lo=m.slope.lowHeight,hi=m.height;const k=Math.min(1,Math.max(0,x/m.width));return m.slope.side==='right'?hi-(hi-lo)*k:lo+(hi-lo)*k;}
export function slopeAngle(m:Module){return m.slope?Math.atan2(m.height-m.slope.lowHeight,m.width):0;}
/** Глубина корпуса в точке x при скосе фронта (линейно от полной глубины к depth у мелкой стороны). */
export function depthAt(m:Module,x:number){if(!m.skew)return m.depth;const lo=m.skew.depth,hi=m.depth;const k=Math.min(1,Math.max(0,x/m.width));return m.skew.side==='right'?hi-(hi-lo)*k:lo+(hi-lo)*k;}
/** Угол фронта к оси X (рад), знак — по наклону глубины. */
export function skewAngle(m:Module){return m.skew?Math.atan2((m.skew.side==='right'?-1:1)*(m.depth-m.skew.depth),m.width):0;}
/** Точка на линии фронта x → {x,z} плюс сдвиг наружу по нормали и вдоль фронта; rotY (градусы) для детали, лежащей вдоль фронта. */
export function frontPoint(m:Module,x:number,normalOff:number,alongOff=0){
  const a=skewAngle(m),ux=Math.cos(a),uz=Math.sin(a),nx=-uz,nz=ux;
  return {x:x+ux*alongOff+nx*normalOff,z:depthAt(m,x)+uz*alongOff+nz*normalOff,rotY:-(a*180)/Math.PI};
}
export function railsOf(m:Module){return (m.rails??[]).filter(r=>r&&Number.isFinite(r.height));}
export function railHeight(m:Module,place:NonNullable<Module['rails']>[number]['place']){return railsOf(m).find(r=>r.place===place)?.height??0;}
/** Угловая фальш этого корпуса — планка из фасада (strip). Старые файлы без cornerKind: по наличию фасадов. */
export function cornerStrip(m:Module){if(!m.cornerFiller)return false;return m.cornerKind?m.cornerKind==='strip'&&m.doors:m.doors;}
/** Опоры регулируемые под нижним корпусом (за цоколем): 4, при ширине от 900 — 6. Антресоли и корпуса без цоколя — без опор. */
export function legCount(m:Module,y=0){if(y>0||(!m.feet&&plinth(m)===0))return 0;return m.width>=RULES.legsWideW?RULES.legsWide:RULES.legsPerModule;}
/** В корпусе есть распашные фасады или выкатные элементы — по регламенту у стены нужна фальшпанель. */
export function needsWallFiller(m:Module){return !m.desk&&(m.doors||m.sections.some(s=>s.drawers>0));}
/** Геометрия подстолья: границы опор по X, глубина опор, отступ царги — с подстановкой значений по умолчанию. */
export function deskGeometry(m:Module){
  const dk=m.desk!,x0=dk.baseX??0,bw=dk.baseWidth??m.width-x0;
  return {x0,x1:x0+bw,baseWidth:bw,baseDepth:dk.baseDepth??m.depth,apronOffset:dk.apronOffset??0,hasL:dk.sides==='both'||dk.sides==='left',hasR:dk.sides==='both'||dk.sides==='right'};
}
/** Заготовка стола: столешница 750 на двух опорах, глубина 600, без фасадов, дна, задника и цоколя. */
export function deskModule(base?:Module):Module{
  const m=base?structuredClone(base):initialModule();
  return {...m,name:'Стол',height:750,depth:Math.max(500,Math.min(m.depth,700)),doors:false,plinthHeight:0,bottomType:'none',backType:'none',topType:'panel',
    sections:[{...section(),shelves:[]}],desk:{sides:'both',apron:100},
    feet:undefined,slope:undefined,skew:undefined,alu:undefined,topGlass:undefined,sidePanels:undefined,topStrip:undefined,standLight:undefined,rails:undefined,cornerFiller:undefined,wallFiller:undefined,doorMount:undefined,doorOpen:undefined};
}
/** В корпусе есть ручки (распашные фасады всегда с ручкой; ящики — если не push-to-open). */
export function hasHandles(m:Module){return m.doors||m.sections.some(s=>Array.from({length:s.drawers},(_,j)=>drawerConfig(m,s,j)).some(c=>drawerHasHandle(c)));}
/** Низ накладного фасада: на цоколе — 30 мм от пола (регулировка по цоколю), без цоколя — зазор 2 от низа корпуса. */
export function facadeBottom(m:Module){
  if(m.feet){
    // На ножках: накладной фасад закрывает торец дна; без дна — начинается над передней/задней нижней стяжкой.
    const rail=Math.max(railHeight(m,'front-bottom'),hasBottom(m)?0:railHeight(m,'rear-bottom'));
    return hasBottom(m)?m.feet.height:m.feet.height+rail;
  }
  return plinth(m)>0?Math.min(RULES.facadeFloorGap,plinth(m)):RULES.faceGap;
}
/** Верх накладного фасада: под крышей минус зазор, ниже планки под крышей, если она есть. */
/** Верх накладных фасадов: под скосом — по низкой стороне (крыша плоская на её высоте), выше идёт фальш из фасадного материала. */
export function facadeTop(m:Module){return (m.slope?m.slope.lowHeight:m.height)-RULES.faceGap-(m.topStrip?m.topStrip+RULES.faceGap:0);}
/** Горизонтальный размах накладных фасадов секции i: крайние секции до края корпуса минус зазор, между секциями — до середины перегородки. */
export function facadeSpan(m:Module,i:number,b:SectionBox){
  const t=RULES.panel;
  let left=i===0?RULES.faceGap:b.x-t/2+RULES.faceGap/2;
  let right=i===m.sections.length-1?m.width-RULES.faceGap:b.x+b.width+t/2-RULES.faceGap/2;
  // Угловая фальш-планка из фасада занимает край проёма: фасады крайней секции сдвигаются на планку + зазор 3.
  if(cornerStrip(m)&&m.cornerFiller==='left'&&i===0)left+=RULES.fillerStrip+RULES.fillerGap;
  if(cornerStrip(m)&&m.cornerFiller==='right'&&i===m.sections.length-1)right-=RULES.fillerStrip+RULES.fillerGap;
  return {left,right};
}
export function rearClear(m:Module){return m.backType==='board'?RULES.panel+1:m.backType==='groove'?(m.grooveInset??16)+RULES.back+1:0;}
/** Шаг ящика по высоте: короб + просвет 40, но не меньше фасада с зазором. */
export function drawerPitch(c:{height?:number;facadeH?:number}){const box=(c.height??RULES.drawerH)+RULES.drawerStep;return c.facadeH?Math.max(box,c.facadeH+RULES.drawerFrontGap):box;}
export function drawerOffsets(s:Section){let y=0;return Array.from({length:Math.max(0,Math.min(5,s.drawers))},(_,j)=>{const start=s.drawerConfigs?.[j]?.y??y;y=start+drawerPitch(s.drawerConfigs?.[j]??{});return start;});}
/** Предельная ширина распашного фасада: 640 при высоте фасада до 920, иначе 600 (Перечень для производства). */
export function doorMaxWidth(m:Module){const h=m.height-RULES.faceGap-facadeBottom(m);return h<=RULES.doorLowH?RULES.doorMaxLow:RULES.doorMax;}
export function doorCount(m:Module,s:Section){const b=boxes(m).find(b=>b.id===s.id)!;return b.width+RULES.panel>doorMaxWidth(m)?2:1;}
export function fillerSides(m:Module,s:Section){if(!m.doors||!s.drawers)return {left:0,right:0};const both=doorCount(m,s)===2;return {left:both||m.hingeSide!=='right'?RULES.drawerFiller:0,right:both||m.hingeSide==='right'?RULES.drawerFiller:0};}
export function drawerStackHeight(s: Section) {
  const yy=drawerOffsets(s);return Math.max(0,...yy.map((y,j)=>y+drawerPitch(s.drawerConfigs?.[j]??{})));
}
export function initialModule(): Module {
  return {
    version: 1,
    name: "Шкаф в прихожую",
    width: 600,
    height: 2000,
    depth: 600,
    decor: "Дуб Вотан",
    facadeDecor: "Белый",
    doors: true,
    sections: [
      { ...section(), shelves: [0.72], drawers: 2, rod: false },
    ],
  };
}
export function boxes(m: Module): SectionBox[] {
  const t = RULES.panel;
  const available = m.width - t * (m.sections.length + 1);
  const total = m.sections.reduce((s, x) => s + x.weight, 0);
  let x = t;
  return m.sections.map((s, i) => {
    const width =
      i === m.sections.length - 1
        ? m.width - t - x
        : Math.round(((available * s.weight) / total) * 10) / 10;
    const b = {
      id: s.id,
      x,
      width,
      bottom: innerBottom(m),
      top: innerTop(m),
    };
    x += width + t;
    return b;
  });
}
export function parts(m: Module): Part[] {
  if(m.casework)return caseworkParts(m);
  const out: Part[] = [];
  const t = RULES.panel;
  const d = m.depth;
  const bottom = baseLevel(m), floorY = m.feet ? m.feet.height : 0;
  const rear=rearClear(m);
  function add(
    key: string,
    name: string,
    size: Part["size"],
    pos: Part["position"],
    length: number,
    width: number,
    thickness: number,
    role: Part["role"] = "body",
    sid?: string,
    material: Part["material"] = "board",
  ) {
    out.push({
      id: key,
      name,
      sectionId: sid,
      size,
      position: pos,
      length,
      width,
      thickness,
      role,
      material,
      decor: role === "door" ? m.facadeDecor : m.decor,
      grain: "length",
      grainAxis: role==='door'||key==='left'||key==='right'||key==='back'||key.startsWith('corner-filler')||key.startsWith('wall-filler')||key.endsWith(':divider')||key.includes(':filler:')||key.endsWith(':facade')?1:role==='drawer'&&(key.endsWith(':left')||key.endsWith(':right'))?2:0,
      edge: material === "board" ? role === "door" ? [2,2,2,2] : [0.4, 0.4, 2, 0.4] : [0, 0, 0, 0],
    });
  }
  if (m.desk) {
    // Стол: столешница 32 (две плиты 16 склейкой) на всю ширину, подстолье — опоры до пола и царга, могут быть уже столешницы.
    // Без своей опоры столешница и царга крепятся к соседнему корпусу эксцентриком + шкантом (Базис: «Стяжка эксц. + шкант фикс 50»).
    const g = deskGeometry(m), H = m.height, T = RULES.deskTop;
    add("top", "Столешница · верхняя плита 16", [m.width, t, d], [m.width / 2, H - t / 2, d / 2], m.width, d, t);
    out.at(-1)!.edge = [2, 2, 2, 2];
    add("top2", "Столешница · нижняя плита 16 (склейка до 32)", [m.width, t, d], [m.width / 2, H - T + t / 2, d / 2], m.width, d, t);
    out.at(-1)!.edge = [2, 2, 2, 2];
    const bz = g.baseDepth / 2;
    if (g.hasL) add("left", "Опора стола левая", [t, H - T, g.baseDepth], [g.x0 + t / 2, (H - T) / 2, bz], H - T, g.baseDepth, t);
    if (g.hasR) add("right", "Опора стола правая", [t, H - T, g.baseDepth], [g.x1 - t / 2, (H - T) / 2, bz], H - T, g.baseDepth, t);
    const ax0 = g.hasL ? g.x0 + t : g.x0, ax1 = g.hasR ? g.x1 - t : g.x1, aw = ax1 - ax0;
    add("rail:rear-top", "Царга стола " + m.desk.apron + (g.apronOffset ? " · отступ " + g.apronOffset : ""), [aw, m.desk.apron, t], [(ax0 + ax1) / 2, H - T - m.desk.apron / 2, g.apronOffset + t / 2], aw, m.desk.apron, t);
    if (m.desk.grille) {
      const gr = m.desk.grille;
      add("desk-grille", `Решётка вентиляционная ${gr.width}×${gr.depth} в столешницу`, [gr.width, 3, gr.depth], [gr.x + gr.width / 2, H + 1, RULES.deskGrilleRear + gr.depth / 2], gr.width, gr.depth, 3, "body", undefined, "metal");
    }
    // Крепёж столешницы к опорам: эксцентрики снизу столешницы, сверху не сверлим.
    for (const [side, x, has] of [["left", g.x0 + t / 2, g.hasL], ["right", g.x1 - t / 2, g.hasR]] as const) if (has)
      for (const [k, z] of [RULES.confirmatInset, g.baseDepth - RULES.confirmatInset].entries()) {
        add(`ecc:top:${side}:${k}`, "Эксцентрик D15 · бочонок", [RULES.eccBarrelH, RULES.eccBarrelD, RULES.eccBarrelD], [x, H - T - RULES.eccBarrelH / 2 + 0.3, z], RULES.eccBarrelH, RULES.eccBarrelD, RULES.eccBarrelD, "fastener", undefined, "metal");
      }
    return out;
  }
  // Боковины: от пола (на цоколе) или от верха ножек; под стеклянной крышей — короче на её толщину.
  // Скос под потолок (правило Макса): крыша плоская на высоте низкой стороны, низкая боковина — до крыши, высокая — до потолка;
  // треугольник над фасадами закрывает фальш из фасадного материала вровень с фасадами. Так дешевле, чем косая крыша.
  const sideTopAt = (x: number) => (m.slope ? (x < m.width / 2 === (m.slope.side === "left") ? m.slope.lowHeight : m.height) : m.height - (m.topGlass && hasTop(m) ? RULES.glassTop : 0));
  const lT = sideTopAt(t / 2), rT = sideTopAt(m.width - t / 2);
  // Скос фронта в плане: боковины разной глубины, горизонтали — трапецией (в раскрое габарит с пометкой «скос»).
  const dL = depthAt(m, 0), dR = depthAt(m, m.width), sk = m.skew ? " · скос" : "";
  const planTaper = (p: Part, x0: number, x1: number, rearOff: number, minus: number) => { if (m.skew) p.taperZ = [depthAt(m, x0) - rearOff - minus, depthAt(m, x1) - rearOff - minus]; };
  add("left", "Боковина левая", [t, lT - floorY, dL], [t / 2, (lT + floorY) / 2, dL / 2], lT - floorY, dL, t);
  add("right", "Боковина правая", [t, rT - floorY, dR], [m.width - t / 2, (rT + floorY) / 2, dR / 2], rT - floorY, dR, t);
  if (hasBottom(m)) { add("bottom", "Дно" + sk, [m.width - 2 * t, t, d], [m.width / 2, bottom + t / 2, d / 2], m.width - 2 * t, d, t); planTaper(out.at(-1)!, t, m.width - t, 0, 0); }
  if (hasTop(m) && m.slope) {
    // Плоская крыша на высоте низкой стороны, между боковинами.
    add("top", "Крыша", [m.width - 2 * t, t, d], [m.width / 2, m.slope.lowHeight - t / 2, d / 2], m.width - 2 * t, d, t);
    if (m.doors && m.doorMount !== "inset") {
      // Фальш над фасадами: трапеция из фасадного материала, низ — над фасадами с зазором 2, верх — по линии потолка минус зазор.
      const bx = boxes(m), l = facadeSpan(m, 0, bx[0]).left, r = facadeSpan(m, bx.length - 1, bx.at(-1)!).right;
      const y0 = m.slope.lowHeight, hL = Math.max(1, slopeAt(m, l) - RULES.faceGap - y0), hR = Math.max(1, slopeAt(m, r) - RULES.faceGap - y0), hh = Math.max(hL, hR);
      add("slope-filler", "Фальш над фасадами под скос · фасадный материал", [r - l, hh, t], [(l + r) / 2, y0 + hh / 2, d + t / 2 + 2], hh, r - l, t, "door");
      out.at(-1)!.taper = [hL, hR]; out.at(-1)!.decor = m.facadeDecor; out.at(-1)!.edge = [2, 2, 2, 2];
    }
  } else if (hasTop(m)) {
    if (m.topGlass) {
      // Стеклянная крыша: закалённое стекло 4 мм лежит на боковинах заподлицо с верхом, полировка кромки по периметру.
      const g = RULES.glassTop;
      add("top", "Крыша · " + (aluInsert(m.topGlass)?.label ?? "стекло") + " закалённое", [m.width, g, d], [m.width / 2, m.height - g / 2, d / 2], m.width, d, g, "body", undefined, "glass");
      out.at(-1)!.decor = aluInsert(m.topGlass)?.label ?? "стекло";
    } else { add("top", "Крыша" + sk, [m.width - 2 * t, t, d], [m.width / 2, m.height - t / 2, d / 2], m.width - 2 * t, d, t); planTaper(out.at(-1)!, t, m.width - t, 0, 0); }
  }
  // Ножки: по 2 под каждой боковиной (для сцены и опор в смете), в раскрой не идут.
  if (m.feet) for (const [side, x] of [["left", t / 2], ["right", m.width - t / 2]] as const) for (const [k, z] of [[0, 60], [1, d - 60]] as const)
    add(`leg:${side}:${k}`, "Ножка", [40, m.feet.height, 40], [x, m.feet.height / 2, z], m.feet.height, 40, 40, "fastener", undefined, "metal");
  // Стяжки — планки между боковинами: сзади/спереди, снизу/сверху.
  for (const r of railsOf(m)) {
    const front = r.place.startsWith("front"), low = r.place.endsWith("bottom");
    const y0 = low ? (hasBottom(m) ? bottom + t : bottom) : innerTop(m) - r.height;
    add("rail:" + r.place, "Стяжка " + RAIL_PLACES[r.place] + " " + r.height, [m.width - 2 * t, r.height, t], [m.width / 2, y0 + r.height / 2, front ? d - t / 2 : t / 2], m.width - 2 * t, r.height, t);
  }
  // Планка под крышей спереди (фальшпанель над фасадами) — в плоскости фасадов.
  if (m.topStrip) {
    const inset = m.doorMount === "inset";
    const y1 = inset ? innerTop(m) : m.height - RULES.faceGap, sw = inset ? m.width - 2 * t - 2 * RULES.faceGap : m.width - 2 * RULES.faceGap;
    add("top-strip", "Планка под крышей " + m.topStrip, [sw, m.topStrip, t], [m.width / 2, y1 - m.topStrip / 2, inset ? d - t / 2 : d + t / 2 + 2], sw, m.topStrip, t);
    out.at(-1)!.decor = m.facadeDecor; out.at(-1)!.edge = [2, 2, 2, 2];
  }
  // Боковые фальшпанели до потолка снаружи боковин.
  for (const side of ["left", "right"] as const) {
    const sp = m.sidePanels?.[side];
    if (!sp) continue;
    add("side-panel:" + side, "Фальшпанель боковая " + (side === "left" ? "левая" : "правая") + " " + sp.height + "×" + sp.depth, [t, sp.height, sp.depth], [side === "left" ? -t / 2 : m.width + t / 2, sp.height / 2, d + 18 - sp.depth / 2], sp.height, sp.depth, t);
    out.at(-1)!.edge = [2, 2, 2, 2];
  }
  // Фальши цеха — только «торцом»: планка 16 × 100 на всю высоту, прикручена пластью снаружи боковины, виден торец 16 мм.
  // Угловая: выступает вперёд на 40 мм от корпуса (правило Макса). К стене: заподлицо с фасадом, +5 мм к стене (регламент).
  if (m.cornerFiller && cornerStrip(m)) {
    // Фасад корпуса упирается в боковину соседа: фальш-планка из фасадного материала вровень с фасадами, на эксцентриках
    // к каркасу, зазор 3 к соседнему фасаду (Макс, 06.09). Занимает край фасадного проёма; распашные фасады становятся уже.
    const w = RULES.fillerStrip, y0 = facadeBottom(m), y1 = m.height - RULES.faceGap;
    add("corner-filler:" + m.cornerFiller, "Фальш-планка угловая из фасада " + (m.cornerFiller === "left" ? "левая" : "правая"), [w, y1 - y0, t], [m.cornerFiller === "left" ? RULES.faceGap + w / 2 : m.width - RULES.faceGap - w / 2, (y0 + y1) / 2, d + t / 2 + 2], y1 - y0, w, t);
    out.at(-1)!.decor = m.facadeDecor; out.at(-1)!.edge = [2, 2, 2, 2];
  } else if (m.cornerFiller) {
    // Сосед примыкает к боковине: планка 100×16 торцом снаружи боковины, выступает вперёд на 40 (правило Макса).
    const w = RULES.fillerStrip, front = d + RULES.cornerFillerExtra;
    add("corner-filler:" + m.cornerFiller, "Фальш угловая " + (m.cornerFiller === "left" ? "левая" : "правая") + " 100×16 торцом", [t, m.height, w], [m.cornerFiller === "left" ? -t / 2 : m.width + t / 2, m.height / 2, front - w / 2], m.height, w, t);
  }
  for (const side of ["left", "right"] as const) {
    const wf = m.wallFiller?.[side];
    if (!wf || m.cornerFiller === side) continue;
    const dir = side === "left" ? -1 : 1, edge = side === "left" ? 0 : m.width, w = wf.width;
    add("wall-filler:" + side, "Фальшпанель к стене " + (side === "left" ? "левая" : "правая") + " " + w + "×16", [t, m.height, w], [edge + dir * t / 2, m.height / 2, d + 18 - w / 2], m.height, w, t);
  }
  if(!m.feet&&bottom>0){
    if(m.skew){ // цоколь по скошенному фронту: длина по косой, утоплен на 2 от передних граней боковин
      const pl=(m.width-2*t)/Math.cos(skewAngle(m)),fp=frontPoint(m,m.width/2,-RULES.plinthInset-t/2);
      add("plinth","Цоколь · скос",[pl,bottom,t],[fp.x,bottom/2,fp.z],pl,bottom,t);out.at(-1)!.rotY=fp.rotY;
    } else add(
    "plinth",
    "Цоколь",
    [m.width - 2 * t, bottom, t],
    [m.width / 2, bottom / 2, d - RULES.plinthInset - t / 2],
    m.width - 2 * t,
    bottom,
    t,
  );}
  const groove=m.backType==='groove',gd=m.grooveDepth??8;
  const backW=groove?m.width-2*t+2*gd-1:m.width-4;
  const backH=groove?m.height-bottom-2*t+2*gd-1:m.height-4;
  const backTopL = m.slope ? slopeAt(m, 2) - 2 : m.height, backTopR = m.slope ? slopeAt(m, m.width - 2) - 2 : m.height;
  if(m.backType==='board'){const bh=innerTop(m)-bottom-t;add('back','Задняя стенка · ЛДСП вкладная',[m.width-2*t,bh,t],[m.width/2,bottom+t+bh/2,t/2],bh,m.width-2*t,t,'body');out.at(-1)!.edge=[0.4,0.4,0.4,0.4];}
  else if(m.backType!=='none'){
    if(m.slope&&!groove){const maxH=Math.max(backTopL,backTopR)-2;add('back','Задняя стенка · набивная · скос',[backW,maxH,RULES.back],[m.width/2,2+maxH/2,-RULES.back/2],maxH,backW,RULES.back,'body',undefined,'hdf');out.at(-1)!.taper=[backTopL-2,backTopR-2];}
    else add('back',groove?'Задняя стенка · в паз':'Задняя стенка · набивная',[backW,backH,RULES.back],[m.width/2,groove?(bottom+m.height)/2:m.height/2,groove?(m.grooveInset??16)+RULES.back/2:-RULES.back/2],backH,backW,RULES.back,'body',undefined,'hdf');
  }
  boxes(m).forEach((b, i) => {
    const s = m.sections[i],
      h = b.top - b.bottom,
      sd = d - rear - RULES.shelfDepthMinus;
    if (i > 0) {
      const dd = depthAt(m, b.x - t / 2) - rear - RULES.shelfDepthMinus;
      add(
        `${s.id}:divider`,
        "Перегородка",
        [t, h, dd],
        [b.x - t / 2, b.bottom + h / 2, rear + dd / 2],
        h,
        dd,
        t,
        "body",
        s.id,
      );
    }
    if (m.standLight)
      for (const side of ["left", "right"] as const)
        add(
          `${s.id}:light:${side}`,
          "Подсветка LED в стойке",
          [RULES.lightProfileT, h, RULES.lightProfileW],
          [side === "left" ? b.x + RULES.lightProfileT / 2 : b.x + b.width - RULES.lightProfileT / 2, b.bottom + h / 2, d - RULES.lightFrontOffset],
          h,
          RULES.lightProfileW,
          RULES.lightProfileT,
          "light",
          s.id,
          "metal",
        );
    s.shelves.forEach((f, j) => {
      add(
        `${s.id}:shelf:${j}`,
        (s.fixed?.includes(j) ? "Полка жёсткая" : "Полка съёмная") + sk,
        [b.width - (s.fixed?.includes(j) ? 0 : 2 * RULES.shelfGap), t, sd],
        [b.x + b.width / 2, b.bottom + f * h, rear + sd / 2],
        b.width - (s.fixed?.includes(j) ? 0 : 2 * RULES.shelfGap),
        sd,
        t,
        "shelf",
        s.id,
      );
      planTaper(out.at(-1)!, b.x, b.x + b.width, rear, RULES.shelfDepthMinus);
    });
    const f=fillerSides(m,s),filler=f.left+f.right;
    for(const side of ['left','right'] as const)if(f[side]) add(s.id+':filler:'+side,'Фальш-панель '+(side==='left'?'левая':'правая'),[t,drawerStackHeight(s),sd],[side==='left'?b.x+t/2:b.x+b.width-t/2,b.bottom+drawerStackHeight(s)/2,rear+sd/2],drawerStackHeight(s),sd,t,'body',s.id);
    if(s.drawers>0){add(s.id+':drawer-cap','Обязательная полка над ящиками'+sk,[b.width,t,sd],[b.x+b.width/2,b.bottom+drawerStackHeight(s)+t/2,rear+sd/2],b.width,sd,t,'shelf',s.id);planTaper(out.at(-1)!,b.x,b.x+b.width,rear,RULES.shelfDepthMinus);}
    let nextY = b.bottom + RULES.drawerStep / 2;
    for (let j = 0; j < s.drawers; j++) {
      const cfg = drawerConfig(m, s, j),
        hidden = cfg.slide === "gtv0fpo";
      const sideGap = hidden ? 5 : RULES.drawerSideGap,
        boxW = b.width - filler - 2 * sideGap;
      const boxD = cfg.length - (hidden ? 10 : 0),
        bh = cfg.height;
      const bx = b.x + f.left + sideGap,
        y = b.bottom + RULES.drawerStep/2 + drawerOffsets(s)[j],
        z = d - (m.doors ? 44 : 20) - boxD;
      nextY += bh + RULES.drawerStep;
      const mesh = cfg.mesh ? meshById(cfg.mesh) : undefined;
      if (mesh) {
        // Сетчатый элемент Лемана: рама по требуемой ширине минус крепление, глубина изделия, свои направляющие.
        // Сетка без фасада: за дверью хватает 20 мм (дверь 16 + зазор), в открытом корпусе рама заподлицо с передом.
        const front = m.doors ? RULES.meshDoorClear : 0;
        const mw = mesh.reqW - 8, md = Math.min(mesh.reqD - 10, d - rear - front), mz = d - front - md;
        add(s.id + ":drawer:" + j + ":mesh", mesh.label + " · Лемана Про арт. " + mesh.art, [mw, mesh.h, md], [b.x + f.left + (b.width - filler) / 2, y + mesh.h / 2, mz + md / 2], md, mw, mesh.h, "drawer", s.id, "metal");
        continue;
      }
      for (const side of ["left", "right"])
        add(
          s.id + ":drawer:" + j + ":" + side,
          "Ящик " + (j + 1) + " · боковина",
          [t, bh, boxD],
          [
            side === "left" ? bx + t / 2 : bx + boxW - t / 2,
            y + bh / 2,
            z + boxD / 2,
          ],
          boxD,
          bh,
          t,
          "drawer",
          s.id,
        );
      const endH = hidden ? bh - 28 : bh,
        endY = hidden ? y + 28 : y;
      for (const end of ["front", "back"])
        add(
          s.id + ":drawer:" + j + ":" + end,
          "Ящик " +
            (j + 1) +
            " · " +
            (end === "front" ? "передняя стенка" : "задняя стенка"),
          [boxW - 2 * t, endH, t],
          [
            bx + boxW / 2,
            endY + endH / 2,
            end === "front" ? z + boxD - t / 2 : z + t / 2,
          ],
          boxW - 2 * t,
          endH,
          t,
          "drawer",
          s.id,
        );
      const bw = hidden ? boxW - 2 * t : boxW,
        bd = boxD,
        bt = t;
      add(
        s.id + ":drawer:" + j + ":bottom",
        "Ящик " + (j + 1) + " · дно",
        [bw, bt, bd],
        [bx + boxW / 2, hidden ? y + 12 + t / 2 : y - bt / 2, z + boxD / 2],
        bw,
        bd,
        bt,
        "drawer",
        s.id,
        "board",
      );
      // За распашными дверями фасад ящика вкладной (внутри проёма, зазор 3). В открытом корпусе — накладной:
      // перекрывает стойки как распашной фасад, зазор 2, нижний фасад опускается на цоколь до 30 мм от пола.
      // Фасад: по умолчанию на шаг ящика минус зазор; при заданной высоте фасада — она (короб может быть ниже, экономия плиты).
      const pitch=drawerPitch(cfg),pitchBottom=y-RULES.drawerStep/2;
      let fh=cfg.facadeH??(pitch-RULES.drawerFrontGap),fw=b.width-filler-2*RULES.drawerFrontGap,fx=b.x+f.left+(b.width-filler)/2,fy=pitchBottom+fh/2+(cfg.facadeH?RULES.drawerFrontGap/2:0);
      if(cfg.noFacade){ // внутренний ящик: только короб и направляющие
        for (const side of [0, 1])
          add(s.id + ":drawer:" + j + ":slide:" + side, "Направляющая " + cfg.slide, [hidden ? 20 : 12, hidden ? 12 : 45, cfg.length], [hidden ? bx + (side ? boxW - 10 : 10) : bx + (side ? boxW + 6 : -6), hidden ? y + 6 : y + bh / 2, z + boxD - cfg.length / 2], cfg.length, 20, 12, "drawer", s.id, "metal");
        continue;
      }
      if(!m.doors){
        const span=facadeSpan(m,i,b);fw=span.right-span.left;fx=(span.left+span.right)/2;
        fh=cfg.facadeH??(pitch-RULES.faceGap);fy=pitchBottom+fh/2+(cfg.facadeH?RULES.faceGap/2:0);
        const lowest=drawerOffsets(s).every((o,k)=>k===j||o>=drawerOffsets(s)[j]);
        if(lowest){const top=fy+fh/2,floor=facadeBottom(m);if(floor<top-fh){fh=top-floor;fy=(top+floor)/2;}}
      }
      add(s.id+':drawer:'+j+':facade','Ящик '+(j+1)+' · фасад',[fw,fh,t],[fx,fy,m.doors?d-36:d+t/2+2],fh,fw,t,'drawer',s.id);
      out.at(-1)!.decor=m.drawerFacadeDecor??m.facadeDecor;out.at(-1)!.edge=[2,2,2,2];
      if(drawerHasHandle(cfg)){const hl=handleById(m.handleId).len;add(s.id+':drawer:'+j+':handle','Ручка ящика · '+handleById(m.handleId).label,[hl,10,18],[fx,y+bh/2,m.doors?d-20:d+28],hl,10,18,'handle',s.id,'metal');}
      for (const side of [0, 1])
        add(
          s.id + ":drawer:" + j + ":slide:" + side,
          "Направляющая " + cfg.slide,
          [hidden ? 20 : 12, hidden ? 12 : 45, cfg.length],
          [
            hidden ? bx + (side ? boxW - 10 : 10) : bx + (side ? boxW + 6 : -6),
            hidden ? y + 6 : y + bh / 2,
            z + boxD - cfg.length / 2,
          ],
          cfg.length,
          20,
          12,
          "drawer",
          s.id,
          "metal",
        );
    }
    if (s.rod) {
      const topShelf = s.shelves.length
        ? Math.min(...s.shelves.map((f) => b.bottom + f * h))
        : b.top;
      const ry = s.rodAt===undefined?topShelf-RULES.rodTopOffset:b.bottom+s.rodAt*h;
      const oval = m.rodType === "oval";
      add(
        `${s.id}:rod`,
        oval ? "Штанга овальная 15×30" : "Штанга",
        [b.width, oval ? 15 : RULES.rodDiameter, oval ? 30 : RULES.rodDiameter],
        [b.x + b.width / 2, ry, d / 2],
        b.width,
        oval ? 15 : RULES.rodDiameter,
        oval ? 30 : RULES.rodDiameter,
        "rod",
        s.id,
        "metal",
      );
    }
    if(s.rod){const rp=out.find(p=>p.id===s.id+':rod')!;for(const side of [0,1])add(s.id+':flange:'+side,'Фланец штанги D25',[5,48,48],[side?b.x+b.width-2.5:b.x+2.5,rp.position[1],rp.position[2]],48,48,5,'flange',s.id,'metal');}
    if(s.pantograph){
      const ry=b.bottom+(s.rodAt??0.87)*h,cy=ry-360;
      for(const side of [0,1]){
        const xx=side?b.x+b.width-24:b.x+24;
        add(s.id+':pantograph:mount:'+side,'Пантограф · механизм',[48,160,95],[xx,cy, d/2],160,95,48,'pantograph',s.id,'metal');
        add(s.id+':pantograph:arm:'+side,'Пантограф · рычаг',[18,400,22],[xx,cy+200,d/2],400,22,18,'pantograph',s.id,'metal');
      }
      add(s.id+':pantograph:rod','Пантограф · штанга',[b.width-48,25,25],[b.x+b.width/2,ry,d/2],b.width-48,25,25,'rod',s.id,'metal');
      add(s.id+':pantograph:pull','Пантограф · ручка',[18,550,18],[b.x+b.width/2,ry-275,d/2+40],550,18,18,'pantograph',s.id,'metal');
    }
    if (m.doors) {
      const {left,right}=facadeSpan(m,i,b);
      const inset=m.doorMount==='inset';
      // Вкладной фасад: внутри проёма секции с зазором 2, заподлицо с передом корпуса. Накладной: перекрывает стойки.
      const spanL=inset?b.x+RULES.faceGap:left,spanR=inset?b.x+b.width-RULES.faceGap:right;
      // Скос фронта: фасады лежат вдоль наклонной линии фронта, их суммарная ширина — по косой (длиннее проёма).
      const cosK=Math.cos(skewAngle(m)),frontLen=(spanR-spanL)/cosK;
      const count=doorCount(m,s),dw=(frontLen-(count-1)*RULES.faceGap)/count;
      const y0=inset?b.bottom+RULES.faceGap:facadeBottom(m),y1flat=inset?b.top-RULES.faceGap-(m.topStrip?m.topStrip+RULES.faceGap:0):facadeTop(m);
      const dz=inset?d-t/2:d+t/2+2;
      for(let k=0;k<count;k++){
        const hinge=count===2?(k===0?'left':'right'):(m.hingeSide??'left'),x0=spanL+k*(dw+RULES.faceGap)*cosK,cx=x0+dw*cosK/2;
        const fp=m.skew?frontPoint(m,cx,t/2+2):undefined;
        // Фасады прямоугольные и под скосом: их верх — по низкой стороне, выше идёт фальш (см. slope-filler).
        const hL=y1flat-y0,hR=y1flat-y0,dh=Math.max(hL,hR),y1=y0+dh;void x0;
        if(m.alu){
          const ft=ALU_EXTRAS.frameDepth;
          add(s.id+':door:'+k,'Фасад в алюминиевой рамке',[dw,dh,ft],[cx,(y0+y1)/2,inset?d-ft/2:d+ft/2+2],dh,dw,ft,'door',s.id,'alu');
          out.at(-1)!.decor=aluLabel(m.alu);out.at(-1)!.edge=[0,0,0,0];
        } else add(s.id+':door:'+k,inset?'Фасад распашной вкладной':'Фасад распашной',[dw,dh,t],[fp?fp.x:cx,(y0+y1)/2,fp?fp.z:dz],dh,dw,t,'door',s.id);
        if(fp)out.at(-1)!.rotY=fp.rotY;
        out.at(-1)!.hinge=hinge;
        if(m.doorOpen==='push')continue; // push-to-open: без ручки, толкатель в смете
        const hl=handleById(m.handleId).len;
        const hp=m.skew?frontPoint(m,cx,t+2+13,(hinge==='left'?1:-1)*(dw/2-40)):undefined;
        add(s.id+':handle:'+k,'Ручка фасада · '+handleById(m.handleId).label,[10,hl,25],[hp?hp.x:cx+(hinge==='left'?1:-1)*(dw/2-40),y0+Math.min(hL,hR)/2,hp?hp.z:dz+t/2+13],hl,25,10,'handle',s.id,'metal');
        if(hp)out.at(-1)!.rotY=hp.rotY;
      }

    }
  });
  // Крепёж по СТП: евровинты (конфирматы, видны снаружи) или эксцентриковые стяжки (скрыты: бочонок в пласти горизонтали, шток в боковине).
  // Стыки: дно, крыша, полка над ящиками, жёсткие полки — с боковинами; перегородки — с крышей и дном.
  const fixedIds = new Set(m.sections.flatMap((s) => (s.fixed ?? []).map((j) => `${s.id}:shelf:${j}`)));
  const horizontals = out.filter((p) => p.material === "board" && !p.rotZ && (p.id === "bottom" || p.id === "top" || p.id.endsWith(":drawer-cap") || fixedIds.has(p.id)));
  const ecc = m.fastening === "eccentric";
  for (const hp of horizontals) {
    const z0 = hp.position[2] - hp.size[2] / 2;
    const x0 = hp.position[0] - hp.size[0] / 2, x1 = hp.position[0] + hp.size[0] / 2; // грани горизонтали у боковин/перегородок
    for (const [side, edgeX, dir] of [["left", x0, 1], ["right", x1, -1]] as const) {
      const z1 = z0 + (hp.taperZ ? hp.taperZ[side === "left" ? 0 : 1] : hp.size[2]); // при скосе фронта передний крепёж по глубине своей стороны
      for (const [k, z] of [z0 + RULES.confirmatInset, z1 - RULES.confirmatInset].entries()) {
        if (ecc) {
          // Бочонок сверлится с пласти, обращённой внутрь корпуса: у дна — сверху, у крыши и полок — снизу; торец бочонка виден при открытых фасадах.
          const fromTop = hp.id === "bottom", by = fromTop ? hp.position[1] + t / 2 - RULES.eccBarrelH / 2 + 0.3 : hp.position[1] - t / 2 + RULES.eccBarrelH / 2 - 0.3;
          add(`ecc:${hp.id}:${side}:${k}`, "Эксцентрик D15 · бочонок", [RULES.eccBarrelH, RULES.eccBarrelD, RULES.eccBarrelD], [edgeX + dir * RULES.eccCenter, by, z], RULES.eccBarrelH, RULES.eccBarrelD, RULES.eccBarrelD, "fastener", hp.sectionId, "metal");
          add(`ecc:${hp.id}:${side}:${k}:pin`, "Эксцентрик D15 · шток", [RULES.eccCenter + t / 2, 7, 7], [edgeX + dir * (RULES.eccCenter - t / 2) / 2, hp.position[1], z], RULES.eccCenter + t / 2, 7, 7, "fastener", hp.sectionId, "metal");
        } else add(`fast:${hp.id}:${side}:${k}`, "Конфирмат 5×50", [RULES.confirmatL, RULES.confirmatD, RULES.confirmatD], [edgeX - dir * t + dir * RULES.confirmatL / 2, hp.position[1], z], RULES.confirmatL, RULES.confirmatD, RULES.confirmatD, "fastener", hp.sectionId, "metal");
      }
    }
  }
  for (const dv of out.filter((p) => p.id.endsWith(":divider"))) {
    const z0 = dv.position[2] - dv.size[2] / 2, z1 = dv.position[2] + dv.size[2] / 2;
    for (const [edge, y] of [["top", innerTop(m) + t / 2 + (hasTop(m) ? 0 : -t / 2)], ["bottom", innerBottom(m) - t / 2 + (hasBottom(m) ? 0 : t / 2)]] as const)
      for (const [k, z] of [z0 + RULES.confirmatInset, z1 - RULES.confirmatInset].entries()) {
        if (ecc) add(`ecc:${dv.id}:${edge}:${k}`, "Эксцентрик D15 · бочонок", [RULES.eccBarrelH, RULES.eccBarrelD, RULES.eccBarrelD], [dv.position[0], edge === "top" ? y - RULES.eccBarrelH : y + RULES.eccBarrelH, z], RULES.eccBarrelH, RULES.eccBarrelD, RULES.eccBarrelD, "fastener", dv.sectionId, "metal");
        else add(`fast:${dv.id}:${edge}:${k}`, "Конфирмат 5×50", [RULES.confirmatD, RULES.confirmatL, RULES.confirmatD], [dv.position[0], y, z], RULES.confirmatL, RULES.confirmatD, RULES.confirmatD, "fastener", dv.sectionId, "metal");
      }
  }
  return out;
}
/** Верх полки над ящиками секции от низа корпуса (цоколь + дно + стопка ящиков + полка). */
export function drawerCapTop(m:Module,s:Section){const b=boxes(m).find(b=>b.id===s.id)!;return b.bottom+drawerStackHeight(s)+RULES.panel;}
/**
 * Задать высоту верха полки над ящиками (от низа корпуса): ящики делятся поровну по высоте.
 * Возвращает новые конфигурации; высота короба = шаг − 40, фасады по шагу.
 */
export function distributeDrawers(m:Module,s:Section,capTop:number):DrawerConfig[]{
  const b=boxes(m).find(b=>b.id===s.id)!,n=s.drawers;
  if(n<1)throw Error('В секции нет ящиков.');
  const stack=capTop-b.bottom-RULES.panel,pitch=Math.floor(stack/n);
  const box=pitch-RULES.drawerStep;
  if(box<68)throw Error(`Слишком низко: при ${n} ящиках нужно не меньше ${b.bottom+RULES.panel+n*(68+RULES.drawerStep)} мм от низа корпуса.`);
  if(box>300)throw Error(`Слишком высоко: боковина ящика выйдет ${box} мм, максимум 300. Добавьте ящик или опустите полку.`);
  return Array.from({length:n},(_,j)=>{const c=drawerConfig(m,s,j);const {facadeH:_f,...rest}=c;void _f;return {...rest,height:box,y:j*pitch};});
}
/** Число конфирматов корпуса и полкодержателей под съёмные полки. */
export function fastenerCounts(m: Module) {
  const ps = parts(m);
  const fixedIds = new Set(m.sections.flatMap((s) => (s.fixed ?? []).map((j) => `${s.id}:shelf:${j}`)));
  return { confirmats: ps.filter((p) => p.role === "fastener" && p.id.startsWith("fast:")).length, shelfHolders: 4 * ps.filter((p) => p.role === "shelf" && !p.id.endsWith(":drawer-cap") && !fixedIds.has(p.id)).length, eccentrics: ps.filter((p) => p.id.startsWith("ecc:") && !p.id.endsWith(":pin")).length + (cornerStrip(m) ? 4 : 0) };
}
export function validate(m: Module): string[] {
  if(m.casework)return caseworkErrors(m);
  const errors: string[] = [];
  for (const [key, label, min, max] of (m.desk ? [
    ["width", "Ширина стола", RULES.minW, RULES.deskMaxW],
    ["height", "Высота стола", RULES.deskMinH, RULES.deskMaxH],
    ["depth", "Глубина стола", RULES.minD, RULES.maxD],
  ] : [
    ["width", "Ширина", RULES.minW, RULES.maxW],
    ["height", "Высота", RULES.minH, RULES.maxH],
    ["depth", "Глубина", RULES.minD, RULES.maxD],
  ]) as readonly (readonly ["width" | "height" | "depth", string, number, number])[]) {
    const n = m[key];
    if (!Number.isFinite(n) || n < min || n > max)
      errors.push(`${label}: допустимо от ${min} до ${max} мм.`);
  }
  if (m.backType!==undefined && !["nailed","groove","board","none"].includes(m.backType)) errors.push("Выберите допустимый тип задней стенки.");
  if(m.hingeSide!==undefined&&!['left','right'].includes(m.hingeSide))errors.push('Выберите сторону петель.');
  if(m.standLight!==undefined&&typeof m.standLight!=='boolean')errors.push('Неверный параметр подсветки.');
  if(m.handleId!==undefined&&!HANDLES.some(h=>h.id===m.handleId))errors.push('Выберите ручку из каталога.');
  if(m.cornerFiller!==undefined&&!['left','right'].includes(m.cornerFiller))errors.push('Неверная угловая фальш.');
  if(m.cornerKind!==undefined&&!['plank','strip'].includes(m.cornerKind))errors.push('Неверный вид угловой фальши.');
  if(m.alu!==undefined&&(!aluProfile(m.alu.profile)||!aluColor(m.alu.profile,m.alu.color)||!aluInsert(m.alu.insert)))errors.push('Алюминиевый фасад: выберите профиль, цвет и вставку из каталога.');
  if(m.topGlass!==undefined&&!aluInsert(m.topGlass))errors.push('Стеклянная крыша: выберите стекло из каталога.');
  if(m.feet!==undefined&&(!Number.isFinite(m.feet.height)||m.feet.height<RULES.feetMin||m.feet.height>RULES.feetMax))errors.push(`Ножки: высота от ${RULES.feetMin} до ${RULES.feetMax} мм.`);
  if(m.bottomType!==undefined&&!['panel','none'].includes(m.bottomType))errors.push('Неверный тип дна.');
  if(m.topType!==undefined&&!['panel','none'].includes(m.topType))errors.push('Неверный тип крыши.');
  if(m.rails!==undefined){if(!Array.isArray(m.rails)||m.rails.length>4)errors.push('Стяжек не более четырёх.');else{const seen=new Set<string>();for(const r of m.rails){if(!r||!(r.place in RAIL_PLACES)||seen.has(r.place)||!Number.isFinite(r.height)||r.height<RULES.railMin||r.height>RULES.railMax)errors.push(`Стяжка: одно место, высота от ${RULES.railMin} до ${RULES.railMax} мм.`);seen.add(r?.place);}}}
  if(m.doorMount!==undefined&&!['overlay','inset'].includes(m.doorMount))errors.push('Неверный тип монтажа фасадов.');
  if(m.doorOpen!==undefined&&!['handle','push'].includes(m.doorOpen))errors.push('Неверный тип открывания фасадов.');
  if(m.topStrip!==undefined&&(!Number.isFinite(m.topStrip)||m.topStrip<RULES.topStripMin||m.topStrip>RULES.topStripMax))errors.push(`Планка под крышей: от ${RULES.topStripMin} до ${RULES.topStripMax} мм.`);
  if(m.sidePanels!==undefined)for(const side of ['left','right'] as const){const sp=m.sidePanels[side];if(sp===undefined)continue;if(!Number.isFinite(sp.height)||!Number.isFinite(sp.depth)||sp.height<m.height-1||sp.height>RULES.sidePanelMaxH||sp.depth<m.depth||sp.depth>RULES.sidePanelMaxD)errors.push(`Боковая фальшпанель: высота от высоты корпуса до ${RULES.sidePanelMaxH}, глубина от глубины корпуса до ${RULES.sidePanelMaxD} мм.`);}
  if(m.rodType!==undefined&&!['round','oval'].includes(m.rodType))errors.push('Неверный тип штанги.');
  if(m.feet&&m.bottomType==='none'&&!railsOf(m).some(r=>r.place.endsWith('bottom')))errors.push('Каркас без дна на ножках нужно связать нижней стяжкой.');
  if(m.slope!==undefined){if(!['left','right'].includes(m.slope.side)||!Number.isFinite(m.slope.lowHeight)||m.slope.lowHeight<RULES.slopeMinLow||m.slope.lowHeight>m.height-RULES.slopeMinDrop)errors.push(`Скос под потолок: высота низкой стороны от ${RULES.slopeMinLow} до ${m.height-RULES.slopeMinDrop} мм (корпус ${m.height}).`);if(m.topGlass)errors.push('Скос со стеклянной крышей не делаем.');if(m.topType==='none')errors.push('Скос без крыши не делаем.');if(m.alu)errors.push('Скос с алюминиевыми фасадами не делаем: рамки не режутся по косой.');}
  if(m.fastening!==undefined&&!['confirmat','eccentric'].includes(m.fastening))errors.push('Неверный тип крепежа.');
  if(m.desk!==undefined){
    if(!['both','left','right','none'].includes(m.desk.sides)||!Number.isFinite(m.desk.apron)||m.desk.apron<RULES.deskApronMin||m.desk.apron>RULES.deskApronMax)errors.push(`Стол: опоры слева/справа/обе/нет, царга от ${RULES.deskApronMin} до ${RULES.deskApronMax} мм.`);
    else{
      const g=deskGeometry(m),dk=m.desk;
      if(!Number.isFinite(g.x0)||!Number.isFinite(g.baseWidth)||g.x0<0||g.baseWidth<RULES.minW||g.x1>m.width+0.01)errors.push(`Подстолье: ширина от ${RULES.minW} мм и в пределах столешницы (${m.width}).`);
      if(!Number.isFinite(g.baseDepth)||g.baseDepth<RULES.minD||g.baseDepth>m.depth+0.01)errors.push(`Опоры стола: глубина от ${RULES.minD} до глубины столешницы (${m.depth}).`);
      if(!Number.isFinite(g.apronOffset)||g.apronOffset<0||g.apronOffset>g.baseDepth-RULES.panel-50)errors.push(`Царга: отступ от задней кромки от 0 до ${Math.max(0,g.baseDepth-RULES.panel-50)} мм.`);
      if(dk.grille!==undefined){const gr=dk.grille;if(![gr.x,gr.width,gr.depth].every(Number.isFinite)||gr.width<RULES.deskGrilleMinW||gr.depth<60||gr.x<30||gr.x+gr.width>m.width-30||RULES.deskGrilleRear+gr.depth>m.depth-30)errors.push(`Решётка: ширина от ${RULES.deskGrilleMinW}, глубина от 60, отступ 30 мм от кромок столешницы.`);}
    }
    if(m.doors||m.sections.some(s=>s.shelves.length||s.drawers>0||s.rod||s.pantograph)||m.sections.length>1)errors.push('Стол: наполнение и фасады не ставятся — это столешница на опорах.');
    if(m.slope||m.skew||m.alu||m.topGlass||m.feet||m.sidePanels||m.topStrip||m.standLight)errors.push('Стол: скосы, стекло, ножки, фальшпанели и подсветка не применяются.');
  }
  if(m.skew!==undefined){
    if(!['left','right'].includes(m.skew.side)||!Number.isFinite(m.skew.depth)||m.skew.depth<RULES.minD||m.skew.depth>m.depth-30)errors.push(`Скос фронта: глубина мелкой стороны от ${RULES.minD} мм и минимум на 30 меньше глубины корпуса.`);
    if(m.slope)errors.push('Скос фронта и скос под потолок вместе не делаем.');
    if(m.alu)errors.push('Скос фронта с алюминиевыми фасадами не делаем.');
    if(m.doors&&m.doorMount==='inset')errors.push('Скос фронта: фасады только накладные.');
    if(m.sections.some(s=>s.drawers>0))errors.push('Скос фронта с ящиками не делаем: короба не встают под углом.');
    if(m.topStrip)errors.push('Скос фронта: планка под крышей не предусмотрена.');
    if(m.cornerFiller||m.wallFiller)errors.push('Скос фронта: фальши к стене и в угол не ставим.');
  }
  for(const s of m.sections)if(s.fixed!==undefined&&(!Array.isArray(s.fixed)||s.fixed.some(j=>!Number.isInteger(j)||j<0||j>=s.shelves.length)))errors.push('Жёсткие полки: неверные номера.');
  if(m.wallFiller!==undefined){for(const side of ['left','right'] as const){const w=m.wallFiller[side];if(w===undefined)continue;if(w.kind!=='edge'||!Number.isFinite(w.width)||w.width<RULES.wallFillerMin||w.width>RULES.wallFillerMax)errors.push(`Фальшпанель к стене: планка торцом от ${RULES.wallFillerMin} до ${RULES.wallFillerMax} мм.`);}}
  if(m.plinthHeight!==undefined && ![0,80,100,120,150].includes(m.plinthHeight))errors.push("Выберите высоту цоколя из списка.");
  if(m.backType==="groove" && (![m.grooveInset??16,m.grooveDepth??8].every(Number.isFinite)||(m.grooveInset??16)<8||(m.grooveInset??16)>30||(m.grooveDepth??8)<4||(m.grooveDepth??8)>10))errors.push("Паз: отступ 8–30 мм, глубина 4–10 мм.");
  if (errors.length) return errors;
  if (m.sections.length < 1 || m.sections.length > RULES.maxSections)
    return [...errors, "Допустимо от 1 до 4 секций."];
  if (m.sections.some((s) => !Number.isFinite(s.weight) || s.weight <= 0))
    return [...errors, "Ширина секции должна быть положительной."];
  if (new Set(m.sections.map((s) => s.id)).size !== m.sections.length)
    errors.push("Идентификаторы секций повторяются.");
  boxes(m).forEach((b, i) => {
    const s = m.sections[i],
      h = b.top - b.bottom,
      prefix = `Секция ${i + 1}: `;
    if (b.width < RULES.minSection)
      errors.push(
        prefix +
          `нужно не менее ${RULES.minSection} мм внутри. Уберите перегородку или увеличьте ширину.`,
      );
    if (
      s.shelves.length > RULES.maxShelves ||
      !Number.isInteger(s.drawers) ||
      s.drawers < 0 ||
      s.drawers > RULES.maxDrawers
    )
      errors.push(prefix + "слишком много элементов.");
    if (
      s.drawerConfigs &&
      (!Array.isArray(s.drawerConfigs) || s.drawerConfigs.length > 5)
    )
      errors.push(prefix + "некорректные параметры ящиков.");
    for (let j = 0; j < s.drawers && j < 5; j++) {
      const c = drawerConfig(m, s, j),
        hw = SLIDES[c.slide];
      if (c.mesh !== undefined) {
        const item = meshById(c.mesh);
        if (!item) { errors.push(prefix + "неизвестный элемент Лемана Про."); continue; }
        if (!Number.isFinite(c.height) || c.height !== item.h) errors.push(prefix + `высота «${item.label}» фиксирована: ${item.h} мм.`);
        const inner = b.width - (m.doors ? RULES.drawerFiller * (doorCount(m, s) === 2 ? 2 : 1) : 0);
        if (inner < item.reqW || inner > item.reqW + MESH_WIDTH_TOLERANCE)
          errors.push(prefix + `«${item.label}» нужен проём ${item.reqW}–${item.reqW + MESH_WIDTH_TOLERANCE} мм внутри, сейчас ${Math.round(inner)}. Сделайте секцию ${Math.round(item.reqW + (b.width - inner) + 2 * RULES.panel)} мм по корпусу.`);
        const front = m.doors ? RULES.meshDoorClear : 0, depthAvailable = m.depth - rearClear(m) - front;
        if (depthAvailable < item.reqD) errors.push(prefix + `«${item.label}» нужна глубина корпуса от ${item.reqD + rearClear(m) + front} мм.`);
        continue;
      }
      if (
        !hw ||
        (c.handle!==undefined&&typeof c.handle!=='boolean') ||
        (c.handle===false&&c.slide==='ball') ||
        !Number.isFinite(c.height) ||
        c.height < 68 ||
        c.height > 300 ||
        !hw.lengths.some((l) => l === c.length)
      ) {
        errors.push(prefix + "неверный размер или тип направляющих.");
        continue;
      }
      if (c.length > m.depth - rearClear(m) - (m.doors ? 44 : 25))
        errors.push(prefix + "направляющая слишком длинная для этой глубины.");
      if (c.facadeH !== undefined && (!Number.isFinite(c.facadeH) || c.facadeH < 60 || c.facadeH > 800))
        errors.push(prefix + "высота фасада ящика: от 60 до 800 мм.");

    }
    const offsets=drawerOffsets(s);
    for(let j=0;j<offsets.length;j++){
      if(!Number.isFinite(offsets[j])||offsets[j]<0)errors.push(prefix+'неверное положение ящика.');
      for(let k=0;k<j;k++)if(offsets[j]<offsets[k]+drawerPitch(drawerConfig(m,s,k))&&offsets[k]<offsets[j]+drawerPitch(drawerConfig(m,s,j)))errors.push(prefix+'ящики пересекаются.');
    }
    if(s.pantograph && (b.width<545||b.width>910||h<1100))errors.push(prefix+'пантографу нужен проём шириной 545–910 мм и высотой от 1100 мм.');
    if(s.rod&&s.pantograph)errors.push(prefix+'выберите штангу или пантограф.');
    if(s.rodAt!==undefined&&(!Number.isFinite(s.rodAt)||s.rodAt<0.1||s.rodAt>0.97))errors.push(prefix+'измените высоту штанги.');
    if(s.pantograph!==undefined&&typeof s.pantograph!=='boolean')errors.push(prefix+'неверный тип пантографа.');
    const shelfY = s.shelves.map((f) => f * h).sort((a, b) => a - b);
    const drawerTop = drawerStackHeight(s);
    if (s.drawers && drawerTop + RULES.panel > h - RULES.shelfMinClear)
      errors.push(
        prefix +
          "ящики не помещаются по высоте. Уберите один ящик или увеличьте высоту.",
      );
    shelfY.forEach((y, j) => {
      if (
        !Number.isFinite(y) ||
        y < RULES.shelfMinClear + RULES.panel / 2 - .001 ||
        y > h - RULES.shelfMinClear - RULES.panel / 2 + .001 ||
        y < drawerTop + (s.drawers ? RULES.panel : 0) + RULES.shelfMinClear + RULES.panel / 2 - .001 ||
        (j > 0 && y - shelfY[j - 1] < RULES.shelfMinClear + RULES.panel - .001)
      )
        errors.push(
          prefix +
            "между поверхностями полок, дна и крыши нужно не менее 80 мм. Измените положение полок.",
        );
    });
    if (
      s.drawers > 0 &&
      (b.width - (m.doors ? RULES.drawerFiller : 0) < 250 || dTooSmall(m))
    )
      errors.push(
        prefix +
          "для ящиков нужно от 250 мм внутри и глубина корпуса от 300 мм.",
      );
    const rodY=s.rodAt===undefined?(shelfY[0]??h)-RULES.rodTopOffset:s.rodAt*h;
    const support=Math.max(drawerTop+(s.drawers?RULES.panel:0),0,...shelfY.filter(y=>y<rodY).map(y=>y+RULES.panel/2));
    if(s.rod&&shelfY.some(y=>Math.abs(y-rodY)<(RULES.panel+RULES.rodDiameter)/2))errors.push(prefix+'штанга пересекает полку. Измените высоту.');
    if (
      s.rod && rodY - support < RULES.rodMinClear
    )
      errors.push(
        prefix +
          "под штангой нужно 900 мм до полки, ящиков или дна. Измените высоту штанги или наполнение.",
      );
  });
  if (errors.length) return [...new Set(errors)];
  const geometry=parts(m);
  for(const section of m.sections.filter(s=>s.pantograph)){
    const b=boxes(m).find(b=>b.id===section.id)!;
    const mechanism=geometry.filter(p=>p.id.startsWith(section.id+':pantograph:'));
    if(mechanism.some(p=>p.position[1]-p.size[1]/2<b.bottom||p.position[1]+p.size[1]/2>b.top))errors.push('Пантограф выходит за внутреннюю высоту корпуса. Измените его положение.');
    const filling=geometry.filter(p=>p.sectionId===section.id&&(p.role==='shelf'||p.role==='drawer')&&p.material==='board');
    if(mechanism.some(a=>filling.some(b=>a.size.every((size,k)=>Math.abs(a.position[k]-b.position[k])<(size+b.size[k])/2-.1))))errors.push('Пантограф пересекает полку или ящик. Освободите место для механизма.');
  }
  for (const p of geometry) {
    if (p.material === "metal") continue;
    const sw = p.material === "hdf" ? RULES.hdfW : RULES.sheetW,
      sh = p.material === "hdf" ? RULES.hdfH : RULES.sheetH;
    if (
      !p.size.every((n) => Number.isFinite(n) && n > 0) ||
      p.length > sw - 2 * RULES.sheetMargin ||
      p.width > sh - 2 * RULES.sheetMargin
    )
      errors.push(
        `«${p.name}» не помещается в полезное поле листа или имеет неверный размер.`,
      );
    if (p.id === "slope-filler") continue; // фальш над фасадами — не створка: без ограничений ширины/высоты двери
    if (p.role === "door" && p.width > (p.length <= RULES.doorLowH ? RULES.doorMaxLow : RULES.doorMax))
      errors.push(
        `Фасад шире ${p.length <= RULES.doorLowH ? RULES.doorMaxLow : RULES.doorMax} мм при высоте ${Math.round(p.length)}. Разделите модуль на секции или уберите фасады.`,
      );
    if (p.role === "door" && p.length < RULES.doorMinH)
      errors.push(`Распашной фасад ниже ${RULES.doorMinH} мм. Увеличьте высоту корпуса или уберите фасады.`);
    if (p.role === "door" && p.material === "alu" && (p.length > ALU_EXTRAS.maxH || p.width > ALU_EXTRAS.maxW))
      errors.push(`Алюминиевый фасад ${Math.round(p.width)}×${Math.round(p.length)}: по СТП не выше ${ALU_EXTRAS.maxH} и не шире ${ALU_EXTRAS.maxW} мм. Разделите секцию или уменьшите высоту.`);
  }
  const hl=handleById(m.handleId).len;
  for(const p of geometry){
    if(p.role!=='handle')continue;
    const facade=p.id.includes(':drawer:')?geometry.find(f=>f.id===p.id.replace(':handle',':facade')):geometry.find(f=>f.id===p.id.replace(':handle:',':door:'));
    if(!facade)continue;
    const room=p.id.includes(':drawer:')?facade.size[0]:facade.size[1];
    if(hl+2*HANDLE_MARGIN>room)errors.push(`Ручка ${hl} мм длиннее фасада «${facade.name}». Выберите короче или измените фасад.`);
  }
  return [...new Set(errors)];
}
function dTooSmall(m: Module) {
  return m.depth < 300;
}
export function distribute(m: Module, s: Section, count: number): number[] {
  const h=m.height-plinth(m)-2*RULES.panel;
  let base=s.drawers?drawerStackHeight(s)+RULES.panel:0;
  if(s.rod)base=Math.max(base+RULES.rodMinClear+RULES.rodTopOffset,s.rodAt===undefined?0:s.rodAt*h+RULES.rodTopOffset-RULES.panel/2);
  const clear=(h-base-count*RULES.panel)/(count+1);
  return Array.from({length:count},(_,i)=>(base+clear*(i+1)+RULES.panel*i+RULES.panel/2)/h);
}
export function splitSection(m: Module, sid: string): Module {
  const next = structuredClone(m),
    i = next.sections.findIndex((s) => s.id === sid),
    s = next.sections[i];
  if (!s) return next;
  const bb=boxes(m),half=(bb[i].width-RULES.panel)/2;
  next.sections.forEach((a,j)=>a.weight=bb[j].width);
  next.sections.splice(
    i,
    1,
    { ...s, weight: half },
    { ...section(), weight: half },
  );
  return next;
}
/** Clear openings, measured between actual panel faces, bottom to top. */
export function shelfGaps(m: Module, sid: string) {
  const b = boxes(m).find((b) => b.id === sid)!;
  const s = m.sections.find((s) => s.id === sid)!;
  const centers = s.shelves
    .map((f) => b.bottom + f * (b.top - b.bottom))
    .sort((a, b) => a - b);
  return [...centers, b.top + RULES.panel / 2].map((y, i) => {
    const bottom = i === 0 ? b.bottom + (s.drawers ? drawerStackHeight(s)+RULES.panel : 0) : centers[i - 1] + RULES.panel / 2;
    const top = y - RULES.panel / 2;
    return { bottom, top, height: Math.round((top - bottom) * 10) / 10 };
  });
}
export function shelfInsertionHeight(m:Module,sid:string){
  const gaps=shelfGaps(m,sid).sort((a,b)=>b.height-a.height);
  return (gaps[0].bottom+gaps[0].top)/2;
}
export function setShelfGap(
  m: Module,
  sid: string,
  index: number,
  value: number,
) {
  const b = boxes(m).find((b) => b.id === sid)!,
    s = m.sections.find((s) => s.id === sid)!;
  s.shelves.sort((a, b) => a - b);
  const gaps = shelfGaps(m, sid);
  if (!s.shelves.length || !gaps[index]) return;
  const j = Math.min(index, s.shelves.length - 1);
  const center =
    index === s.shelves.length
      ? b.top - value - RULES.panel / 2
      : gaps[index].bottom + value + RULES.panel / 2;
  s.shelves[j] = (center - b.bottom) / (b.top - b.bottom);
}
export function parseModule(input: unknown): Module {
  if (!input || typeof input !== "object")
    throw new Error("Файл не содержит модуль.");
  const x = input as Record<string, unknown>;
  if (
    x.version !== 1 ||
    typeof x.name !== "string" ||
    x.name.length > 80 ||
    typeof x.decor !== "string" ||
    typeof x.facadeDecor !== "string" ||
    (x.drawerFacadeDecor!==undefined&&(typeof x.drawerFacadeDecor!=="string"||x.drawerFacadeDecor.length>150)) ||
    typeof x.doors !== "boolean" ||
    !Array.isArray(x.sections) ||
    x.sections.length > 4
  )
    throw new Error("Нужен файл модуля из 3D-редактора (.json).");
  for (const s of x.sections) {
    if (
      !s ||
      typeof s.id !== "string" ||
      typeof s.weight !== "number" ||
      !Array.isArray(s.shelves) ||
      s.shelves.length > 10 ||
      !s.shelves.every((v: unknown) => typeof v === "number") ||
      typeof s.drawers !== "number" ||
      typeof s.rod !== "boolean" ||
      (s.drawerConfigs !== undefined &&
        (!Array.isArray(s.drawerConfigs) || s.drawerConfigs.length > 5))
    )
      throw new Error("Некорректные данные секции.");
  }
  const m: Module = {
    version: 1,
    name: x.name,
    width: x.width as number,
    height: x.height as number,
    depth: x.depth as number,
    decor: x.decor,
    facadeDecor: x.facadeDecor,
    ...(x.casework===undefined?{}:{casework:structuredClone(x.casework) as Casework}),
    ...(x.drawerFacadeDecor===undefined?{}:{drawerFacadeDecor:x.drawerFacadeDecor}),
    doors: x.doors,
    ...(x.backType===undefined?{}:{backType:x.backType as Module["backType"]}),
    ...(x.grooveInset===undefined?{}:{grooveInset:x.grooveInset as number}),
    ...(x.grooveDepth===undefined?{}:{grooveDepth:x.grooveDepth as number}),
    ...(x.plinthHeight===undefined?{}:{plinthHeight:x.plinthHeight as number}),
    ...(x.hingeSide===undefined?{}:{hingeSide:x.hingeSide as Module["hingeSide"]}),
    ...(x.standLight===undefined?{}:{standLight:x.standLight as boolean}),
    ...(x.handleId===undefined?{}:{handleId:x.handleId as string}),
    ...(x.cornerFiller===undefined?{}:{cornerFiller:x.cornerFiller as Module["cornerFiller"]}),
    ...(x.cornerKind===undefined?{}:{cornerKind:x.cornerKind as Module["cornerKind"]}),
    ...(x.alu===undefined?{}:{alu:{profile:String((x.alu as AluFacade)?.profile),color:String((x.alu as AluFacade)?.color),insert:String((x.alu as AluFacade)?.insert)}}),
    ...(x.topGlass===undefined?{}:{topGlass:String(x.topGlass)}),
    ...(x.feet===undefined?{}:{feet:{height:Number((x.feet as {height:number})?.height)}}),
    ...(x.bottomType===undefined?{}:{bottomType:x.bottomType as Module['bottomType']}),
    ...(x.topType===undefined?{}:{topType:x.topType as Module['topType']}),
    ...(x.rails===undefined?{}:{rails:Array.isArray(x.rails)?(x.rails as {place:string;height:number}[]).map(r=>({place:r?.place as NonNullable<Module['rails']>[number]['place'],height:Number(r?.height)})):[]}),
    ...(x.doorMount===undefined?{}:{doorMount:x.doorMount as Module['doorMount']}),
    ...(x.doorOpen===undefined?{}:{doorOpen:x.doorOpen as Module['doorOpen']}),
    ...(x.topStrip===undefined?{}:{topStrip:Number(x.topStrip)}),
    ...(x.sidePanels===undefined?{}:{sidePanels:Object.fromEntries(Object.entries(x.sidePanels as Record<string,{height:number;depth:number}>).map(([k,v])=>[k,{height:Number(v?.height),depth:Number(v?.depth)}]))}),
    ...(x.rodType===undefined?{}:{rodType:x.rodType as Module['rodType']}),
    ...(x.slope===undefined?{}:{slope:{side:(x.slope as {side:'left'|'right'})?.side,lowHeight:Number((x.slope as {lowHeight:number})?.lowHeight)}}),
    ...(x.fastening===undefined?{}:{fastening:x.fastening as Module['fastening']}),
    ...(x.skew===undefined?{}:{skew:{side:(x.skew as {side:'left'|'right'})?.side,depth:Number((x.skew as {depth:number})?.depth)}}),
    ...(x.desk===undefined?{}:{desk:(()=>{const dk=x.desk as NonNullable<Module['desk']>;return {sides:dk.sides,apron:Number(dk.apron),
      ...(dk.apronOffset===undefined?{}:{apronOffset:Number(dk.apronOffset)}),...(dk.baseWidth===undefined?{}:{baseWidth:Number(dk.baseWidth)}),...(dk.baseX===undefined?{}:{baseX:Number(dk.baseX)}),...(dk.baseDepth===undefined?{}:{baseDepth:Number(dk.baseDepth)}),
      ...(dk.grille===undefined?{}:{grille:{x:Number(dk.grille.x),width:Number(dk.grille.width),depth:Number(dk.grille.depth)}})};})()}),
    ...(x.wallFiller===undefined?{}:{wallFiller:Object.fromEntries(Object.entries(x.wallFiller as Record<string,{kind?:string;width?:number}>).map(([k,v])=>[k,{kind:'edge' as const,width:v?.kind==='standard'||v?.width===undefined?RULES.fillerStrip:v.width}]))}),
    sections: x.sections.map((s) => ({
      id: s.id,
      weight: s.weight,
      shelves: [...s.shelves],
      drawers: s.drawers,
      rod: s.rod,
      ...(s.pantograph===undefined?{}:{pantograph:s.pantograph}),
      ...(s.rodAt===undefined?{}:{rodAt:s.rodAt}),
      ...(s.fixed===undefined?{}:{fixed:Array.isArray(s.fixed)?[...s.fixed]:s.fixed}),
      ...(s.drawerConfigs === undefined
        ? {}
        : {
            drawerConfigs: s.drawerConfigs.map((c: DrawerConfig) => ({
              slide: c?.slide,
              height: c?.height,
              length: c?.length,
              ...(c?.handle===undefined?{}:{handle:c.handle}),
                  ...(c?.y===undefined?{}:{y:c.y}),
                  ...(c?.mesh===undefined?{}:{mesh:c.mesh}),
                  ...(c?.noFacade===undefined?{}:{noFacade:c.noFacade}),
                  ...(c?.facadeH===undefined?{}:{facadeH:c.facadeH}),
            })),
          }),
    })),
  };
  const errors = validate(m);
  if (errors.length) throw new Error(errors[0]);
  return m;
}

