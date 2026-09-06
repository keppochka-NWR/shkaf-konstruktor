// PB-0FPO for 16 mm, NOT PB-0FPO18. Source: GTV 2020 pp.126–127.
// Cross-check: user's PB-0FPO-450 fragment: LW=200, inner=158, side length=440.
export const SLIDES = {
  ball: {
    label: "GTV Versalite PLUS+ · шариковые с доводчиком",
    lengths: [250, 300, 350, 400, 450, 500],
    note: "Боковой зазор 13 мм. Дно ЛДСП 16 мм. Профиль из базы конструктора. Закупка ФАМ; 300 и 400 мм в смете — интерполяция.",
  },
  gtv0fpo: {
    label: "Скрытого монтажа · Push to Open (геометрия GTV 0FPO)",
    lengths: [250, 270, 300, 350, 400, 450, 500, 550, 600],
    note: "Для ЛДСП 16 мм. Внутренняя ширина ящика = проём − 42 мм; длина боковины = направляющая − 10 мм. Дно ЛДСП 16 мм по вашему фрагменту. В смете — закупка цеха: DTC (push) / Unihopper (с доводчиком).",
  },
} as const;
export type DrawerConfig = {
  slide: keyof typeof SLIDES;
  height: number;
  length: number;
  y?: number;
  handle?: boolean;
  /** id сетчатого элемента Лемана Про (mesh.ts): вместо ящика ЛДСП ставится корзина/брючница/обувница. */
  mesh?: string;
};
export const GTV_SOURCE =
  "https://api2.gtv.com.pl/pimcore/assets/attachments/karta_techniczna/Karta_techniczna_2020_128-129.pdf";

export function drawerHasHandle(c:DrawerConfig){if(c.mesh)return false;return c.handle??(c.slide!=="gtv0fpo");}


export function compatibleSlideLength(slide:DrawerConfig['slide'],current:number,available:number):number|undefined {
 const fitting=SLIDES[slide].lengths.filter(length=>length<=available);
 if(fitting.some(length=>length===current))return current;
 return [...fitting].reverse().find(length=>length<=current)??fitting[0];
}
