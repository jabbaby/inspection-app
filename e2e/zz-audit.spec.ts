// Throwaway: screenshots for the UI work. Not committed.
import { expect, test, type Page } from "@playwright/test";
import { startInspection } from "./helpers";

const OUT =
  "C:/Users/dsamson/AppData/Local/Temp/claude/C--Users-dsamson-Desktop-CODING-inspection-app/810a43c7-8b0f-4cfc-8964-500634173416/scratchpad/bento";

const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true });

test("dashboard and inspections", async ({ page }) => {
  const shot = async (name: string) => {
    for (const [o, size] of [
      ["land", { width: 1194, height: 834 }],
      ["port", { width: 834, height: 1194 }],
    ] as const) {
      await page.setViewportSize(size);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/v2-${name}-${o}.png` });
    }
    await page.setViewportSize({ width: 1194, height: 834 });
  };
  await page.goto("./");
  for (const [job, item] of [
    ["SY000001", "Level 3 slab reinforcement"],
    ["SY000002", "Footings"],
  ]) {
    await startInspection(page, {
      jobNumber: job,
      jobName: "Example Apartments",
    });
    await field(page, "Item inspected").fill(item);
    await field(page, "Client company").fill("Example Builders Pty Ltd");
    await expect(page.getByTestId("save-state")).toHaveText("Saved");
    await page.goto("./");
  }
  await shot("dashboard");
  await page.goto("./#/inspections");
  await shot("inspections");
  const row = page
    .getByRole("list", { name: "Recent inspections" })
    .getByRole("listitem")
    .first();
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width - 40, box.y + 28);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 200, box.y + 28, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/v2-swipe-land.png` });
});
