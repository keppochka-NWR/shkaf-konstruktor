/* Цена шкафа: закупка × наценка.
   Себестоимость = листы (из раскроя) + кромка + фурнитура + работа цеха.
   Розница = себестоимость × project.markup. */

function priceProject(project) {
  const spec = specification(project);
  const plan = cuttingPlan(project);

  let sheetsCost = 0, sheetsCount = 0, hdfSheetsCount = 0;
  const sheetLines = [];
  for (const g of plan) {
    const cost = g.result.count * (g.price || CONST.pricing.defaultSheet);
    sheetsCost += cost;
    if (g.key === "hdf") hdfSheetsCount += g.result.count; else sheetsCount += g.result.count;
    sheetLines.push({ label: g.label, count: g.result.count, cost: cost,
                      kim: g.result.kim });
  }

  const em = edgeMeters(spec.panels);
  const edgeCost = Math.round(em.face * CONST.pricing.edgeFace + em.tech * CONST.pricing.edgeTech);
  const hwCost = spec.hwCost;
  const smallParts = spec.panels.filter(p => !p.material && Math.min(p.w, p.h) < CONST.minPartW)
    .reduce((s, p) => s + p.qty, 0);
  const feeCost = smallParts * CONST.pricing.smallPartFee;
  // работа цеха (20.10.2026): лист ЛДСП - workPerSheet, лист ЛХДФ - workPerHdfSheet; sheetsCount - только листы ЛДСП
  const workLdspCost = sheetsCount * CONST.pricing.workPerSheet;
  const workHdfCost = hdfSheetsCount * CONST.pricing.workPerHdfSheet;
  const workCost = workLdspCost + workHdfCost;

  const cost = sheetsCost + edgeCost + hwCost + feeCost + workCost;
  const markup = project.markup || CONST.pricing.markup;

  // подсветка в стойках: позиция РОЗНИЧНОГО прайса цеха, добавляется поверх наценки
  const lm = lightMeters(project);
  const lightCost = Math.round(lm.stands * CONST.pricing.lightStandPerM);

  const retail = Math.round((cost * markup + lightCost) / 100) * 100;

  return {
    sheets: sheetLines, sheetsCost, sheetsCount, hdfSheetsCount,
    edge: em, edgeCost, hwCost, feeCost, workCost, workLdspCost, workHdfCost,
    light: lm, lightCost: lightCost,
    cost: cost, markup: markup, retail: retail,
    plan: plan, spec: spec,
  };
}

function fmtRub(n) { return (n == null ? "—" : Math.round(n).toLocaleString("ru-RU") + " ₽"); }
