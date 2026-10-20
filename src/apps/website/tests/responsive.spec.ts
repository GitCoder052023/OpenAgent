import { expect, test } from "@playwright/test";
import { LANDSCAPE, PAGES, VIEWPORTS } from "./viewports";
import { format, probe } from "./probe";

for (const vp of [...VIEWPORTS, ...LANDSCAPE]) {
  test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: vp.touch && vp.width < 1024,
    });

    for (const path of PAGES) {
      test(`${path} lays out without faults`, async ({ page }) => {
        const consoleErrors: string[] = [];
        const failedRequests: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error") consoleErrors.push(m.text());
        });
        page.on("pageerror", (e) => consoleErrors.push(String(e)));
        page.on("requestfailed", (r) =>
          failedRequests.push(`${r.url()} ${r.failure()?.errorText}`),
        );

        await page.goto(path, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);

        const { scrollWidth, clientWidth, issues } = await probe(page);

        expect(
          scrollWidth,
          `${path} scrolls horizontally at ${vp.width}px`,
        ).toBeLessThanOrEqual(clientWidth + 1);

        const overflow = issues.filter((i) => i.kind === "overflow");
        expect(overflow, `elements past the edge:\n${format(overflow)}`).toHaveLength(0);

        const clipped = issues.filter((i) => i.kind === "clipped");
        expect(clipped, `content clipped with no way to scroll:\n${format(clipped)}`).toHaveLength(0);

        const tiny = issues.filter((i) => i.kind === "tiny-text");
        expect(tiny, `text below the legible floor:\n${format(tiny)}`).toHaveLength(0);

        const targets = issues.filter((i) => i.kind === "touch-target");
        expect(targets, `targets under 44px on a touch screen:\n${format(targets)}`).toHaveLength(0);

        expect(consoleErrors, consoleErrors.join("\n")).toHaveLength(0);
        expect(failedRequests, failedRequests.join("\n")).toHaveLength(0);
      });
    }
  });
}

test.describe("content survives every width", () => {
  for (const vp of [VIEWPORTS[0], VIEWPORTS[6], VIEWPORTS[9], VIEWPORTS[13]]) {
    test(`the home page keeps its sections at ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      for (const id of [
        "gap",
        "transport",
        "architecture",
        "engines",
        "ghost",
        "voice",
        "install",
        "vision",
        "questions",
      ]) {
        await expect(page.locator(`#${id}`)).toBeVisible();
      }
      // The loop diagram is rebuilt rather than dropped below xl.
      await expect(page.getByRole("img", { name: /Diagram of the request loop/ })).toHaveCount(1);
      // Every tool row is real markup at every width.
      await page.goto("/tools");
      await expect(page.getByRole("rowheader", { name: "whatsapp_poll" })).toBeVisible();
      await expect(page.getByRole("rowheader")).toHaveCount(86);
    });
  }
});
