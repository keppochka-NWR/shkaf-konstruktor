// Минимальный писатель .xlsx (SpreadsheetML) без новых зависимостей: XML листов + стили, упаковка — zipSync из fflate,
// который уже лежит в three (three/addons/libs/fflate.module.js, как комплект технологу reviewPackage.ts).
// Только то, что нужно смете: строки, числа, формулы с готовым значением, стили, ширины колонок, закреплённая шапка,
// объединённые ячейки, печать A4 по ширине листа.

/** Стили ячеек (индексы cellXfs в styles.xml). */
export const XS = {
  text: 0, title: 1, header: 2, cell: 3, num: 4, money: 5, subLabel: 6, subMoney: 7, group: 8,
  totalLabel: 9, totalMoney: 10, note: 11, price: 12, numCenter: 13, subtitle: 14, area: 15, subNum: 16,
} as const;
export type XStyle = (typeof XS)[keyof typeof XS];
/** Ячейка: строка, число, формула (f — без «=», v — готовое значение для программ, которые не пересчитывают), пусто. */
export type XCell = { s?: XStyle } & ({ t: "s"; v: string } | { t: "n"; v: number } | { t: "f"; f: string; v: number | null } | { t: "e" });
export type XSheet = {
  name: string;
  rows: XCell[][];
  /** ширины колонок в символах */
  cols: number[];
  /** число закреплённых сверху строк (шапка таблицы) */
  freeze?: number;
  merges?: string[];
  landscape?: boolean;
  /** высота строки в пунктах (многострочные ячейки: не все программы подбирают высоту сами — строка выглядела пустой) */
  heights?: (number | undefined)[];
};
export const str = (v: string, s: XStyle = XS.cell): XCell => ({ t: "s", v, s });
export const num = (v: number, s: XStyle = XS.num): XCell => ({ t: "n", v, s });
export const fml = (f: string, v: number | null, s: XStyle = XS.money): XCell => ({ t: "f", f, v, s });
export const empty = (s: XStyle = XS.text): XCell => ({ t: "e", s });

/** Буква колонки: 0 → A, 26 → AA. */
export function colName(i: number): string { let s = ""; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
export const ref = (col: number, row: number) => colName(col) + (row + 1);

// XML 1.0: управляющие символы (кроме таба и переводов строк) недопустимы — убираем
const xml = (v: string) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const numText = (v: number) => (Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : "0");

function cellXML(c: XCell, r: string): string {
  const s = c.s ? ` s="${c.s}"` : "";
  if (c.t === "s") return `<c r="${r}"${s} t="inlineStr"><is><t xml:space="preserve">${xml(c.v)}</t></is></c>`;
  if (c.t === "n") return `<c r="${r}"${s}><v>${numText(c.v)}</v></c>`;
  if (c.t === "f") return `<c r="${r}"${s}><f>${xml(c.f)}</f>${c.v === null ? "" : `<v>${numText(c.v)}</v>`}</c>`;
  return `<c r="${r}"${s}/>`;
}
export function sheetXML(sh: XSheet): string {
  const width = Math.max(1, sh.cols.length, ...sh.rows.map((r) => r.length));
  const dim = `A1:${ref(width - 1, Math.max(0, sh.rows.length - 1))}`;
  const pane = sh.freeze ? `<pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${sh.freeze + 1}" sqref="A${sh.freeze + 1}"/>` : "";
  const cols = sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const rows = sh.rows.map((r, i) => `<row r="${i + 1}"${sh.heights?.[i] ? ` ht="${sh.heights[i]}" customHeight="1"` : ""}>${r.map((c, j) => cellXML(c, ref(j, i))).join("")}</row>`).join("");
  const merges = sh.merges?.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="${dim}"/><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${rows}</sheetData>${merges}<printOptions horizontalCentered="1"/><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${sh.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
const BORDER = `<left style="thin"><color rgb="FFC9D3D6"/></left><right style="thin"><color rgb="FFC9D3D6"/></right><top style="thin"><color rgb="FFC9D3D6"/></top><bottom style="thin"><color rgb="FFC9D3D6"/></bottom><diagonal/>`;
/** Шрифты: 0 обычный, 1 жирный, 2 заголовок 14, 3 жирный белый (шапка), 4 курсив серый (примечания), 5 жирный 12 (итог), 6 серый 10 (подзаголовок).
 *  Заливки: 2 шапка, 3 группа, 4 подытог, 5 итог. Форматы: 164 — рубли без копеек, 165 — с копейками, 166 — количество, 167 — м². */
export const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="4"><numFmt numFmtId="164" formatCode="#,##0&quot; ₽&quot;"/><numFmt numFmtId="165" formatCode="#,##0.00&quot; ₽&quot;"/><numFmt numFmtId="166" formatCode="#,##0.###"/><numFmt numFmtId="167" formatCode="0.000"/></numFmts><fonts count="7"><font><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="14"/><color rgb="FF23404C"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font><font><i/><sz val="9"/><color rgb="FF637C85"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="12"/><color rgb="FF23404C"/><name val="Arial"/><family val="2"/></font><font><sz val="10"/><color rgb="FF637C85"/><name val="Arial"/><family val="2"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF23595F"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7EFF0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F0E4"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFCE9C4"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border>${BORDER}</border><border><left/><right/><top style="medium"><color rgb="FF23404C"/></top><bottom style="medium"><color rgb="FF23404C"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="17"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf><xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="5" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="5" fillId="5" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf><xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf><xf numFmtId="167" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** Имя листа Excel: до 31 символа, без []:*?/\ . */
const sheetName = (s: string) => s.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Лист";
/** Все файлы книги (имя → XML) — отдельно от упаковки, чтобы тест проверял XML без распаковки. */
export function workbookFiles(sheets: XSheet[], title = ""): Record<string, string> {
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const files: Record<string, string> = {
    "[Content_Types].xml": head + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    "_rels/.rels": head + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    "docProps/core.xml": head + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)}</dc:title><dc:creator>Ё Конструктор</dc:creator></cp:coreProperties>`,
    "xl/workbook.xml": head + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${xml(sheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    "xl/_rels/workbook.xml.rels": head + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": STYLES_XML,
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXML(s); });
  return files;
}
/** Упаковка книги в .xlsx (zip). */
export async function workbookZip(files: Record<string, string>): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import("three/addons/libs/fflate.module.js");
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])), { level: 6 });
}
export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** Скачать книгу в браузере. */
export function saveBinary(name: string, data: Uint8Array, type = XLSX_TYPE) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(data).buffer], { type })), a = document.createElement("a");
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
