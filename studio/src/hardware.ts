// PB-0FPO for 16 mm, NOT PB-0FPO18. Source: GTV 2020 pp.126–127.
// Cross-check: user's PB-0FPO-450 fragment: LW=200, inner=158, side length=440.
export const SLIDES = {
  ball: {
    label: "GTV Versalite PLUS+ · шариковые",
    lengths: [250, 300, 350, 400, 450, 500],
    note: "Боковой зазор 13 мм. Дно ЛДСП 16 мм. Профиль из базы конструктора.",
  },
  gtv0fpo: {
    label: "GTV Modern Slide 0FPO · Push to Open",
    lengths: [250, 270, 300, 350, 400, 450, 500, 550, 600],
    note: "Для ЛДСП 16 мм. Внутренняя ширина ящика = проём − 42 мм; длина боковины = направляющая − 10 мм. Дно ЛДСП 16 мм по вашему фрагменту.",
  },
} as const;
export type DrawerConfig = {
  slide: keyof typeof SLIDES;
  height: number;
  length: number;
  y?: number;
  handle?: boolean;
};
export const GTV_SOURCE =
  "https://api2.gtv.com.pl/pimcore/assets/attachments/karta_techniczna/Karta_techniczna_2020_128-129.pdf";

export function drawerHasHandle(c:DrawerConfig){return c.handle??(c.slide!=="gtv0fpo");}


export function compatibleSlideLength(slide:DrawerConfig['slide'],current:number,available:number):number|undefined {
 const fitting=SLIDES[slide].lengths.filter(length=>length<=available);
 if(fitting.some(length=>length===current))return current;
 return [...fitting].reverse().find(length=>length<=current)??fitting[0];
}
