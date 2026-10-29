// Находки критика релиз-кандидата 29.10.2026 (ветка claude/integ-2610): п.8 — радиусный стеллаж и «Крепёж корпуса: эксцентрики».
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, parts, fastenerCounts, validate, type Module } from '../src/model';
import { createModule } from '../src/ModulePalette';
import { estimate } from '../src/pricing';
import { newProject, type Project } from '../src/project';
import { partCollisions } from '../src/collisions';

const one = (m: Module): Project => { const p = newProject(m); p.modules = [{ id: 'a', x: 30, y: 0, z: 30, rotation: 0, module: m }]; return p; };
const rack = (side: 'left' | 'right', fastening?: 'eccentric'): Module => { const m = createModule('radius', 400, 2000, 400, initialModule()); m.radius = { ...m.radius!, side }; if (fastening) m.fastening = fastening; return m; };
const qty = (p: Project, id: string) => estimate(p).lines.filter((l) => l.id === id).reduce((s, l) => s + l.quantity, 0);

test('п.8: «Крепёж корпуса: эксцентрики» у радиусного стеллажа — ни одного конфирмата и заглушки, стыки на эксцентриках', () => {
  for (const side of ['right', 'left'] as const) {
    const m = rack(side, 'eccentric'), ps = parts(m);
    assert.equal(ps.filter((p) => p.id.startsWith('fast:')).length, 0, 'было 27 конфирматов');
    const fc = fastenerCounts(m);
    assert.equal(fc.confirmats, 0);
    // 5 горизонталей × (2 к боковине + 2 к заднику) + 3 задник к боковине + 2 цоколь
    assert.equal(fc.eccentrics, 29);
    const p = one(m);
    assert.equal(qty(p, 'confirmat'), 0); assert.equal(qty(p, 'confirmat-cap'), 0, 'заглушек нет');
    assert.equal(qty(p, 'eccentric'), 29, 'в смете столько же эксцентриков, сколько в модели');
    assert.deepEqual(validate(m), []); assert.deepEqual(partCollisions(ps), []);
    if (side === 'left') assert.ok(ps.some((q) => q.id.startsWith('ecc:') && q.id.includes(':right:')), 'левое исполнение — зеркально');
  }
});
test('п.8: по умолчанию конфирматы только через боковину у соседа и задник у стены; эксцентрики цоколя — деталями, без лишней строки', () => {
  const m = rack('right'), ps = parts(m);
  assert.ok(ps.filter((p) => p.id.startsWith('fast:')).every((p) => /^fast:.*:(left|back):\d+$/.test(p.id)));
  const plinthEcc = ps.filter((p) => /^ecc:plinth:/.test(p.id) && !p.id.endsWith(':pin')).length;
  assert.equal(plinthEcc, 2, 'торец фронтальной планки к боковине, боковой — к заднику');
  assert.equal(qty(one(m), 'eccentric'), fastenerCounts(m).eccentrics, 'строка «эксцентрик» = эксцентрики модели (цоколь), без добавки hullFasteners');
});
