import { expect, test, type Page } from "@playwright/test";
import { waitForServiceWorker } from "./helpers";

const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true });

async function newInspection(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "New inspection" }).click();
  await expect(page).toHaveURL(/#\/inspections\/[0-9a-f-]{36}$/);
  await expect(field(page, "Job number")).toBeVisible();
}

async function fillJob(page: Page) {
  await field(page, "Job number").fill("SY000001");
  await field(page, "Job name").fill("Example Apartments");
  await field(page, "Client name").fill("Alex Example");
  await field(page, "Client company").fill("Example Builders Pty Ltd");
  await field(page, "Address line 1").fill("1 Sample Street");
  await field(page, "Address line 2").fill("Exampleville NSW 2000");
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
}

test("creates an inspection, autosaves every field and keeps it after reload", async ({
  page,
}) => {
  await newInspection(page);
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await expect(field(page, "Date")).toHaveValue(today);
  await expect(page.getByTestId("missing-fields")).toHaveText(
    "Job number and job name are needed before a memo can be created.",
  );

  await fillJob(page);
  await expect(page.getByTestId("inspection-title")).toHaveText(
    "SY000001 – Example Apartments",
  );
  await expect(page.getByTestId("missing-fields")).toHaveCount(0);

  await page.reload();
  await expect(field(page, "Job number")).toHaveValue("SY000001");
  await expect(field(page, "Client company")).toHaveValue(
    "Example Builders Pty Ltd",
  );
  await expect(field(page, "Address line 2")).toHaveValue(
    "Exampleville NSW 2000",
  );

  await page.getByRole("link", { name: "‹ Inspections" }).click();
  const card = page
    .getByRole("listitem")
    .filter({ hasText: "SY000001 – Example Apartments" });
  await expect(card).toContainText("Example Builders Pty Ltd");
  await expect(card).toContainText("Edited");
});

test("saves an edit made just before leaving the screen", async ({ page }) => {
  await newInspection(page);
  const url = page.url();
  await field(page, "Job name").fill("Quick edit");
  // Leave immediately, before the autosave delay has passed.
  await page.getByRole("link", { name: "‹ Inspections" }).click();
  await expect(page.getByRole("listitem")).toContainText("Quick edit");
  await page.goto(url);
  await expect(field(page, "Job name")).toHaveValue("Quick edit");
});

test("deletes an inspection only after confirming", async ({ page }) => {
  await newInspection(page);
  await fillJob(page);
  await page.getByRole("link", { name: "‹ Inspections" }).click();

  const deleteButton = page.getByRole("button", {
    name: "Delete SY000001 – Example Apartments",
  });
  await deleteButton.click();
  const dialog = page.getByRole("dialog", { name: "Delete inspection?" });
  await expect(dialog).toContainText("SY000001 – Example Apartments");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);

  await deleteButton.click();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No inspections yet")).toBeVisible();
});

test("deletes from the inspection screen", async ({ page }) => {
  await newInspection(page);
  await page.getByRole("button", { name: "Delete inspection" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByText("No inspections yet")).toBeVisible();
});

test("new inspections take the inspector from My details", async ({ page }) => {
  await page.goto("./#/settings");
  await field(page, "Inspector name").fill("Test Engineer");
  await field(page, "Title").fill("Structural Engineer");
  await expect(page.getByTestId("settings-save-state")).toHaveText("Saved");

  await page.reload();
  await expect(field(page, "Inspector name")).toHaveValue("Test Engineer");

  await newInspection(page);
  await expect(field(page, "Inspector")).toHaveValue("Test Engineer");
});

// Tagged @offline: runs in the Chromium project only (see playwright.config.ts).
test(
  "creates and saves an inspection offline",
  { tag: "@offline" },
  async ({ page, context }) => {
    await page.goto("./");
    await waitForServiceWorker(page);
    await context.setOffline(true);
    await page.reload();

    await page.getByRole("button", { name: "New inspection" }).click();
    await fillJob(page);
    await page.reload();
    await expect(field(page, "Job number")).toHaveValue("SY000001");
  },
);
