// K2 (критик релиза 22.10, раунд 2): новый модуль или объект замера при нехватке места у стены вставал посреди комнаты
// или внутрь нижних модулей без предупреждения. Здесь — чистые проверки: стоит ли модуль у стены и где свободное место
// для объекта замера (стиральная машина, холодильник, колонна…), не внутри мебели.
import { bounds, overlap, obstacleBounds, moduleFootprint, type PlacedModule, type Project, type Room, type RoomObstacle } from "./project";
import { flatten, pointInOutline, polygonInOutline, projectToEdges } from "./roomOutline";

export const OFF_WALL_NOTE = "Нет места у стены — модуль поставлен в свободное место, передвиньте";
/** допуск «у стены»: корпус глубже 250 мм, значит за ним при зазоре ≤ 150 мм другой мебели нет (фальши, отступ 30 мм от стены) */
const WALL_TOL = 150;

/** Модуль стоит у стены: без поворота — задом к задней стене (как ряд); повёрнутый — любой стороной у стены. Столешница — всегда да. */
export function atWall(room: Room, a: PlacedModule): boolean {
  if (a.module.worktop) return true;
  const b = bounds(a), r = ((((a.rotation ?? 0) % 360) + 360) % 360);
  // контур (задача Макса 30.10.2026): без поворота — за задними углами следа (или серединой задней кромки) в пределах допуска стена
  // контура (скос, дуга — тоже стена); повёрнутый — любой угол не дальше допуска от стены
  if (room.outline) {
    const f = moduleFootprint(a), o = room.outline;
    if (r !== 0 || a.module.corner) return Math.min(...f.map((p) => projectToEdges(o, p).dist)) <= WALL_TOL;
    const back = [f[0], f[1], { x: (f[0].x + f[1].x) / 2, z: f[0].z }];
    return back.some((p) => !pointInOutline({ x: p.x, z: p.z - WALL_TOL }, o));
  }
  if (r === 0) return b.z <= WALL_TOL;
  return b.z <= WALL_TOL || b.x <= WALL_TOL || room.width - (b.x + b.w) <= WALL_TOL || room.depth - (b.z + b.d) <= WALL_TOL;
}

/** Предупреждение для добавленных модулей (ids), если хоть один встал не у стены; null — все у стены. */
export function offWallNote(p: Project, ids: readonly string[]): string | null {
  const off = p.modules.filter((a) => ids.includes(a.id) && !atWall(p.room, a));
  if (!off.length) return null;
  return OFF_WALL_NOTE.replace("модуль", off.length === 1 ? `модуль «${off[0].module.name}»` : `модули (${off.map((a) => "«" + a.module.name + "»").join(", ")})`) + ".";
}

/** Объекты замера, которые ставятся на пол у стены и не должны вставать внутрь мебели. Вытяжка, варочная панель и балка — по-старому
 *  (они по смыслу над/в мебели). */
const FLOOR_TYPES: RoomObstacle["type"][] = ["column", "fridge", "washer", "stove", "dishwasher", "radiator"];

/** Свободное место для нового объекта замера o (x, z — исходное предложение): у задней стены ближе к середине, затем у боковых стен,
 *  у передней, затем любое свободное место на полу. Занято — корпуса (габариты с фасадами) и другие объекты замера, по высоте тоже
 *  (машина под навесными — можно). Места нет — исходное положение (проверка расстановки покажет пересечение). */
export function freeObstacleSpot(room: Room, modules: readonly PlacedModule[], o: RoomObstacle): { x: number; z: number } {
  if (!FLOOR_TYPES.includes(o.type)) return { x: o.x, z: o.z };
  const occupied = [...modules.map(bounds), ...(room.obstacles ?? []).filter((x) => x.id !== o.id).map(obstacleBounds)];
  const W = room.width, D = room.depth, w = o.width, d = o.depth;
  const poly = room.outline ? flatten(room.outline) : null; // контур (30.10.2026): объект — внутри стен, не в срезанном углу
  const free = (x: number, z: number) => x >= 0 && z >= 0 && x + w <= W + 0.1 && z + d <= D + 0.1 && !occupied.some((b) => overlap({ x, y: o.y, z, w, h: o.height, d }, b))
    && (!poly || polygonInOutline([{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }], poly));
  const cx = Math.round((W - w) / 2), cz = Math.round((D - d) / 2);
  const edgesX = [cx, 0, W - w, ...occupied.flatMap((b) => [b.x + b.w, b.x - w])].map(Math.round);
  const edgesZ = [0, D - d, ...occupied.flatMap((b) => [b.z + b.d, b.z - d])].map(Math.round);
  const uniq = (v: number[]) => [...new Set(v)];
  const near = (v: number[], c: number) => uniq(v).sort((a, b) => Math.abs(a - c) - Math.abs(b - c) || a - b);
  // 1) у задней стены, ближе к середине
  for (const x of near(edgesX, cx)) if (free(x, 0)) return { x, z: 0 };
  // 2) у левой и правой стены, ближе к задней стене
  for (const z of near(edgesZ, 0)) for (const x of [0, W - w]) if (free(x, z)) return { x, z };
  // 3) у передней стены
  for (const x of near(edgesX, cx)) if (free(x, D - d)) return { x, z: D - d };
  // 4) любое свободное место на полу (сетка 50 мм от середины)
  for (const z of near([...edgesZ, ...Array.from({ length: Math.floor(D / 50) + 1 }, (_, i) => i * 50)], cz))
    for (const x of near([...edgesX, ...Array.from({ length: Math.floor(W / 50) + 1 }, (_, i) => i * 50)], cx)) if (free(x, z)) return { x, z };
  return { x: o.x, z: o.z };
}
