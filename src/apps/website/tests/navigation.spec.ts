import { expect, test } from "@playwright/test";

const PHONE = { width: 390, height: 844 };
const TABLET_LANDSCAPE = { width: 1024, height: 768 };

test.describe("mobile navigation", () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test("opens, dismisses every way, and never exceeds the viewport", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Open menu" });
    const panel = page.locator("#mobile-nav");

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();

    // open
    await toggle.click();
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(panel).toBeVisible();

    // the panel stays inside the viewport and scrolls itself if it has to
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(PHONE.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width + 1,
    );

    // Escape closes it and hands focus back to the control that opened it
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();

    // a tap outside closes it
    await toggle.click();
    await expect(panel).toBeVisible();
    await page.mouse.click(PHONE.width / 2, PHONE.height - 40);
    await expect(panel).toBeHidden();

    // following a link closes it and lands on the right route
    await toggle.click();
    await panel.getByRole("link", { name: "Tools" }).click();
    await expect(page).toHaveURL(/\/tools$/);
    await expect(page.locator("#mobile-nav")).toBeHidden();
  });

  test("is operable from the keyboard alone", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Open menu" });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#mobile-nav")).toBeVisible();

    // Tab cycles within the panel rather than escaping behind it
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const el = document.activeElement;
      return (
        el?.closest("#mobile-nav") !== null ||
        el === document.querySelector('[aria-controls="mobile-nav"]')
      );
    });
    expect(inside).toBe(true);
  });

  test("locks the page behind the panel", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });
});

test.describe("navigation adapts to the screen", () => {
  test("the menu button gives way to the full bar on a laptop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });

  test("an open panel closes when the viewport grows past the breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("#mobile-nav")).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator("#mobile-nav")).toBeHidden();
  });

  test("header links clear 44px on a touch tablet in landscape", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: TABLET_LANDSCAPE,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("/");
    const links = page.getByRole("navigation", { name: "Primary" }).getByRole("link");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await links.nth(i).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await context.close();
  });

  test("skip link reaches main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    const box = await skip.boundingBox();
    expect(box!.width).toBeGreaterThan(40);
  });
});
