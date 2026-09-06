import { test, expect } from "@playwright/test";
test("complete editing, persistence, validation, undo and download", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/studio/");
  await expect(page.getByRole("heading", { name: "Ваш проект" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByLabel("Ширина", { exact: true }).fill("1100");
  await page.getByLabel("Ширина", { exact: true }).press("Enter");
  await expect(page.getByLabel("Ширина", { exact: true })).toHaveValue("1100");
  await page.getByLabel("Высота", { exact: true }).fill("3000");
  await page.getByLabel("Высота", { exact: true }).press("Enter");
  await expect(page.getByRole("alert")).toContainText("2500");
  await expect(page.getByLabel("Высота", { exact: true })).toHaveValue("2000");
  await page.getByLabel("Закрыть сообщение").click();
  await page.getByLabel("Отменить", { exact: true }).click();
  await expect(page.getByLabel("Ширина", { exact: true })).toHaveValue("1000");
  await page.getByLabel("Повторить", { exact: true }).click();
  await expect(page.getByLabel("Ширина", { exact: true })).toHaveValue("1100");
  await page
    .getByRole("button", { name: "Материал Белый", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Ширина", { exact: true })).toHaveValue("1100");
  await expect(page.locator(".material-choice")).toContainText("Белый");
  await page.getByRole("switch", { name: "Распашные фасады" }).click();
  await expect(
    page.getByRole("switch", { name: "Распашные фасады" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("Открыть фасады", { exact: true }).click();
  for (const name of ["Спереди", "Сбоку", "Сверху", "3D"])
    await page.getByRole("button", { name, exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать", exact: true }).click();
  expect((await download).suggestedFilename()).toContain(".project.json");
  await page.getByRole("button", { name: /деталей/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Фальш-панель", { exact: true })).toBeVisible();
  await page.getByLabel("Закрыть окно").click();
  expect(errors).toEqual([]);
});
test("section edit and invalid import preserve existing model", async ({
  page,
}) => {
  await page.goto("/studio/");
  await page
    .getByRole("button", { name: "Пустой корпус", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Разделить пополам", exact: true })
    .click();
  await expect(page.locator(".section-picker button")).toHaveCount(2);
  await page.getByLabel("Внутренняя ширина", { exact: true }).fill("400");
  await page.getByLabel("Внутренняя ширина", { exact: true }).press("Enter");
  await expect(
    page.getByLabel("Внутренняя ширина", { exact: true }),
  ).toHaveValue("400");
  await page
    .getByRole("button", { name: "Добавить полку", exact: true })
    .click();
  await expect(page.getByLabel("Полка 1", { exact: true })).toBeVisible();
  await page.getByLabel("Полка 1", { exact: true }).fill("650");
  await page.getByLabel("Полка 1", { exact: true }).press("Enter");
  await expect(page.getByLabel("Полка 1", { exact: true })).toHaveValue("650");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":1}'),
    });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".section-picker button")).toHaveCount(2);
});
test("canvas resizes, materials load and layouts remain usable", async ({
  page,
}) => {
  const failed: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/assets/tex/") && r.status() !== 200)
      failed.push(r.url());
  });
  await page.goto("/studio/");
  await page.waitForTimeout(1200);
  for (const [width, height] of [
    [1920, 1080],
    [1280, 720],
    [1400, 860],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    const box = await page.locator("canvas").boundingBox();
    expect(box?.width).toBeGreaterThan(150);
    expect(box?.height).toBeGreaterThan(150);
    expect(box!.width).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(failed).toEqual([]);
  await page.setViewportSize({ width: 1400, height: 860 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "test-results/studio-desktop.png",
    fullPage: true,
  });
});
