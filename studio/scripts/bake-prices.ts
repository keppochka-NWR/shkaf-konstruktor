/** Запекание клиентских цен в публичную сборку (магазин п.1, решение 16.10.2026): в открытом JS нет закупочных чисел и коэффициентов.
 *  Плагин Vite (только `vite build` без STUDIO_MANAGER=1, enforce 'pre' — по исходникам TS) переписывает числа в таблицах цен
 *  src/ по правилам BAKE_RULES: закупка → закупка × коэффициент (общий коэффициент сметы MARKUP_DEFAULT, у Вернисажа — свой,
 *  профили купе — × KUPE_PROFILE_MULT), а сами коэффициенты → 1. Браузер публичной сборки считает только от розничных чисел;
 *  менеджерская сборка (dev, тесты, STUDIO_MANAGER=1) не меняется и сохраняет себестоимость.
 *  Коэффициенты берутся из тех же исходников (pricing.ts, kupeData.ts), поэтому смена коэффициента в коде меняет и сборку.
 *  Оценочные формулы (slidePrice: «+50 ₽ на 50 мм», «≈ 55 %») считаются от запечённых чисел — их строки могут сдвинуться на
 *  несколько рублей округления; итог проекта округляется до 100 ₽ (тест tests/bake-prices.test.ts на типовых заказах).
 *  Тот же разбор даёт множество исходных закупочных значений для стража publish.ps1 (purchaseValues → scripts/price-guard.ts). */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseAst} from 'rolldown/parseAst';

type Coef = 'markup' | 'vernissage' | 'kupeProfile';
type Rule = {
  file: string; coef: Coef;
  /** числовые значения свойств с этими ключами (в любом месте файла) */
  props?: string[];
  /** все числа внутри значения свойства с этим ключом (вложенные таблицы: prices Вернисажа) */
  subtreeProps?: string[];
  /** все числа в инициализаторе объявления с этим именем */
  decls?: string[];
  /** числовой аргумент вызова функции: имя → индекс аргумента цены */
  calls?: Record<string, number>;
  /** как calls, но исходная розница остаётся следующим аргументом (ревью R5: розница Лемана для модели «цена за лист» — без коэффициента;
   *  это публичная цена гипермаркета, не закупка цеха): lemana(…, 98) → lemana(…, 215.6, 98) */
  shelfCalls?: Record<string, number>;
  /** числа с этими значениями внутри функции (оценочные формулы) */
  fnLits?: Record<string, number[]>;
  /** число, умноженное на идентификатор (steps*50 — шаг цены), внутри функции */
  fnMulIdent?: Record<string, string[]>;
};
export const BAKE_RULES: Rule[] = [
  { file: 'pricing.ts', coef: 'markup', props: ['price'], decls: ['sheets', 'tierPrice', 'HDF_SHEET', 'SHOP_WORK_LDSP_SHEET', 'SHOP_WORK_HDF_SHEET', 'PULLOUT_PRICE'], calls: { add: 4 },
    fnLits: { slidePrice: [1040, 1729, 1100, 60] }, fnMulIdent: { slidePrice: ['steps'] } },
  { file: 'hardware.ts', coef: 'markup', props: ['price'] },
  { file: 'handles.ts', coef: 'markup', calls: { workshop: 3 }, shelfCalls: { lemana: 3 } },
  { file: 'mesh.ts', coef: 'markup', shelfCalls: { item: 6 } },
  { file: 'alu.ts', coef: 'markup', props: ['perM2'] }, // стекло крыши (закупка АТБ); рамка — цены клиента из aluData.ts, не запекаются
  { file: 'model.ts', coef: 'markup', props: ['glassTopTemper', 'glassTopPolishPerM'] },
  { file: 'vernissageData.ts', coef: 'vernissage', subtreeProps: ['prices'], props: ['patinaPerM2', 'hingeBoringPerPc', 'enamelMatteLacquerPerM2'] },
  { file: 'kupeData.ts', coef: 'kupeProfile', props: ['ruchka', 'verh', 'niz', 'razd', 'top', 'bot'] },
];
/** Коэффициенты и константы, которые в публичной сборке становятся нейтральными. */
export const BAKE_SETS: { file: string; name: string; value: number }[] = [
  { file: 'pricing.ts', name: 'MARKUP_DEFAULT', value: 1 },
  { file: 'pricing.ts', name: 'VERNISSAGE_MARKUP_DEFAULT', value: 1 },
  // цена клиенту за лист в модели «цена за лист» — экономика цеха; в публичной сборке модель — только с ценой листа проекта
  { file: 'pricing.ts', name: 'SHEET_PRICE_DEFAULT', value: 0 },
  { file: 'kupeData.ts', name: 'KUPE_PROFILE_MULT', value: 1 },
];
/** Во всех модулях: коэффициент в значениях по умолчанию ({markup:2.2,overrides:{}}) → 1. */
export const BAKE_GLOBAL_PROPS = ['markup', 'vernissageMarkup'];

export type Coefs = Record<Coef, number>;
const num = (src: string, re: RegExp, what: string) => { const m = re.exec(src); if (!m) throw Error('bake-prices: не найден ' + what); return Number(m[1]); };
/** Коэффициенты из исходников: MARKUP_DEFAULT и VERNISSAGE_MARKUP_DEFAULT (pricing.ts), KUPE_PROFILE_MULT (kupeData.ts). */
export function readCoefs(srcDir: string): Coefs {
  const pricing = readFileSync(resolve(srcDir, 'pricing.ts'), 'utf8'), kupe = readFileSync(resolve(srcDir, 'kupeData.ts'), 'utf8');
  return {
    markup: num(pricing, /export const MARKUP_DEFAULT\s*=\s*([\d.]+)/, 'MARKUP_DEFAULT'),
    vernissage: num(pricing, /export const VERNISSAGE_MARKUP_DEFAULT\s*=\s*([\d.]+)/, 'VERNISSAGE_MARKUP_DEFAULT'),
    kupeProfile: num(kupe, /export const KUPE_PROFILE_MULT\s*=\s*([\d.]+)/, 'KUPE_PROFILE_MULT'),
  };
}

type Node = { type: string; start: number; end: number; [k: string]: unknown };
export type BakeEdit = { start: number; end: number; text: string; was: number; now: number; key: string };
const keyName = (p: Node) => { const k = p.key as Node | undefined; if (!k) return null; return k.type === 'Identifier' ? (k.name as string) : k.type === 'Literal' && typeof k.value === 'string' ? (k.value as string) : null; };
const isNum = (n: unknown): boolean => !!n && (n as Node).type === 'Literal' && typeof (n as Node).value === 'number';
const fmt = (v: number) => String(Math.round(v * 100) / 100);
const ruleFile = (file: string) => file.replace(/\\/g, '/').replace(/^(.*\/)?src\//, '');

/** Правки одного модуля src/ (путь — любой, сравнивается имя от src/). */
export function bakeEdits(code: string, file: string, coefs: Coefs): BakeEdit[] {
  const rel = ruleFile(file), rules = BAKE_RULES.filter((r) => r.file === rel), sets = BAKE_SETS.filter((s) => s.file === rel);
  const lang = file.endsWith('.tsx') ? 'tsx' : file.endsWith('.ts') ? 'ts' : file.endsWith('x') ? 'jsx' : 'js';
  if (!rules.length && !sets.length && !BAKE_GLOBAL_PROPS.some((k) => code.includes(k))) return [];
  const ast = parseAst(code, { lang }, file) as unknown as Node;
  const edits = new Map<number, BakeEdit>();
  const put = (n: Node, now: number, key: string) => { if (edits.has(n.start)) return; edits.set(n.start, { start: n.start, end: n.end, text: fmt(now), was: n.value as number, now: Math.round(now * 100) / 100, key }); };
  const bake = (n: Node, k: number, key: string) => { if (isNum(n) && (n.value as number) !== 0) put(n, (n.value as number) * k, key); };
  // все числа поддерева, кроме ключей объектов
  const all = (n: unknown, k: number, key: string, parent: Node | null = null, pk = '') => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const c of n) all(c, k, key, parent, pk); return; }
    const node = n as Node; if (typeof node.type !== 'string') return;
    if (parent && parent.type === 'Property' && pk === 'key') return;
    if (isNum(node)) { bake(node, k, key); return; }
    if (node.type.startsWith('TS') && node.type !== 'TSAsExpression' && node.type !== 'TSSatisfiesExpression' && node.type !== 'TSNonNullExpression') return;
    for (const c of Object.keys(node)) if (c !== 'type' && c !== 'start' && c !== 'end') all(node[c], k, key, node, c);
  };
  const visit = (n: unknown, fn: string | null) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const c of n) visit(c, fn); return; }
    const node = n as Node; if (typeof node.type !== 'string') return;
    let inFn = fn;
    if (node.type === 'FunctionDeclaration' && (node.id as Node | null)?.name) inFn = (node.id as Node).name as string;
    if (node.type === 'Property') {
      const key = keyName(node), v = node.value as Node;
      if (key && BAKE_GLOBAL_PROPS.includes(key) && isNum(v) && (v.value as number) !== 0) put(v, 1, key);
      for (const r of rules) {
        if (key && r.props?.includes(key)) bake(v, coefs[r.coef], key);
        if (key && r.subtreeProps?.includes(key)) all(v, coefs[r.coef], key);
      }
    }
    if (node.type === 'VariableDeclarator') {
      const name = (node.id as Node)?.name as string | undefined, init = node.init as Node | null;
      for (const s of sets) if (name === s.name && init && isNum(init)) put(init, s.value, name);
      for (const r of rules) if (name && r.decls?.includes(name)) all(init, coefs[r.coef], name);
    }
    if (node.type === 'CallExpression') {
      const callee = node.callee as Node, args = node.arguments as Node[];
      for (const r of rules) { const i = callee.type === 'Identifier' ? r.calls?.[callee.name as string] : undefined; if (i !== undefined && args[i]) bake(args[i], coefs[r.coef], callee.name + '()'); }
      for (const r of rules) { const i = callee.type === 'Identifier' ? r.shelfCalls?.[callee.name as string] : undefined; const a = i === undefined ? undefined : args[i];
        if (a && isNum(a) && (a.value as number) !== 0 && !args[i! + 1] && !edits.has(a.start)) { const was = a.value as number, now = was * coefs[r.coef];
          edits.set(a.start, { start: a.start, end: a.end, text: fmt(now) + ', ' + fmt(was), was, now: Math.round(now * 100) / 100, key: callee.name + '()' }); } }
    }
    if (inFn) for (const r of rules) {
      const lits = r.fnLits?.[inFn]; if (lits && isNum(node) && lits.includes(node.value as number)) bake(node, coefs[r.coef], inFn);
      const ids = r.fnMulIdent?.[inFn];
      if (ids && node.type === 'BinaryExpression' && node.operator === '*') {
        const l = node.left as Node, rr = node.right as Node;
        if (l.type === 'Identifier' && ids.includes(l.name as string)) bake(rr, coefs[r.coef], inFn);
        if (rr.type === 'Identifier' && ids.includes(rr.name as string)) bake(l, coefs[r.coef], inFn);
      }
    }
    for (const k of Object.keys(node)) if (k !== 'type' && k !== 'start' && k !== 'end') visit(node[k], inFn);
  };
  visit(ast, null);
  return [...edits.values()];
}
export function applyBake(code: string, edits: BakeEdit[]): string {
  let out = code;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}
/** Закупочные значения исходных таблиц с контекстом поля цены (ключ свойства) — для стража publish.ps1. Коэффициенты — с ключом
 *  markup/vernissageMarkup и именем константы. Позиционные цены (add(…, 45, …)) ключа в JS не имеют — их проверяет тест сборки. */
export function purchaseValues(srcDir: string): { key: string; value: number; file: string }[] {
  const coefs = readCoefs(srcDir), out: { key: string; value: number; file: string }[] = [];
  const files = new Set([...BAKE_RULES.map((r) => r.file), ...BAKE_SETS.map((s) => s.file)]);
  for (const f of files) {
    const code = readFileSync(resolve(srcDir, f), 'utf8');
    for (const e of bakeEdits(code, f, coefs)) if (/^[A-Za-z_$][\w$]*$/.test(e.key) && e.was !== e.now) out.push({ key: e.key, value: e.was, file: f });
  }
  // закупка, совпавшая с запечённой розницей того же поля (шариковые 300 мм: 500 × 2,2 = 1100 = закупка скрытых 350 мм),
  // в сборке неотличима от розницы — такие значения стражем не ищутся
  const bakedNow = new Set<string>();
  for (const f of files) for (const e of bakeEdits(readFileSync(resolve(srcDir, f), 'utf8'), f, coefs)) bakedNow.add(e.key + ':' + e.now);
  return out.filter((v) => !bakedNow.has(v.key + ':' + v.value));
}

/** Плагин Vite публичной сборки. Журнал — test-results/public-bake.txt (vite.config.ts). */
export function bakePricesPlugin(srcDir: string, log: string[]) {
  const coefs = readCoefs(srcDir);
  return {
    name: 'bake-client-prices',
    apply: 'build' as const,
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?')[0].replace(/\\/g, '/');
      if (!/\/studio\/src\/.*\.tsx?$/.test(file)) return null;
      const edits = bakeEdits(code, file, coefs);
      if (!edits.length) return null;
      log.push(ruleFile(file) + ': ' + edits.length + ' чисел');
      return { code: applyBake(code, edits), map: null };
    },
  };
}
