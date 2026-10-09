import { kupeParts, kupeErrors, type KupeSpec } from "./kupe";
import { rawParts, rawErrors, parseRaw, type RawSpec } from "./rawModule";
import { kitchenDrawerParts, kitchenDrawerErrors, parseKDrawers, type KDrawer } from "./kitchenDrawers";
import { kitchenLiftParts, kitchenLiftErrors, parseKitchenLift, type KitchenLift } from "./kitchenLift";
import { kitchenExtraParts, kitchenErrors, worktopParts, kitchenEdges, KITCHEN, type KitchenSpec, type WorktopSpec } from "./kitchen";
import { partPenetration, allowedContact } from "./collisions";
import { qmul, qrot, type Quat } from "./quat";
import { partAxes as partAxesOf } from "./edges";
import { drawerHasHandle, SLIDES, hingePositions, hingeShifts, slideMotion, slideBrand, HINGE_BRANDS, SLIDE_BRANDS, type DrawerConfig, type HingeBrand } from "./hardware";
export type EdgeThickness = 2 | 1 | 0.8;
export const EDGE_CHOICES: { value: EdgeThickness; label: string }[] = [{ value: 2, label: "2 мм · стандарт, прочная" }, { value: 1, label: "1 мм" }, { value: 0.8, label: "0,8 мм · тонкая, дешевле" }];
import {caseworkParts,caseworkErrors,type Casework} from './casework';
import {cornerParts,cornerErrors,cornerBoxes,cornerDrawer,normalizeCorner,type CornerSpec} from './cornerWardrobe';
import {resolveLayout,splitOpening,type SectionLayout} from './sectionLayout';
import { handleById, handleKind, HANDLES, HANDLE_MARGIN } from "./handles";
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
  drawerMount?: 'inset';
  glassShelves?: number[];
  rodClearance?: number;
  id: string;
  weight: number;
  doorLeaves?: 1 | 2;
  doorHandles?: (string | null)[];
  doorHinges?: ("left"|"right"|"top"|null)[];
  /** Высоты петель от низа фасада, мм (как в проекте Базиса); без поля — по правилу (100 мм от краёв). */
  hingeY?: number[];
  /** Высота фасада, при которой записаны hingeY (при другой высоте высоты пересчитываются). */
  hingeYFor?: number;
  /** Кухня (пенал с doorSplit): высоты петель верхнего ряда фасадов от низа фасада; без поля верхний ряд берёт hingeY. */
  hingeYUp?: number[];
  /** Высота верхнего фасада, при которой записаны hingeYUp. */
  hingeYUpFor?: number;
  hingeSide?: "left" | "right";
  removedDoors?: number[];
  doorGap?: number;
  /** Высота нижнего ряда фасадов от низа дверного проёма. */
  doorSplit?: number;
  /** Наружные ящики снизу, распашные двери только над обязательной полкой. */
  externalDrawers?: boolean;
  drawerGap?: number;
  shelves: number[];
  drawers: number;
  rod: boolean;
  drawerConfigs?: DrawerConfig[];
  pantograph?: boolean;
  /** Выдвижные тремпели (GTV, крепление к полке/крыше, выдвигаются вперёд): количество в ряд по ширине секции, 1–3. */
  pullouts?: number;
  rodAt?: number;
  /** Индексы жёстких полок (на конфирматах/эксцентриках, в точную ширину проёма); остальные съёмные на полкодержателях. */
  fixed?: number[];
  /** Глубина обычных полок секции, мм. Полка над ящиками сохраняет конструктивную глубину. */
  shelfDepth?: number;
};
export type Module = {
  sectionLayout?: SectionLayout;
  raisedSides?: boolean;
  /** Open corner junction checked by actual part volumes, without door fillers. */
  openJunction?: boolean;
  casework?: Casework;
  corner?: CornerSpec;
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
  /** Отдельная ручка ящиков. Отсутствие сохраняет прежнюю общую настройку. */
  drawerHandleId?: string;
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
  /** Стяжки — планки между боковинами сзади или спереди, снизу или сверху (высота 60–300). По умолчанию стоят на ребре (вертикально);
   *  lay 'flat' — лёжа, как царги кухонных низов Базиса (ширина height в глубину, заподлицо с верхом); setback — утопание от фронта (под Gola). */
  rails?: { place: "rear-bottom" | "rear-top" | "front-bottom" | "front-top"; height: number; lay?: "edge" | "flat"; setback?: number; at?: number }[];
  /** Дно под боковинами на всю ширину (кухонные низы и пеналы Базиса: боковины стоят на дне). По умолчанию дно между боковинами. */
  bottomUnder?: boolean;
  /** Отступ фасадов от кромок корпуса и зазор между фасадами, мм (по умолчанию RULES.faceGap; кухни Базиса цеха — 1,5 и 3). */
  faceGap?: number;
  faceGapBetween?: number;
  /** Накладной задник: отступ от наружных граней корпуса, мм (по умолчанию 2; кухни Базиса — 1,5 → ХДФ (W−3)×(H−3)). */
  backGap?: number;
  /** Паз под задник: ширина паза (задник у передней стенки паза; по умолчанию — задник на grooveInset) и недоход ХДФ до дна паза
   *  (по умолчанию 0,5; кухни Базиса П16-4×8 — ширина 4, недоход 1 → ХДФ (W−18)×(H−18)). */
  grooveWidth?: number;
  grooveClear?: number;
  /** Толщина фасадов (ЛДСП 16 по умолчанию; МДФ 18–19, стекло в рамке 4) и «воздух» между корпусом и накладным фасадом (шкафы 2; кухни Базиса 0). */
  facadeT?: number;
  faceAir?: number;
  /** Полка: отступ от задника (Базис — 1 мм) и полкодержатели от кромок полки (шкафы 40; Базис кухни — 60). */
  shelfRear?: number;
  shelfPinInset?: number;
  /** Кухня Базиса: отступ передних полкодержателей от переднего торца полки, если не равен заднему (61 из 244 полок Базиса). */
  shelfPinInsetFront?: number;
  /** Конфирматы дна/крыши/жёстких полок — от концов стыка, мм (по умолчанию RULES.confirmatInset 50; проекты Базиса — 50…64). */
  confirmatInset?: number;
  /** Ручки не заложены (Gola, ручки заказчика, без ручек) — как в кухнях Базиса без ручек в спецификации. */
  noHandles?: boolean;
  /** Толщина стеклянных полок (по умолчанию 6; кухни Базиса — 4, полкодержатели MV05). */
  glassT?: number;
  /** Зазор стеклянной полки до стойки с каждой стороны (по умолчанию как у ЛДСП — 1; Базис — 1,5). */
  glassGap?: number;
  /** Сырой модуль — детали проекта Базиса как есть (rawModule.ts): импорт кухонь/шкафов, которые параметрика пока не повторяет. */
  raw?: RawSpec;
  /** Ящики кухни по Базису (Axis PRO): фасад, высота направляющей, царга, длина — kitchenDrawers.ts. */
  kdrawers?: KDrawer[];
  /** Gola (профиль-ручка) по Базису: вырезы в переднем торце боковин нижнего модуля. top0/top1 — расстояние от верха боковины
   *  до верхнего/нижнего края выреза (мм), depth — глубина от переднего торца, r — радиус скругления внутренних углов.
   *  Вырез с top0 = 0 открыт сверху (верхний профиль L), остальные — средние (профиль C). Только для кухонь (m.kitchen). */
  gola?: { cuts: GolaCut[]; /** Верх фасадов ниже верха корпуса на столько мм (Базис: 28–33 под верхний профиль L). */ faceTop?: number };
  /** Газлифт подъёмного фасада кухни по Базису (PD-G-N02, комплект на каждую боковину) — kitchenLift.ts. */
  kitchenLift?: KitchenLift;
  /** Материал фасадов: ЛДСП (по умолчанию, в раскрое) или фасадный материал стороннего участка (МДФ/плёнка/эмаль — без раскроя и кромки). */
  facadeMaterial?: "ldsp" | "external";
  /** Кромка фасадов из фасадного материала, мм (Базис: «Кромка фасадная 1х22»); нет — без кромки. */
  facadeEdge?: number;
  /** Схема кромки кухни по Базису: открытые торцы — кромка t мм (1 или 0,5), скрытые — без кромки (kitchen.ts kitchenEdges). */
  /** Кромка кухни: толщина; railBack:false — задняя царга заподлицо с задником без кромки по заднему торцу (18 из 80 нижних в базе). */
  edgeScheme?: { t: number; railBack?: false; /** кухня Базиса: все детали корпуса кромятся по кругу (k11, k32 — 36 из 422 модулей) */ all?: true; /** нижний: верхний торец боковин без кромки (k03, k20 — 16 из 290 боковин) */ sideTop?: false; /** передние торцы корпуса толще остальных (k29, k27 — 8 из 383 модулей: 2 или 1 при 0,5) */ front?: number; /** съёмные полки кромятся не по кругу, а по этим торцам (18 из 219 полок Базиса — только перед) */ shelf?: string[] };
  /** Пазы в панелях, кроме паза под задник (кухни Базиса: паз под LED-подсветку 17×8 в боковинах/дне/крыше): коробка паза в осях модуля.
   *  В 3D — тёмная полоса, в смете — подсветка врезная за погонный метр, на бирке — паз. */
  grooves?: Groove[];
  /** Крепёж по стыкам «горизонталь:сторона» (bottom:left, top:right…): конфирмат или эксцентрик (кухни Базиса: эксцентрики на открытой
   *  стороне, чтобы не было видно головок). Без записи — общий m.fastening. */
  jointFastening?: Record<string, "confirmat" | "eccentric">;
  /** Шканты 8×30 рядом с эксцентриками (Базис «Стяжка эксц. + шкант»): сдвиг внутрь от эксцентрика, мм (обычно 32). */
  dowels?: { offset: number };
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
  /** Двери-купе (kupe.ts): объект-проём с направляющими и полотнами, глубина 100. Перед корпусами или в нише. */
  kupe?: KupeSpec;
  /** Кухонный корпус (kitchen.ts): нижний на ножках с цокольной планкой, навесной на навесах, пенал; техника в нише. */
  kitchen?: KitchenSpec;
  /** Столешница (kitchen.ts): отдельный объект над нижними корпусами, цена за погонный метр. */
  worktop?: WorktopSpec;
  /** Бренд петель распашных фасадов (hardware.ts HINGE_BRANDS). По умолчанию GTV. */
  hingeBrand?: HingeBrand;
  /** Кромка видимых торцов корпуса и кромка фасадов, мм. По умолчанию 2; скрытые торцы всегда 0,4. */
  edgeBody?: EdgeThickness;
  edgeFacade?: EdgeThickness;
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
/** Паз в панели-носителе (не под задник): привязан к детали и идёт за ней при изменении размеров модуля.
 *  face — сторона толщины детали (+/−), along — отступы от концов по длине детали, across — от минимальной грани по ширине (от/до), depth — глубина. */
export type Groove = { host: string; face: "+" | "-"; along: [number, number]; across: [number, number]; depth: number; name: string };
export const RAIL_PLACES: Record<NonNullable<Module["rails"]>[number]["place"], string> = { "rear-bottom": "сзади снизу", "rear-top": "сзади сверху", "front-bottom": "спереди снизу", "front-top": "спереди сверху" };
export type WallFiller = { kind: "edge"; width: number };
export type GolaCut = { top0: number; top1: number; depth: number; r: number; /** Кромка и по контуру самого выреза (стенка, дуга, дно) — как в части кухонь Базиса. */ edged?: boolean };
export type Part = {
  /** Вырезы Gola в боковине (координаты детали: от её верха вниз по Y, глубина — от переднего торца +Z); раскрой — по габариту. */
  golaCuts?: GolaCut[];
  /** Длина кромки по направлению торца ('+z' и т. п.), если контур фигурный (вырезы): смета, бирки и сверщик берут её вместо стороны. */
  edgeLen?: Record<string, number>;
  /** Horizontal polygon in local X/Z coordinates, relative to its bounding box. */
  planContour?: [number,number][];
  /** Edge thickness for each successive polygon segment. */
  contourEdges?: number[];
  /** Изделие стороннего участка (двери-купе): не идёт в раскрой ЛДСП, деталировку и бирки. */
  external?: boolean;
  /** Готовый вид материала в 3D (цвет, прозрачность, металл) — для наполнений купе и профиля. */
  look?: { color: number; opacity?: number; metalness?: number; roughness?: number };
  /** Модель профиля из Blender (public/models/<file>): вписывается в габарит детали, length — ось длины. */
  model?: { file: string; length: "x" | "y"; mirror?: boolean;
    /** Модель фурнитуры из Базиса (TriData → GLB, мм, локальные оси фурнитуры): ставится как есть — начало координат модели
     *  в точку origin (координаты модуля), поворот quat [w,x,y,z]; без вписывания в габарит детали. */
    native?: boolean; origin?: [number, number, number]; quat?: [number, number, number, number] };
  /** Сдвиг по X при «открытых фасадах» — полотно купе отъезжает за соседнее. */
  openShift?: number;
  /** Explicitly schematic handle; use the declared box instead of a catalogue asset. */
  simpleHandle?: boolean;
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
  hinge?: "left" | "right" | "top";
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
  /** Точные коробки фурнитуры для проверки пересечений (координаты модуля) — вместо габарита модели: у петли чашка в теле фасада
   *  и плечо с планкой у стойки, а не общий параллелепипед, задевающий торец стойки. См. collisions.ts. */
  collide?: { size: [number, number, number]; position: [number, number, number] }[];
  /** Опорная точка фурнитуры как в Базисе (эксцентрик — грань стойки × внутренняя пласть горизонтали), для сверки и присадки. */
  anchor?: [number, number, number];
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
  if(m.corner)return cornerDrawer(m,s,j);
  return (
    s.drawerConfigs?.[j] || {
      slide: "ball",
      height: RULES.drawerH,
      length:
        [...SLIDES.ball.lengths].reverse().find((l) => l <= m.depth - rearClear(m) - (drawersBehindDoors(m,s) ? 44 : 25)) ||
        250,
    }
  );
}
/** Resolve a handle against its own facade; legacy module defaults stay compatible. */
export function facadeHandleId(m:Module,pid:string):string|undefined {
 const sid=pid.split(':')[0],s=m.sections.find(s=>s.id===sid);
 if(pid.includes(':drawer:')){const j=Number(pid.split(':drawer:')[1].split(':')[0]);return s?drawerConfig(m,s,j).handleId??m.drawerHandleId??m.handleId:m.drawerHandleId??m.handleId;}
 const leaf=Number(pid.split(/:door:|:handle:/)[1]);return s?.doorHandles?.[leaf]??m.handleId;
}
export function setFacadeHandle(m:Module,pid:string,handleId:string){
 if(!parts(m).some(p=>p.id===pid&&(p.role==='door'||p.id.endsWith(':facade'))))throw Error('Выбранный фасад больше не существует.');
 const s=m.sections.find(s=>s.id===pid.split(':')[0]);if(!s)throw Error('Секция фасада не найдена.');
 if(pid.includes(':drawer:')){const j=Number(pid.split(':drawer:')[1].split(':')[0]);s.drawerConfigs=Array.from({length:s.drawers},(_,k)=>({...drawerConfig(m,s,k)}));s.drawerConfigs[j].handleId=handleId;}
 else{const k=Number(pid.split(':door:')[1]);s.doorHandles=Array.from({length:4},(_,i)=>s.doorHandles?.[i]??null);s.doorHandles[k]=handleId;}
}
export function plinth(m:Module){return m.feet?0:(m.plinthHeight ?? RULES.plinth);}
/** Отступ фасадов от кромок корпуса (шкафы — RULES.faceGap 2; кухни Базиса цеха — 1,5). */
export function fe(m:Module){return m.faceGap??RULES.faceGap;}
/** Зазор между фасадами (шкафы — 2; кухни Базиса — 3). */
export function fb(m:Module){return m.faceGapBetween??RULES.faceGap;}
/** Уровень низа корпуса над полом: цоколь или высота ножек. */
export function baseLevel(m:Module){return m.feet?m.feet.height:plinth(m);}
export function hasBottom(m:Module){return m.bottomType!=='none';}
export function hasTop(m:Module){return m.topType!=='none';}
/** Полки финальных заказов бывают на всю глубину. Вкладная дверь требует места перед полкой. */
export function shelfMaxDepth(m:Module){return m.depth-rearClear(m)-(m.doors&&m.doorMount==='inset'?RULES.panel+fe(m):0);}
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
/** Фальшпанель к стене нужна, когда у стены распашной фасад или накладной ящик. Вкладной ящик открытого корпуса (за купе) внутри проёма — о стену не бьёт. */
export function needsWallFiller(m:Module){return !m.desk&&(m.doors||m.sections.some(s=>s.drawers>0&&s.drawerMount!=='inset'));}
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
    // Кухни Базиса: отступ фасада от низа дна такой же, как от остальных кромок (m.faceGap, 1,5); шкафы — вровень с низом дна.
    return (hasBottom(m)?m.feet.height:m.feet.height+rail)+(m.kitchen?.faceBottom??m.faceGap??0); // кухня Базиса: свой зазор снизу (kitchen.faceBottom)
  }
  return plinth(m)>0?Math.min(RULES.facadeFloorGap,plinth(m)):fe(m);
}
/** Верх накладного фасада: под крышей минус зазор, ниже планки под крышей, если она есть. */
/** Верх накладных фасадов: под скосом — по низкой стороне (крыша плоская на её высоте), выше идёт фальш из фасадного материала. */
export function facadeTop(m:Module){if(m.kitchen&&m.gola?.faceTop!==undefined)return m.height-m.gola.faceTop;if(m.kitchen?.faceTop!==undefined&&m.feet)return m.height-m.kitchen.faceTop;return (m.slope?m.slope.lowHeight:m.height)-fe(m)-(m.topStrip?m.topStrip+fe(m):0);}
/** Горизонтальный размах накладных фасадов секции i: крайние секции до края корпуса минус зазор, между секциями — до середины перегородки. */
export function facadeSpan(m:Module,i:number,b:SectionBox){
  const t=RULES.panel;
  let left=i===0?fe(m):b.x-t/2+fb(m)/2;
  let right=i===m.sections.length-1?m.width-fe(m):b.x+b.width+t/2-fb(m)/2;
  // Угловая фальш-планка из фасада занимает край проёма: фасады крайней секции сдвигаются на планку + зазор 3.
  if(cornerStrip(m)&&m.cornerFiller==='left'&&i===0)left+=RULES.fillerStrip+RULES.fillerGap;
  if(cornerStrip(m)&&m.cornerFiller==='right'&&i===m.sections.length-1)right-=RULES.fillerStrip+RULES.fillerGap;
  return {left,right};
}
export function rearClear(m:Module){return m.backType==='board'?RULES.panel+1:m.backType==='groove'?(m.grooveInset??16)+RULES.back+1:0;}
/** Шаг ящика по высоте: короб + просвет 40, но не меньше фасада с зазором. */
export function drawerPitch(c:{height?:number;facadeH?:number;tray?:boolean},gap:number=RULES.drawerFrontGap){const box=(c.height??RULES.drawerH)+(c.tray?10:RULES.drawerStep);return c.facadeH?Math.max(box,c.facadeH+gap):box;}
export function drawerOffsets(s:Section){let y=0;return Array.from({length:Math.max(0,Math.min(5,s.drawers))},(_,j)=>{const start=s.drawerConfigs?.[j]?.y??y;y=start+drawerPitch(s.drawerConfigs?.[j]??{},s.drawerGap);return start;});}
/** Предельная ширина распашного фасада: 640 при высоте фасада до 920, иначе 600 (Перечень для производства). */
export function doorMaxWidth(m:Module){const h=m.height-fe(m)-facadeBottom(m);return h<=RULES.doorLowH?RULES.doorMaxLow:RULES.doorMax;}
export function doorCount(m:Module,s:Section){if(s.doorLeaves)return s.doorLeaves;const b=boxes(m).find(b=>b.id===s.id)!;return b.width+RULES.panel>doorMaxWidth(m)?2:1;}
export function drawersBehindDoors(m:Module,s:Section){return m.doors&&!s.externalDrawers;}
export function fillerSides(m:Module,s:Section){
 if(!drawersBehindDoors(m,s)||!s.drawers)return {left:0,right:0};
 const count=doorCount(m,s),hinges=Array.from({length:s.doorSplit===undefined?1:2},(_,row)=>Array.from({length:count},(_,col)=>s.doorHinges?.[row*2+col]??(count===2?(col===0?'left':'right'):(s.hingeSide??m.hingeSide??'left')))).flat();
 return {left:hinges.includes('left')?RULES.drawerFiller:0,right:hinges.includes('right')?RULES.drawerFiller:0};
}
/** Длина выдвижного тремпеля: самый длинный из ряда GTV 250–500, который помещается в глубину секции с зазором 20 спереди и сзади. */
export function pulloutLength(m:Module){const free=shelfMaxDepth(m)-40;return [500,450,400,350,300,250].find(l=>l<=free)??0;}
export function drawerStackHeight(s: Section) {
  const yy=drawerOffsets(s);return Math.max(0,...yy.map((y,j)=>y+drawerPitch(s.drawerConfigs?.[j]??{},s.drawerGap)));
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
  if(m.corner)return cornerBoxes(m);
  if(m.sectionLayout)return resolveLayout(m).boxes;
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
  if(m.kupe)return kupeParts(m);
  if(m.raw)return rawParts(m);
  if(m.worktop)return worktopParts(m);
  if(m.corner)return cornerParts(m);
  if(m.casework)return caseworkParts(m);
  const out: Part[] = [];
  const t = RULES.panel;
  const d = m.depth;
  const bottom = baseLevel(m), floorY = m.feet ? m.feet.height : m.raisedSides?bottom:0;
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
  // Дно под боковинами (кухни Базиса): боковины стоят на дне, дно на всю ширину.
  const under = !!m.bottomUnder && hasBottom(m), sideY0 = under ? bottom + t : floorY;
  // кухня Базиса: одна боковина опущена (до низа дна или до пола), дно — под другой (kitchen.sideDown)
  const sd = under && m.kitchen?.sideDown ? m.kitchen.sideDown : undefined;
  const yL = sd?.side === "left" ? sd.y0 : sideY0, yR = sd?.side === "right" ? sd.y0 : sideY0;
  add("left", "Боковина левая", [t, lT - yL, dL], [t / 2, (lT + yL) / 2, dL / 2], lT - yL, dL, t);
  add("right", "Боковина правая", [t, rT - yR, dR], [m.width - t / 2, (rT + yR) / 2, dR / 2], rT - yR, dR, t);
  const bx0 = sd?.side === "left" ? t : 0, bx1 = sd?.side === "right" ? m.width - t : m.width;
  if (under) add("bottom", sd ? `Дно · под ${sd.side === "left" ? "правой" : "левой"} боковиной` : "Дно · под боковинами", [bx1 - bx0, t, d], [(bx0 + bx1) / 2, bottom + t / 2, d / 2], bx1 - bx0, d, t);
  else if (hasBottom(m)) { add("bottom", "Дно" + sk, [m.width - 2 * t, t, d], [m.width / 2, bottom + t / 2, d / 2], m.width - 2 * t, d, t); planTaper(out.at(-1)!, t, m.width - t, 0, 0); }
  if (hasTop(m) && m.slope) {
    // Плоская крыша на высоте низкой стороны, между боковинами.
    add("top", "Крыша", [m.width - 2 * t, t, d], [m.width / 2, m.slope.lowHeight - t / 2, d / 2], m.width - 2 * t, d, t);
    if (m.doors && m.doorMount !== "inset") {
      // Фальш над фасадами: трапеция из фасадного материала, низ — над фасадами с зазором 2, верх — по линии потолка минус зазор.
      const bx = boxes(m), l = facadeSpan(m, 0, bx[0]).left, r = facadeSpan(m, bx.length - 1, bx.at(-1)!).right;
      const y0 = m.slope.lowHeight, hL = Math.max(1, slopeAt(m, l) - fe(m) - y0), hR = Math.max(1, slopeAt(m, r) - fe(m) - y0), hh = Math.max(hL, hR);
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
  if (m.feet && !m.kitchen) for (const [side, x] of [["left", t / 2], ["right", m.width - t / 2]] as const) for (const [k, z] of [[0, 60], [1, d - 60]] as const)
    add(`leg:${side}:${k}`, "Ножка", [40, m.feet.height, 40], [x, m.feet.height / 2, z], m.feet.height, 40, 40, "fastener", undefined, "metal");
  // Стяжки — планки между боковинами: сзади/спереди, снизу/сверху.
  for (const r of railsOf(m)) {
    const front = r.place.startsWith("front"), low = r.place.endsWith("bottom");
    if (r.lay === "flat") {
      // Царга лёжа (кухни Базиса): ширина r.height в глубину, заподлицо с верхом боковин (или на дне); передняя — с утопанием setback.
      const yc = low ? (hasBottom(m) ? bottom + t : bottom) + t / 2 : innerTop(m) - t / 2, sb = r.setback ?? 0;
      add("rail:" + r.place, "Царга " + RAIL_PLACES[r.place] + " " + r.height + " лёжа", [m.width - 2 * t, t, r.height], [m.width / 2, yc, front ? d - sb - r.height / 2 : sb + r.height / 2], m.width - 2 * t, r.height, t);
      continue;
    }
    // at — низ стяжки на ребре от пола модуля (мойка Базиса: задняя стяжка посередине высоты, под трубы)
    const y0 = r.at ?? (low ? (hasBottom(m) ? bottom + t : bottom) : innerTop(m) - r.height);
    // кухня Базиса: стяжка на ребре бывает утоплена на 1–2 мм от кромки боковин (задняя — от задней, передняя — от передней)
    const sbE = m.kitchen ? r.setback ?? 0 : 0;
    add("rail:" + r.place, r.at !== undefined ? `Стяжка ${r.place.startsWith("front") ? "спереди" : "сзади"} ${r.height} на высоте ${Math.round(r.at)}` : "Стяжка " + RAIL_PLACES[r.place] + " " + r.height, [m.width - 2 * t, r.height, t], [m.width / 2, y0 + r.height / 2, front ? d - sbE - t / 2 : sbE + t / 2], m.width - 2 * t, r.height, t);
  }
  // Планка под крышей спереди (фальшпанель над фасадами) — в плоскости фасадов.
  if (m.topStrip) {
    const inset = m.doorMount === "inset";
    const y1 = inset ? innerTop(m) : m.height - fe(m), sw = inset ? m.width - 2 * t - 2 * fe(m) : m.width - 2 * fe(m);
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
    const w = RULES.fillerStrip, y0 = facadeBottom(m), y1 = m.height - fe(m);
    add("corner-filler:" + m.cornerFiller, "Фальш-планка угловая из фасада " + (m.cornerFiller === "left" ? "левая" : "правая"), [w, y1 - y0, t], [m.cornerFiller === "left" ? fe(m) + w / 2 : m.width - fe(m) - w / 2, (y0 + y1) / 2, d + t / 2 + 2], y1 - y0, w, t);
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
  const groove=m.backType==='groove',gd=m.grooveDepth??8,gc=m.grooveClear??0.5,bg=m.backGap??2;
  // Накладной задник: от низа корпуса (у корпуса на ножках — от дна, а не от пола) до верха, с отступом bg от наружных граней.
  const backFrom=m.feet?floorY:m.raisedSides?bottom:0;
  const backW=groove?m.width-2*t+2*gd-2*gc:m.width-2*bg;
  // кухня Базиса: накладной ХДФ со своими зазорами снизу и сверху (kitchen.backGaps), по бокам — backGap
  const kb=!groove&&!m.slope&&!m.raisedSides?m.kitchen?.backGaps:undefined;
  const backH=groove?m.height-bottom-2*t+2*gd-2*gc:kb?m.height-backFrom-kb.bottom-kb.top:m.height-backFrom-2*bg;
  const backZ0=groove?(m.grooveInset??16)+(m.grooveWidth!==undefined?m.grooveWidth-RULES.back:0):-RULES.back;
  const backTopL = m.slope ? slopeAt(m, 2) - 2 : m.height, backTopR = m.slope ? slopeAt(m, m.width - 2) - 2 : m.height;
  if(m.backType==='board'){const bh=innerTop(m)-bottom-t;add('back','Задняя стенка · ЛДСП вкладная',[m.width-2*t,bh,t],[m.width/2,bottom+t+bh/2,t/2],bh,m.width-2*t,t,'body');out.at(-1)!.edge=[0.4,0.4,0.4,0.4];}
  else if(m.backType!=='none'){
    if(m.slope&&!groove){const maxH=Math.max(backTopL,backTopR)-2;add('back','Задняя стенка · набивная · скос',[backW,maxH,RULES.back],[m.width/2,2+maxH/2,-RULES.back/2],maxH,backW,RULES.back,'body',undefined,'hdf');out.at(-1)!.taper=[backTopL-2,backTopR-2];}
    else add('back',groove?'Задняя стенка · в паз':'Задняя стенка · набивная',[backW,backH,RULES.back],[m.width/2,groove||m.raisedSides?(bottom+m.height)/2:kb?(backFrom+kb.bottom+m.height-kb.top)/2:(backFrom+m.height)/2,backZ0+RULES.back/2],backH,backW,RULES.back,'body',undefined,'hdf');
  }
  if(m.sectionLayout)for(const panel of resolveLayout(m).panels){
    const depth=d-rear-RULES.shelfDepthMinus;
    add('layout:'+panel.id,panel.axis==='x'?'Перегородка ограниченной высоты':'Общая разделительная полка',[panel.width,panel.height,depth],[panel.x+panel.width/2,panel.bottom+panel.height/2,rear+depth/2],panel.axis==='x'?panel.height:panel.width,depth,t,'body');
    out.at(-1)!.grainAxis=panel.axis==='x'?1:0;
  }
  boxes(m).forEach((b, i) => {
    const s = m.sections[i],
      h = b.top - b.bottom,
      sd = d - rear - RULES.shelfDepthMinus;
    if (i > 0 && !m.sectionLayout) {
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
      const shelfDepth=s.shelfDepth??sd;
      const glass=s.glassShelves?.includes(j),st=glass?(m.glassT??6):t;
      add(
        `${s.id}:shelf:${j}`,
        (glass?"Стеклянная полка "+(m.glassT??6)+" мм · обработку уточнить":s.fixed?.includes(j) ? "Полка жёсткая" : "Полка съёмная") + sk,
        [b.width - (s.fixed?.includes(j) ? 0 : 2 * (glass ? m.glassGap ?? RULES.shelfGap : RULES.shelfGap)), st, shelfDepth],
        [b.x + b.width / 2, b.bottom + f * h, rear + (m.shelfRear ?? 0) + shelfDepth / 2],
        b.width - (s.fixed?.includes(j) ? 0 : 2 * (glass ? m.glassGap ?? RULES.shelfGap : RULES.shelfGap)),
        shelfDepth,
        st,
        "shelf",
        s.id,
        glass?'glass':'board',
      );
      if(s.shelfDepth===undefined)planTaper(out.at(-1)!, b.x, b.x + b.width, rear, RULES.shelfDepthMinus);
    });
    const f=fillerSides(m,s),filler=f.left+f.right;
    for(const side of ['left','right'] as const)if(f[side]) add(s.id+':filler:'+side,'Фальш-панель '+(side==='left'?'левая':'правая'),[t,drawerStackHeight(s),sd],[side==='left'?b.x+t/2:b.x+b.width-t/2,b.bottom+drawerStackHeight(s)/2,rear+sd/2],drawerStackHeight(s),sd,t,'body',s.id);
    if(s.drawers>0&&!(m.sectionLayout&&b.top<innerTop(m))&&!s.drawerConfigs?.every(c=>c.tray)){add(s.id+':drawer-cap','Обязательная полка над ящиками'+sk,[b.width,t,sd],[b.x+b.width/2,b.bottom+drawerStackHeight(s)+t/2,rear+sd/2],b.width,sd,t,'shelf',s.id);planTaper(out.at(-1)!,b.x,b.x+b.width,rear,RULES.shelfDepthMinus);}
    let nextY = b.bottom + RULES.drawerStep / 2;
    for (let j = 0; j < s.drawers; j++) {
      const cfg = drawerConfig(m, s, j),
        hidden = cfg.slide === "gtv0fpo";
      const sideGap = hidden ? 5 : RULES.drawerSideGap,
        boxW = b.width - filler - 2 * sideGap;
      const boxD = cfg.length - (hidden ? 10 : 0),
        bh = cfg.height;
      const bx = b.x + f.left + sideGap,
        y = b.bottom + (cfg.tray?2:RULES.drawerStep/2) + drawerOffsets(s)[j],
        z = d - (drawersBehindDoors(m,s) ? 44 : 20) - boxD;
      nextY += bh + RULES.drawerStep;
      const mesh = cfg.mesh ? meshById(cfg.mesh) : undefined;
      if (mesh) {
        // Сетчатый элемент Лемана: рама по требуемой ширине минус крепление, глубина изделия, свои направляющие.
        // Сетка без фасада: за дверью хватает 20 мм (дверь 16 + зазор), в открытом корпусе рама заподлицо с передом.
        const front = drawersBehindDoors(m,s) ? RULES.meshDoorClear : 0;
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
      const frontGap=s.drawerGap??(drawersBehindDoors(m,s)?RULES.drawerFrontGap:fb(m)),pitch=drawerPitch(cfg,frontGap),pitchBottom=b.bottom+drawerOffsets(s)[j];
      let fh=cfg.facadeH??(pitch-frontGap),fw=b.width-filler-2*RULES.drawerFrontGap,fx=b.x+f.left+(b.width-filler)/2,fy=pitchBottom+fh/2+(cfg.facadeH?frontGap/2:0);
      if(cfg.noFacade){ // внутренний ящик: только короб и направляющие
        for (const side of [0, 1])
          add(s.id + ":drawer:" + j + ":slide:" + side, "Направляющая · " + slideLabel(cfg), [hidden ? 20 : 12, hidden ? 12 : 45, cfg.length], [hidden ? bx + (side ? boxW - 10 : 10) : bx + (side ? boxW + 6 : -6), hidden ? y + 6 : y + bh / 2, z + boxD - cfg.length / 2], cfg.length, 20, 12, "drawer", s.id, "metal");
        continue;
      }
      if(!drawersBehindDoors(m,s)&&s.drawerMount!=='inset'){
        const span=facadeSpan(m,i,b);fw=span.right-span.left;fx=(span.left+span.right)/2;
        fh=cfg.facadeH??(pitch-frontGap);fy=pitchBottom+fh/2+(cfg.facadeH?frontGap/2:0);
        const lowest=drawerOffsets(s).every((o,k)=>k===j||o>=drawerOffsets(s)[j]);
        if(lowest){const top=fy+fh/2,floor=facadeBottom(m);if(floor<top-fh){fh=top-floor;fy=(top+floor)/2;}}
      }
      const dft=drawersBehindDoors(m,s)?t:m.facadeT??t;
      add(s.id+':drawer:'+j+':facade',(cfg.tray?'Выкатная полка':'Ящик '+(j+1))+' · фасад',[fw,fh,dft],[fx,fy,drawersBehindDoors(m,s)?d-36:s.drawerMount==='inset'?d-dft/2:d+dft/2+(m.faceAir??2)],fh,fw,dft,'drawer',s.id);
      out.at(-1)!.decor=m.drawerFacadeDecor??m.facadeDecor;out.at(-1)!.edge=[2,2,2,2];
      if(drawerHasHandle(cfg)&&!m.noHandles){const hl=handleById(cfg.handleId??m.drawerHandleId??m.handleId).len;add(s.id+':drawer:'+j+':handle','Ручка ящика · '+handleById(cfg.handleId??m.drawerHandleId??m.handleId).label,[hl,10,18],[fx,y+bh/2,drawersBehindDoors(m,s)?d-20:d+28],hl,10,18,'handle',s.id,'metal');}
      for (const side of [0, 1])
        add(
          s.id + ":drawer:" + j + ":slide:" + side,
          "Направляющая · " + slideLabel(cfg),
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
    if(s.pullouts){
      // Тремпель крепится под ближайшей полкой сверху (или под крышей), выдвигается вперёд. Длина — стандартный ряд GTV под глубину секции.
      // Под самой верхней полкой, если она в верхних 40 % секции (зона одежды под ней), иначе под крышей.
      const highest=s.shelves.length?Math.max(...s.shelves):0,topShelf=highest>=0.6?b.bottom+highest*h-t/2:b.top,L=pulloutLength(m),n=Math.min(3,Math.max(1,Math.round(s.pullouts)));
      // Крепление от задней стенки (как в моделях Базиса цеха): тремпель выдвигается вперёд из глубины корпуса.
      for(let k=0;k<n;k++){const x=b.x+b.width*(k+1)/(n+1);add(s.id+':pullout:'+k,'Выдвижной тремпель GTV WSL '+L+' мм',[30,42,L],[x,topShelf-21,rearClear(m)+L/2],L,42,30,'pantograph',s.id,'metal');const tp=out[out.length-1];tp.model={file:'hardware/trempel_wsl.glb',length:'y'};}
    }
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
      const spanL=inset?b.x+fe(m):left,spanR=inset?b.x+b.width-fe(m):right;
      // Скос фронта: фасады лежат вдоль наклонной линии фронта, их суммарная ширина — по косой (длиннее проёма).
      const cosK=Math.cos(skewAngle(m)),frontLen=(spanR-spanL)/cosK;
      const gap=s.doorGap??fb(m),count=doorCount(m,s),dw=(frontLen-(count-1)*gap)/count;
      const baseY=inset?b.bottom+fe(m):facadeBottom(m),doorBottom=s.externalDrawers&&s.drawers?Math.max(baseY,drawerCapTop(m,s)+gap):baseY,y1flat=inset?b.top-fe(m)-(m.topStrip?m.topStrip+fe(m):0):facadeTop(m);
      const ft=m.facadeT??t,dz=inset?d-ft/2:d+ft/2+(m.faceAir??2);
      const bands=s.doorSplit===undefined?[[doorBottom,y1flat]]:[[doorBottom,doorBottom+s.doorSplit-gap/2],[doorBottom+s.doorSplit+gap/2,y1flat]];
      for(let row=0;row<bands.length;row++){
      const [y0,yTop]=bands[row];
      for(let col=0;col<count;col++){
        const k=row*2+col;
        if(s.removedDoors?.includes(k))continue;
        const hinge=s.doorHinges?.[k]??(count===2?(col===0?'left':'right'):(s.hingeSide??m.hingeSide??'left')),x0=spanL+col*(dw+gap)*cosK,cx=x0+dw*cosK/2;
        const fp=m.skew?frontPoint(m,cx,t/2+2):undefined;
        // Фасады прямоугольные и под скосом: их верх — по низкой стороне, выше идёт фальш (см. slope-filler).
        const hL=yTop-y0,hR=yTop-y0,dh=Math.max(hL,hR),y1=y0+dh;void x0;
        if(m.alu){
          const ft=ALU_EXTRAS.frameDepth;
          add(s.id+':door:'+k,'Фасад в алюминиевой рамке',[dw,dh,ft],[cx,(y0+y1)/2,inset?d-ft/2:d+ft/2+2],dh,dw,ft,'door',s.id,'alu');
          out.at(-1)!.decor=aluLabel(m.alu);out.at(-1)!.edge=[0,0,0,0];
        } else add(s.id+':door:'+k,inset?'Фасад распашной вкладной':'Фасад распашной',[dw,dh,ft],[fp?fp.x:cx,(y0+y1)/2,fp?fp.z:dz],dh,dw,ft,'door',s.id);
        if(fp)out.at(-1)!.rotY=fp.rotY;
        out.at(-1)!.hinge=hinge;if(hinge==='top')out.at(-1)!.name=m.kitchen&&m.kitchenLift?'Фасад подъёмный · газлифт PD-G-N02':'Фасад подъёмный · механизм требует подбора';
        if(m.doorOpen==='push'||m.noHandles)continue; // push-to-open или ручки не заложены: без ручки
        const hl=handleById(s.doorHandles?.[k]??m.handleId).len;
        const hp=m.skew?frontPoint(m,cx,t+2+13,hinge==='top'?0:(hinge==='left'?1:-1)*(dw/2-40)):undefined;
        add(s.id+':handle:'+k,'Ручка фасада · '+handleById(s.doorHandles?.[k]??m.handleId).label,hinge==='top'?[hl,10,25]:[10,hl,25],[hp?hp.x:hinge==='top'?cx:cx+(hinge==='left'?1:-1)*(dw/2-40),hinge==='top'?y0+40:y0+Math.min(hL,hR)/2,hp?hp.z:dz+ft/2+13],hl,25,10,'handle',s.id,'metal');
        if(hp)out.at(-1)!.rotY=hp.rotY;
      }
      }

    }
  });
  // Крепёж по СТП: евровинты (конфирматы, видны снаружи) или эксцентриковые стяжки (скрыты: бочонок в пласти горизонтали, шток в боковине).
  // Стыки: дно, крыша, полка над ящиками, жёсткие полки — с боковинами; перегородки — с крышей и дном.
  const fixedIds = new Set(m.sections.flatMap((s) => (s.fixed ?? []).map((j) => `${s.id}:shelf:${j}`)));
  // Конфирмат: головка на наружной грани сквозной панели, ось — в сторону ввинчивания; модель «Евровинт 7х50» из проектов Базиса
  // (X — ось винта, головка при x = 0). Габарит детали — стержень 7×50 от головки.
  const CONF_Q: Record<"+x" | "-x" | "+y" | "-y", Quat> = { "+x": [1, 0, 0, 0], "-x": [0, 0, 1, 0], "+y": [Math.SQRT1_2, 0, 0, Math.SQRT1_2], "-y": [Math.SQRT1_2, 0, 0, -Math.SQRT1_2] };
  const confirmat = (key: string, head: [number, number, number], axis: "+x" | "-x" | "+y" | "-y", sid?: string) => {
    const L = RULES.confirmatL, D = RULES.confirmatD, s = axis.startsWith("-") ? -1 : 1, vertical = axis.endsWith("y");
    const c: [number, number, number] = vertical ? [head[0], head[1] + s * L / 2, head[2]] : [head[0] + s * L / 2, head[1], head[2]];
    add(key, "Конфирмат 7×50", vertical ? [D, L, D] : [L, D, D], c, L, D, D, "fastener", sid, "metal");
    out.at(-1)!.model = { file: "hardware/bazis/f660d89fba1a.glb", length: "y", native: true, origin: head, quat: CONF_Q[axis] };
  };
  const horizontals = out.filter((p) => p.material === "board" && !p.rotZ && (p.id === "bottom" || p.id === "top" || p.id.endsWith(":drawer-cap") || fixedIds.has(p.id)));
  const ecc = m.fastening === "eccentric";
  for (const hp of horizontals) {
    const z0 = hp.position[2] - hp.size[2] / 2;
    if (hp.id === "bottom" && m.bottomUnder) {
      // Дно под боковинами (кухни Базиса): конфирмат снизу через дно в торец боковины — головка на нижней пласти дна.
      const yb = hp.position[1] - t / 2;
      const sdn = m.kitchen?.sideDown;
      for (const [side, x] of [["left", t / 2], ["right", m.width - t / 2]] as const)
        // кухня Базиса: дно глубже 600 — третий конфирмат посередине (602–700: 9 из 9 днищ под боковинами; ровно 600, k30 m03 — два)
        for (const [k, z] of [z0 + (m.confirmatInset ?? RULES.confirmatInset), z0 + hp.size[2] - (m.confirmatInset ?? RULES.confirmatInset), ...(m.kitchen && hp.size[2] > KITCHEN.deepBottom + 0.5 ? [z0 + hp.size[2] / 2] : [])].entries())
          if (sdn?.side !== side) confirmat(`fast:${hp.id}:${side}:${k}`, [x, yb, z], "+y", hp.sectionId);
      // опущенная боковина (kitchen.sideDown): дно примыкает к ней торцом — стык как у дна между боковинами (конфирмат или эксцентрик)
      if (!sdn) continue;
    }
    const downSide = hp.id === "bottom" && m.bottomUnder ? m.kitchen?.sideDown?.side : undefined;
    const x0 = hp.position[0] - hp.size[0] / 2, x1 = hp.position[0] + hp.size[0] / 2; // грани горизонтали у боковин/перегородок
    for (const [side, edgeX, dir] of [["left", x0, 1], ["right", x1, -1]] as const) {
      if (downSide && side !== downSide) continue;
      const z1 = z0 + (hp.taperZ ? hp.taperZ[side === "left" ? 0 : 1] : hp.size[2]); // при скосе фронта передний крепёж по глубине своей стороны
      for (const [k, z] of [z0 + (m.confirmatInset ?? RULES.confirmatInset), z1 - (m.confirmatInset ?? RULES.confirmatInset)].entries()) {
        const jf = m.jointFastening?.[`${hp.id}:${side}`] ?? (ecc ? "eccentric" : "confirmat");
        if (jf === "eccentric") {
          // Бочонок сверлится с пласти, обращённой внутрь корпуса: у дна — сверху, у крыши и полок — снизу; торец бочонка виден при открытых фасадах.
          const fromTop = hp.id === "bottom" && !m.kitchen?.eccBelow, by = fromTop ? hp.position[1] + t / 2 - RULES.eccBarrelH / 2 + 0.3 : hp.position[1] - t / 2 + RULES.eccBarrelH / 2 - 0.3;
          add(`ecc:${hp.id}:${side}:${k}`, "Эксцентрик D15 · бочонок", [RULES.eccBarrelH, RULES.eccBarrelD, RULES.eccBarrelD], [edgeX + dir * RULES.eccCenter, by, z], RULES.eccBarrelH, RULES.eccBarrelD, RULES.eccBarrelD, "fastener", hp.sectionId, "metal");
          out.at(-1)!.anchor = [edgeX, fromTop ? hp.position[1] + t / 2 : hp.position[1] - t / 2, z];
          add(`ecc:${hp.id}:${side}:${k}:pin`, "Эксцентрик D15 · шток", [RULES.eccCenter + t / 2, 7, 7], [edgeX + dir * (RULES.eccCenter - t / 2) / 2, hp.position[1], z], RULES.eccCenter + t / 2, 7, 7, "fastener", hp.sectionId, "metal");
          if (m.dowels) {
            // Шкант 8×30 рядом с эксцентриком, внутрь стыка: 12 мм в стойку, 18 в торец горизонтали (отверстия 8×12 и 8×22).
            const dz = k === 0 ? m.dowels.offset : -m.dowels.offset;
            add(`dowel:${hp.id}:${side}:${k}`, "Шкант 8×30", [30, 8, 8], [edgeX + dir * 3, hp.position[1], z + dz], 30, 8, 8, "fastener", hp.sectionId, "metal");
          }
        } else confirmat(`fast:${hp.id}:${side}:${k}`, [edgeX - dir * t, hp.position[1], z], dir > 0 ? "+x" : "-x", hp.sectionId);
      }
    }
  }
  // Царги лёжа (кухни Базиса) и стяжки кухни на ребре: по одному конфирмату с каждой стороны через боковину в торец царги.
  for (const r of out.filter((p) => p.id.startsWith("rail:") && (p.size[1] === t || !!m.kitchen))) {
    for (const [side, edgeX, dir] of [["left", r.position[0] - r.size[0] / 2, 1], ["right", r.position[0] + r.size[0] / 2, -1]] as const) {
      // Конфирмат царги по центру её торца; если там уже конфирмат дна/крыши в той же боковине (дно под боковинами,
      // отступ 54 у k04 — z 503 против 507), сдвигаем по ширине царги до чистого места: 16 мм между осями (critic qdrawers B4).
      const hx = edgeX - dir * t, xs = [Math.min(hx, hx + dir * 50), Math.max(hx, hx + dir * 50)], y = r.position[1];
      const others = out.filter((p) => p.name.startsWith("Конфирмат") && p.position[0] + p.size[0] / 2 > xs[0] && p.position[0] - p.size[0] / 2 < xs[1] && Math.abs(p.position[1] - y) < p.size[1] / 2 + 3.5);
      const hits = (z: number, gap: number) => others.some((p) => Math.abs(p.position[2] - z) < p.size[2] / 2 + 3.5 + gap);
      let z = r.position[2];
      if (hits(z, 0)) {
        const half = r.size[2] / 2 - 10;
        for (let d = 1; d <= half; d++) { const c = [r.position[2] + d, r.position[2] - d].find((v) => !hits(v, 9)); if (c !== undefined) { z = c; break; } }
      }
      confirmat(`fast:${r.id}:${side}:0`, [hx, y, z], dir > 0 ? "+x" : "-x");
    }
  }
  for (const dv of out.filter((p) => p.id.endsWith(":divider"))) {
    const z0 = dv.position[2] - dv.size[2] / 2, z1 = dv.position[2] + dv.size[2] / 2;
    for (const [edge, y] of [["top", innerTop(m) + t / 2 + (hasTop(m) ? 0 : -t / 2)], ["bottom", innerBottom(m) - t / 2 + (hasBottom(m) ? 0 : t / 2)]] as const)
      for (const [k, z] of [z0 + (m.confirmatInset ?? RULES.confirmatInset), z1 - (m.confirmatInset ?? RULES.confirmatInset)].entries()) {
        if (ecc) add(`ecc:${dv.id}:${edge}:${k}`, "Эксцентрик D15 · бочонок", [RULES.eccBarrelH, RULES.eccBarrelD, RULES.eccBarrelD], [dv.position[0], edge === "top" ? y - RULES.eccBarrelH : y + RULES.eccBarrelH, z], RULES.eccBarrelH, RULES.eccBarrelD, RULES.eccBarrelD, "fastener", dv.sectionId, "metal");
        else confirmat(`fast:${dv.id}:${edge}:${k}`, [dv.position[0], edge === "top" ? y + t / 2 : y - t / 2, z], edge === "top" ? "-y" : "+y", dv.sectionId);
      }
  }
  // Edge pulls mount on the free edge, not at the bracket-handle drilling offset.
  for(const handle of out.filter(p=>p.role==='handle')){
    if(handleKind(handleById(facadeHandleId(m,handle.id)))!=='profile')continue;
    const drawer=handle.id.includes(':drawer:'),face=out.find(p=>p.id===handle.id.replace(drawer?':handle':':handle:',drawer?':facade':':door:'));
    if(!face)continue;
    if(drawer||face.hinge==='top')handle.position[1]=face.position[1]+(drawer?1:-1)*(face.size[1]/2-2);
    else{const off=(face.hinge==='right'?-1:1)*(face.size[0]/2-2),angle=(face.rotY??0)*Math.PI/180;handle.position[0]=face.position[0]+off*Math.cos(angle);handle.position[2]=face.position[2]-off*Math.sin(angle)+face.size[2]/2+3;}
  }
  hardwareParts(m,out);
  kitchenExtraParts(m,out);
  kitchenDrawerParts(m,out,fe(m),m.facadeT??RULES.panel,m.faceAir??2);
  kitchenEdges(m,out);
  // Пазы под подсветку и прочие (кроме паза под задник): тёмная полоса в панели; подсветка — в смете за пог. м (роль light).
  (m.grooves??[]).forEach((g,i)=>{const hostPart=out.find(p=>p.id===g.host);if(!hostPart)return;const b=grooveBox(hostPart,g);if(!b)return;const [x0,y0,z0,x1,y1,z1]=b,size:[number,number,number]=[x1-x0,y1-y0,z1-z0],dims=[...size].sort((a,b)=>b-a);
    out.push({id:`groove:${i}`,name:g.name,size,position:[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],length:dims[0],width:dims[1],thickness:dims[2],role:'light',material:'metal',decor:'',grain:'length',grainAxis:0,edge:[0,0,0,0],external:true,look:{color:0x2a2c2e,metalness:0.2,roughness:0.8}});});
  // Фасады из фасадного материала (МДФ, плёнка, эмаль) — сторонний участок: не в раскрой ЛДСП, без кромки.
  if(m.facadeMaterial==='external')for(const p of out)if(p.role==='door'||p.id.endsWith(':facade')){const fk=m.facadeEdge??0;p.external=true;p.edge=[fk,fk,fk,fk];if(!p.name.includes('фасадный материал'))p.name+=' · фасадный материал';}
  // Выбор кромки (решение Макса 06.10.2026): видимые торцы корпуса и фасады — 2 мм по умолчанию, можно 1 или 0,8; скрытые 0,4 не меняются.
  if((m.edgeBody??2)!==2||(m.edgeFacade??2)!==2)for(const p of out){
    if(p.material!=='board')continue;
    const facade=p.role==='door'||p.id.endsWith(':facade')||p.id==='slope-filler',to=facade?m.edgeFacade??2:m.edgeBody??2;
    p.edge=p.edge.map(e=>e===2?to:e) as Part['edge'];
  }
  return out;
}
/** Подпись направляющей для 3D и чертежей: тип, бренд, ход, длина. */
export function slideLabel(c: DrawerConfig) { return (c.slide === "ball" ? "шариковая" : "скрытая") + " " + SLIDE_BRANDS[slideBrand(c)] + " · " + ({ "soft-close": "с доводчиком", simple: "без доводчика", push: "push-to-open" } as const)[slideMotion(c)] + " · " + c.length + " мм"; }
/** Прорисованная фурнитура (06.10.2026): петли (чашка Ø35 в фасаде + плечо и планка на стойке), толкатели push-to-open,
 *  полкодержатели под съёмными полками. Только для 3D и визуальной проверки; цена считается в pricing.ts по тем же правилам. */
function hardwareParts(m: Module, out: Part[]) {
  const t = RULES.panel, d = m.depth, inset = m.doorMount === "inset", push = m.doorOpen === "push";
  const metal = (id: string, name: string, size: Part["size"], position: Part["position"], role: Part["role"], sectionId?: string): Part =>
    ({ id, name, sectionId, size, position, length: size[0], width: size[1], thickness: size[2], role, material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] });
  const brand = HINGE_BRANDS[m.hingeBrand ?? "gtv"].label;
  // Полкодержатели — до петель: петля не должна сесть на полкодержатель (проверка пересечений ниже их видит).
  const fixed = new Set(m.sections.flatMap((s) => (s.fixed ?? []).map((j) => `${s.id}:shelf:${j}`)));
  for (const sh of out.filter((p) => p.role === "shelf" && (p.material === "board" || p.material === "glass") && /:shelf:\d+$/.test(p.id) && !fixed.has(p.id) && !p.taperZ)) {
    const [x, y, z] = sh.position, [w, , dd] = sh.size;
    const pi = m.shelfPinInset ?? 40, sg = sh.material === "glass" ? m.glassGap ?? RULES.shelfGap : RULES.shelfGap; // держатель — на грани стойки
    const pf = m.kitchen ? m.shelfPinInsetFront ?? pi : pi; // передние — свой отступ только у кухни Базиса
    [[x - w / 2 + 4, z - dd / 2 + pi], [x + w / 2 - 4, z - dd / 2 + pi], [x - w / 2 + 4, z + dd / 2 - pf], [x + w / 2 - 4, z + dd / 2 - pf]].forEach(([px, pz], k) =>
      out.push({ ...metal(`shp:${sh.id}:${k}`, sh.material === "glass" ? "Полкодержатель для стеклянных полок MV05" : "Полкодержатель", [12, 6, 6], [px, y - sh.size[1] / 2 - 3, pz], "fastener", sh.sectionId),
        // модель Базиса: X — из стойки к полке (−7..8), Y — вниз под полку; левая стойка — поворот 180° вокруг X, правая — вокруг Z
        model: { file: "hardware/bazis/4b95caf1da2f.glb", length: "y", native: true, origin: [px < x ? x - w / 2 - sg : x + w / 2 + sg, y - sh.size[1] / 2, pz], quat: px < x ? [0, 1, 0, 0] : [0, 0, 0, 1] } }));
  }
  for (const door of out.filter((p) => p.role === "door" && p.id.includes(":door:") && !p.rotY && (p.hinge === "left" || p.hinge === "right"))) {
    const [cx, cy, dz] = door.position, [dw, dh] = door.size, dir = door.hinge === "left" ? 1 : -1;
    const edgeX = cx - dir * dw / 2, back = dz - door.size[2] / 2;
    // Внутренняя грань стойки, на которую садится планка: фактическая вертикаль корпуса у кромки фасада со стороны петель
    // (боковина, перегородка, фальш), иначе — по правилу накладного/вкладного фасада.
    const guess = inset ? edgeX - dir * fe(m) : edgeX + dir * (t - fe(m));
    // Стойка уходит за фасад вглубь корпуса (фальш-панель в плоскости фасадов — не стойка).
    const stand = out.filter((p) => isBoardVertical(p) && p.position[1] - p.size[1] / 2 <= cy && p.position[1] + p.size[1] / 2 >= cy && p.position[2] + p.size[2] / 2 >= back - 30 && p.position[2] - p.size[2] / 2 <= back - 100)
      .map((p) => dir > 0 ? p.position[0] + p.size[0] / 2 : p.position[0] - p.size[0] / 2)
      .filter((fx) => dir * (fx - edgeX) >= -fe(m) - 1 && dir * (fx - edgeX) <= 40)
      .sort((a, b) => Math.abs(a - guess) - Math.abs(b - guess))[0];
    const sideX = stand ?? guess;
    const mirror = dir < 0 ? { mirror: true } : {};
    const obstacles = out.filter((p) => p !== door);
    const placed: Part[] = [];
    const hingeAt = (y: number, n: number): [Part, Part] => {
      const cupId = door.id.replace(":door:", ":hingecup:") + ":" + n, plateId = door.id.replace(":door:", ":hingeplate:") + ":" + n;
      if (!inset) {
        // Накладная петля GTV ECHC 09BEO — сетки из проектов Базиса цеха (TriData → GLB). Узел Базиса: начало — внутренняя плоскость
        // стойки × тыльная плоскость фасада; X — от фасада внутрь, Y — от стойки внутрь корпуса, Z — ось петли. Ориентации левой и правой
        // петли — как в моделях Базиса. Чашка — по преобразованию из моделей: поворот Ry 90°, сдвиг 4,5 по Y.
        const qb: Quat = dir > 0 ? [0.5, 0.5, 0.5, -0.5] : [0.5, -0.5, 0.5, 0.5], o: [number, number, number] = [sideX, y, back];
        // Центр чашки — в 7,5 мм от внутренней плоскости стойки (присадка «Петля накладная» в проектах Базиса цеха).
        const co = qrot(qb, [0, 7.5, 0]), cupO: [number, number, number] = [o[0] + co[0], o[1] + co[1], o[2] + co[2]];
        const cup: Part = { ...metal(cupId, "Петля " + brand + " · чашка Ø35", [35, 35, 12.5], [cupO[0], y, back + 6.25], "hinge", door.sectionId),
          model: { file: "hardware/bazis/39d9d9c26d8c.glb", length: "y", native: true, origin: cupO, quat: qmul(qb, [Math.SQRT1_2, 0, Math.SQRT1_2, 0]) },
          collide: [{ size: [35, 35, 12.5], position: [cupO[0], y, back + 6.25] }] };
        // Плечо с планкой: по сетке ECHC 0..70 от фасада вглубь, 0..23,7 от стойки внутрь, ±26,5 по высоте.
        const plate: Part = { ...metal(plateId, "Петля " + brand + " · плечо и планка", [23.7, 53, 70], [sideX + dir * 11.85, y, back - 35], "hinge", door.sectionId),
          model: { file: "hardware/bazis/d7e1d3957ebe.glb", length: "y", native: true, origin: o, quat: qb },
          collide: [{ size: [23.7, 53, 70], position: [sideX + dir * 11.85, y, back - 35] }] };
        return [cup, plate];
      }
      // Вкладная — модели по технической карте GTV DCHCB 3D (scripts/blender_hardware.py): отсчёт от кромки фасада со стороны петель (x)
      // и от тыльной плоскости фасада (z). Правая петля — зеркально. Точные коробки: чашка Ø35×12,5 в теле фасада;
      // плечо с планкой — у внутренней грани стойки, 26 мм внутрь корпуса, 78 мм от фасада вглубь.
      const cup: Part = { ...metal(cupId, "Петля " + brand + " · чашка Ø35", [36.4, 58, 27.3], [edgeX + dir * 22.5, y, back - 1.85], "hinge", door.sectionId), model: { file: "hardware/hinge_cup.glb", length: "y", ...mirror },
        collide: [{ size: [35, 35, 12.5], position: [edgeX + dir * 22.5, y, back + 6.25] }] };
      const plate: Part = { ...metal(plateId, "Петля " + brand + " · плечо и планка", [19.6, 63, 76.5], [sideX + dir * 9.8, y, back - 39.75], "hinge", door.sectionId), model: { file: "hardware/hinge_plate.glb", length: "y", ...mirror },
        collide: [{ size: [26, 63, 78], position: [sideX + dir * 13, y, back - 39] }] };
      return [cup, plate];
    };
    // Зазор 5 мм до любой детали, кроме разрешённых контактов (своя стойка, свой фасад, своя петля) — не впритык к полке.
    // Зазор — только до «чужих» деталей в зоне петли (полки, царги, крепёж, ящики, другие петли); каркас и свой фасад петля касает по устройству.
    const clearOf = (o: Part) => o.role === "shelf" || o.role === "drawer" || o.role === "hinge" || o.id.startsWith("rail:") || o.id.startsWith("fast:") || o.id.startsWith("shp:") || o.id.startsWith("ecc:");
    const blocked = (hs: Part[]) => hs.some((h) => [...obstacles, ...placed].some((o) => { const depth = partPenetration(h, o); if (allowedContact(h, o, Math.max(depth, 0), m)) return false; return depth > 0.1 || (clearOf(o) && depth > -HINGE_CLEAR); }));
    // Петля не должна пересекать ничего (замечание Макса 09.10.2026): идеальная высота (100 мм от краёв фасада), а если там полка,
    // царга, конфирмат, полкодержатель, ящик или соседняя петля — ближайшая свободная высота в пределах фасада.
    const lo = cy - dh / 2 + Math.min(40, dh / 4), hi = cy + dh / 2 - Math.min(40, dh / 4);
    const sec = m.sections.find((s) => s.id === door.sectionId);
    const upRow = !!m.kitchen && sec?.doorSplit !== undefined && Number(door.id.split(":door:")[1]) >= 2 && !!sec.hingeYUp?.length; // верхний ряд пенала — свои высоты
    (upRow ? scaleHingeY(sec!.hingeYUp!, sec!.hingeYUpFor ?? dh, dh) : sec?.hingeY?.length ? scaleHingeY(sec.hingeY, sec.hingeYFor ?? dh, dh) : hingePositions(dh, dw, !!m.kitchen)).forEach((hy, n) => {
      const ideal = cy - dh / 2 + hy;
      let pair = hingeAt(ideal, n);
      for (const s of hingeShifts()) {
        const y = ideal + s;
        if (y < lo || y > hi) continue;
        const cand = hingeAt(y, n);
        if (!blocked(cand)) { pair = cand; break; }
      }
      placed.push(...pair);
    });
    out.push(...placed);
    if (push) {
      const freeX = cx + dir * dw / 2 - dir * (inset ? -fe(m) : t - fe(m)) - dir * 8;
      out.push(metal(door.id.replace(":door:", ":latch:"), "Толкатель push-to-open", [14, 14, 40], [freeX, cy + dh / 2 - 120, (inset ? back : d) - 20], "hinge", door.sectionId));
    }
  }
  // Подъёмный фасад кухни (петли по верху, как в Базисе: «Петля накладная» на нижней плоскости крыши, 100 мм от боковых кромок фасада,
  // кватернион узла Базиса [0,−0,71,0,0,71]; центр чашки — в 7,5 мм от плоскости крыши). Только для кухонь и накладных фасадов.
  if (m.kitchen && !inset) for (const door of out.filter((p) => p.role === "door" && p.id.includes(":door:") && !p.rotY && p.hinge === "top")) {
    const [cx, cy, dz] = door.position, [dw, dh] = door.size, back = dz - door.size[2] / 2, topY = cy + dh / 2;
    // Крыша/горизонталь над фасадом: нижняя плоскость в пределах кромки фасада
    const roof = out.filter((p) => p.material === "board" && p.role === "body" && p.size[1] <= 40 && p.size[0] > 60 && p.size[2] > 60 && !p.rotY && !p.rotZ
      && p.position[0] - p.size[0] / 2 <= cx && p.position[0] + p.size[0] / 2 >= cx && p.position[2] + p.size[2] / 2 >= back - 30)
      .map((p) => p.position[1] - p.size[1] / 2).filter((y) => y <= topY + 1 && y >= topY - 40).sort((a, b) => b - a)[0];
    if (roof === undefined) continue;
    // Кватернион узла Базиса [w,x,y,z] = [0,−0,71,0,0,71]: X петли → −Z (вглубь от фасада), Y → −Y (вниз от крыши), Z → −X (вдоль кромки).
    const qv: Quat = [0, -Math.SQRT1_2, 0, Math.SQRT1_2];
    hingePositions(dw, dh, true).forEach((hx, n) => {
      const x = cx - dw / 2 + hx, o: [number, number, number] = [x, roof, back];
      const cupId = door.id.replace(":door:", ":hingecup:") + ":" + n, plateId = door.id.replace(":door:", ":hingeplate:") + ":" + n;
      const cupO: [number, number, number] = [x, roof - 7.5, back];
      out.push({ ...metal(cupId, "Петля " + brand + " · чашка Ø35", [35, 35, 12.5], [x, cupO[1], back + 6.25], "hinge", door.sectionId),
        model: { file: "hardware/bazis/39d9d9c26d8c.glb", length: "y", native: true, origin: cupO, quat: qmul(qv, [Math.SQRT1_2, 0, Math.SQRT1_2, 0]) },
        collide: [{ size: [35, 35, 12.5], position: [x, cupO[1], back + 6.25] }] });
      out.push({ ...metal(plateId, "Петля " + brand + " · плечо и планка (подъёмный фасад)", [53, 23.7, 70], [x, roof - 11.85, back - 35], "hinge", door.sectionId),
        model: { file: "hardware/bazis/d7e1d3957ebe.glb", length: "y", native: true, origin: o, quat: qv },
        collide: [{ size: [53, 23.7, 70], position: [x, roof - 11.85, back - 35] }] });
    });
  }
  kitchenLiftParts(m, out);
  void slideMotion; void slideBrand; void SLIDE_BRANDS;
}
/** Коробка паза в осях модуля по детали-носителю (пересчитывается при каждом построении — паз идёт за деталью). */
export function grooveBox(p: Part, g: Groove): [number, number, number, number, number, number] | null {
  const ax = partAxesOf(p), lo = p.position.map((v, i) => v - p.size[i] / 2), hi = p.position.map((v, i) => v + p.size[i] / 2);
  const b0 = [...lo], b1 = [...hi];
  b0[ax.t] = g.face === "+" ? hi[ax.t] - g.depth : lo[ax.t]; b1[ax.t] = g.face === "+" ? hi[ax.t] : lo[ax.t] + g.depth;
  b0[ax.L] = lo[ax.L] + g.along[0]; b1[ax.L] = hi[ax.L] - g.along[1];
  b0[ax.W] = lo[ax.W] + g.across[0]; b1[ax.W] = lo[ax.W] + g.across[1];
  if (b1[ax.L] <= b0[ax.L] || b1[ax.W] <= b0[ax.W] || b1[ax.W] > hi[ax.W] + 0.01) return null;
  return [b0[0], b0[1], b0[2], b1[0], b1[1], b1[2]];
}
/** Пазы панели для бирки и деталировки (кроме паза под задник). */
export function grooveText(m: Module, partId: string) {
  // коротко, чтобы влезло в строку бирки 96 мм: «паз под подсветку 17×8, от задн. кромки 100, торцы 16/16»
  return (m.grooves ?? []).filter((g) => g.host === partId).map((g) => `${g.name === "паз под подсветку" ? "подсветка" : g.name} ${Math.round(g.across[1] - g.across[0])}×${g.depth}, задн.кр. ${Math.round(g.across[0])}, торцы ${Math.round(g.along[0])}/${Math.round(g.along[1])}`).join("; ");
}
/** Ручные высоты петель при другой высоте фасада: нижняя держит отступ от низа, верхняя — от верха, средние — пропорционально. */
export function scaleHingeY(ys: number[], was: number, now: number): number[] {
  if (Math.abs(was - now) < 0.5 || ys.length < 2) return ys.map((y) => Math.min(Math.max(y, 40), now - 40));
  const a = ys[0], b = was - ys[ys.length - 1], top = now - b;
  return ys.map((y, k) => k === 0 ? a : k === ys.length - 1 ? top : a + (y - a) * (top - a) / Math.max(1, ys[ys.length - 1] - a));
}
/** Минимальный зазор от петли до чужих деталей при подборе высоты, мм. */
const HINGE_CLEAR = 5;
/** Вертикальная доска корпуса (боковина, перегородка, фальш-планка): тонкая по X. */
function isBoardVertical(p: Part) { return p.material === "board" && p.role === "body" && p.size[0] <= 40 && p.size[1] > 60 && !p.rotY && !p.rotZ; }
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
/** Refit only overflowing drawer stacks on a height change; reject infeasible hardware instead of deleting it. */
export function fitDrawersAfterResize(m:Module){
 for(const section of m.sections){
  if(!section.drawers)continue;
  const b=boxes(m).find(b=>b.id===section.id)!,h=b.top-b.bottom;
  const ceiling=Math.min(b.top-RULES.shelfMinClear,...section.shelves.map(f=>b.bottom+f*h-RULES.panel/2-RULES.shelfMinClear));
  if(drawerCapTop(m,section)<=ceiling)continue;
  if(section.drawerConfigs?.some(c=>c.mesh))throw Error('Корзины имеют фиксированную высоту. Увеличьте корпус или уберите корзину.');
  section.drawerConfigs=distributeDrawers(m,section,ceiling);
 }
}
/** Число конфирматов корпуса и полкодержателей под съёмные полки. */
export function fastenerCounts(m: Module) {
  const ps = parts(m);
  const fixedIds = new Set(m.sections.flatMap((s) => (s.fixed ?? []).map((j) => `${s.id}:shelf:${j}`)));
  return { confirmats: ps.filter((p) => p.role === "fastener" && p.id.startsWith("fast:")).length, shelfHolders: m.kitchen?.fasteners === false ? 0 : 4 * ps.filter((p) => p.role === "shelf" && !p.id.endsWith(":drawer-cap") && !fixedIds.has(p.id)).length, eccentrics: ps.filter((p) => p.id.startsWith("ecc:") && !p.id.endsWith(":pin")).length + (cornerStrip(m) ? 4 : 0) };
}
/** Предел высоты модуля: кухонный пенал до KITCHEN.maxHeight 2900 (Базис до 2869), остальное (шкафы, нижние/навесные/антресоли) — RULES.maxH 2500. Один источник для validate и полей «Высота». */
export function maxHeightOf(m: Module): number {
  return m.kitchen?.role === "tall" ? KITCHEN.maxHeight : RULES.maxH;
}
export function validate(m: Module): string[] {
  if(m.kupe)return kupeErrors(m);
  if(m.raw)return rawErrors(m);
  if(m.worktop)return kitchenErrors(m);
  if(m.corner)return cornerErrors(m);
  if(m.casework)return caseworkErrors(m);
  if(m.sectionLayout){
    try{resolveLayout(m);}catch(e){return [(e as Error).message];}
    if(m.doors||m.slope||m.skew||m.topGlass)return ['Составные проёмы пока доступны в прямом открытом корпусе.'];
  }
  if((m.raisedSides!==undefined&&typeof m.raisedSides!=='boolean')||(m.openJunction!==undefined&&typeof m.openJunction!=='boolean'))return ['Неверные параметры основания или углового соединения.'];
  const errors: string[] = [];
  for (const [key, label, min, max] of (m.desk ? [
    ["width", "Ширина стола", RULES.minW, RULES.deskMaxW],
    ["height", "Высота стола", RULES.deskMinH, RULES.deskMaxH],
    ["depth", "Глубина стола", RULES.minD, RULES.maxD],
  ] : [
    ["width", "Ширина", m.kitchen ? KITCHEN.minWidth : RULES.minW, RULES.maxW], // кухня: бутылочница 150 (вкладка «Кухня»)
    ["height", "Высота", RULES.minH, maxHeightOf(m)], // кухонный пенал до 2900 (Базис), остальное до 2500
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
  if(m.drawerHandleId!==undefined&&!HANDLES.some(h=>h.id===m.drawerHandleId))errors.push('Выберите ручку ящиков из каталога.');
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
  for(const [k,lo,hi] of [['faceGap',0,5],['faceGapBetween',0,10],['backGap',0,10],['grooveWidth',3,10],['grooveClear',0,3],['facadeT',3,40],['faceAir',0,10],['shelfRear',0,100],['shelfPinInset',20,200],['confirmatInset',20,200]] as const){const v=m[k];if(v!==undefined&&(!Number.isFinite(v)||v<lo||v>hi))errors.push(`Параметр ${k}: ${lo}–${hi} мм.`);}
  if(m.rails?.some(r=>r&&((r.lay!==undefined&&!['edge','flat'].includes(r.lay))||(r.setback!==undefined&&(!Number.isFinite(r.setback)||r.setback<0||r.setback>80)))))errors.push('Царга: укладка на ребро или лёжа, утопание 0–80 мм.');
  if(m.rails?.some(r=>r&&r.at!==undefined&&(!Number.isFinite(r.at)||r.at<innerBottom(m)||r.at+r.height>innerTop(m)+0.01)))errors.push('Стяжка на заданной высоте выходит за боковины: низ не ниже верха дна, верх не выше крыши/верха боковин.');
  if(m.slope!==undefined){if(!['left','right'].includes(m.slope.side)||!Number.isFinite(m.slope.lowHeight)||m.slope.lowHeight<RULES.slopeMinLow||m.slope.lowHeight>m.height-RULES.slopeMinDrop)errors.push(`Скос под потолок: высота низкой стороны от ${RULES.slopeMinLow} до ${m.height-RULES.slopeMinDrop} мм (корпус ${m.height}).`);if(m.topGlass)errors.push('Скос со стеклянной крышей не делаем.');if(m.topType==='none')errors.push('Скос без крыши не делаем.');if(m.alu)errors.push('Скос с алюминиевыми фасадами не делаем: рамки не режутся по косой.');}
  if(m.fastening!==undefined&&!['confirmat','eccentric'].includes(m.fastening))errors.push('Неверный тип крепежа.');
  if(m.hingeBrand!==undefined&&!(m.hingeBrand in HINGE_BRANDS))errors.push('Неизвестный бренд петель.');
  for(const e of [m.edgeBody,m.edgeFacade])if(e!==undefined&&![2,1,0.8].includes(e))errors.push('Кромка: выберите 2, 1 или 0,8 мм.');
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
  if(m.plinthHeight!==undefined && ![0,60,80,100,120,150].includes(m.plinthHeight))errors.push("Выберите высоту цоколя из списка.");
  if(m.backType==="groove" && (![m.grooveInset??16,m.grooveDepth??8].every(Number.isFinite)||(m.grooveInset??16)<8||(m.grooveInset??16)>30||(m.grooveDepth??8)<4||(m.grooveDepth??8)>10))errors.push("Паз: отступ 8–30 мм, глубина 4–10 мм.");
  errors.push(...kitchenErrors(m),...kitchenDrawerErrors(m),...kitchenLiftErrors(m,{facadeTop:facadeTop(m),innerBottom:innerBottom(m),leaves:s=>{try{return doorCount(m,s);}catch{return 4;}}}));
  if(m.facadeEdge!==undefined&&(!Number.isFinite(m.facadeEdge)||m.facadeEdge<0||m.facadeEdge>2))errors.push('Кромка фасадов: 0–2 мм.');
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
    if(s.drawerMount!==undefined&&s.drawerMount!=='inset')errors.push(prefix+'неверная посадка фасадов ящиков.');
    if(s.glassShelves!==undefined&&(!Array.isArray(s.glassShelves)||s.glassShelves.some(j=>!Number.isInteger(j)||j<0||j>=s.shelves.length)))errors.push(prefix+'неверные номера стеклянных полок.');
    if(s.rodClearance!==undefined&&(!Number.isFinite(s.rodClearance)||s.rodClearance<300||s.rodClearance>1500))errors.push(prefix+'просвет под штангой: 300–1500 мм.');
    if(s.doorHandles!==undefined&&(!Array.isArray(s.doorHandles)||s.doorHandles.length>4||s.doorHandles.some(h=>h!==null&&!HANDLES.some(a=>a.id===h))))errors.push(prefix+'неверная ручка створки.');
    if(s.externalDrawers!==undefined&&typeof s.externalDrawers!=='boolean')errors.push(prefix+'неверное расположение ящиков.');
    if(s.doorSplit!==undefined&&(!Number.isFinite(s.doorSplit)||s.doorSplit<RULES.doorMinH||s.doorSplit>m.height-RULES.doorMinH))errors.push(prefix+'недопустимая высота разделения фасадов.');
    if(s.doorHinges!==undefined&&(!Array.isArray(s.doorHinges)||s.doorHinges.length>4||s.doorHinges.some(v=>v!==null&&!['left','right','top'].includes(v))))errors.push(prefix+'неверное открывание фасада.');
    if(s.drawerGap!==undefined&&(!Number.isFinite(s.drawerGap)||s.drawerGap<2||s.drawerGap>10))errors.push(prefix+'зазор фасадов ящиков от 2 до 10 мм.');
    if(s.doorLeaves!==undefined&&s.doorLeaves!==1&&s.doorLeaves!==2)errors.push(prefix+'число створок: 1 или 2.');
    if(s.hingeSide!==undefined&&!['left','right'].includes(s.hingeSide))errors.push(prefix+'неверная сторона петель.');
    if(s.doorGap!==undefined&&(!Number.isFinite(s.doorGap)||s.doorGap<2||s.doorGap>10))errors.push(prefix+'зазор створок от 2 до 10 мм.');
    if(s.removedDoors!==undefined&&(!Array.isArray(s.removedDoors)||s.removedDoors.some(k=>!Number.isInteger(k)||k<0||k>(s.doorSplit===undefined?1:3))))errors.push(prefix+'неверный список снятых фасадов.');
    if(s.shelfDepth!==undefined){
      const max=shelfMaxDepth(m);
      if(!Number.isFinite(s.shelfDepth)||s.shelfDepth<100||s.shelfDepth>max)errors.push(prefix+`глубина полок должна быть от 100 до ${max} мм. Уменьшите глубину полки или увеличьте корпус.`);
      if(m.skew)errors.push(prefix+'при скосе фронта используйте автоматическую глубину полок.');
    }
    const minSection = m.kitchen ? KITCHEN.minWidth - 2 * RULES.panel : RULES.minSection; // кухонная бутылочница 150: 118 внутри
    if (b.width < minSection)
      errors.push(
        prefix +
          `нужно не менее ${minSection} мм внутри. Уберите перегородку или увеличьте ширину.`,
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
      if(c.handleId!==undefined&&!HANDLES.some(h=>h.id===c.handleId))errors.push(prefix+'неверная ручка ящика.');
      if (c.mesh !== undefined) {
        const item = meshById(c.mesh);
        if (!item) { errors.push(prefix + "неизвестный элемент Лемана Про."); continue; }
        if (!Number.isFinite(c.height) || c.height !== item.h) errors.push(prefix + `высота «${item.label}» фиксирована: ${item.h} мм.`);
        const inner = b.width-fillerSides(m,s).left-fillerSides(m,s).right;
        if (inner < item.reqW || inner > item.reqW + MESH_WIDTH_TOLERANCE)
          errors.push(prefix + `«${item.label}» нужен проём ${item.reqW}–${item.reqW + MESH_WIDTH_TOLERANCE} мм внутри, сейчас ${Math.round(inner)}. Сделайте секцию ${Math.round(item.reqW + (b.width - inner) + 2 * RULES.panel)} мм по корпусу.`);
        const front = drawersBehindDoors(m,s) ? RULES.meshDoorClear : 0, depthAvailable = m.depth - rearClear(m) - front;
        if (depthAvailable < item.reqD) errors.push(prefix + `«${item.label}» нужна глубина корпуса от ${item.reqD + rearClear(m) + front} мм.`);
        continue;
      }
      if (
        !hw ||
        (c.handle!==undefined&&typeof c.handle!=='boolean') ||
        (c.handle===false&&c.slide==='ball') ||
        !Number.isFinite(c.height) ||
        c.height < (c.tray?40:68) ||
        c.height > 300 ||
        !hw.lengths.some((l) => l === c.length)
      ) {
        errors.push(prefix + "неверный размер или тип направляющих.");
        continue;
      }
      if (c.length > m.depth - rearClear(m) - (drawersBehindDoors(m,s) ? 44 : 25))
        errors.push(prefix + "направляющая слишком длинная для этой глубины.");
      if((c.tray!==undefined&&typeof c.tray!=='boolean')||(c.operation!==undefined&&!['push','soft-close','simple'].includes(c.operation))||(c.brand!==undefined&&!(c.brand in SLIDE_BRANDS))||(c.operation==='simple'&&c.slide!=='ball'))errors.push(prefix+'проверьте тип выкатного элемента.');
      if (c.facadeH !== undefined && (!Number.isFinite(c.facadeH) || c.facadeH < (c.tray?40:60) || c.facadeH > 800))
        errors.push(prefix + "высота фасада ящика: от 60 до 800 мм.");

    }
    const offsets=drawerOffsets(s);
    for(let j=0;j<offsets.length;j++){
      if(!Number.isFinite(offsets[j])||offsets[j]<0)errors.push(prefix+'неверное положение ящика.');
      for(let k=0;k<j;k++)if(offsets[j]<offsets[k]+drawerPitch(drawerConfig(m,s,k),s.drawerGap)&&offsets[k]<offsets[j]+drawerPitch(drawerConfig(m,s,j),s.drawerGap))errors.push(prefix+'ящики пересекаются.');
    }
    if(s.pantograph && (b.width<545||b.width>910||h<1100))errors.push(prefix+'пантографу нужен проём шириной 545–910 мм и высотой от 1100 мм.');
    if(s.rod&&s.pantograph)errors.push(prefix+'выберите штангу или пантограф.');
    if(s.rodAt!==undefined&&(!Number.isFinite(s.rodAt)||s.rodAt<0.1||s.rodAt>0.97))errors.push(prefix+'измените высоту штанги.');
    if(s.pantograph!==undefined&&typeof s.pantograph!=='boolean')errors.push(prefix+'неверный тип пантографа.');
    if(s.pullouts!==undefined&&(!Number.isInteger(s.pullouts)||s.pullouts<0||s.pullouts>3))errors.push(prefix+'выдвижных тремпелей — от 1 до 3.');
    if(s.pullouts&&pulloutLength(m)<250)errors.push(prefix+'выдвижному тремпелю нужна внутренняя глубина от 270 мм.');
    const shelfY = s.shelves.map((f) => f * h).sort((a, b) => a - b);
    const drawerTop = drawerStackHeight(s);
    const partitionCap=!!m.sectionLayout&&b.top<innerTop(m),trayOnly=!!s.drawers&&!!s.drawerConfigs?.every(c=>c.tray);
    if (s.drawers && (partitionCap?drawerTop>h:drawerTop+(trayOnly?0:RULES.panel)>h-RULES.shelfMinClear))
      errors.push(
        prefix +
          "ящики не помещаются по высоте. Уберите один ящик или увеличьте высоту.",
      );
    shelfY.forEach((y, j) => {
      if (
        !Number.isFinite(y) ||
        y < RULES.shelfMinClear + RULES.panel / 2 - .001 ||
        y > h - RULES.shelfMinClear - RULES.panel / 2 + .001 ||
        offsets.some((offset,k)=>y+RULES.panel/2>offset-RULES.shelfMinClear+.001&&y-RULES.panel/2<offset+drawerPitch(drawerConfig(m,s,k),s.drawerGap)+(trayOnly?20:RULES.panel+RULES.shelfMinClear)-.001) ||
        (j > 0 && y - shelfY[j - 1] < RULES.shelfMinClear + RULES.panel - .001)
      )
        errors.push(
          prefix +
            "между поверхностями полок, дна и крыши нужно не менее 80 мм. Измените положение полок.",
        );
    });
    if (
      s.drawers > 0 &&
      (b.width - (drawersBehindDoors(m,s) ? RULES.drawerFiller : 0) < 250 || dTooSmall(m))
    )
      errors.push(
        prefix +
          "для ящиков нужно от 250 мм внутри и глубина корпуса от 300 мм.",
      );
    const rodY=s.rodAt===undefined?(shelfY[0]??h)-RULES.rodTopOffset:s.rodAt*h;
    const support=Math.max(drawerTop+(s.drawers?RULES.panel:0),0,...shelfY.filter(y=>y<rodY).map(y=>y+RULES.panel/2));
    if(s.rod&&shelfY.some(y=>Math.abs(y-rodY)<(RULES.panel+RULES.rodDiameter)/2))errors.push(prefix+'штанга пересекает полку. Измените высоту.');
    if (
      s.rod && rodY - support < (s.rodClearance??RULES.rodMinClear)
    )
      errors.push(
        prefix +
          `под штангой нужно ${s.rodClearance??RULES.rodMinClear} мм до полки, ящиков или дна. Измените высоту штанги или назначение проёма.`,
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
    // Кухня: фасады до 700 (в проектах Базиса цеха навесные 627–650 мм при высоте 927); шкафы — правило цеха doorMax.
    // антресоль кухни с подъёмным фасадом (петли сверху) — до ширины кухонного корпуса 1200, как в Базисе (А 975×357)
    const doorWMax = m.kitchen ? (p.hinge === "top" ? KITCHEN.maxWidth : Math.max(700, RULES.doorMax)) : p.length <= RULES.doorLowH ? RULES.doorMaxLow : RULES.doorMax;
    if (p.role === "door" && p.width > doorWMax)
      errors.push(`Фасад шире ${doorWMax} мм при высоте ${Math.round(p.length)}. Разделите модуль на секции или уберите фасады.`);
    // кухонные антресоли Базиса — фасады от 247 мм (корпус 250–400); шкафы — правило цеха doorMinH
    const doorHMin = m.kitchen ? 200 : RULES.doorMinH;
    if (p.role === "door" && p.length < doorHMin)
      errors.push(`Распашной фасад ниже ${doorHMin} мм. Увеличьте высоту корпуса или уберите фасады.`);
    if (p.role === "door" && p.material === "alu" && (p.length > ALU_EXTRAS.maxH || p.width > ALU_EXTRAS.maxW))
      errors.push(`Алюминиевый фасад ${Math.round(p.width)}×${Math.round(p.length)}: по СТП не выше ${ALU_EXTRAS.maxH} и не шире ${ALU_EXTRAS.maxW} мм. Разделите секцию или уменьшите высоту.`);
  }
  for(const p of geometry){
    const hl=handleById(facadeHandleId(m,p.id)).len;
    if(p.role!=='handle')continue;
    const facade=p.id.includes(':drawer:')?geometry.find(f=>f.id===p.id.replace(':handle',':facade')):geometry.find(f=>f.id===p.id.replace(':handle:',':door:'));
    if(!facade)continue;
    const room=p.id.includes(':drawer:')||facade.hinge==='top'?facade.size[0]:facade.size[1];
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
  return Array.from({length:count},(_,i)=>Math.round(base+clear*(i+1)+RULES.panel*i+RULES.panel/2)/h);
}
export function splitSection(m: Module, sid: string): Module {
  const next = structuredClone(m),
    i = next.sections.findIndex((s) => s.id === sid),
    s = next.sections[i];
  if (!s) return next;
  const bb=boxes(m),half=(bb[i].width-RULES.panel)/2;
  if(m.sectionLayout){splitOpening(next,sid,'x',half,id());return next;}
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
  const centers = s.shelves.map((f,j)=>({y:b.bottom+f*(b.top-b.bottom),half:s.glassShelves?.includes(j)?3:RULES.panel/2})).sort((a,b)=>a.y-b.y);
  const obstacles=s.drawers?parts(m).filter(p=>p.sectionId===sid&&(p.role==='drawer'&&p.material==='board'||p.id.endsWith(':drawer-cap'))):[];
  return [...centers, {y:b.top,half:0}].map((surface, i) => {
    let bottom = i === 0 ? b.bottom : centers[i - 1].y+centers[i - 1].half;
    const top = surface.y-surface.half;
    for(const p of obstacles){const end=p.position[1]+p.size[1]/2;if(end>bottom&&end<=top+.001)bottom=end;}
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
  const order=s.shelves.map((value,i)=>({value,i})).sort((a,b)=>a.value-b.value);
  for(const key of ['fixed','glassShelves'] as const)if(s[key])s[key]=order.flatMap((entry,j)=>s[key]!.includes(entry.i)?[j]:[]);
  s.shelves=order.map(entry=>entry.value);
  const gaps = shelfGaps(m, sid);
  if (!s.shelves.length || !gaps[index]) return;
  const j = Math.min(index, s.shelves.length - 1);
  const half=s.glassShelves?.includes(j)?3:RULES.panel/2;
  const center =
    index === s.shelves.length
      ? b.top - value - half
      : gaps[index].bottom + value + half;
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
    ...(x.corner===undefined?{}:{corner:structuredClone(x.corner) as CornerSpec}),
    ...(x.sectionLayout===undefined?{}:{sectionLayout:structuredClone(x.sectionLayout) as SectionLayout}),
    ...(x.raisedSides===undefined?{}:{raisedSides:x.raisedSides as boolean}),
    ...(x.openJunction===undefined?{}:{openJunction:x.openJunction as boolean}),
    ...(x.drawerFacadeDecor===undefined?{}:{drawerFacadeDecor:x.drawerFacadeDecor}),
    doors: x.doors,
    ...(x.backType===undefined?{}:{backType:x.backType as Module["backType"]}),
    ...(x.grooveInset===undefined?{}:{grooveInset:x.grooveInset as number}),
    ...(x.grooveDepth===undefined?{}:{grooveDepth:x.grooveDepth as number}),
    ...(x.plinthHeight===undefined?{}:{plinthHeight:x.plinthHeight as number}),
    ...(x.hingeSide===undefined?{}:{hingeSide:x.hingeSide as Module["hingeSide"]}),
    ...(x.standLight===undefined?{}:{standLight:x.standLight as boolean}),
    ...(x.handleId===undefined?{}:{handleId:x.handleId as string}),
    ...(x.drawerHandleId===undefined?{}:{drawerHandleId:x.drawerHandleId as string}),
    ...(x.cornerFiller===undefined?{}:{cornerFiller:x.cornerFiller as Module["cornerFiller"]}),
    ...(x.cornerKind===undefined?{}:{cornerKind:x.cornerKind as Module["cornerKind"]}),
    ...(x.alu===undefined?{}:{alu:{profile:String((x.alu as AluFacade)?.profile),color:String((x.alu as AluFacade)?.color),insert:String((x.alu as AluFacade)?.insert)}}),
    ...(x.topGlass===undefined?{}:{topGlass:String(x.topGlass)}),
    ...(x.feet===undefined?{}:{feet:{height:Number((x.feet as {height:number})?.height)}}),
    ...(x.bottomType===undefined?{}:{bottomType:x.bottomType as Module['bottomType']}),
    ...(x.topType===undefined?{}:{topType:x.topType as Module['topType']}),
    ...(x.rails===undefined?{}:{rails:Array.isArray(x.rails)?(x.rails as {place:string;height:number;lay?:string;setback?:number}[]).map(r=>({place:r?.place as NonNullable<Module['rails']>[number]['place'],height:Number(r?.height),...(r?.lay===undefined?{}:{lay:r.lay as 'edge'|'flat'}),...(r?.setback===undefined?{}:{setback:Number(r.setback)}),...((r as {at?:number})?.at===undefined?{}:{at:Number((r as {at?:number}).at)})})):[]}),
    ...(x.bottomUnder===undefined?{}:{bottomUnder:x.bottomUnder===true}),
    ...(x.faceGap===undefined?{}:{faceGap:Number(x.faceGap)}),
    ...(x.faceGapBetween===undefined?{}:{faceGapBetween:Number(x.faceGapBetween)}),
    ...(x.backGap===undefined?{}:{backGap:Number(x.backGap)}),
    ...(x.grooveWidth===undefined?{}:{grooveWidth:Number(x.grooveWidth)}),
    ...(x.grooveClear===undefined?{}:{grooveClear:Number(x.grooveClear)}),
    ...(x.facadeT===undefined?{}:{facadeT:Number(x.facadeT)}),
    ...(x.faceAir===undefined?{}:{faceAir:Number(x.faceAir)}),
    ...(x.shelfRear===undefined?{}:{shelfRear:Number(x.shelfRear)}),
    ...(x.shelfPinInset===undefined?{}:{shelfPinInset:Number(x.shelfPinInset)}),
    ...(x.shelfPinInsetFront===undefined?{}:{shelfPinInsetFront:Number(x.shelfPinInsetFront)}),
    ...(x.confirmatInset===undefined?{}:{confirmatInset:Number(x.confirmatInset)}),
    ...(x.noHandles===undefined?{}:{noHandles:x.noHandles===true}),
    ...(x.glassT===undefined?{}:{glassT:Number(x.glassT)}),
    ...(x.glassGap===undefined?{}:{glassGap:Number(x.glassGap)}),
    ...(x.raw===undefined?{}:(()=>{const r=parseRaw(x.raw);return r?{raw:r}:{};})()),
    ...(x.kdrawers===undefined?{}:(()=>{const k=parseKDrawers(x.kdrawers);return k?{kdrawers:k}:{};})()),
    ...(x.kitchenLift===undefined?{}:(()=>{const k=parseKitchenLift(x.kitchenLift);return k?{kitchenLift:k}:{};})()),
    ...(x.facadeMaterial===undefined?{}:{facadeMaterial:x.facadeMaterial==='external'?'external':'ldsp'}),
    ...(x.facadeEdge===undefined?{}:{facadeEdge:Number(x.facadeEdge)}),
    ...(x.edgeScheme===undefined?{}:{edgeScheme:{t:Number((x.edgeScheme as {t:number}).t),...((x.edgeScheme as {railBack?:boolean}).railBack===false?{railBack:false as const}:{}),...((x.edgeScheme as {all?:boolean}).all===true?{all:true as const}:{}),...((x.edgeScheme as {sideTop?:boolean}).sideTop===false?{sideTop:false as const}:{}),...((x.edgeScheme as {front?:number}).front!==undefined?{front:Number((x.edgeScheme as {front?:number}).front)}:{}),...(Array.isArray((x.edgeScheme as {shelf?:unknown}).shelf)?{shelf:((x.edgeScheme as {shelf:unknown[]}).shelf).map(String)}:{})}}),
    ...(x.jointFastening===undefined||typeof x.jointFastening!=='object'?{}:{jointFastening:Object.fromEntries(Object.entries(x.jointFastening as Record<string,string>).map(([k,v])=>[k,v==='eccentric'?'eccentric':'confirmat']))}),
    ...(x.dowels===undefined?{}:{dowels:{offset:Number((x.dowels as {offset:number}).offset)}}),
    ...(x.grooves===undefined?{}:{grooves:Array.isArray(x.grooves)?(x.grooves as Groove[]).filter(g=>g&&typeof g.host==='string'&&Array.isArray(g.along)&&Array.isArray(g.across)).map(g=>({host:g.host,face:g.face==='-'?'-':'+',along:[Number(g.along[0]),Number(g.along[1])],across:[Number(g.across[0]),Number(g.across[1])],depth:Number(g.depth),name:String(g.name??'Паз')})):[]}),
    ...(x.doorMount===undefined?{}:{doorMount:x.doorMount as Module['doorMount']}),
    ...(x.doorOpen===undefined?{}:{doorOpen:x.doorOpen as Module['doorOpen']}),
    ...(x.topStrip===undefined?{}:{topStrip:Number(x.topStrip)}),
    ...(x.sidePanels===undefined?{}:{sidePanels:Object.fromEntries(Object.entries(x.sidePanels as Record<string,{height:number;depth:number}>).map(([k,v])=>[k,{height:Number(v?.height),depth:Number(v?.depth)}]))}),
    ...(x.rodType===undefined?{}:{rodType:x.rodType as Module['rodType']}),
    ...(x.slope===undefined?{}:{slope:{side:(x.slope as {side:'left'|'right'})?.side,lowHeight:Number((x.slope as {lowHeight:number})?.lowHeight)}}),
    ...(x.fastening===undefined?{}:{fastening:x.fastening as Module['fastening']}),
    ...(x.hingeBrand===undefined?{}:{hingeBrand:x.hingeBrand as Module['hingeBrand']}),
    ...(x.kitchen===undefined?{}:{kitchen:(()=>{const k=x.kitchen as KitchenSpec;return {role:String(k.role) as KitchenSpec["role"],...(k.appliance?{appliance:String(k.appliance) as NonNullable<KitchenSpec["appliance"]>}:{}),...(k.plinth?{plinth:{height:Number(k.plinth.height),...(k.plinth.off?{off:true}:{}),...(k.plinth.clips===false?{clips:false}:{})}}:{}),...(k.hangers===false?{hangers:false}:{}),...(k.hinges===false?{hinges:false}:{}),...(k.noLegs?{noLegs:true}:{}),...(k.fasteners===false?{fasteners:false}:{}),...(k.plateHoles===false?{plateHoles:false}:{}),...(k.faceTop!==undefined?{faceTop:Number(k.faceTop)}:{}),...(k.eccBelow?{eccBelow:true as const}:{}),...(k.backGaps?{backGaps:{bottom:Number(k.backGaps.bottom),top:Number(k.backGaps.top)}}:{}),...(k.faceBottom!==undefined?{faceBottom:Number(k.faceBottom)}:{}),...(k.sideDown&&(k.sideDown.side==='left'||k.sideDown.side==='right')?{sideDown:{side:k.sideDown.side,y0:Number(k.sideDown.y0)}}:{}),...(k.legs?{legs:{back:Number(k.legs.back),front:Number(k.legs.front),...(k.legs.side===undefined?{}:{side:Number(k.legs.side)}),...(Array.isArray(k.legs.xs)?{xs:k.legs.xs.map(Number)}:{}),...(Array.isArray(k.legs.pts)?{pts:k.legs.pts.map(q=>[Number(q?.[0]),Number(q?.[1])] as [number,number])}:{})}}:{})};})()}),
    ...(x.worktop===undefined?{}:{worktop:(()=>{const w=x.worktop as WorktopSpec;return {material:String(w.material) as WorktopSpec["material"],thickness:Number(w.thickness),overhang:Number(w.overhang),cutouts:Array.isArray(w.cutouts)?w.cutouts.map(c=>({kind:(c?.kind==="hob"?"hob":"sink") as "sink"|"hob",x:Number(c?.x),width:Number(c?.width),depth:Number(c?.depth)})):[]};})()}),
    ...(x.kupe===undefined?{}:{kupe:(()=>{const k=x.kupe as KupeSpec;return {doors:Number(k.doors),system:String(k.system),color:String(k.color),fills:Array.isArray(k.fills)?k.fills.map(String):[],...(k.sections===undefined?{}:{sections:Number(k.sections)}),...(k.softClose?{softClose:true}:{}),...(k.film?{film:true}:{})};})()}),
    ...(x.edgeBody===undefined?{}:{edgeBody:Number(x.edgeBody) as EdgeThickness}),
    ...(x.edgeFacade===undefined?{}:{edgeFacade:Number(x.edgeFacade) as EdgeThickness}),
    ...(x.skew===undefined?{}:{skew:{side:(x.skew as {side:'left'|'right'})?.side,depth:Number((x.skew as {depth:number})?.depth)}}),
    ...(x.desk===undefined?{}:{desk:(()=>{const dk=x.desk as NonNullable<Module['desk']>;return {sides:dk.sides,apron:Number(dk.apron),
      ...(dk.apronOffset===undefined?{}:{apronOffset:Number(dk.apronOffset)}),...(dk.baseWidth===undefined?{}:{baseWidth:Number(dk.baseWidth)}),...(dk.baseX===undefined?{}:{baseX:Number(dk.baseX)}),...(dk.baseDepth===undefined?{}:{baseDepth:Number(dk.baseDepth)}),
      ...(dk.grille===undefined?{}:{grille:{x:Number(dk.grille.x),width:Number(dk.grille.width),depth:Number(dk.grille.depth)}})};})()}),
    ...(x.wallFiller===undefined?{}:{wallFiller:Object.fromEntries(Object.entries(x.wallFiller as Record<string,{kind?:string;width?:number}>).map(([k,v])=>[k,{kind:'edge' as const,width:v?.kind==='standard'||v?.width===undefined?RULES.fillerStrip:v.width}]))}),
    sections: x.sections.map((s) => ({
      id: s.id,
      weight: s.weight,
      ...(s.doorHinges===undefined?{}:{doorHinges:Array.isArray(s.doorHinges)?[...s.doorHinges]:s.doorHinges}),
      ...(s.hingeY===undefined?{}:{hingeY:Array.isArray(s.hingeY)?s.hingeY.map(Number).filter(Number.isFinite):[]}),
      ...(s.hingeYFor===undefined?{}:{hingeYFor:Number(s.hingeYFor)}),
      ...(s.hingeYUp===undefined?{}:{hingeYUp:Array.isArray(s.hingeYUp)?s.hingeYUp.map(Number).filter(Number.isFinite):[]}),
      ...(s.hingeYUpFor===undefined?{}:{hingeYUpFor:Number(s.hingeYUpFor)}),
      ...(s.doorHandles===undefined?{}:{doorHandles:Array.isArray(s.doorHandles)?[...s.doorHandles]:s.doorHandles}),
      ...(s.doorLeaves===undefined?{}:{doorLeaves:s.doorLeaves}),
      ...(s.hingeSide===undefined?{}:{hingeSide:s.hingeSide}),
      ...(s.doorSplit===undefined?{}:{doorSplit:s.doorSplit}),
      ...(s.drawerGap===undefined?{}:{drawerGap:s.drawerGap}),
      ...(s.externalDrawers===undefined?{}:{externalDrawers:s.externalDrawers}),
      ...(s.doorGap===undefined?{}:{doorGap:s.doorGap}),
      ...(s.removedDoors===undefined?{}:{removedDoors:Array.isArray(s.removedDoors)?[...s.removedDoors]:s.removedDoors}),
      shelves: [...s.shelves],
      ...(s.drawerMount===undefined?{}:{drawerMount:s.drawerMount}),
      ...(s.glassShelves===undefined?{}:{glassShelves:structuredClone(s.glassShelves)}),
      ...(s.rodClearance===undefined?{}:{rodClearance:s.rodClearance}),
      ...(s.shelfDepth===undefined?{}:{shelfDepth:s.shelfDepth}),
      drawers: s.drawers,
      rod: s.rod,
      ...(s.pantograph===undefined?{}:{pantograph:s.pantograph}),
    ...(s.pullouts===undefined?{}:{pullouts:s.pullouts}),
      ...(s.rodAt===undefined?{}:{rodAt:s.rodAt}),
      ...(s.fixed===undefined?{}:{fixed:Array.isArray(s.fixed)?[...s.fixed]:s.fixed}),
      ...(s.drawerConfigs === undefined
        ? {}
        : {
            drawerConfigs: s.drawerConfigs.map((c: DrawerConfig) => ({
              slide: c?.slide,
              ...(c?.tray===undefined?{}:{tray:c.tray}),
              ...(c?.operation===undefined?{}:{operation:c.operation}),
              ...(c?.brand===undefined?{}:{brand:c.brand}),
              height: c?.height,
              length: c?.length,
              ...(c?.handle===undefined?{}:{handle:c.handle}),
              ...(c?.handleId===undefined?{}:{handleId:c.handleId}),
                  ...(c?.y===undefined?{}:{y:c.y}),
                  ...(c?.mesh===undefined?{}:{mesh:c.mesh}),
                  ...(c?.noFacade===undefined?{}:{noFacade:c.noFacade}),
                  ...(c?.facadeH===undefined?{}:{facadeH:c.facadeH}),
            })),
          }),
    })),
  };
  if(m.corner)normalizeCorner(m);
  const errors = validate(m);
  if (errors.length) throw new Error(errors[0]);
  return m;
}

