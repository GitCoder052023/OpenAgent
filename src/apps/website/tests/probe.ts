import type { Page } from "@playwright/test";

export type Issue = { kind: string; el: string; detail: string };

/**
 * Measures layout faults in the live page. Everything here is something a
 * browser can prove, not an opinion about how the page looks: content past the
 * viewport edge, type below a legible size, targets too small for a finger,
 * and content clipped inside a box that offers no way to scroll it.
 */
export async function probe(page: Page): Promise<{
  scrollWidth: number;
  clientWidth: number;
  issues: Issue[];
}> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const issues: { kind: string; el: string; detail: string }[] = [];
    const add = (kind: string, el: Element, detail: string) => {
      const cls =
        typeof el.className === "string" && el.className.trim()
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "";
      issues.push({
        kind,
        el: (el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + cls).slice(0, 120),
        detail,
      });
    };

    const srOnly = (el: Element) =>
      el.closest(".sr-only") !== null ||
      (typeof el.className === "string" && /(^|\s)sr-only(\s|$)/.test(el.className));

    const visible = (el: Element) => {
      if (srOnly(el)) return false;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0")
        return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    const clippedByAncestor = (el: Element) => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        if (/hidden|auto|scroll|clip/.test(getComputedStyle(p).overflowX)) return true;
        p = p.parentElement;
      }
      return false;
    };

    const all = [...document.body.querySelectorAll("*")];
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    for (const el of all) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if ((r.right > vw + 1 || r.left < -1) && !clippedByAncestor(el)) {
        add("overflow", el, `${Math.round(r.left)}..${Math.round(r.right)} in ${vw}`);
      }
    }

    // Captions sit at 10px on a mouse-driven laptop by design; a touch
    // viewport steps them up, and nothing anywhere may go below that.
    const floor = coarse ? 11 : 10;
    for (const el of all) {
      if (!visible(el)) continue;
      const hasText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1,
      );
      if (!hasText) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < floor) {
        add("tiny-text", el, `${fs}px "${(el.textContent ?? "").trim().slice(0, 40)}"`);
      }
    }

    if (coarse) {
      for (const el of document.querySelectorAll(
        'a, button, input, [role="tab"], summary',
      )) {
        if (!visible(el) || srOnly(el)) continue;
        const inlineInProse =
          el.tagName === "A" &&
          getComputedStyle(el).display === "inline" &&
          el.parentElement != null &&
          /^(P|LI|DD|SPAN)$/.test(el.parentElement.tagName);
        if (inlineInProse) continue;
        const r = el.getBoundingClientRect();
        if (r.height < 44 || r.width < 24) {
          add(
            "touch-target",
            el,
            `${Math.round(r.width)}x${Math.round(r.height)} "${(
              (el as HTMLElement).innerText ||
              el.getAttribute("aria-label") ||
              ""
            )
              .trim()
              .slice(0, 30)}"`,
          );
        }
      }
    }

    for (const el of all) {
      if (!visible(el)) continue;
      if (getComputedStyle(el).overflowX !== "hidden") continue;
      const cls = typeof el.className === "string" ? el.className : "";
      if (cls.includes("truncate")) continue;
      if (el.scrollWidth > el.clientWidth + 2) {
        add("clipped", el, `scrollW ${el.scrollWidth} > clientW ${el.clientWidth}`);
      }
    }

    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: vw,
      issues,
    };
  });
}

export function format(issues: Issue[]) {
  return issues.map((i) => `  ${i.kind}  ${i.el}\n      ${i.detail}`).join("\n");
}
