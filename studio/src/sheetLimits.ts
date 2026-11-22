import {panelSheetSize} from './facadePanels';
import { catalog } from './catalog';

/** Общие форматы для проверки корпуса и раскроя, мм. */
export const SHEETS = { board: { long: 2750, short: 1830 }, hdf: { long: 2800, short: 2070 }, margin: 10 };
// Только внешний предел числового поля: горизонталь может лежать между двумя боковинами.
// Реальный предел задают размеры ВСЕХ построенных деталей, их материал и текстура.
export const BODY_DIMENSION_ENVELOPE = SHEETS.board.long + 2 * 16;
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
