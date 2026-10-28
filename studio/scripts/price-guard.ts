/** Страж закупочных чисел публичной сборки (publish.ps1 Step 4b): множество исходных закупочных значений с контекстом поля цены
 *  (purchaseValues из bake-prices.ts: ключ свойства/константы + число из таблиц src/) не должно встречаться в собранном JS
 *  ни в каком виде минификации (445, .7, 23e3) — `price:445`, `sheetPrice??23e3`, `markup:2.2`.
 *  npx tsx scripts/price-guard.ts <папка сборки> [src] → код 1 и список совпадений, если найдено. */
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {purchaseValues} from './bake-prices';
import {SENSITIVE_SOURCES} from './public-build';

/** Подписи источников с ценами/закупкой (SENSITIVE_SOURCES, критик 28.10.2026) в собранном коде: «старый калькулятор 90 ₽»,
 *  «Оценка по классу … (1000–1250)», «… ₽ (розница allpremial.ru …)», «в прайсе 9000 ₽ — цена продажи». Плагин public-build их
 *  вырезает; страж проверяет готовую сборку. */
export function findSourceLeaks(code: string): string[] {
  const re = new RegExp(SENSITIVE_SOURCES.source, 'gi'), hits: string[] = [];
  for (const m of code.matchAll(re)) hits.push(code.slice(Math.max(0, m.index! - 60), m.index! + m[0].length + 40).replace(/\s+/g, ' '));
  return hits;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Записи числа, которые даёт минификатор: 445, 0.7/.7, 23000/23e3. */
export function numberForms(v: number): string[] {
  const s = String(v), out = new Set([s]);
  if (/^0\./.test(s)) out.add(s.slice(1));
  const m = /^(\d+?)(0{3,})$/.exec(s); if (m) out.add(m[1] + 'e' + m[2].length);
  return [...out];
}
export function findPurchaseNumbers(code: string, values: { key: string; value: number }[]): string[] {
  const hits: string[] = [], byKey = new Map<string, Set<string>>();
  for (const v of values) { const s = byKey.get(v.key) ?? new Set<string>(); for (const f of numberForms(v.value)) s.add(f); byKey.set(v.key, s); }
  for (const [key, forms] of byKey) {
    const re = new RegExp('(?<![\\w$])' + esc(key) + '\\s*(?::|=|\\?\\?)\\s*(' + [...forms].sort((a, b) => b.length - a.length).map(esc).join('|') + ')(?![\\w.])', 'g');
    for (const m of code.matchAll(re)) hits.push(code.slice(Math.max(0, m.index! - 40), m.index! + m[0].length + 20).replace(/\s+/g, ' '));
  }
  return hits;
}
function* jsFiles(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) yield* jsFiles(p); else if (/\.(m|c)?js$|\.html?$/.test(f)) yield p; }
}
/** Калькулятор купе на сайте (web/calc, scripts/bake-calc-kupe.ts): закупочные значения профилей купе студии (kupeData.ts —
 *  тот же прайс v2.10) не должны стоять в его данных; направляющие там называются napravl_top / napravl_bot. */
export function calcPurchaseValues(src: string) {
  return purchaseValues(src).filter((v) => v.file === 'kupeData.ts').flatMap((v) => v.key === 'top' || v.key === 'bot' ? [v, { ...v, key: 'napravl_' + v.key }] : [v]);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const calcMode = process.argv.includes('--calc'), args = process.argv.slice(2).filter((a) => a !== '--calc');
  const dir = args[0], src = args[1] ?? fileURLToPath(new URL('../src', import.meta.url));
  if (!dir) { console.error('usage: price-guard.ts <build dir> [src] [--calc]'); process.exit(2); }
  const values = calcMode ? calcPurchaseValues(src) : purchaseValues(src), hits: string[] = [];
  let files = 0;
  let sources = 0;
  for (const f of jsFiles(dir)) { if (/[\\/](local-projects|\.git)[\\/]/.test(f)) continue; files++; const code = readFileSync(f, 'utf8');
    for (const h of findPurchaseNumbers(code, values)) hits.push(f.slice(dir.length) + ': ' + h);
    if (!calcMode) for (const h of findSourceLeaks(code)) { sources++; hits.push(f.slice(dir.length) + ': подпись источника с ценой/закупкой: ' + h); } }
  console.log(`price-guard: ${values.length} purchase values, ${files} file(s), ${hits.length} match(es)` + (calcMode ? '' : `, source labels ${sources}`));
  for (const h of hits.slice(0, 30)) console.log('  ' + h);
  process.exit(hits.length ? 1 : 0);
}
