# Архитектура 3D-студии («Ё Конструктор»)

Краткая карта для того, кто открывает репозиторий впервые. Подробная история — [CLAUDE-BRANCH.md](CLAUDE-BRANCH.md),
карта файлов — [INDEX.md](INDEX.md). Правило Макса: **всё как в Базисе; студия ничего не добавляет сверх Базиса в кухни;
правила Базиса — только для модулей из Базиса, шкафы студии не меняются.**

## 1. Три вида модулей

Один и тот же `Module` (`src/model.ts`) живёт в трёх режимах. Режим определяет, какие правила применяются и кто считает детали.

| Вид | Признак | Кто строит | Правила | Где считаются детали |
|---|---|---|---|---|
| **Шкаф студии** | нет `m.kitchen` и нет `m.raw` | пользователь в студии (палитра корпусов, шаблоны `initialModule()`, купе `kupe.ts`, угловые `cornerWardrobe.ts`) | правила цеха и ТЗ Макса: `validate()`, `WORKSHOP-RULES.md`; **не меняются ради кухонь** | `parts()` в `model.ts`, крепёж `drilling.ts`, кромка `edges.ts` |
| **Кухня из Базиса — параметрика** | `m.kitchen` (`KitchenSpec`), `m.bazis`/`kitchen.bazis` | `scripts/kitchen/*` распознаёт эталон Базиса (`fromEtalon.ts`, `recognize-*.ts`, `buildKitchen.ts`) и пишет `kitchen-k*.json`; в студии правится панелью `KitchenPanel.tsx` | правила Базиса: `kitchen.ts` (царги, торцы, крепёж, Gola, ошибки `kitchenErrors`), `kitchenDrawers.ts` (ящики, направляющие комплектами на ящик — `guideKits.ts`), `kitchenRafix.ts`, `kitchenLift.ts`; опоры кухонь не трогать | `parts()` по веткам `m.kitchen` в `model.ts` + те же `drilling.ts`/`edges.ts` |
| **Сырой модуль «как есть»** | `m.raw` (`RawModule`, `source: 'bazis' \| 'bazis-kitchen' \| 'bazis-corpus'`) | импорт сцены Базиса без распознавания: `scripts/wardrobe/import.ts` (шкафы базы заказов → `public/local-projects/wardrobe-NNN.json`), сырые кухни | никаких правил студии: детали, фурнитура и их положение — из Базиса; `validate` только по пересечениям | `rawModule.ts` (детали, смета по записям Базиса) |

Отличить модуль Базиса от студийного — только через `isBazisModule()` (`src/project.ts`), не по косвенным полям.

Регрессия на «шкафы студии не изменились»: `npx tsx scripts/parts-snapshot.ts` (эталон `tests/fixtures`/снимок; `kitchen-*`
и `wardrobe-NNN.json` из local-projects исключены — `scripts/wardrobe/files.ts`).

## 2. Поток данных

```
Базис (.b3d → b3d-tools → model.json, корпус Кухни/corpus)   пользователь в студии
        │ scripts/kitchen/*  (эталон → KitchenSpec)                │ App.tsx + панели
        │ scripts/wardrobe/* (сцена → RawModule)                   ▼
        ▼                                                   Project (src/project.ts)
   kitchen-k*.json / wardrobe-NNN.json  ──parseProject──▶  modules[] : PlacedModule{ module: Module }
                                                                   │
                     ┌──────────────┬──────────────┬───────────────┼───────────────┬──────────────┐
                     ▼              ▼              ▼               ▼               ▼              ▼
                 parts()        collisions.ts   pricing.ts     packing.ts /    drawings.ts    exports.ts /
               (model.ts,      (пересечения,   (estimate:      guillotine.ts   (чертежи,      reviewPackage.ts
                rawModule.ts)   фурнитура)      листы, крепёж,  (раскрой)       бирки)        (ZIP технологу,
                                                фурнитура)                                     PDF, CSV)
                     ▼
                 Scene.tsx (three.js: boardGeometry, mesh/meshModels, hardwareModels, vernissageGeometry)
```

- `Project` хранится в `localStorage` (`projectStorage.ts`, индекс клиентов `clientIndex.ts`) и в кабинете на сервере (`studioApi.ts`,
  `CloudPanel.tsx`; сервер — [SERVER-CABINET.md](SERVER-CABINET.md), аккаунты — [ACCOUNTS-SETUP.md](ACCOUNTS-SETUP.md)).
- Парсинг старых JSON — `parseModule`/`parseProject` (`model.ts`, `project.ts`): новое поле без строки в parse теряется молча,
  поэтому на каждое новое поле — round-trip-тест.
- Помещение: `roomGeometry.ts`, `bazisRoom.ts` (импорт замера Базиса), `RoomEditor.tsx`/`RoomPlan.tsx`, предупреждения `roomWarnings.ts`.

## 3. Интерфейс: этапы и панели

`App.tsx` ведёт проект по этапам (`src/stages.ts`, полоса `StageBar.tsx`). Элементы интерфейса помечены `data-stages="…"`
(через пробел — на каких этапах элемент виден): `room` (помещение), `fixtures` (коммуникации), `bodies` (корпуса),
`filling` (наполнение), далее фасады, смета и фурнитура. Нижний док `ProjectDock.tsx` — вкладки «Детали», «Смета»
(`EstimatePanel.tsx`), «Документы» (`DrawingsPanel.tsx`, `OutputPanel.tsx`), «Фурнитура».

Панели по видам модулей: `ModulePalette.tsx`/`ModuleLibrary.tsx` (шкафы студии), `KitchenPalette.tsx`/`KitchenPanel.tsx`
(кухни Базиса), `WardrobeBase.tsx` (сырые шкафы базы), `KupePanel.tsx` (купе), `CornerStudio.tsx` (угловые),
`VernissagePicker.tsx` (фасады Вернисаж), `RadialMenu.tsx` (меню правой кнопки), `ClientWorkspace.tsx` (клиенты и проекты).
Стили: `style.css` + `layout-fixes.css` (подключается последним).

## 4. Где живут правила Базиса (и только там)

- `src/kitchen.ts` — `KitchenSpec`, торцы/кромка, крепёж стыков, Gola, `kitchenErrors`.
- `src/kitchenDrawers.ts`, `src/guideKits.ts` — ящики Firmax / Axis PRO / Versalite / Indigo / MODERN SLIDE / СТАРТ; направляющие **комплектами на ящик**.
- `src/kitchenRafix.ts`, `src/kitchenLift.ts` — рафикс, подъёмники.
- `src/kitchenProject.ts` — ряды кухни, `rowResize.ts` — изменение ширины ряда.
- `scripts/kitchen/*` — распознаватели эталонов и сверки: `batch.ts` (пакеты base-doors, wall, base-drawers, base-sink, antresol, tall),
  `whole.ts` (целая кухня), `bazis-only.ts` (ничего сверх Базиса), `audit-additions.ts` (строки сверх Базиса), `compare.ts`.

Эталоны (`Кухни/corpus`, `public/local-projects`) и имена клиентских папок в git не хранятся; в коде, тестах и отчётах —
только номера проектов (k25, wardrobe-012). Проверка — `py -I scripts/privacy-scan.py`.

## 5. Карта тестов (`npm test` = `tsx --test "tests/*.test.ts"`)

| Область | Тесты |
|---|---|
| Ядро шкафа студии | `model`, `workshop`, `section-layout`, `hinges`, `hardware-choice`, `hardware-models`, `collisions`, `packing`, `cutting-bazis`, `row-resize` |
| Проект, клиенты, кабинет | `project`, `client-index`, `manager-workflow`, `dock`, `compare`, `room`, `room-document`, `room-plan` |
| Купе, угловые, Вотан, Вернисаж | `kupe`, `corner-wardrobe`, `corner-integration`, `votan`, `vernissage` |
| Смета | `pricing`, `kitchen-guide-kits` |
| Кухни Базиса (параметрика) | `kitchen`, `kitchen-grooves`, `kitchen-sink`, `kitchen-drawers`, `kitchen-gola`, `kitchen-ui`, `kitchen-lift`, `kitchen-tall`, `kitchen-firmax-etalon`, `kitchen-versalite`, `kitchen-start`, `kitchen-indigo`, `kitchen-modern`, `kitchen-depth-refit`, `kitchen-meshes`, `kitchen-plinth-etalon`, `kitchen-base-asis`, `kitchen-wall`, `kitchen-rafix`, `kitchen-antresol`, `kitchen-base-n4`, `kitchen-n4-drawers`, `kitchen-wall-n4`, `kitchen-tall-n4`, `kitchen-n6-drawers`, `kitchen-editing`, `kitchen-alignment` |
| «Ничего сверх Базиса», целые кухни | `kitchen-no-additions`, `kitchen-bazis-whole`, `kitchen-whole-n4`, `k08-complete` |
| Сырые модули | `raw-kitchen`, `wardrobe-import` |
| Premial | `premial-pullout`, `premial-sink` |
| Playwright (`npm run test:ui`, `test:rooms`) | `editor.spec`, `accounts.spec`, `room-workspace.spec` |

Тесты, читающие `public/local-projects`, обязаны пропускаться (`skip`), если папки нет — в git её нет.
