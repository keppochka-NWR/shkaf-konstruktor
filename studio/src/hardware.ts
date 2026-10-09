// PB-0FPO for 16 mm, NOT PB-0FPO18. Source: GTV 2020 pp.126–127.
// Cross-check: user's PB-0FPO-450 fragment: LW=200, inner=158, side length=440.
export const SLIDES = {
  ball: {
    label: "GTV Versalite PLUS+ · шариковые с доводчиком",
    lengths: [250, 300, 350, 400, 450, 500],
    note: "Боковой зазор 13 мм. Дно ЛДСП 16 мм. Профиль из базы конструктора. Закупка ФАМ; 300 и 400 мм в смете — интерполяция.",
  },
  gtv0fpo: {
    label: "Скрытого монтажа · геометрия GTV 0FPO",
    lengths: [250, 270, 300, 350, 400, 450, 500, 550, 600],
    note: "Для ЛДСП 16 мм. Внутренняя ширина ящика = проём − 42 мм; длина боковины = направляющая − 10 мм. Дно ЛДСП 16 мм по вашему фрагменту. В смете — закупка цеха: DTC (push) / Unihopper (с доводчиком).",
  },
} as const;
/** Петли распашных фасадов: бренд выбирает клиент (решение Макса 06.10.2026: GTV, Pulse, Blum). soft — с доводчиком (фасады с ручками),
 *  free — без пружины под толкатель push-to-open. Цены — закупка, оценки помечены явно. */
export type HingeBrand = 'gtv' | 'pulse' | 'blum';
export const HINGE_BRANDS: Record<HingeBrand, { label: string; note: string; soft: { label: string; price: number; source: string }; free: { label: string; price: number; source: string } }> = {
  gtv: { label: 'GTV', note: 'стандарт цеха',
    soft: { label: 'Петля GTV SOLID PRO с доводчиком', price: 157, source: 'Счёт Мега-Трейд 6219, 2026 · стандарт цеха при ручках' },
    free: { label: 'Петля GTV без пружины', price: 80, source: 'ФАМ: петля GTV ZP-COCA клиповая без пружины' } },
  pulse: { label: 'Pulse', note: 'эконом, МДМ',
    soft: { label: 'Петля Pulse Harmony с доводчиком', price: 112, source: 'Оценка: Pulse Harmony накладная с доводчиком, розница МДМ/Инталика 112 ₽ (10.2026); подтвердить счётом МДМ' },
    free: { label: 'Петля Pulse без пружины', price: 60, source: 'Оценка по классу Pulse; подтвердить счётом МДМ' } },
  blum: { label: 'Blum', note: 'премиум, Австрия',
    soft: { label: 'Петля Blum CLIP top BLUMOTION 110°', price: 480, source: 'Оценка: дилеры Blum (Москва) 480–490 ₽ за петлю 71B3550, 10.2026; подтвердить закупкой' },
    free: { label: 'Петля Blum CLIP top без пружины', price: 330, source: 'Оценка: Blum CLIP top без пружины под TIP-ON; подтвердить закупкой' } },
};
/** Число петель по высоте и ширине фасада (правило цеха). */
export function hingeCount(height: number, width: number) { return (height <= 900 ? 2 : height <= 1600 ? 3 : height <= 2000 ? 4 : 5) + (width > 450 ? 1 : 0); }
/** Кухня — как в проектах Базиса цеха (разбор 1 146 петель кухонь цеха, 09.10.2026): число только по высоте фасада,
 *  до 900 — 2, до 1300 — 3, до 1700 — 4, до 2100 — 5, выше — 6. Шкафы — прежнее правило hingeCount (решение Макса: шкафы не трогать). */
export function kitchenHingeCount(height: number) { return height <= 900 ? 2 : height <= 1300 ? 3 : height <= 1700 ? 4 : height <= 2100 ? 5 : 6; }
/** Центры петель по высоте фасада: 100 мм от краёв (у низких фасадов — четверть высоты, не меньше 40), остальные равномерно. */
export function hingePositions(height: number, width: number, kitchen = false): number[] {
  const n = kitchen ? kitchenHingeCount(height) : hingeCount(height, width), off = Math.min(100, Math.max(40, height / 4)), a = off, b = height - off;
  return Array.from({ length: n }, (_, k) => n === 1 ? height / 2 : a + (b - a) * k / (n - 1));
}
/** Пробные сдвиги петли от идеальной высоты: 0, −5, +5, −10, +10 … до ±limit (мм). */
export function hingeShifts(limit = 200, step = 5): number[] {
  const out = [0];
  for (let s = step; s <= limit; s += step) out.push(-s, s);
  return out;
}
/** Ход ящика: с доводчиком, простой (без доводчика, только шариковые), push-to-open (нажал — выехал, без ручки). */
export type SlideMotion = 'soft-close' | 'simple' | 'push';
/** Производитель направляющих: шариковые — GTV; скрытые — Unihopper, DTC или Premial (решение Макса 06.10.2026). */
export type SlideBrand = 'gtv' | 'unihopper' | 'dtc' | 'premial';
export const SLIDE_BRANDS: Record<SlideBrand, string> = { gtv: 'GTV', unihopper: 'Unihopper', dtc: 'DTC', premial: 'Premial' };
export const SLIDE_MOTIONS: Record<SlideMotion, string> = { 'soft-close': 'с доводчиком', simple: 'без доводчика', push: 'push-to-open' };
/** Готовые системы для выбора одним списком: тип + ход + бренд. */
export const SLIDE_SYSTEMS: { id: string; slide: 'ball' | 'gtv0fpo'; motion: SlideMotion; brand: SlideBrand; label: string }[] = [
  { id: 'ball-soft', slide: 'ball', motion: 'soft-close', brand: 'gtv', label: 'Шариковые GTV · с доводчиком' },
  { id: 'ball-simple', slide: 'ball', motion: 'simple', brand: 'gtv', label: 'Шариковые GTV · без доводчика' },
  { id: 'ball-push', slide: 'ball', motion: 'push', brand: 'gtv', label: 'Шариковые GTV · push-to-open' },
  { id: 'hidden-unihopper-soft', slide: 'gtv0fpo', motion: 'soft-close', brand: 'unihopper', label: 'Скрытые Unihopper · с доводчиком' },
  { id: 'hidden-unihopper-push', slide: 'gtv0fpo', motion: 'push', brand: 'unihopper', label: 'Скрытые Unihopper · push-to-open' },
  { id: 'hidden-dtc-soft', slide: 'gtv0fpo', motion: 'soft-close', brand: 'dtc', label: 'Скрытые DTC · с доводчиком' },
  { id: 'hidden-dtc-push', slide: 'gtv0fpo', motion: 'push', brand: 'dtc', label: 'Скрытые DTC · push-to-open' },
  { id: 'hidden-premial-soft', slide: 'gtv0fpo', motion: 'soft-close', brand: 'premial', label: 'Скрытые Premial · с доводчиком' },
  { id: 'hidden-premial-push', slide: 'gtv0fpo', motion: 'push', brand: 'premial', label: 'Скрытые Premial · push-to-open' },
];
/** Ход ящика с учётом старых проектов: скрытые без поля — push (как было), шариковые — с доводчиком. */
export function slideMotion(c: Pick<DrawerConfig, 'slide' | 'operation'>): SlideMotion {
  if (c.operation) return c.operation;
  return c.slide === 'gtv0fpo' ? 'push' : 'soft-close';
}
/** Бренд с учётом старых проектов: правило закупки цеха — скрытые push = DTC, скрытые с доводчиком = Unihopper. */
export function slideBrand(c: Pick<DrawerConfig, 'slide' | 'operation' | 'brand'>): SlideBrand {
  if (c.slide === 'ball') return 'gtv';
  if (c.brand && c.brand !== 'gtv') return c.brand;
  return slideMotion(c) === 'push' ? 'dtc' : 'unihopper';
}
export function slideSystem(c: Pick<DrawerConfig, 'slide' | 'operation' | 'brand'>) {
  const motion = slideMotion(c), brand = slideBrand(c);
  return SLIDE_SYSTEMS.find((s) => s.slide === c.slide && s.motion === motion && s.brand === brand) ?? SLIDE_SYSTEMS[0];
}
export type DrawerConfig = {
  tray?: boolean;
  operation?: SlideMotion;
  brand?: SlideBrand;
  slide: keyof typeof SLIDES;
  height: number;
  length: number;
  y?: number;
  handle?: boolean;
  handleId?: string;
  /** id сетчатого элемента Лемана Про (mesh.ts): вместо ящика ЛДСП ставится корзина/брючница/обувница. */
  mesh?: string;
  /** Высота фасада ящика отдельно от боковины короба (экономия плиты): по умолчанию боковина + 40 − зазор. */
  facadeH?: number;
  /** Внутренний ящик без фасада: короб и направляющие, без фасада и ручки (за дверями или в открытом каркасе). */
  noFacade?: boolean;
};
export const GTV_SOURCE =
  "https://api2.gtv.com.pl/pimcore/assets/attachments/karta_techniczna/Karta_techniczna_2020_128-129.pdf";

export function drawerHasHandle(c:DrawerConfig){if(c.mesh||c.noFacade)return false;return c.handle??(slideMotion(c)!=='push');}


export function compatibleSlideLength(slide:DrawerConfig['slide'],current:number,available:number):number|undefined {
 const fitting=SLIDES[slide].lengths.filter(length=>length<=available);
 if(fitting.some(length=>length===current))return current;
 return [...fitting].reverse().find(length=>length<=current)??fitting[0];
}
