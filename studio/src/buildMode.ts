/** Режим сборки. Публичная сборка (сайт, `npm run build` без STUDIO_MANAGER=1) — только клиентские цены: строки сметы
 *  уже умножены на коэффициент, без себестоимости и источников закупки (см. clientPrices.ts и scripts/public-build.ts).
 *  Менеджерский расчёт (себестоимость, коэффициенты, CSV сметы) — в dev-сервере, в тестах и в сборке с STUDIO_MANAGER=1.
 *  __PUBLIC_BUILD__ подставляет vite.config.ts (define); в tsx/тестах его нет — менеджерский режим. */
declare const __PUBLIC_BUILD__: boolean | undefined;
export const PUBLIC_BUILD: boolean = typeof __PUBLIC_BUILD__ !== 'undefined' && __PUBLIC_BUILD__ === true;
export const MANAGER_PRICING = !PUBLIC_BUILD;
