// Сетчатое наполнение Лемана Про: корзины, брючницы, обувницы. Парсинг lemanapro.ru (Москва) 01.09.2026,
// артикулы настоящие, цены розничные. reqW/reqD — требуемые внутренние ширина и глубина секции по габариту
// изделия (технички производителей уточняются), h — высота изделия. Ставится вместо ящика ЛДСП, свои направляющие
// в комплекте; фасада и ручки нет; за распашными дверями нужны фальши как для ящиков.
export type MeshItem = { id: string; art: string; label: string; kind: "basket" | "trousers" | "shoes"; reqW: number; reqD: number; h: number; price: number };
const item = (art: string, label: string, kind: MeshItem["kind"], reqW: number, reqD: number, h: number, price: number): MeshItem => ({ id: "lm" + art, art, label, kind, reqW, reqD, h, price });
export const MESH: MeshItem[] = [
  item("85127628", "Корзина Титан-GS 430 · h185", "basket", 440, 560, 185, 711),
  item("85127629", "Корзина Титан-GS 430 · h85", "basket", 440, 560, 85, 688),
  item("91586765", "Брючница Firmax 564", "trousers", 564, 430, 140, 5630),
  item("89389437", "Вешалка для брюк Лион 386", "trousers", 390, 575, 120, 4300),
  item("89389438", "Вешалка для брюк Лион 480", "trousers", 484, 575, 120, 5086),
  item("89441008", "Брючница выдвижная 568 белая", "trousers", 570, 425, 120, 4300),
  item("91587993", "Обувница Firmax 564 шампань", "shoes", 564, 430, 140, 9460),
  item("91587997", "Обувница Firmax 564 чёрная", "shoes", 564, 430, 140, 7486),
  item("91587994", "Обувница Firmax 664 шампань", "shoes", 664, 430, 160, 6339),
  item("91587996", "Обувница Firmax 864 шампань", "shoes", 864, 430, 140, 11190),
];
export const DEFAULT_MESH = "lm85127628";
export function meshById(id: string): MeshItem | undefined {
  return MESH.find((m) => m.id === id);
}
/** Допустимый запас ширины проёма сверх требуемой: крепление направляющих корзины к стойкам с регулировкой. */
export const MESH_WIDTH_TOLERANCE = 60;
export const MESH_KIND_LABEL: Record<MeshItem["kind"], string> = { basket: "Корзина", trousers: "Брючница", shoes: "Обувница" };
