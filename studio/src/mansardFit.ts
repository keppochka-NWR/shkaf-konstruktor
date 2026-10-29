// Ящики под скосом мансарды (критик 29.10, круги 2–3): короб ящика, что проходит сквозь наклонную крышу, — ниже, затем короче
// направляющая; фасады те же. Общий код кнопки «Опустить полки под скос» (paletteBuild.fitUnderMansard) и числа ящиков секции
// («+/−», удаление ящика — drawerModes.setDrawerCount): у мансардного шкафа ящики поровну делятся под скосом, а не уходят снова в крышу.
import { drawerConfig, drawerOffsets, drawerPitch, drawersBehindDoors, fb, parts, RULES, type Module, type Section } from "./model";
import { mansardIntrusions } from "./shapes";
import { SLIDES } from "./hardware";

const drawerHits = (n: Module, s: Section) => mansardIntrusions(n, parts(n)).filter((x) => x.error && x.part.sectionId === s.id && x.part.role === "drawer");

/** Короба ящиков секции под скос: фасад и шаг ящика те же — у ящика задаётся высота фасада (как parts() строит фасад с заданной
 *  высотой — пол-зазора снизу, зазор под ним 3 мм как у равных фасадов выше короба), ящики выше не двигаются; короб ниже до 68 мм,
 *  затем короче направляющая. true — сквозь крышу ящиков нет; false — не встаёт (настройки ящиков секции прежние). */
export function fitDrawersUnderRoof(n: Module, s: Section): boolean {
  if (!n.mansard || !s.drawers || !drawerHits(n, s).length) return true;
  const g = s.drawerGap ?? (drawersBehindDoors(n, s) ? RULES.drawerFrontGap : fb(n)), off = drawerOffsets(s), was = s.drawerConfigs;
  s.drawerConfigs = Array.from({ length: s.drawers }, (_, k) => ({ ...drawerConfig(n, s, k), y: off[k] }));
  const touched = new Set<number>();
  for (let guard = 0; guard < 40; guard++) {
    const x = drawerHits(n, s)[0];
    if (!x) return true;
    const j = Number(x.part.id.split(":drawer:")[1].split(":")[0]), c = s.drawerConfigs[j];
    if (!touched.has(j)) {
      touched.add(j);
      // шаг ящика в проверке — по зазору шага (s.drawerGap ?? 3), фасад — по зазору фасадов g: верхний — шаг тот же, остальные — верх фасада тот же
      const highest = off.every((o, k) => k === j || o <= off[j]), G = s.drawerGap ?? RULES.drawerFrontGap, pitch = drawerPitch(c, G);
      if (c.facadeH === undefined) c.facadeH = Math.round((highest ? pitch - G : Math.min(pitch - G, pitch - 1.5 * g)) * 100) / 100;
    }
    if (c.height - x.over - 1 >= 68) { c.height = Math.floor(c.height - x.over - 1); continue; }
    if (c.height > 68) { c.height = 68; continue; }
    const shorter = [...SLIDES[c.slide].lengths].filter((l) => l < c.length).sort((a, b) => b - a)[0];
    if (shorter === undefined) break;
    c.length = shorter;
  }
  s.drawerConfigs = was;
  return false;
}
/** Ящики секции мансардного шкафа после смены их числа: под скос (fitDrawersUnderRoof) или отказ с причиной. */
export function drawersUnderMansard(m: Module, s: Section): void {
  if (fitDrawersUnderRoof(m, s)) return;
  const x = drawerHits(m, s)[0];
  throw Error(`Ящики под скосом мансарды не встают: при ${s.drawers} ящиках «${x.part.name.replace(/ · .*$/, "")}» выше нижней пласти крыши на ${x.over} мм у задней кромки даже с коробом 68 мм и самой короткой направляющей. Уберите ящик или увеличьте высоту сзади / уменьшите глубину корпуса.`);
}
