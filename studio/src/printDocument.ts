// Настоящий PDF без внешних сервисов: документ печатается из скрытого фрейма через window.print() — в диалоге браузера
// «Сохранить как PDF» (Chrome, Edge, Яндекс; в Safari — «Экспорт в PDF»). Печатная вёрстка — @media print/@page A4 в самом документе.
/** Открыть диалог печати документа. Возвращает false, если браузер не дал напечатать (тогда остаётся скачать HTML). */
export function printDocument(html: string, title: string): boolean {
  try {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.title = title;
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.append(frame);
    const w = frame.contentWindow, d = frame.contentDocument;
    if (!w || !d) { frame.remove(); return false; }
    d.open(); d.write(html); d.close();
    d.title = title; // имя файла PDF по умолчанию — заголовок документа
    const cleanup = () => setTimeout(() => frame.remove(), 1000);
    w.addEventListener("afterprint", cleanup, { once: true });
    const go = () => { w.focus(); w.print(); setTimeout(() => { if (frame.isConnected) frame.remove(); }, 60000); };
    // картинки (вид проекта) должны загрузиться до печати
    const images = Array.from(d.images).filter((img) => !img.complete);
    if (images.length) Promise.all(images.map((img) => new Promise((r) => { img.onload = img.onerror = r; }))).then(go); else setTimeout(go, 50);
    return true;
  } catch { return false; }
}
