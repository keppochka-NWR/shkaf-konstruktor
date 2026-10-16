import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { VERNISSAGE_MILLINGS, VERNISSAGE_SERIES, normalizeVernissage, vernissageLayout } from '../src/facadesVernissage';
import { previewSvg } from '../src/vernissageGeometry';
import { VERNISSAGE_MARKUP_DEFAULT } from '../src/pricing';
import { HIDDEN_MILLINGS, MILLING_TILES, MILL_STYLES, PRICE_TIERS, millingPhotoUrl, tierGroups } from '../src/vernissageCatalog';

const PUBLIC = join(import.meta.dirname, '..', 'public');
const groups = tierGroups(VERNISSAGE_MARKUP_DEFAULT);

/** Размер JPEG по маркеру SOF (без зависимостей). */
function jpegSize(buf: Buffer): [number, number] {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const mk = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  throw new Error('нет SOF');
}

test('каталог плиток = каталог фрезеровок: ни одна не потеряна и не задублирована', () => {
  const shown = groups.flatMap((g) => g.tiles.map((t) => t.id));
  assert.equal(new Set(shown).size, shown.length, 'плитка в двух группах');
  assert.equal(shown.length, MILLING_TILES.length, 'каждая плитка — ровно в одной ценовой группе');
  const all = [...shown, ...HIDDEN_MILLINGS].sort();
  assert.deepEqual(all, VERNISSAGE_MILLINGS.map((m) => m.id).sort());
  assert.equal(HIDDEN_MILLINGS.length, 22, 'без фото и описания — 22 фрезеровки (макет 16.10)');
  assert.equal(shown.length, 79);
});

test('у каждой показанной плитки есть фото (≤240 px, ≤40 КБ) или схема; скрытые — без фото', () => {
  for (const t of MILLING_TILES) {
    if (t.photo) {
      const f = join(PUBLIC, t.photo);
      assert.ok(existsSync(f), `нет файла ${t.photo}`);
      const buf = readFileSync(f), [w, h] = jpegSize(buf);
      assert.ok(buf.length <= 40 * 1024, `${t.photo}: ${buf.length} Б`);
      assert.ok(Math.max(w, h) <= 240, `${t.photo}: ${w}×${h}`);
    } else {
      const svg = previewSvg(vernissageLayout(normalizeVernissage({ milling: t.id, cover: 'film', thickness: 19 }), 450, 716), 160);
      assert.match(svg, /^<svg[\s\S]*<polygon/, `№${t.id}: нет схемы`);
    }
    assert.ok(t.name && !/Стандарт|Оптима|Престиж|Премиум|серия/i.test(t.name), `№${t.id}: название «${t.name}» — без серий`);
    assert.ok(MILL_STYLES.some((s) => s.id === t.style));
  }
  for (const id of HIDDEN_MILLINGS) assert.ok(!existsSync(join(PUBLIC, millingPhotoUrl(id))), `№${id} скрыт, но фото есть`);
});

test('фото фрезеровок: общий вес папки ≤ 3 МБ, лишних файлов нет', () => {
  const dir = join(PUBLIC, 'vernissage', 'millings'), files = readdirSync(dir);
  const total = files.reduce((s, f) => s + statSync(join(dir, f)).size, 0);
  assert.ok(total <= 3 * 1024 * 1024, `${total} Б`);
  const used = new Set(MILLING_TILES.filter((t) => t.photo).map((t) => t.photo!.split('/').pop()));
  assert.deepEqual(files.filter((f) => !used.has(f)), [], 'фото без плитки');
});

test('цена группы — по прайсу: минимум плёночной колонки серии (19 мм, ПЭТ 18) × коэффициент Вернисажа', () => {
  const ref = (id: string) => {
    const s = VERNISSAGE_SERIES.find((x) => x.id === id)!, row = s.prices['19'] ?? s.prices['18']!;
    const film = Object.entries(row).filter(([k]) => k.startsWith('pvc') || k === 'pet').map(([, v]) => v);
    return Math.round((Math.min(...film) * VERNISSAGE_MARKUP_DEFAULT) / 100) * 100;
  };
  assert.deepEqual(groups.map((g) => g.id), PRICE_TIERS.map((t) => t.id), 'все три группы заполнены, дешёвые сверху');
  for (const g of groups) {
    const series = [...new Set(g.tiles.map((t) => t.milling.series))], prices = series.map(ref);
    assert.equal(g.from, Math.min(...prices), `${g.label}: «от»`);
    assert.equal(g.to, Math.max(...prices), `${g.label}: «до»`);
    const tier = PRICE_TIERS.find((t) => t.id === g.id)!;
    assert.ok(prices.every((p) => p < tier.upTo), `${g.label}: серия дороже порога группы`);
  }
  for (let i = 1; i < groups.length; i++) assert.ok(groups[i - 1].to < groups[i].from, 'группы по цене не пересекаются');
  // серия целиком в одной группе (цена в группе одна на серию)
  for (const s of new Set(MILLING_TILES.map((t) => t.milling.series))) assert.equal(groups.filter((g) => g.tiles.some((t) => t.milling.series === s)).length, 1, s);
});
