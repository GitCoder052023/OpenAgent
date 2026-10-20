import { expect, test } from "@playwright/test";

const SIZES = [
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "tablet", width: 768, height: 1024, touch: true },
  { name: "laptop", width: 1440, height: 900, touch: false },
];

for (const size of SIZES) {
  test.describe(`${size.name} (${size.width}px)`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
    });

    test("the transport replay is usable", async ({ page }) => {
      await page.goto("/");
      const panel = page.locator("#transport-panel");
      await panel.scrollIntoViewIfNeeded();

      // A turn is on screen before any script runs, and stays inside the panel.
      await expect(panel).toContainText("WhatsApp Desktop");
      const box = await panel.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1);

      // tabs switch scenarios by pointer
      const tabs = page.getByRole("tab");
      await expect(tabs).toHaveCount(3);
      await tabs.nth(1).click();
      await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");

      // and by keyboard
      await tabs.nth(1).focus();
      await page.keyboard.press("ArrowRight");
      await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
      await expect(tabs.nth(2)).toBeFocused();

      // every tab clears 44px where a finger is the pointer
      if (size.touch) {
        for (let i = 0; i < 3; i++) {
          const b = await tabs.nth(i).boundingBox();
          expect(b!.height).toBeGreaterThanOrEqual(44);
        }
      }

      await page.getByRole("button", { name: /Replay|Restart/ }).click();
      await expect(panel).toBeVisible();
    });

    test("the tool filter narrows the reference", async ({ page }) => {
      await page.goto("/tools");
      await expect(page.getByRole("rowheader")).toHaveCount(86);
      const search = page.getByRole("searchbox");
      if (size.touch) {
        const b = await search.boundingBox();
        expect(b!.height).toBeGreaterThanOrEqual(44);
      }
      await search.fill("whatsapp_poll");
      await expect(page.getByRole("rowheader")).toHaveCount(1);
      await expect(page.getByRole("rowheader", { name: "whatsapp_poll" })).toBeVisible();
      await search.fill("");
      await expect(page.getByRole("rowheader")).toHaveCount(86);
    });

    test("install commands can be copied", async ({ page, context, browserName }) => {
      test.skip(browserName !== "chromium", "clipboard permission is chromium-only");
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto("/");
      const copy = page.getByRole("button", { name: "Copy ./install.py" });
      await copy.scrollIntoViewIfNeeded();
      if (size.touch) {
        const b = await copy.boundingBox();
        expect(b!.height).toBeGreaterThanOrEqual(44);
      }
      await copy.click();
      await expect(copy).toContainText("copied");
    });

    test("in-page anchors land on their section", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("link", { name: "Watch a request run" }).click();
      await expect(page).toHaveURL(/#transport$/);
      const top = await page
        .locator("#transport")
        .evaluate((el) => el.getBoundingClientRect().top);
      // The fixed header must not be sitting on top of the section heading.
      expect(top).toBeGreaterThanOrEqual(0);
    });
  });
}
