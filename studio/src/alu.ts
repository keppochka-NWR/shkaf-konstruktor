// Алюминиевые рамочные фасады. Источник: «Расчет алюм.фасад рам.xls» цеха (бланк заказа, прайс профилей МВМ за хлыст 6 м,
// припуски по профилям, комментарии) и справочник закупочных цен АТБ 01.01.2026 (вставки).
// Расчёт по бланку цеха: профиль ₽/м × периметр + вставка ₽/м² × площадь фасада + уплотнитель 13 ₽/м × периметр
// + соединительная фурнитура 80 ₽/фасад + отверстия под петли (40 ₽, в узком профиле 150 ₽) + отверстие под ручку 70 ₽.
export type AluProfile = { id: string; label: string; face: number; allowance: number; narrow: boolean; colors: { id: string; label: string; perM: number; source: string }[] };
const mvm = "Прайс МВМ, хлыст 6 м (бланк цеха)";
export const ALU_PROFILES: AluProfile[] = [
  { id: "F1-09", label: "F1-09 · узкая рамка 19 мм", face: 19, allowance: 29, narrow: true, colors: [
    { id: "silver", label: "серебро", perM: 447.17, source: mvm },
    { id: "white", label: "белый", perM: 554.67, source: mvm },
    { id: "black", label: "чёрный матовый", perM: 829.5, source: mvm },
    { id: "gold", label: "золото матовое", perM: 767, source: mvm },
    { id: "champagne", label: "шампань матовый", perM: 767, source: mvm },
  ] },
  { id: "F1-17", label: "F1-17 · рамка 20×19", face: 19, allowance: 29, narrow: true, colors: [
    { id: "silver", label: "серебро", perM: 455.83, source: mvm + " (Ф 1-17)" },
    { id: "white", label: "белый RAL 9016", perM: 501, source: mvm },
    { id: "black", label: "чёрный", perM: 670.67, source: mvm },
    { id: "gold", label: "золото", perM: 693, source: mvm },
    { id: "cognac", label: "коньяк", perM: 693, source: mvm },
    { id: "champagne", label: "шампань", perM: 693, source: mvm },
  ] },
  { id: "F1-19", label: "F1-19 · широкая рамка 45 мм", face: 45, allowance: 29, narrow: false, colors: [
    { id: "silver", label: "серебро", perM: 1037.33, source: mvm },
    { id: "black", label: "чёрный", perM: 1368.33, source: mvm },
    { id: "gold", label: "золото", perM: 1231.83, source: mvm },
    { id: "cognac", label: "коньяк", perM: 1231.83, source: mvm },
  ] },
];
export type AluInsert = { id: string; label: string; perM2: number | null; source: string; mirror?: boolean; thickness: number };
const atb = "АТБ, прайс 01.01.2026 (закупка)";
export const ALU_INSERTS: AluInsert[] = [
  { id:'moru-bronze',label:'Мору бронза · образец и цену согласовать',perM2:null,source:'ТЗ Вотан; цена не подтверждена',thickness:4 },
  { id:'satin-bronze',label:'Сатин бронза · образец и цену согласовать',perM2:null,source:'ТЗ Вотан; цена не подтверждена',thickness:4 },
  { id: "mirror-silver", label: "Зеркало серебро 4 мм", perM2: 1530, source: atb, mirror: true, thickness: 4 },
  { id: "mirror-bronze", label: "Зеркало бронза 4 мм", perM2: 2190, source: atb, mirror: true, thickness: 4 },
  { id: "mirror-graphite", label: "Зеркало графит 4 мм", perM2: 2190, source: atb, mirror: true, thickness: 4 },
  { id: "glass-clear", label: "Стекло прозрачное 4 мм", perM2: 970, source: atb, thickness: 4 },
  { id: "glass-bronze", label: "Стекло тонированное бронза 4 мм", perM2: 1820, source: atb, thickness: 4 },
  { id: "glass-graphite", label: "Стекло тонированное графит 4 мм", perM2: 1820, source: atb, thickness: 4 },
  { id: "satin", label: "Сатин матовый 4 мм", perM2: 1600, source: atb, thickness: 4 },
  { id: "lacobel-white", label: "Лакобель 9010 белый", perM2: 1930, source: atb, thickness: 4 },
  { id: "lacobel-black", label: "Лакобель 9005 чёрный", perM2: 2040, source: atb, thickness: 4 },
];
export const ALU_EXTRAS = {
  sealPerM: 13, // уплотнитель, ₽/м периметра
  cornersPerFacade: 80, // соединительная фурнитура (уголки) на фасад
  hingeHole: 40, // отверстие под петлю Ø35
  hingeHoleNarrow: 150, // отверстие под петлю в узком профиле (F1-09, F1-17)
  handleHole: 70, // отверстие под ручку (в стекле 8 мм под втулку)
  mirrorFilmPerM2: 90, // армирующая плёнка на зеркало, АТБ
  frameDepth: 20, // толщина рамочного фасада для сцены и габарита
  maxH: 2000, // СТП: выше 2000 и шире 600 нежелательно
  maxW: 600,
  source: "Бланк «Расчет алюм.фасад рам.xls» цеха; АТБ 01.01.2026",
} as const;
export type AluFacade = { profile: string; color: string; insert: string };
export const DEFAULT_ALU: AluFacade = { profile: "F1-09", color: "silver", insert: "mirror-silver" };
export function aluProfile(id: string) { return ALU_PROFILES.find((p) => p.id === id); }
export function aluColor(profile: string, color: string) { return aluProfile(profile)?.colors.find((c) => c.id === color); }
export function aluInsert(id: string) { return ALU_INSERTS.find((i) => i.id === id); }
export function aluLabel(a: AluFacade) { const p = aluProfile(a.profile), c = aluColor(a.profile, a.color), i = aluInsert(a.insert); return `${p?.label ?? a.profile} · ${c?.label ?? a.color} · ${i?.label ?? a.insert}`; }
/** Размер вставки по припуску профиля: фасад минус припуск по каждому габариту. */
export function aluInsertSize(a: AluFacade, w: number, h: number) { const al = aluProfile(a.profile)?.allowance ?? 0; return { w: w - al, h: h - al }; }
