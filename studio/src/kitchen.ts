// Кухня в ГардерЁбе (основа 08.10.2026; конструктив по проектам Базиса цеха — разбор базы кухонь цеха 09.10.2026).
// Кухонный корпус — обычный модуль студии с пометкой kitchen (нижний, навесной, пенал, антресоль): наполнение, фасады, петли,
// смета и раскрой работают как у шкафов. Здесь — только кухонное: регламенты, опоры с клипсами и цоколем, навесы, ниши техники,
// столешница как отдельный объект и шаблоны для палитры.
// Источник чисел: 30 кухонь, 372 модуля Базиса (Кухни\etalon\archetypes.md, отчёты разведки 09.10.2026). Оси Базиса = оси студии
// (X вправо, Y вверх, фасады на +Z), проверено снимком на кухне 2777.
import type { GolaCut, Module, Part } from "./model";
import { setEdges, edgeDirs } from "./edges";
import { axisLayout } from "./kitchenDrawers";
import type { KitchenRafix, RafixGrid } from "./kitchenRafix";

export type KitchenRole = "base" | "wall" | "tall" | "antresol";
export type ApplianceKind = "sink" | "oven" | "microwave" | "dishwasher" | "hob" | "hood" | "fridge";
export type KitchenSpec = { role: KitchenRole; appliance?: ApplianceKind;
  /** Цоколь модуля: высота (Базис 95, на 5 мм ниже дна) и есть ли он у этого модуля (сплошной цоколь ряда — у крайнего). */
  plinth?: { height: number; off?: boolean; clips?: boolean;
    /** Корпус без опор (цоколь — деталь самого модуля): отступ цоколя от переда корпуса, если не RULES.plinthInset 2 (Базис k20 m09: 16). */
    inset?: number };
  /** Корпус приподнят без опор, и в модуле Базиса под дном есть фронтальная панель ЛДСП (цоколь/планка под другим именем) —
   *  студия ставит «Цоколь» по высоте подъёма. Без флага у кухни такого цоколя нет (у навесного фасад свисает ниже дна). */
  lowFront?: boolean;
  /** Низ навесного без опор (Базис): дно поднято на plinthHeight, стандартного цоколя нет. front — фронтальная панель ЛДСП под дном
   *  (в Базисе «Фронтальная», «ФП» — закрывает низ, как цоколь) с утопанием от лица боковин; без front панели нет.
   *  doorsToFloor — фасады опущены до низа модуля (корпус поднят, фасад закрывает подсветку: k23, k28, k30). */
  raise?: { front?: number; doorsToFloor?: boolean };
  /** Дно короче спереди на столько мм (Базис k06, k10, k15: 24,5 — ниша под подсветку у лица навесного); по умолчанию 0. */
  bottomFront?: number;
  /** Дно короче сзади (Базис: навесной под вытяжку, дно перед ХДФ — k08 m10, k04, k13, k14: 20). */
  bottomBack?: number;
  /** Крыша короче сзади (Базис k33, k34: 20 — крыша перед ХДФ, ХДФ проходит за ней); backTopGap — ХДФ в паз до верха модуля минус столько мм (k33/k34: 1). */
  topBack?: number;
  backTopGap?: number;
  /** Набивной ХДФ с разными отступами [снизу, сверху] от низа и верха корпуса (Базис k32 m06: 2 и 4 при боковых 1,5). */
  backGapY?: [number, number];
  /** Модуль без дна (сушка k34 m04): ХДФ от низа модуля плюс столько мм (k34: 1). */
  backBottomGap?: number;
  /** Вырезы в обоих верхних углах ХДФ (Базис k33, k34: 25×45 — ХДФ проходит за крышей): ширина по X, высота от верха ХДФ. */
  backNotch?: { width: number; height: number };
  /** Стыки дна/крыши без крепежа в проекте Базиса («bottom:left» и т. п., k08 m10, k14 m06) — студия крепёж не ставит. */
  jointNone?: string[];
  /** Крепёж стыков дна/крыши с боковинами по Базису: ключ «bottom:left» и т. п. → [от задней кромки, от передней кромки детали], мм. */
  jointZ?: Record<string, [number, number]>;
  // Крепёж стяжки на ребре по Базису (конфирматы через боковины и через крышу/дно) — в самой стяжке: Module.rails[].confY и topConf
  // (одно правило для нижних, навесных и антресолей; слияние n4-base, n4-wall).
  /** Стяжка на дне навесного на эксцентриках и шкантах снизу по Базису (n4-wall; k04 m08, k31): ключ — место стяжки; ecc и dowel —
   *  мм от левого конца стяжки; face — пласть стяжки с бочонком D15×12 (front — к фасаду, back — к стене). */
  railUnder?: Record<string, { ecc: number[]; dowel: number[]; face: "front" | "back" }>;
  /** В проекте Базиса у модуля нет крепежа корпуса (конфирматов, эксцентриков, шкантов) — студия его не добавляет (n3-wall, n3-antresol). */
  noFasteners?: boolean;
  /** Сушка навесного — элементы с сеткой Базиса (набор SU01/03: держатели, решётки, поддоны): x — от боковины side, y — от низа, z — от задней кромки. */
  dryer?: { name: string; /** сетка библиотеки Базиса; нет — у Базиса элемент без геометрии (k01, k02, k06, k08): точка и строка спецификации */ mesh?: string; side: "left" | "right"; x: number; y: number; z: number; quat: [number, number, number, number] }[];
  /** Имя крепежа корпуса по проекту Базиса, если это не «Конфирмат 7х50» (k33, k34: «Евровинт 6х50») — в деталях и смете. */
  confirmatName?: string;
  /** Глубина присадки по проекту Базиса, если она не типовая: confirmat — D5 в торец (обычно 35; k33/k34 «Евровинт 6х50» — 36), pin — D5 под полкодержатель (обычно 12; k33/k34 — 9). */
  drill?: { confirmat?: number; pin?: number };
  /** Присадка эксцентрика по проекту Базиса, если не типовая (k33/k34 «Стяжка Макмарт Ø15»): глубина бочонка D15 (13 вместо 12),
   *  шток [D, глубина] ([7, 28] вместо [8, 34]), в стойку D5 (9 вместо 12), шкант в стойку D8 (11 вместо 12);
   *  bottomOut — бочонок дна с наружной (нижней) пласти; topOut — бочонок крыши с наружной (верхней) пласти (k07, n4-wall). */
  ecc?: { barrel?: number; stem?: [number, number]; side?: number; dowelSide?: number; bottomOut?: boolean; topOut?: boolean };
  /** Вырез в заднем верхнем углу боковины навесного/антресоли (Базис k32: 100×20 — контур боковины из 6 точек): height — от верха, depth — от задней кромки. */
  sideNotch?: Partial<Record<"left" | "right", { height: number; depth: number }>>;
  /** Навесы ABS L/R: по умолчанию есть у навесных и антресолей; false — навешивание иначе (планка, шина, ранние проекты без навесов);
   *  true у пенала — пенал на навесах, как в проекте Базиса (k23 m04, k18 m21). */
  hangers?: boolean;
  /** Положение навесов, как в проекте Базиса (если не по правилу 15 ниже верха / 20 от задней кромки / на внутренней грани боковины):
   *  [ниже верха боковины, от задней кромки, внутрь от внутренней грани боковины], мм — по каждой стороне. Отрицательное «ниже верха» —
   *  навес выше корпуса (так стоит в части проектов Базиса; отверстий в боковине тогда нет, как и у Базиса). */
  hangerAt?: { left: [number, number, number]; right: [number, number, number]; caps?: { left: [number, number, number]; right: [number, number, number] } };
  /** Набивной ХДФ стоит с зазором от задней кромки корпуса, мм (k01 m14, k01 m10 — 2, так в проекте Базиса). Без поля — вплотную. */
  backAir?: number;
  /** Служебные сквозные отверстия, как в проекте Базиса (k28 m14: D10 под провод в боковине и дне): точка входа, направление внутрь
   *  детали, диаметр, глубина. В смету не идут (у Базиса это служебная запись). */
  svcHoles?: { at: [number, number, number]; dir: [number, number, number]; d: number; depth: number }[];
  /** Стяжка соседних модулей в Gola (Базис «5»: служебная запись + сквозное D5 на толщину боковины; по всей базе 23 боковины
   *  в k10, k15, k17, k30, k21, k31 — все в остром верхнем углу среднего выреза Gola: на его верхней кромке, в глубине выреза от переднего торца;
   *  у соседа — встречное, винт стягивает боковины за профилем C). Стороны — по проекту Базиса (в k06, k21 m03, k23, k27, k31 НМ
   *  стяжек нет), значение — направление сверления по X (+1 — с левой пласти). depth — от переднего торца боковины, если не равна
   *  глубине выреза (k17: 27 при вырезе 26). Без поля — нет. */
  golaTies?: { left?: 1 | -1; right?: 1 | -1; depth?: number };
  /** Глухие фасады рядом с ящиками — без петель, направляющих и короба, как в проекте Базиса (k29 m03: фасад 102–593 под двумя
   *  ящиками Axis). Низ и верх от пола модуля, ширина и вынос — как у фасадов ящиков. Без поля — нет. */
  blindFronts?: { y0: number; y1: number }[];
  /** Конфирматы стяжки с соседним корпусом, как в проекте Базиса (k15 m12): изнутри через боковину наружу — сторона, высота,
   *  от задней кромки боковин. Без поля их нет. */
  outConf?: { side: "left" | "right"; y: number; z: number }[];
  /** Точки крепления крепежа, чьё отверстие и в проекте Базиса вскрывает паз подсветки (k31, k28 m12): только это пересечение
   *  подписывается «как в проекте Базиса» (collisions.ts). Ставит импорт по двойнику в Базисе (compare.ts grooveTwins). */
  grooveHoles?: [number, number, number][];
  /** Модуль распознан из проекта Базиса: смета — только то, что есть в Базисе (без норматива «мелочёвка корпуса» и заглушек
   *  под конфирматы — в проектах Базиса цеха их нет ни в одном модуле). */
  bazis?: boolean;
  /** Дно под боковинами на эксцентриках (Базис k16, k28, k31; jointFastening bottom:left/right = eccentric): отступы стяжек
   *  от задней и передней кромки дна, мм (у Базиса несимметрично: сзади на 20 больше — за пазом ХДФ). */
  underEcc?: { back: number; front: number };
  /** ХДФ в пазу: зазор до дна паза снизу и сверху, мм, как в проекте Базиса (k28 m10: 2,5 и 1); без поля — grooveClear с обеих сторон. */
  backClearY?: [number, number];
  /** Глубина отверстия D5 конфирмата в торце второй детали, как в проекте Базиса (по умолчанию 35; k11 — 37, k31 — 42). */
  confDepth?: number;
  /** Опоры: отступы рядов от задней и передней кромки боковин и позиции по ширине (по умолчанию 70/70 от краёв дна, как в Базисе). */
  legs?: { back: number; front: number; side?: number; xs?: number[];
    /** Площадка опоры на 4 самореза 3×3 по квадрату 31×31 (Базис «3x3» у опор: k21, k24 — 6 модулей из 174 с опорами). */
    screws?: true;
    /** Левые опоры — той же сетки и поворота, что правые (часть проектов Базиса: k26, k27). */
    same?: true;
    /** Два ряда без третьего посередине и шире 1300 (широкие модули Базиса: мойка k28 m17 1480, остров k30 m01 1324): ряды — по
     *  отступу side от торцов, поэтому правые опоры идут за боковиной при смене ширины. */
    rows2?: true;
    /** Нерегулярная раскладка Базиса (17 модулей 10 кухонь: не сетка «ряды × перед/зад»): точки [x, z от задней кромки боковин]. */
    pts?: [number, number][] };
  /** Крепёж корпуса: по умолчанию «Конфирмат 7×50»; euro-6x50 — «Евровинт 6х50» (шаблоны «Т_» k33, k34: D8×16 + D5×36). */
  screw?: "euro-6x50";
  /** Как в Базисе — ничего сверх проекта (правило Макса): false — фасады без петель (15 модулей 12 кухонь Базиса: фасад есть, петель нет,
   *  студия строит ровно те же фасады). Флаг модуля: дверь, добавленная потом в студии, тоже будет без петель — см. KitchenPanel. */
  hinges?: false;
  /** Корпус без опор (33 модуля 13 кухонь Базиса: дно на полу или на своём цоколе) — не ошибка для кухни из Базиса. */
  noLegs?: true;
  /** Гвозди набивного ХДФ по Базису (11 навесных/антресолей k01, k03): ряды по периметру в 7,5 от края, round(W/125) и round(H/125)
   *  гвоздей (см. scripts/kitchen/recognize-nails.ts); q — поворот сетки по рядам, mesh — сетка Базиса. Нет — студия гвоздей не ставит. */
  nails?: { mesh?: string; q: Record<"bottom" | "top" | "left" | "right", [number, number, number, number]> };
  /** Ручка распашного фасада по проекту Базиса (k07, k09: 36 ручек «рейлинг 128/160»): горизонтальная — по центру ширины,
   *  вертикальная — у свободного края; dy — от низа (from "bottom") или верха фасада до точки ручки на лицевой плоскости.
   *  holes — отверстия под ручку, если они есть в проекте (k07: 2 × D5×18 насквозь, межосевое 160; у k09 отверстий нет).
   *  name — ручка Базиса: в смете строкой Базиса «bazis:ручка:<name>» (не ручкой студии сверху неё); mesh, quat — сетка библиотеки
   *  и поворот Базиса [w,x,y,z] в точке ручки; size — габарит сетки в её осях [вдоль, поперёк, вылет] (n4-wall). */
  handle?: { dy: number; from: "bottom" | "top"; horizontal: boolean; holes?: { d: number; depth: number; gap: number };
    name?: string; mesh?: string; quat?: [number, number, number, number]; size?: [number, number, number] };
  /** false — без крепежа (конфирматы, эксцентрики, шканты, полкодержатели): в проекте Базиса его нет (только k32 — 22 модуля). */
  fasteners?: false;
  /** Дно под одной боковиной, другая опущена (8 модулей 5 кухонь Базиса): до низа дна (y0 = низ дна, k22 m01) или до пола (y0 = 10, k06 m01 —
   *  торцевая боковина закрывает опоры). Действует только с дном под боковинами (bottomUnder). */
  sideDown?: { side: "left" | "right"; y0: number };
  /** «8x45» Базиса в нижнем торце опущенной боковины: отступы от задней кромки (только если они есть в проекте; k05 m01). */
  sideScrews?: number[];
  /** false — у петель нет наколок D3×3 под планку, только чашка Ø35 (26 модулей 11 кухонь Базиса). */
  plateHoles?: false;
  /** Нижний на опорах: зазор верха фасадов от верха боковин и низа фасадов от низа дна, если не равен faceGap (k18 m03: 3 и 1,5 при 2; n3-base).
   *  faceBottom у корпуса без опор — низ фасадов от пола, мм, как в Базисе (над нишей под техникой — от дна; n3-tall). */
  faceTop?: number; faceBottom?: number;
  /** Угловая мойка Базиса с фальшпанелью (n4-base): у края модуля в плоскости фасадов — фальш ЛДСП корпуса width мм (от низа дна до верха),
   *  рядом планка из фасадного материала strip мм; фасады — после них через faceGap, дверь у фальша на «Петля под фальшпанель»
   *  (точка — кромка двери, чашка в 22 от кромки, без наколок под планку). Только плоский фальш (k25 m02, k01 m03); Г-образный — нет. */
  faceFiller?: { side: "left" | "right"; width: number; strip?: number; /** планка по высоте фальша, а не фасадов (k28 m17) */ stripFull?: true;
    /** конфирматы через фальш, если они есть в проекте (k01 m03): bottom — в передний торец дна, x от края модуля со стороны фальша;
     *  side — в передний торец боковины, y от низа фальша. Нет поля — фальш без крепежа (k25 m02, k28 m17 — как в Базисе) */
    conf?: { bottom?: number[]; side?: number[] } };
  /** Накладной ХДФ: зазоры снизу и сверху, если не равны боковому backGap (24 модуля 13 кухонь Базиса; k32 m06: 2 и 4 при 1,5). */
  backGaps?: { bottom: number; top: number };
  /** Эксцентрик дна сверлится снизу (бочонок в нижней пласти): 56 из 380 эксцентриков дна Базиса, флаг — на 12 модулях 10 кухонь. */
  eccBelow?: true;
  /** Рафиксы жёстких полок по сетке Базиса (kitchenRafix.ts); без поля — жёсткие полки на конфирматах/эксцентриках, как у шкафов. */
  rafix?: KitchenRafix;
  /** Точек крепежа на стык дна/крыши со стойкой (2 или 3); без поля — по правилу kitchenJointPoints. */
  jointPoints?: 2 | 3;
  /** Жёсткие полки (номера секции 1), у которых в Базисе нет крепежа к стойкам: студия его не добавляет. */
  bareShelves?: number[];
  /** Низ корпуса приподнят без опор, а панели под дном (цоколя — детали, закрывающей низ) в Базисе нет: открытая ниша под техникой
   *  или зазор. Студия не рисует цоколь под дном (правило шкафов «низ без ножек — цоколь» к такой кухне не применяется). */
  bareBottom?: true;
  /** Дно/крыша, у которых в Базисе нет крепежа к стойкам (ни конфирмата, ни эксцентрика, ни шканта): студия его не добавляет. */
  bareJoints?: ("bottom" | "top")[];
  /** Крепёж стыков со стойками по сетке Базиса, если она не как у модуля (отступы от заднего/переднего торца, штук на сторону):
   *  ключ — bottom, top или shelf:N (жёсткая полка секции 1). Пример: k23 — у крыши 104,5/64,5, у дна 64,5/64,5. */
  joints?: Record<string, RafixGrid>;
  /** Дубли Базиса: фурнитура (опора, конфирмат), которая в проекте Базиса стоит дважды в одной точке (k16 m01 — две опоры,
   *  k23 m14 — два конфирмата полки). Повторяем Базис: id детали студии, у которой есть второй экземпляр — в 3D и смете их столько же,
   *  сколько в Базисе; отверстие одно (второй раз то же отверстие не сверлится). Нет детали с таким id (после правки) — дубль не ставится. */
  dupParts?: string[];
  /** Фигурный контур Базиса в плане у горизонтальной детали (id детали → точки [x, z] от её заднего левого угла): вырез под вентиляцию
   *  в дне пенала (k23 m15/m16). Ставится, только если габарит контура совпадает с деталью; после смены размера — прямоугольник. */
  planContours?: Record<string, [number, number][]>;
  /** ХДФ в пазу только от жёсткой полки (номер в секции 1) до верха: пенал под холодильник (k25 m10), ниже полки — ниша без задника.
   *  Низ ХДФ — низ полки плюс зазор паза (grooveClear), как в Базисе. Работает вместе с topBack/backTopGap и bottomBack. */
  backFromShelf?: number };

/** Своя сетка крепежа стыка горизонтали (bottom/top/жёсткая полка) кухни Базиса; undefined — по общему правилу. */
export function kitchenJointGrid(m: Module, hid: string): RafixGrid | undefined {
  const j = m.kitchen?.joints; if (!j) return undefined;
  const key = hid === "bottom" || hid === "top" ? hid : hid.includes(":shelf:") && hid.startsWith(m.sections[0]?.id + ":") ? "shelf:" + hid.split(":shelf:")[1] : undefined;
  return key ? j[key] : undefined;
}

/** Точек крепежа на стык горизонтали кухни со стойкой — одно правило на все стыки (слияние n4-base и n4-tall):
 *  1) узкий стык (глубина joint до KITCHEN.narrowJoint, 120) в корпусе глубже него больше чем на narrowJoint — 1 точка посередине
 *     (Базис: 402 из 422 таких стыков с крепежом; мелкий корпус целиком, k08 m07 80–100 мм, — по п. 2);
 *  2) дно и крыша (bottomTop): свой счёт модуля из Базиса (kitchen.jointPoints), иначе 3 точки (третья посередине глубины) глубже
 *     KITCHEN.deepBottom (600) — 21 из 25 глубоких модулей Базиса с крепежом, до 600 — 2 (523 из 528); depth — корпус (по умолчанию)
 *     или дно под боковинами (9 из 9 днищ глубже 600 — по 3, ровно 600 k30 m03 — по 2): один порог на «глубокое дно» и «глубокий корпус»;
 *  3) остальные горизонтали — 2. Шкаф студии — всегда 2 (правила Базиса — только для кухонь). */
export function kitchenJointPoints(m: Module, depth = m.depth, joint?: number, bottomTop = true): 1 | 2 | 3 {
  if (!m.kitchen) return 2;
  if (joint !== undefined && joint <= KITCHEN.narrowJoint && m.depth - joint > KITCHEN.narrowJoint) return 1;
  if (!bottomTop) return 2;
  return m.kitchen.jointPoints ?? jointPointsRule(depth);
}
/** Правило кухни без своего счёта из Базиса: глубже KITCHEN.deepBottom (600) — 3 точки, иначе 2. */
export const jointPointsRule = (depth: number): 2 | 3 => (depth > KITCHEN.deepBottom ? 3 : 2);
export type WorktopCutout = { kind: "sink" | "hob"; x: number; width: number; depth: number };
export type WorktopSpec = { material: "postforming" | "ldsp" | "stone"; thickness: number; overhang: number; cutouts: WorktopCutout[] };

/** Регламенты кухни по проектам Базиса цеха, мм. */
export const KITCHEN = {
  legs: 100,            // «Опора кухонная регулируемая H100-120, чёрная» — 1 197 шт. в базе; дно на высоте 100
  legInset: 70,         // опоры в 70 мм от краёв дна по ширине и глубине (340 из 1 196 — самый частый вариант)
  legPad: 58,           // площадка опоры (сетка Базиса ±29): ряды опор ближе 58 мм пересекаются
  clipReach: 29,        // клипса цоколя выступает от оси опоры к цоколю на 29 (сетка «Клипса для ПВХ цоколя»: X −10,9..+29 к цоколю)
  plinthHeight: 95,     // цоколь ЛДСП 16, на 5 мм ниже дна
  baseBody: 720,        // нижний корпус без опор (15 модулей; 740–840 — под клиента)
  baseHeight: 820,      // нижний модуль вместе с опорами, без столешницы
  baseDepth: 557,       // боковина нижнего; с накладным ХДФ 3 — 560
  worktopThickness: 38, // СКИФ 38
  worktopDepth: 600,    // от стены
  worktopOverhang: 24,  // свес над фасадом 21–24
  wallHeight: 920,      // навесной: 600–1110, чаще 920–1040
  wallDepth: 330,       // 34 модуля из ~120; 300–400
  wallGap: 600,         // от столешницы до низа навесных — 600 у 13 из 27 кухонь (462–737)
  wallGapMin: 450,
  hoodGapMin: 650,
  railWidth: 100,       // царги низа 100 лёжа (у части кухонь базы — 80)
  hangerDown: 15,       // навес: 15 мм ниже верха боковины
  hangerBack: 20,       // и 20 мм от задней кромки (лицевая плоскость ХДФ в пазу)
  faceGap: 1.5,         // фасад W−3 × H−3: отступ 1,5 от кромок (75 из 92 низов, 118 из 144 верхов)
  faceGapBetween: 3,    // зазор между фасадами 3
  backGap: 1.5,         // накладной ХДФ низа (W−3)×(H−3)
  groove: { inset: 16, width: 4, depth: 8, clear: 1 }, // П16-4×8, ХДФ (W−18)×(H−18), заходит на 7
  deepBottom: 600,      // дно под боковинами ГЛУБЖЕ 600 (602–700) — 3 конфирмата на сторону (третий посередине): 9 из 9 днищ Базиса; ровно 600 (k30 m03) и мельче — 2
  narrowJoint: 120,     // стык горизонтали глубиной до 120 — одна точка крепежа посередине (Базис: 402 из 468 таких стыков)
  minWidth: 150, maxWidth: 1200,
  maxModuleWidth: 1650, // предел ширины кухонного модуля в проверке: самый широкий модуль 34 кухонь Базиса — 1649 (шкафы — RULES.maxW 1300)
  maxHeight: 2900,      // пеналы в Базисе до 2869 (k30 m15), 2850 (k31 m05), 2820 (k27); у шкафов студии лимит RULES.maxH 2500 не меняется
} as const;

/** Техника: размеры ниши/корпуса по паспортам типовых встраиваемых моделей (ширина × высота × глубина, мм). */
export const APPLIANCES: Record<ApplianceKind, { label: string; niche: [number, number, number]; widths: number[] }> = {
  sink: { label: "Мойка", niche: [0, 0, 0], widths: [450, 500, 600, 800] },
  oven: { label: "Духовой шкаф", niche: [560, 595, 550], widths: [600] },
  microwave: { label: "Встраиваемая СВЧ", niche: [560, 380, 550], widths: [600] },
  dishwasher: { label: "Посудомоечная машина", niche: [450, 820, 560], widths: [450, 600] },
  hob: { label: "Варочная панель", niche: [560, 50, 490], widths: [450, 600, 800] },
  hood: { label: "Вытяжка встраиваемая", niche: [560, 180, 280], widths: [600] },
  fridge: { label: "Встраиваемый холодильник", niche: [560, 1780, 550], widths: [600] },
};

/** Модели фурнитуры Базиса (TriData → GLB, studio/public/models/hardware/bazis). Заполняется по manifest.json библиотеки.
 *  quat — поворот локальных осей фурнитуры Базиса в оси модуля (w, x, y, z). */
export const KITCHEN_MODELS: Partial<Record<"leg" | "clip" | "leg-left" | "clip-left" | "hanger-left" | "hanger-right" | "hanger-cap-left" | "hanger-cap-right", { file: string; mirror?: boolean }>> = {
  leg: { file: "hardware/bazis/ac675db9fc57.glb" },                // Опора кухонная регулируемая H100-120, чёрная (1 197 шт. в базе)
  clip: { file: "hardware/bazis/0d12888fb9df.glb" },               // Клипса для ПВХ цоколя, чёрная (611)
  // левые опоры в Базисе — своя сетка и поворот на 180° вокруг вертикали (эталоны: 287 из 340 левых, правые — 343 из 349 ac675;
  // по n3-wardrobes2: 283 из 336 левых опор, 141 из 167 левых клипс по 34 кухням); клипса левой опоры — зеркальная сетка
  // (X −29..10,9), поэтому в осях модуля она так же выступает к цоколю
  "leg-left": { file: "hardware/bazis/cb84c30b57a5.glb" },
  "clip-left": { file: "hardware/bazis/7ebcad9fda10.glb" },
  "hanger-left": { file: "hardware/bazis/95a815598b07.glb" },      // Навес мебельный регулируемый ABS левый
  "hanger-right": { file: "hardware/bazis/b8339a249124.glb" },     // … правый (своя сетка Базиса, Z −23..0 — без зеркала)
  "hanger-cap-left": { file: "hardware/bazis/ca74b45576fa.glb" },  // Заглушка для мебельного навеса ABS левая
  "hanger-cap-right": { file: "hardware/bazis/19a5dd31bc40.glb" }, // … правая
};

export const isKitchen = (m: Module) => !!m.kitchen;
export const kitchenRole = (m: Module) => m.kitchen?.role;

/** Опоры нижнего модуля: в 70 мм от краёв дна; узкие (< 250) — по центру ширины, широкие (> 1300) — третий ряд посередине. */
export function kitchenLegs(m: Module): { x: number; z: number; front: boolean }[] {
  const w = m.width, d = m.depth, a = KITCHEN.legInset, L = m.kitchen?.legs;
  if (L?.pts?.length) return L.pts.map(([x, z]) => ({ x, z, front: z > d / 2 })); // как в Базисе, точка в точку
  // отступ от торцов (side) — относительный, переживает изменение ширины; xs — абсолютные позиции нестандартной раскладки
  // узкий (< 250) — один ряд по центру, если отступ от торцов не задан явно (Базис k05 m02: 200 мм, ряды в 70 от торцов) или ряды
  // легли бы внахлёст (площадка опоры 58: Базис k16 m07 — 150 мм, опоры на 70 и 80 пересекаются; студия так не ставит)
  const s = L?.side ?? a, narrow = w < 250 && (L?.side === undefined || w - 2 * s < KITCHEN.legPad);
  const xs = L?.xs ?? (narrow ? [w / 2] : w > 1300 && !L?.rows2 ? [s, w / 2, w - s] : [s, w - s]);
  return xs.flatMap((x) => [{ x, z: L?.back ?? a, front: false }, { x, z: d - (L?.front ?? a), front: true }]);
}

// Повороты осей фурнитуры Базиса в оси модуля (проверено по корпусу: опора — Z вниз, клипса — X к цоколю; навес — X к стене, Y вверх,
// Z внутрь корпуса). Кватернион [w, x, y, z].
const Q_LEG: [number, number, number, number] = [0.5, 0.5, -0.5, 0.5];      // X→+Z, Y→−X, Z→−Y
const Q_LEG_LEFT: [number, number, number, number] = [0.5, 0.5, 0.5, -0.5]; // левые опора и клипса Базиса: X→−Z, Y→+X, Z→−Y (k04 m01: x = 70)
const Q_HANGER: [number, number, number, number] = [Math.SQRT1_2, 0, Math.SQRT1_2, 0]; // X→−Z, Y→+Y, Z→+X (оба навеса)
/** Площадка опоры: 4 точки крепления по квадрату 31×31 вокруг оси (те же, что отверстия D4×3 под опору). */
export const LEG_SCREWS: [number, number][] = [[-15.5, -15.5], [15.5, -15.5], [-15.5, 15.5], [15.5, 15.5]];

/** Кухня из Базиса — ничего сверх проекта: без петель (hinges: false) снимаем петли и толкатели фасадов, без крепежа (fasteners: false) —
 *  конфирматы, эксцентрики, шканты и полкодержатели. Присадка и смета идут по деталям, поэтому лишнего нет и там. */
export function kitchenStrip(m: Module, out: Part[]) {
  const k = m.kitchen; if (!k || (k.hinges !== false && k.fasteners !== false && !k.noFasteners)) return;
  const drop = (p: Part) => (k.hinges === false && /:(hingecup|hingeplate|hingearm|latch):/.test(p.id)) || (k.fasteners === false && /^(fast|ecc|dowel|shp):/.test(p.id))
    // Базис без крепежа корпуса (n3-wall: k32 целиком, отдельные модули k33, k34) — конфирматы, эксцентрики, шканты
    || (!!k.noFasteners && /^(fast|ecc|dowel):/.test(p.id));
  for (let i = out.length - 1; i >= 0; i--) if (drop(out[i])) out.splice(i, 1);
}
/** Единичный кватернион: в эталоне Базиса компоненты округлены до 0,01 (0,71 вместо √½, |q|² = 1,0082) — без нормировки сетка растянута на ~0,8 %. */
export function unitQuat(q: [number, number, number, number]): [number, number, number, number] {
  const n = Math.hypot(...q);
  return n > 1e-9 ? (q.map((v) => v / n) as [number, number, number, number]) : [1, 0, 0, 0];
}

/** Список «Фурнитура модуля» в панели кухни: имя → штук. Без выреза под мойку и служебных отверстий Базиса (kitchen-svc — точка
 *  привязки сквозного отверстия, не изделие: в смету не идёт, в список фурнитуры тоже). */
export function hardwareRows(list: Part[]): [string, number][] {
  const map = new Map<string, number>();
  for (const p of list) if (p.material === "metal" && (p.role === "fastener" || p.role === "hinge" || p.role === "handle") && !p.id.startsWith("worktop-cut") && !p.id.startsWith("kitchen-svc:") && !p.id.startsWith("kitchen-tie:")) map.set(p.name, (map.get(p.name) ?? 0) + 1);
  return [...map].sort((a, b) => b[1] - a[1]);
}

/** Детали, которые кухонный корпус добавляет к обычному: опоры с клипсами и цоколь (нижний, пенал), навесы (навесной, антресоль). */
/** Ряды гвоздей набивного ХДФ по Базису (в осях ХДФ: x от левого края, y от низа), см. kitchen.nails. */
export function nailRows(W: number, H: number): { bottom: number[]; top: number[]; left: number[]; right: number[] } {
  const row = (n: number, a: number, b: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));
  const nh = Math.round(W / 125), nv = Math.round(H / 125);
  return { bottom: row(nh, 23, W - 23), top: row(nh, 23, W - 23), left: row(nv, 8, H - 8), right: row(nv, 8, H - 8) };
}

export function kitchenExtraParts(m: Module, out: Part[]) {
  const k = m.kitchen; if (!k) return;
  kitchenStrip(m, out);
  const t = 16;
  const metal = (id: string, name: string, size: Part["size"], position: Part["position"], model?: Part["model"]): Part =>
    ({ id, name, size, position, length: Math.max(...size), width: [...size].sort((a, b) => b - a)[1], thickness: Math.min(...size), role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0], ...(model ? { model } : {}) });
  if ((k.role === "base" || k.role === "tall") && m.feet) {
    const H = m.feet.height;
    for (const [n, l] of kitchenLegs(m).entries()) {
      // Опора: ось вниз от нижней грани дна, площадка 4×D4 по квадрату 31×31; модель Базиса ±29 × 0..100 по оси.
      // левая половина модуля — левая опора Базиса (своя сетка и поворот), центр и правая — правая (n3-runners); клипса левой опоры —
      // зеркальная сетка Базиса 7ebcad9fda10 с тем же поворотом (n3-additions: 140 из 164 левых клипс 34 кухонь)
      const left = !k.legs?.same && l.x < m.width / 2 - 0.01, lm = left ? KITCHEN_MODELS["leg-left"] : KITCHEN_MODELS.leg, q = left ? Q_LEG_LEFT : Q_LEG;
      out.push(metal(`leg:${n}`, "Опора кухонная регулируемая H100-120, чёрная", [58, H, 58], [l.x, H / 2, l.z], lm ? { file: lm.file, length: "y", native: true, origin: [l.x, H, l.z], quat: q } : undefined));
      // саморезы площадки опоры — только если они есть в проекте Базиса (legs.screws): точка — на нижней пласти дна, тело — в отверстии 3×3 дна
      if (k.legs?.screws) LEG_SCREWS.forEach(([dx, dz], j) => { const s = metal(`kitchen-leg-screw:${n}:${j}`, "Саморез 3×3 (площадка опоры)", [3, 3, 3], [l.x + dx, H + 1.5, l.z + dz]); s.anchor = [l.x + dx, H, l.z + dz]; out.push(s); });
      // клипсы на передних опорах — и когда цоколь у ряда, а не у модуля; нет только при clips: false
      if (l.front && k.plinth?.clips !== false) {
        const cm = left ? KITCHEN_MODELS["clip-left"] : KITCHEN_MODELS.clip;
        // Клипса для ПВХ цоколя: на передней опоре, 45–52 мм ниже дна, от −10,9 до +29 к цоколю.
        out.push(metal(`kitchen-clip:${n}`, "Клипса для ПВХ цоколя, чёрная", [32.3, 7, 39.9], [l.x, H - 49, l.z + 9.07], cm ? { file: cm.file, length: "y", native: true, origin: [l.x, H, l.z], quat: q } : undefined));
      }
    }
    // опущенная до пола боковина (sideDown): в её нижнем торце «8x45» Базиса — D8×45 по оси боковины (sideScrews — отступы от задней
    // кромки, только если они есть в проекте Базиса: k05 m01, k06 m01, k15 m06 — 50 от задней и передней; n4-tall)
    if (k.sideDown && k.sideScrews?.length) {
      const x = k.sideDown.side === "left" ? t / 2 : m.width - t / 2, y = k.sideDown.y0;
      k.sideScrews.forEach((z, j) => { const s = metal(`kitchen-side-screw:${k.sideDown!.side}:${j}`, "8x45", [8, 45, 8], [x, y + 22.5, z]); s.anchor = [x, y, z]; out.push(s); });
    }
    if (!k.plinth?.off) {
      const ph = k.plinth?.height ?? KITCHEN.plinthHeight, zb = m.depth - (k.legs?.front ?? KITCHEN.legInset) + KITCHEN.clipReach;
      // Цоколь ЛДСП 16 на клипсах передних опор: задняя грань — по выступу клипсы, на 5 мм ниже дна.
      out.push({ id: "kitchen-plinth", name: `Цоколь ${ph} ЛДСП 16 (на клипсах)`, size: [m.width, ph, t], position: [m.width / 2, ph / 2, zb + t / 2], length: m.width, width: ph, thickness: t, role: "body", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [2, 0, 0, 0] });
    }
  }
  // гвозди набивного ХДФ — только если они есть в проекте Базиса (kitchen.nails), точка — на тыльной пласти ХДФ
  const nb = k.nails ? out.find((p) => p.id === "back" && p.material === "hdf" && !p.taper) : undefined;
  if (k.nails && nb) {
    const W = nb.size[0], H = nb.size[1], x0 = nb.position[0] - W / 2, y0 = nb.position[1] - H / 2, z = nb.position[2] - nb.size[2] / 2;
    const r = nailRows(W, H), q = k.nails.q, pts: [number, number, [number, number, number, number]][] = [
      ...r.bottom.map((x) => [x, 7.5, q.bottom] as [number, number, [number, number, number, number]]), ...r.top.map((x) => [x, H - 7.5, q.top] as [number, number, [number, number, number, number]]),
      ...r.left.map((y) => [7.5, y, q.left] as [number, number, [number, number, number, number]]), ...r.right.map((y) => [W - 7.5, y, q.right] as [number, number, [number, number, number, number]])];
    pts.forEach(([x, y, qq], n) => {
      const o: [number, number, number] = [x0 + x, y0 + y, z];
      const p = metal(`nail:${n}`, "Гвоздь", [0.01, 0.01, 0.01], o, k.nails!.mesh ? { file: `hardware/bazis/${k.nails!.mesh}.glb`, length: "y", native: true, origin: o, quat: unitQuat(qq) } : undefined);
      p.anchor = o; out.push(p);
    });
  }
  // служебные отверстия Базиса (kitchen.svcHoles): точка входа — привязка «прочего» для сверки; отверстие даёт drilling.ts
  for (const [n, h] of (k.svcHoles ?? []).entries()) { const p = metal(`kitchen-svc:${n}`, `Отверстие D${h.d} сквозное (как в проекте Базиса)`, [0.01, 0.01, 0.01], [...h.at]); p.anchor = [...h.at]; out.push(p); }
  // сушка (Базис): элементы по сетке библиотеки фурнитуры, в точке и с поворотом проекта; в раскрой не идут
  for (const [n, d] of (k.dryer ?? []).entries()) {
    const o: [number, number, number] = [d.side === "left" ? d.x : m.width - d.x, d.y, d.z];
    out.push(metal(`kitchen-dryer:${n}`, d.name, [0.01, 0.01, 0.01], o, // габарит сетки неизвестен — точка привязки, геометрия из GLB
       d.mesh ? { file: `hardware/bazis/${d.mesh}.glb`, length: "y", native: true, origin: o, quat: unitQuat(d.quat) } : undefined)); // без сетки — как в Базисе: только точка
  }
  // пенал на навесах — только если они есть в проекте Базиса (hangers: true, k23 m04, k18 m21; n4-tall)
  if (((k.role === "wall" || k.role === "antresol") && k.hangers !== false) || (k.role === "tall" && k.hangers === true)) {
    for (const side of ["left", "right"] as const) {
      // Навес ABS регулируемый: начало координат — 15 мм ниже верха боковины, 20 мм от её задней кромки, на внутренней грани;
      // сетка Базиса: −64..+20 к стене, −42..−1 по высоте, 0..23 внутрь корпуса.
      const dir = side === "left" ? 1 : -1, at = k.hangerAt?.[side], ca = k.hangerAt?.caps?.[side] ?? at;
      const pt = (a: [number, number, number] | undefined): [number, number, number] => [(side === "left" ? t : m.width - t) + dir * (a?.[2] ?? 0), m.height - (a?.[0] ?? KITCHEN.hangerDown), a?.[1] ?? KITCHEN.hangerBack];
      const [fx, oy, oz] = pt(at), [cx, cy, cz] = pt(ca);
      // Оси навеса в модуле: X→−Z (−64..+20 → z 84..0, задний крюк заподлицо с задней кромкой), Y→+Y, Z→+X (правый навес Базиса — Z −23..0, внутрь).
      const hm = KITCHEN_MODELS[side === "left" ? "hanger-left" : "hanger-right"], cm = KITCHEN_MODELS[side === "left" ? "hanger-cap-left" : "hanger-cap-right"];
      out.push(metal(`kitchen-hanger:${side}`, `Навес мебельный регулируемый ABS ${side === "left" ? "левый" : "правый"}`, [23, 41, 84], [fx + dir * 11.5, oy - 21.5, oz + 22],
        hm ? { file: hm.file, length: "y", native: true, origin: [fx, oy, oz], quat: Q_HANGER } : undefined));
      // Заглушка навеса (комплект с навесом): −65..0 по X, −44..−1 по высоте, 0..26 внутрь.
      out.push(metal(`kitchen-hanger-cap:${side}`, `Заглушка навеса ABS ${side === "left" ? "левая" : "правая"}`, [26, 43, 65], [cx + dir * 13, cy - 22.5, cz + 32.5],
        cm ? { file: cm.file, length: "y", native: true, origin: [cx, cy, cz], quat: Q_HANGER } : undefined));
    }
  }
}

/** Кромка кухни по проектам Базиса цеха (k25, k16, k14): кромятся только открытые торцы, скрытые — без кромки; толщина — своя у кухни
 *  (1 или 0,5 мм ПВХ в цвет). Боковины низа — верх и перед; навесных — все четыре; дно под боковинами — перед и концы; дно и крыша между
 *  боковинами — перед и зад; царги — обе длинные; полки — все четыре; ХДФ и фасады — без кромки (фасады — фасадный материал). */
export function kitchenEdges(m: Module, out: Part[]) {
  // кухня Базиса без кромки вовсе (k23 — 15 модулей: ни одной кромки на деталях корпуса) — снимаем кромку студии по умолчанию
  // и двери из ЛДСП корпуса там тоже без кромки (k23: 8 из 8 дверей ЛДСП без кромки, n4-tall); фасадный материал — своей кромкой (facadeEdge)
  if (m.kitchen && m.edgeScheme?.t === 0) for (const p of out) if (p.material === "board" && !p.external && (p.role !== "door" || p.id.includes(":door:")) && !p.id.endsWith(":facade")) p.edge = [0, 0, 0, 0];
  // фальш угловой мойки (kitchen.faceFiller) — ЛДСП корпуса, кромка корпуса по кругу (k25 m02: 1, k01 m03 и k28 m17: 0,5)
  const ffp = out.find((p) => p.id === "face-filler:panel:facade");
  if (ffp && m.edgeScheme?.t !== undefined) setEdges(ffp, edgeDirs(ffp), m.edgeScheme.t);
  const t = m.edgeScheme?.t; if (!t || !m.kitchen) { golaSides(m, out); rearNotches(m, out); return; } // вырезы Gola и задних углов — и без схемы кромки
  const wall = m.kitchen.role === "wall" || m.kitchen.role === "antresol", tall = m.kitchen.role === "tall";
  // торцы дна/крыши у боковин — кромятся, если так в проекте Базиса (k32 — оба, k31 m13 — только дно; edgeScheme.endsX, n3-antresol);
  // свои списки торцов дна/крыши навесного (edgeScheme.ends, n3-wall) — главнее
  const en = m.edgeScheme?.endsX, endsB = en === true || en === "bottom" ? ["+x", "-x"] : [], endsT = en === true || en === "top" ? ["+x", "-x"] : [];
  // фиксированная полка на эксцентриках (пенал k12 m04, k30 m05): торцы у боковин закрыты — кромка только перед и зад;
  // фикс. полка на другом крепеже (k16 m01, P8–P14) — по кругу, как съёмная
  const ecc = (id: string) => m.jointFastening?.[`${id}:left`] === "eccentric" || m.jointFastening?.[`${id}:right`] === "eccentric";
  // edgeScheme.fixedEnds === false — у всех жёстких полок торцы у боковин без кромки, как в проекте Базиса (k13 m02, на конфирматах; n3-antresol)
  const fixedIds = new Set(m.sections.flatMap((s) => (s.fixed ?? []).map((j) => `${s.id}:shelf:${j}`)).filter((id) => ecc(id) || m.edgeScheme?.fixedEnds === false));
  const fixedAll = new Set(m.sections.flatMap((s) => (s.fixed ?? []).map((j) => `${s.id}:shelf:${j}`)));
  for (const p of out) {
    if (p.material !== "board" || p.role === "door" || p.id.endsWith(":facade")) continue;
    // кухня Базиса с кромкой по кругу (k11, k32): все четыре торца каждой детали корпуса
    if (m.edgeScheme?.all) { setEdges(p, edgeDirs(p), t); continue; }
    // задние торцы кромятся, только если задник в пазу (у набивного ХДФ они закрыты)
    const rear = m.backType === "groove" || m.backType === "none" || m.edgeScheme?.rear ? ["-z"] : [];
    // у навесных задние торцы кромятся при пазе; у нижних без задника (мойка) — тоже открыты и кромятся;
    // edgeScheme.rear — задние торцы кромятся и при набивном ХДФ, как в проекте Базиса (k31 m03/m04, n3-antresol)
    const rearBase = m.backType === "none" || m.edgeScheme?.rear ? ["-z"] : [];
    const ends = (p.id === "bottom" || p.id === "top") ? m.edgeScheme?.ends?.[p.id] : undefined, own = m.edgeScheme?.parts?.[p.id];
    if (own) setEdges(p, own, m.edgeScheme?.partsT?.[p.id] ?? t); // торцы детали и их кромка — как в проекте Базиса (k32 низ: по кругу; k31 m07: стяжка 0,5)
    else if (ends) setEdges(p, ends, t); // торцы дна/крыши — как в проекте Базиса (k32 — по кругу)
    // опущенная боковина (sideDown, k22 m01): нижний торец открыт снизу — кромится
    else if (p.id === "left" || p.id === "right") setEdges(p, wall ? ["+y", "-y", "+z", ...rear] : [...(m.edgeScheme?.sideTop === false ? [] : ["+y"]), "+z", ...rearBase, ...(m.kitchen.sideDown?.side === p.id ? ["-y"] : [])], t);
    // дно под боковинами без кромки по торцам (underEnds, k28); торцы дна/крыши между боковинами у боковин (endsX, k31 m13) — n3-antresol
    else if (p.id === "bottom") setEdges(p, m.bottomUnder ? ["+z", ...(m.edgeScheme?.underEnds === false ? [] : ["+x", "-x"]), ...(wall ? rear : rearBase)] : ["+z", ...rear, ...endsB], t);
    else if (p.id === "top") setEdges(p, tall ? ["+z", "-z", ...endsT] : ["+z", ...rear, ...endsT], t); // пенал: крыша видна сверху — кромка перед и зад (Базис k12 m04, k30 m05)
    // торцы жёсткой полки по проекту Базиса (fixedSides) главнее правила «перед и зад» (k25 m10: только перед, n4-tall)
    else if (p.role === "shelf" && fixedIds.has(p.id)) setEdges(p, m.edgeScheme?.fixedSides ?? ["+z", "-z"], t);
    else if (p.role === "shelf" && m.edgeScheme?.fixedSides && fixedAll.has(p.id)) setEdges(p, m.edgeScheme.fixedSides, t); // жёсткая полка навесного — торцы как в Базисе (k05: перед и зад)
    else if (p.id.startsWith("rail:")) setEdges(p, p.size[1] <= 16.01 ? (m.edgeScheme?.railBack === false && p.position[2] - p.size[2] / 2 < 0.5 ? ["+z"] : ["+z", "-z"]) : ["+y", "-y"], t);
    else if (p.role === "shelf") setEdges(p, m.edgeScheme?.shelfSides ?? m.edgeScheme?.shelf ?? ["+x", "-x", "+z", "-z"], m.edgeScheme?.shelfT ?? t); // съёмная полка: по кругу или по Базису (shelfSides / shelf), толщина корпуса — если Базис не задал иначе
    else if (p.id === "kitchen-plinth") setEdges(p, ["+y", "-y"], t); // цоколь: кромка по верхнему и нижнему торцу (у пола в Базисе ±y)
    else if (p.id.startsWith("kd:") && p.id.includes(":fx:")) setEdges(p, p.id.includes(":fx:side:") ? ["+y", "-y", "-z"] : p.id.endsWith(":bottom") ? ["-z"] : ["+y"], t); // короб Firmax (Базис): боковины ±y и задний торец, задняя/фальшпанель — верх, дно — задний торец
    else if (p.id.startsWith("kd:") && /:(bottom|back)$/.test(p.id) && m.kdrawers?.[Number(p.id.split(":")[1])]?.system === "indigo") setEdges(p, p.id.endsWith(":back") ? ["+y", "-y"] : ["+z", "-z"], t); // Indigo (Базис k16): задняя стенка ±y, дно перед и зад
    else if (p.id.startsWith("kd:") && /:(bottom|back)$/.test(p.id) && m.kdrawers?.[Number(p.id.split(":")[1])]?.system === "start-sc") {
      // ящик СТАРТ (Базис k17/k21/k27): дно без кромки (4 проекта из 5), задняя стенка по кругу, у SB08 — по ±y
      const k = m.kdrawers[Number(p.id.split(":")[1])] as { sb?: string; edge?: { bottom?: boolean; back?: "y" | "all" } }, back = p.id.endsWith(":back");
      if (!back) { if (k.edge?.bottom) setEdges(p, ["+x", "-x", "+z", "-z"], t); else continue; }
      else setEdges(p, (k.edge?.back ?? (k.sb === "SB08" ? "y" : "all")) === "y" ? ["+y", "-y"] : ["+x", "-x", "+y", "-y"], t);
    }
    else if (p.id.startsWith("kd:") && p.id.endsWith(":back")) setEdges(p, ["+x", "-x", "+y", "-y"], t); // задняя стенка ящика Axis PRO — по кругу; дно — без кромки
    else if (p.id.startsWith("kd:") && p.id.endsWith(":bottom")) {
      // дно Axis PRO с кромкой, если так в проекте Базиса (kdrawers[i].edge.bottom: k18/k30 по кругу, k05/k29 задний торец)
      const eb = (m.kdrawers?.[Number(p.id.split(":")[1])] as { edge?: { bottom?: true | string[] } } | undefined)?.edge?.bottom;
      if (eb) setEdges(p, eb === true ? ["+x", "-x", "+z", "-z"] : eb, t);
    }
    else if (p.id.startsWith("kd:")) continue;
    else if (p.role === "body") setEdges(p, ["+z"], t);
  }
  // передние торцы корпуса толще остальных (k29: 2 при 0,5) — у кромленого «+z» деталей корпуса, выходящих на перед (задняя царга — нет; без ящиков)
  const fr = m.edgeScheme?.front;
  if (fr) for (const p of out) if (p.material === "board" && p.role !== "door" && !p.id.endsWith(":facade") && !p.id.startsWith("kd:") && p.position[2] + p.size[2] / 2 >= m.depth - 1) { const dirs = edgeDirs(p); p.edge = p.edge.map((e, i) => (e > 0 && dirs[i] === "+z" ? fr : e)) as Part["edge"]; }
  golaSides(m, out);
  rearNotches(m, out);
}

/** Вырез в заднем верхнем углу боковин навесного/антресоли (Базис k32: 100×20). Раскрой — по габариту; кромка по контуру
 *  (отрезки выреза кромятся, сумма по сторонам равна стороне — как у Базиса 310 + 20 = 330); пересечения — по телу без выреза. */
export function rearNotches(m: Module, out: Part[]) {
  const wallish = !!m.kitchen && (m.kitchen.role === "wall" || m.kitchen.role === "antresol");
  // ХДФ с вырезами в верхних углах (k33, k34): раскрой — по габариту, пересечения — по телу без углов
  const bn = wallish ? m.kitchen!.backNotch : undefined, bp = bn ? out.find((p) => p.id === "back" && p.material === "hdf") : undefined;
  if (bn && bp && bn.width > 0 && bn.height > 0 && 2 * bn.width < bp.size[0] && bn.height < bp.size[1]) {
    bp.topNotches = { width: bn.width, height: bn.height };
    const [w, h] = bp.size, [x, y, z] = bp.position;
    bp.collide = [{ size: [w, h - bn.height, bp.size[2]], position: [x, y - bn.height / 2, z] }, { size: [w - 2 * bn.width, bn.height, bp.size[2]], position: [x, y + h / 2 - bn.height / 2, z] }];
  }
  const sn = wallish ? m.kitchen!.sideNotch : undefined;
  if (!sn) return;
  for (const p of out) {
    if (p.id !== "left" && p.id !== "right") continue;
    const n = sn[p.id], H = p.size[1], D = p.size[2];
    if (!n || !(n.height > 0 && n.height < H && n.depth > 0 && n.depth < D)) continue;
    p.rearNotch = { height: n.height, depth: n.depth };
    const x = p.position[0], y0 = p.position[1] - H / 2, z0 = p.position[2] - D / 2;
    p.collide = [{ size: [p.size[0], H - n.height, D], position: [x, y0 + (H - n.height) / 2, z0 + D / 2] },
      { size: [p.size[0], n.height, D - n.depth], position: [x, y0 + H - n.height / 2, z0 + n.depth + (D - n.depth) / 2] }];
  }
}

/** Gola по Базису (k06/m03 и др.): вырезы в переднем торце боковин нижнего модуля. Кромка идёт отрезками контура:
 *  перед = высота боковины − длины вырезов, верх = глубина − глубина верхнего (открытого) выреза; торцы самих вырезов не кромятся. */
export function golaSides(m: Module, out: Part[]) {
  const cuts = m.kitchen && (m.kitchen.role === "base" || m.kitchen.role === "tall") ? m.gola?.cuts : undefined; // навесные — без Gola
  if (!cuts?.length) return;
  for (const p of out) {
    if (p.id !== "left" && p.id !== "right") continue;
    const H = p.size[1], D = p.size[2];
    // вырез только в одной боковине (GolaCut.side, k30 m12: средний — только в правой, k30 m14: в правой вырезов нет вовсе)
    const ok = cuts.filter((c) => (!c.side || c.side === p.id) && c.top1 > c.top0 && c.top1 <= H && c.depth > 0 && c.depth < D);
    if (!ok.length) continue;
    p.golaCuts = ok.map((c) => ({ ...c }));
    let front = H - ok.reduce((s, c) => s + (c.top1 - c.top0), 0), top = D - Math.max(0, ...ok.filter((c) => c.top0 <= 0.01).map((c) => c.depth)), under = 0;
    // кромка по самому вырезу (k15, k17 и др.): стенка выреза и дуга скругления — к переднему торцу, дно выреза — к верхнему,
    // верхняя стенка среднего выреза — к нижнему (−y); у среднего с острым верхним углом (sharpTop) — одна дуга, верх во всю глубину
    for (const c of ok) {
      const open = c.top0 <= 0.01, L = c.top1 - c.top0, one = open || c.sharpTop;
      if (c.edged) { front += one ? L - c.r + Math.PI * c.r / 2 : L - 2 * c.r + Math.PI * c.r; top += c.depth - c.r; }
      if (!open && (c.edged || c.edgedTop)) under += c.sharpTop ? c.depth : c.depth - c.r;
    }
    // −y: нижний торец во всю глубину (если он кромится) + верхние стенки средних вырезов; gola.bareBottom — только стенки (k10)
    if (under > 0 && !m.gola?.bareBottom) under += D;
    p.edgeLen = { "+z": Math.round(front * 10) / 10, "+y": Math.round(top * 10) / 10, ...(under > 0 ? { "-y": Math.round(under * 10) / 10 } : {}) };
    // проверка пересечений — по телу боковины без вырезов: задняя часть во всю высоту + передняя полоса между вырезами
    const y0 = p.position[1] - H / 2, z0 = p.position[2] - D / 2, zf = z0 + D, dz = Math.max(...ok.map((c) => c.depth)), x = p.position[0];
    const col: NonNullable<Part["collide"]> = [{ size: [p.size[0], H, D - dz], position: [x, y0 + H / 2, z0 + (D - dz) / 2] }];
    const spans = ok.map((c) => [y0 + H - c.top1, y0 + H - c.top0]).sort((a, b) => a[0] - b[0]);
    let ya = y0;
    for (const [s0, s1] of [...spans, [y0 + H, y0 + H]]) { if (s0 - ya > 0.01) col.push({ size: [p.size[0], s0 - ya, dz], position: [x, (ya + s0) / 2, zf - dz / 2] }); ya = Math.max(ya, s1); }
    p.collide = col;
  }
  out.push(...golaTieParts(m, out));
  // профили Gola (алюминий, вне раскроя): верхний вырез — профиль L, средний — C; по ширине модуля в вырезах боковин; вырез только
  // в одной боковине — профиль упирается в пласть другой (не пересекает её)
  const sL = out.find((p) => p.id === "left"), sR = out.find((p) => p.id === "right"), side0 = [sL, sR].find((p) => p?.golaCuts);
  if (!side0) return;
  const H = side0.size[1], y0 = side0.position[1] - H / 2, zf = side0.position[2] + side0.size[2] / 2;
  const has = (p: Part | undefined, c: GolaCut) => !!p?.golaCuts?.some((g) => g.top0 === c.top0 && g.top1 === c.top1);
  for (const [k, c] of cuts.filter((c) => has(sL, c) || has(sR, c)).entries()) {
    const L = c.top0 <= 0.01, h = c.top1 - c.top0, yc = y0 + H - (c.top0 + c.top1) / 2;
    const xa = has(sL, c) || !sL ? 0 : sL.position[0] + sL.size[0] / 2, xb = has(sR, c) || !sR ? m.width : sR.position[0] - sR.size[0] / 2, w = xb - xa;
    out.push({ id: `gola:${L ? "L" : "C"}:${k}`, name: `Профиль Gola ${L ? "L (верхний)" : "C (средний)"}, алюминий`, size: [w, h, c.depth], position: [(xa + xb) / 2, yc, zf - c.depth / 2],
      length: w, width: h, thickness: c.depth, material: "alu", decor: "", role: "fastener", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0], external: true,
      look: { color: 0xc4c8cc, metalness: 0.85, roughness: 0.35 } });
  }
}

/** Точка стяжки соседних модулей в Gola (kitchen.golaTies): угол верхнего среднего выреза боковины — его верхняя кромка по высоте,
 *  глубина выреза (или golaTies.depth) от переднего торца; по X — пласть, с которой сверлит Базис. Нет среднего выреза — нет точки. */
export function golaTiePoint(m: Module, side: Part): [number, number, number] | null {
  const dir = m.kitchen?.golaTies?.[side.id as "left" | "right"], c = [...(side.golaCuts ?? [])].filter((g) => g.top0 > 0.01).sort((a, b) => a.top0 - b.top0)[0];
  if (!dir || !c) return null;
  const x = side.position[0] - (dir * side.size[0]) / 2, y = side.position[1] + side.size[1] / 2 - c.top0, z = side.position[2] + side.size[2] / 2 - (m.kitchen!.golaTies!.depth ?? c.depth);
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(z * 100) / 100];
}

/** Стяжки соседних модулей в Gola — точка привязки «5» Базиса для сверки (служебная, в смету и список фурнитуры не идёт, как kitchen-svc);
 *  отверстие D5 на толщину боковины даёт drilling.ts. Только кухня из Базиса с golaTies (правило 2: студия не добавляет). */
function golaTieParts(m: Module, out: Part[]): Part[] {
  if (!m.kitchen?.golaTies) return [];
  const res: Part[] = [];
  for (const s of out) {
    if (s.id !== "left" && s.id !== "right") continue;
    const o = golaTiePoint(m, s);
    if (o) res.push({ id: `kitchen-tie:${s.id}`, name: "Стяжка соседнего модуля D5 в Gola (как в проекте Базиса)", size: [0.01, 0.01, 0.01], position: [...o], anchor: [...o], length: 0.01, width: 0.01, thickness: 0.01, role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] });
  }
  return res;
}

/** Столешница — отдельный объект над нижними корпусами: в раскрой ЛДСП не идёт (кроме ЛДСП 32), цена за погонный метр. */
export function worktopParts(m: Module): Part[] {
  const w = m.worktop!, T = w.thickness, out: Part[] = [];
  out.push({ id: "worktop", name: `Столешница ${worktopLabel(w)} ${T} мм`, size: [m.width, T, m.depth], position: [m.width / 2, T / 2, m.depth / 2], length: m.width, width: m.depth, thickness: T, role: "body", material: "board", decor: m.decor, grain: "length", grainAxis: 0, edge: [0, 0, 2, 0], external: w.material !== "ldsp" });
  for (const [i, c] of w.cutouts.entries())
    out.push({ id: `worktop-cut:${i}`, name: c.kind === "sink" ? "Вырез под мойку" : "Вырез под варочную панель", size: [c.width, T + 2, c.depth], position: [c.x + c.width / 2, T / 2, m.depth / 2], length: c.width, width: c.depth, thickness: T, role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0], external: true });
  return out;
}
export function worktopLabel(w: WorktopSpec) { return { postforming: "постформинг", ldsp: "ЛДСП 16+16", stone: "искусственный камень" }[w.material]; }

export function kitchenErrors(m: Module): string[] {
  const e: string[] = [];
  if (m.worktop) {
    const w = m.worktop;
    if (!["postforming", "ldsp", "stone"].includes(w.material)) e.push("Столешница: материал из списка.");
    if (!Number.isFinite(w.thickness) || w.thickness < 12 || w.thickness > 60) e.push("Столешница: толщина 12–60 мм.");
    if (m.width < 200 || m.width > 4100) e.push("Столешница: длина 200–4100 мм (длиннее — со стыком).");
    for (const c of w.cutouts) if (c.x < 50 || c.x + c.width > m.width - 50 || c.depth > m.depth - 80) e.push("Столешница: вырез не ближе 50 мм к торцам и 40 мм к кромкам.");
  }
  if (m.kitchen) {
    const k = m.kitchen;
    if (!["base", "wall", "tall", "antresol"].includes(k.role)) e.push("Кухня: тип корпуса — нижний, навесной, пенал или антресоль.");
    if (k.appliance && !(k.appliance in APPLIANCES)) e.push("Кухня: неизвестная техника.");
    // без опор — у кухни из Базиса (noLegs) или при явном низе (plinthHeight): в Базисе мойки и корпуса без опор бывают
    // (k21 m02, k33/k34 — корпус на полу или подиуме; 33 модуля 13 кухонь — дно на полу или на своём цоколе)
    if ((k.role === "base") && !m.feet && !k.noLegs && m.plinthHeight === undefined) e.push("Нижний кухонный корпус ставится на опоры.");
    if (k.jointZ && Object.values(k.jointZ).some((v) => !Array.isArray(v) || v.length !== 2 || v.some((x) => !Number.isFinite(x) || x < 5 || x > m.depth / 2 + 50))) e.push("Крепёж стыка: отступы от кромок 5 мм — до середины глубины.");
    if (k.bottomFront !== undefined && (!Number.isFinite(k.bottomFront) || k.bottomFront < 0 || k.bottomFront > 100)) e.push("Дно короче спереди: 0–100 мм.");
    if (k.bottomBack !== undefined && (!Number.isFinite(k.bottomBack) || k.bottomBack < 0 || k.bottomBack > 120)) e.push("Дно короче сзади: 0–120 мм.");
    if (k.topBack !== undefined && (!Number.isFinite(k.topBack) || k.topBack < 0 || k.topBack > 120)) e.push("Крыша короче сзади: 0–120 мм.");
    if (k.backTopGap !== undefined && (!Number.isFinite(k.backTopGap) || k.backTopGap < 0 || k.backTopGap > 20)) e.push("Зазор ХДФ до верха: 0–20 мм.");
    if (k.raise && (m.feet || (k.raise.front !== undefined && (!Number.isFinite(k.raise.front) || k.raise.front < 0 || k.raise.front > m.depth - 16)))) e.push("Подъём дна навесного: без опор, панель под дном в пределах глубины корпуса.");
    if (k.plinth && (!Number.isFinite(k.plinth.height) || k.plinth.height < 50 || k.plinth.height > (m.feet?.height ?? 200))) e.push("Цоколь кухни: высота 50 мм — до высоты опор.");
  }
  return e;
}

/** Общий кухонный вид корпуса по Базису: фасады 1,5 / 3, ХДФ накладной (W−3)×(H−3) или в паз П16-4×8. */
const look = (m: Module): Module => ({ ...m, faceGap: KITCHEN.faceGap, faceGapBetween: KITCHEN.faceGapBetween, backGap: KITCHEN.backGap,
  // Базис цеха: фасад вплотную к корпусу (воздух 0), конфирматы в 64 мм от концов стыка, полка в 1 мм от задника, полкодержатели в 60 от кромок полки
  faceAir: 0, confirmatInset: 64, shelfRear: 1, shelfPinInset: 60, edgeScheme: { t: 1 } });

/** Нижний модуль (Базис «Нижний модуль (Пустой)»): дно под боковинами на опорах 100, крыши нет, две царги 100 лёжа заподлицо с верхом,
 *  ХДФ накладной; мойка — без задника, царги на ребре (передняя 60, задняя 100 — как 2777); духовка — без задника и царг. */
export function kitchenBase(base: Module, width: number, kind: "doors" | "drawers" | "sink" | "oven" | "dishwasher" = "doors"): Module {
  const m: Module = look({ ...structuredClone(base), name: { doors: "Нижний кухонный", drawers: "Нижний с ящиками", sink: "Под мойку", oven: "Под духовой шкаф", dishwasher: "Посудомойка" }[kind], width, height: KITCHEN.baseHeight, depth: KITCHEN.baseDepth, feet: { height: KITCHEN.legs }, plinthHeight: undefined, topType: "none", bottomUnder: true, backType: kind === "sink" || kind === "oven" ? "none" : "nailed", doors: kind === "doors" || kind === "sink", kitchen: { role: "base", ...(kind === "sink" || kind === "oven" || kind === "dishwasher" ? { appliance: kind } : {}) } });
  m.rails = kind === "oven" ? [] : kind === "sink"
    ? [{ place: "front-top", height: 60 }, { place: "rear-top", height: 100 }]
    : [{ place: "front-top", height: KITCHEN.railWidth, lay: "flat" }, { place: "rear-top", height: KITCHEN.railWidth, lay: "flat" }];
  // полка: в 1 мм от задника и в 1,5 от лица корпуса (k25 «НМ600»)
  m.sections = [{ ...m.sections[0], shelves: kind === "doors" ? [0.5] : [], drawers: 0, rod: false, shelfDepth: m.depth - 2.5 }];
  // ящики — Axis PRO по Базису (дно и задняя стенка ЛДСП, металлические царги), три фасада: нижний крупнее
  if (kind === "drawers") { m.doors = false; m.kdrawers = axisLayout(m, 3); }
  return m;
}
/** Навесной (Базис «ВМ (Стенка в паз)»): дно и крыша между боковинами, ХДФ в паз П16-4×8, навесы ABS L/R. */
export function kitchenWall(base: Module, width: number): Module {
  const g = KITCHEN.groove;
  const m: Module = look({ ...structuredClone(base), name: "Навесной кухонный", width, height: KITCHEN.wallHeight, depth: KITCHEN.wallDepth, feet: undefined, plinthHeight: 0, topType: "panel", backType: "groove", grooveInset: g.inset, grooveWidth: g.width, grooveDepth: g.depth, grooveClear: g.clear, doors: true, kitchen: { role: "wall" } });
  // полка: W−34, в 21 мм от задней кромки (за ХДФ в пазу) и в 1 мм от лица корпуса
  m.sections = [{ ...m.sections[0], shelves: [0.5], drawers: 0, rod: false, shelfDepth: m.depth - 22 }];
  return m;
}
export function kitchenWorktop(base: Module, width: number): Module {
  return { ...structuredClone(base), name: "Столешница", width, height: KITCHEN.worktopThickness, depth: KITCHEN.worktopDepth, doors: false, feet: undefined, plinthHeight: 0, backType: "none", worktop: { material: "postforming", thickness: KITCHEN.worktopThickness, overhang: KITCHEN.worktopOverhang, cutouts: [] } };
}

/** Ширины нижних корпусов прямой кухни по длине стены: ящики 600 у начала, мойка 800, дальше распашные 600; остаток — в последний корпус. */
export function kitchenRowWidths(length: number): { width: number; kind: "doors" | "drawers" | "sink" }[] {
  const out: { width: number; kind: "doors" | "drawers" | "sink" }[] = [];
  let rest = Math.round(length);
  if (rest >= 1400) { out.push({ width: 600, kind: "drawers" }); rest -= 600; }
  if (rest >= 1100) { out.push({ width: 800, kind: "sink" }); rest -= 800; }
  while (rest > 0) {
    if (rest <= KITCHEN.maxWidth && (rest < 900 || out.length === 0)) { out.push({ width: rest, kind: "doors" }); rest = 0; break; }
    out.push({ width: 600, kind: "doors" }); rest -= 600;
  }
  // остаток уже 300 мм — прибавить к предыдущему корпусу (до 1200), иначе оставить узким
  const last = out[out.length - 1], prev = out[out.length - 2];
  if (last && prev && last.width < 300 && prev.width + last.width <= KITCHEN.maxWidth) { prev.width += last.width; out.pop(); }
  return out;
}
