import {panelSheetSize} from './facadePanels';
import { catalog } from './catalog';

/** Общие форматы для проверки корпуса и раскроя, мм. */
export const SHEETS = { board: { long: 2750, short: 1830 }, hdf: { long: 2800, short: 2070 }, margin: 10 };
// Только внешний предел числового поля: горизонталь может лежать между двумя боковинами.
// Реальный предел задают размеры ВСЕХ построенных деталей, их материал и текстура.
export const BODY_DIMENSION_ENVELOPE = SHEETS.board.long + 2 * 16;
const DOUBLE_PRICE_THRESHOLDS = [[2500, 900], [1700, 1400], [2650, 570]] as const;
export const DOUBLE_PRICE_LABEL = 'Доплата за листы с крупной деталью: оба размера больше ' +
  DOUBLE_PRICE_THRESHOLDS.map(([long, short]) => long + ' × ' + short).join(' или ') + ' мм';

export function requiresDoubleSheetPrice(part: { length: number; width: number }): boolean {
  const long = Math.max(part.length, part.width);
  const short = Math.min(part.length, part.width);
  return DOUBLE_PRICE_THRESHOLDS.some(([minLong, minShort]) => long > minLong && short > minShort);
}

export function grainFree(d: { material: string; decor: string }) {
  return d.material === 'hdf' || !catalog.find(c => c.n === d.decor)?.tex;
}
export function sheetFormat(d:{material:string;decor:string}){
  if(d.material==='hdf')return SHEETS.hdf;
  const panel=panelSheetSize(d.decor);
  return panel?{long:panel.height,short:panel.width}:SHEETS.board;
}
export function fitsSheet(d: { material: string; decor: string; length: number; width: number }) {
  const s = sheetFormat(d);
  const long = s.long - 2 * SHEETS.margin, short = s.short - 2 * SHEETS.margin;
  if (![d.length, d.width].every(n => Number.isFinite(n) && n > 0)) return false;
  return (d.length <= long && d.width <= short) ||
    (grainFree(d) && d.width <= long && d.length <= short);
}
