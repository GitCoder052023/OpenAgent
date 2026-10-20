import { expect, test } from "@playwright/test";

test.describe("reduced motion", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the replay shows a finished turn instead of animating", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const panel = page.locator("#transport-panel");
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toContainText("All 260 tests passed");
    await expect(panel).toContainText("260 passed");
    await expect(panel).toContainText("verified chat header");
  });

  test("nothing on the page is animating", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === "running")
        .map((a) => (a as CSSAnimation).animationName ?? "unnamed"),
    );
    expect(running, running.join(", ")).toHaveLength(0);
  });

  test("smooth scrolling is off so anchors jump", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const behavior = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    );
    expect(behavior).toBe("auto");
  });

  test("the loop diagram is readable with motion disabled", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const diagram = page.getByRole("img", { name: /Diagram of the request loop/ });
    await expect(diagram).toBeVisible();
    // Flow lines must be fully drawn, not left at their pre-animation offset.
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll(".flow-line")].filter(
        (el) => parseFloat(getComputedStyle(el).strokeDashoffset) > 0.01,
      ).length,
    );
    expect(hidden).toBe(0);
  });
});

test.describe("layout stability", () => {
  for (const width of [390, 768, 1440]) {
    test(`no layout shift once fonts load at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            hadRecentInput?: boolean;
            value: number;
          })[]) {
            if (!entry.hadRecentInput)
              (window as unknown as { __cls: number }).__cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto("/", { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1000);
      const cls = await page.evaluate(
        () => (window as unknown as { __cls: number }).__cls,
      );
      expect(cls).toBeLessThan(0.1);
    });
  }
});
