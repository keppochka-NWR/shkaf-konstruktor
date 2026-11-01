// Макс 01.11 «не могу сделать, чтобы фасады выкатных ящиков были вровень с распашными»: одна галочка с одним названием — в настройках ящика
// и в «Фасадах секции». Причина, если вровень нельзя (скос, купе, ящик без фасада), — прямо под ней, а не молча.
import { drawersFlush, drawersFlushBlock, type Module, type Section } from "./model";
import { drawerRowInfo } from "./drawerRowAlign";

export const DRAWER_FLUSH_LABEL = "Фасад ящика вровень с распашными фасадами";

export function DrawerFlushCheck({ m, s, set, setToRow }: { m: Module; s: Section; set: (on: boolean) => void; setToRow: (on: boolean) => void }) {
  const flush = drawersFlush(m, s), why = drawersFlushBlock(m, s), row = flush ? drawerRowInfo(m, s) : null;
  // старый проект: ящики снаружи, но лицо не в плоскости двери (вкладные двери, рамка без галочки, посадка «внутри проёма») — галочка снята и говорит почему
  const off = !flush && !why && !!s.externalDrawers;
  return <div data-testid="drawer-flush">
    <label className="hardware-field"><span><input type="checkbox" aria-label={DRAWER_FLUSH_LABEL} checked={flush} disabled={!!why && !flush} onChange={(e) => set(e.target.checked)} /> {DRAWER_FLUSH_LABEL}</span>
      <small>{why ?? "Для всех ящиков секции: лицо фасадов в плоскости дверей, дверь встаёт над ящиками через зазор между фасадами, петли — по её новой высоте. Снято — ящики за дверью."}</small></label>
    {off && <p className="field-note" role="note">Сейчас ящики снаружи, но их лицо не в плоскости дверей. Поставьте галочку — фасады встанут вровень.</p>}
    {row && <label className="hardware-field" data-testid="drawer-to-row"><span><input type="checkbox" aria-label="Верх ящиков по ряду соседней секции" checked={!!s.drawersToRow} onChange={(e) => setToRow(e.target.checked)} /> Верх ящиков по ряду соседней секции</span>
      <small>{!s.drawersToRow ? "Снято: ящики стоят по своей высоте. Высоту ящика задали вручную — привязка снимается сама." : "seam" in row ? `Верх ящиков на стыке рядов соседа: ${Math.round(row.seam)} мм от низа. Сосед меняет ряды — ящики идут за ними.` : row.none}</small></label>}
    {flush && !!m.alu && m.doorMount !== "inset" && <p className="field-note" role="note">Двери в рамке: фасады ящиков тоже в рамке, иначе лицо на 4 мм глубже. Цена — как у рамки.</p>}
    {flush && !!m.alu && m.doorMount === "inset" && <p className="field-note" role="note">Двери в рамке, вкладные: фасады ящиков из ЛДСП в той же плоскости — рамка на вкладной ящик не ставится.</p>}
    {flush && !!m.mirror && <p className="field-note" role="note">Зеркало на дверях добавляет 4 мм поверх плоскости фасадов.</p>}
  </div>;
}
