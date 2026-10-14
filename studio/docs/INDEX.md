# Карта репозитория studio/

Что где лежит. Архитектура — [ARCHITECTURE.md](ARCHITECTURE.md), история шагов — [CLAUDE-BRANCH.md](CLAUDE-BRANCH.md).

## docs/

| Файл | О чём |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | три вида модулей, поток данных, этапы интерфейса, где живут правила Базиса, карта тестов |
| [CLAUDE-BRANCH.md](CLAUDE-BRANCH.md) | журнал ветки `claude/studio` по шагам (что, почему, какие тесты) |
| [WORKSHOP-RULES.md](WORKSHOP-RULES.md) | правила цеха для шкафов студии |
| [SERVER-CABINET.md](SERVER-CABINET.md) | сервер кабинета (актуально: вход по логину с 04.10.2026) |
| [ACCOUNTS-SETUP.md](ACCOUNTS-SETUP.md) | как заводить аккаунты менеджеров (паролей в репозитории нет) |
| [ROADMAP-CRM-SECURITY.md](ROADMAP-CRM-SECURITY.md) | план CRM/защиты от 07.09 — устарел с 04.10, оставлен как история |
| ITERATION-*.md | старые итерации Codex |

## scripts/ — запуск `npx tsx scripts/<имя>.ts`, Python — `py -I scripts/<имя>.py`

| Группа | Скрипты |
|---|---|
| Публикация и гигиена | `publish.ps1` (сборка → проверки → robocopy в Pages; `-DryRun` без commit/push), `privacy-scan.py` (имена клиентских папок в текстах; вывод без самих имён), `parts-snapshot.ts` (регрессия «шкафы студии без изменений»), `catalog.cjs` (каталог Lamarty для сборки), `serve.cjs` |
| Кухни Базиса | `kitchen/` — `batch.ts`, `whole.ts`, `bazis-only.ts`, `audit-additions.ts`, `compare.ts`, `fromEtalon.ts`, `recognize-*.ts`, `buildKitchen.ts`; `kitchen-check.ts`, `kitchen-demo.ts`, `kitchen-sample.ts`, `kitchen-shots.ts`, `kitchen-ui-shots.ts` |
| Шкафы базы заказов (сырые) | `wardrobe/` — `import.ts`, `xform.ts`, `pack.ts`, `files.ts` |
| Заказы цеха в студии | `orders.ts` (→ `examples/orders/*.project.json`, только номера заказов), `order-7358873.ts` (личный проект → local-projects) |
| Снимки и аудиты интерфейса | `shot.ts`, `stage-shots.ts`, `project-shots.ts`, `dock-shots.ts`, `dims-shots.ts`, `radial-shots.ts`, `hardware-shots.ts`, `hardware-closeup.ts`, `first-run.ts`, `overflow-audit.ts`, `rmb-jitter.ts`, `client-shots.ts`, `vernissage-shots.ts` |
| Купе | `import-kupe.cjs`, `make-kupe-example.ts`, `kupe-price.ts`, `kupe-shots.ts`, `kupe-closeup.ts`, `kupe-profile-shots.ts`, `dump-kupe-parts.ts`, `draw_kupe_*.py`, `kupe_profile_shapes.py`, `profile_*.py`, `extract_aristo_*.py`, `scan_catalog_sections.py`, `aristo_*.json` |
| Вернисаж | `vernissage_data.py`, `vernissage_passports.py`, `vernissage_textures.py` |
| Фурнитура и 3D-модели | `blender_*.py`, `handle-kinds.ts`, `layout-boxes.ts`, `module-card.ts`, `export-corner.ts` |
| Раскрой и коллизии | `b3d-cutting.ts`, `bazis-cutting-dataset.py`, `cutting-bench.ts`, `collision-report.ts`, `check-filling.ts` |
| Отладка разработчика | `dev-parse-check.ts <project.json>` (round-trip parseProject), `dev-probe-parts.ts` (детали модуля) — не для CI |

Временные `_*.ts` в `scripts/` не коммитятся; черновики лежат вне репозитория (`Кухни\ГардерЁб\audit-1011\scratch`).

## tests/

`npm test` подхватывает все `tests/*.test.ts` (node:test через tsx); Playwright — `*.spec.ts` (`npm run test:ui`, `npm run test:rooms`).
Группировка по областям — в [ARCHITECTURE.md §5](ARCHITECTURE.md#5-карта-тестов-npm-test--tsx---test-teststestts).
Фикстуры — `tests/fixtures/`.

## src/ — основные точки входа

`main.tsx` → `App.tsx` (этапы, панели) → `Scene.tsx` (three.js). Модель: `model.ts` (Module, parts, validate, parseModule),
`project.ts` (Project, parseProject, isBazisModule), `kitchen*.ts` (правила Базиса), `rawModule.ts` (как есть),
`pricing.ts` (смета), `packing.ts`/`guillotine.ts` (раскрой), `drawings.ts`/`exports.ts`/`reviewPackage.ts` (документы).

## Вне git (локально)

`public/local-projects/` (эталоны кухонь `kitchen-k*.json`, шкафы базы `wardrobe-NNN.json`, личные проекты), `public/models/hardware/bazis`
(GLB), `../web/studio` после сборки (публикуется `publish.ps1`).
