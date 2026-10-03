import { expect, test, type Page } from "@playwright/test";
import { openTab, startInspection, waitForServiceWorker } from "./helpers";

const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true });

async function newInspection(page: Page) {
  await page.goto("./");
  // A new inspection opens on its job details.
  await startInspection(page, { jobNumber: "SY000001", jobName: "" });
  await expect(page).toHaveURL(/#\/inspections\/[0-9a-f-]{36}\/details$/);
  await expect(field(page, "Job number")).toHaveValue("SY000001");
}

async function fillJob(page: Page) {
  await field(page, "Job number").fill("SY000001");
  await field(page, "Job name").fill("Example Apartments");
  await field(page, "Item inspected").fill("Level 3 slab reinforcement");
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
    "Job name is needed before a memo can be created.",
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
  await expect(field(page, "Item inspected")).toHaveValue(
    "Level 3 slab reinforcement",
  );

  await page.getByRole("link", { name: "Back to inspections" }).click();
  const card = page
    .getByRole("list", { name: "Recent inspections" })
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
  await page.getByRole("link", { name: "Back to inspections" }).click();
  await expect(
    page.getByRole("list", { name: "Recent inspections" }),
  ).toContainText("Quick edit");
  await page.goto(url);
  await expect(field(page, "Job name")).toHaveValue("Quick edit");
});

test("deletes an inspection only after confirming", async ({ page }) => {
  await newInspection(page);
  await fillJob(page);
  await page.getByRole("link", { name: "Back to inspections" }).click();

  const deleteButton = page.getByRole("button", {
    name: "Delete SY000001 – Example Apartments",
  });
  await deleteButton.click();
  const dialog = page.getByRole("dialog", { name: "Delete inspection?" });
  await expect(dialog).toContainText("SY000001 – Example Apartments");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page
      .getByRole("list", { name: "Recent inspections" })
      .getByRole("listitem"),
  ).toHaveCount(1);

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

test("an inspection has Pre-inspection, Inspection and Site memo tabs", async ({
  page,
}) => {
  await newInspection(page);
  await fillJob(page);
  const tabs = page.getByRole("navigation", { name: "Inspection sections" });
  const tab = (name: string) => tabs.getByRole("link", { name, exact: true });
  await expect(tab("Pre-inspection")).toHaveAttribute("aria-current", "page");

  // Opening it again goes to the Inspection tab.
  await page.getByRole("link", { name: "Back to inspections" }).click();
  await page
    .getByRole("list", { name: "Recent inspections" })
    .getByRole("link")
    .click();
  await expect(page).toHaveURL(/\/inspection$/);
  await expect(tab("Inspection")).toHaveAttribute("aria-current", "page");
  // No drawings yet: the step starts by adding them.
  await expect(page.getByRole("heading", { name: "Drawings" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add drawings" }),
  ).toBeVisible();
  await expect(field(page, "Job number")).toHaveCount(0);

  await openTab(page, "Site memo");
  await expect(tab("Site memo")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Create memo" })).toBeEnabled();
  // Photos live here, grouped as in the appendix.
  await expect(page.getByRole("heading", { name: "Photos" })).toBeVisible();

  await openTab(page, "Pre-inspection");
  await expect(field(page, "Job number")).toHaveValue("SY000001");
  await expect(
    page.getByRole("button", { name: "Delete inspection" }),
  ).toBeVisible();
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

    await startInspection(page, { jobNumber: "SY000001", jobName: "" });
    await fillJob(page);
    await page.reload();
    await expect(field(page, "Job number")).toHaveValue("SY000001");
  },
);
