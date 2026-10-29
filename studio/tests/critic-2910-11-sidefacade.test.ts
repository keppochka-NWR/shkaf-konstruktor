// Находки критика релиз-кандидата 29.10.2026 (ветка claude/integ-2610): п.11 — понятный текст ошибки «видимый бок из фасада» при ЛДСП.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, section, validate, type Module } from '../src/model';
import { newProject, projectErrors, type Project } from '../src/project';
import { DEFAULT_VERNISSAGE } from '../src/facadesVernissage';
import { setFacadeKind, facadeKindBlock } from '../src/facadeKind';
import { explainErrors } from '../src/errorDetails';

const one = (m: Module): Project => { const p = newProject(m); p.modules = [{ id: 'a', x: 30, y: 0, z: 30, rotation: 0, module: m }]; return p; };

test('п.11: фасады ЛДСП при флажке «Видимый бок из фасада» — совет снять флажок, а не «Измените размер корпуса»', () => {
  const m: Module = { ...initialModule(), name: 'Шкаф Б', width: 600, height: 2200, depth: 550, doors: true, sections: [section()], vernissage: { ...DEFAULT_VERNISSAGE }, facadeT: DEFAULT_VERNISSAGE.thickness, sidePanels: { right: { height: 2200, depth: 550, facade: true } } };
  assert.deepEqual(validate(m), []);
  const n = structuredClone(m); setFacadeKind(n, 'ldsp');
  const errs = projectErrors(one(n));
  assert.ok(errs.length > 0);
  const d = explainErrors(one(n), errs).find((x) => /Видимый бок/.test(x.text))!;
  assert.ok(d, errs.join(' | '));
  assert.doesNotMatch(d.action, /размер корпуса|разделите фасад/);
  assert.match(d.action, /Снимите флажок «Видимый бок из фасада»/);
  assert.match(facadeKindBlock(m, 'ldsp'), /Снимите флажок/, 'подсказка у недоступного пункта «Тип фасадов» — та же');
});
