import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { retrieve_spend_request } from "@stripe/link-integrations-eve/tools";
import retrieve from "@agent/tools/link__retrieve_spend_request";
import { toolContextFor } from "@tests/helpers/tool-context";

const execute = vi.spyOn(retrieve_spend_request, "execute");
beforeEach(() => vi.clearAllMocks());

describe("Link status-only override", () => {
  it("delegates to the official extension without requesting credentials and projects safe fields", async () => {
    execute.mockResolvedValue({
      id: "spr_1",
      status: "approved",
      created_at: "2026-10-01",
      updated_at: "2026-10-01",
      amount: 2306,
      currency: "usd",
      merchant_url: "https://shop.example",
      approval_url:
        "https://app.link.com/approve/spr_1?approval_token=opaque%2Btoken&source=agent",
      card: {
        id: "card_1",
        brand: "visa",
        number: "4242424242424242",
        cvc: "098",
        exp_month: 12,
        exp_year: 2035,
      },
      link_pay_token: "lpt_secret",
      shared_payment_token: { id: "spt_secret" },
    });
    const context = toolContextFor();
    const output = await retrieve.execute({ id: "spr_1" }, context);
    expect(execute).toHaveBeenCalledExactlyOnceWith({ id: "spr_1" }, context);
    expect(output).toMatchObject({
      id: "spr_1",
      status: "approved",
      amount: 2306,
      currency: "usd",
      approval_url:
        "https://app.link.com/approve/spr_1?approval_token=opaque%2Btoken&source=agent",
    });
    expect(JSON.stringify(output)).not.toMatch(
      /4242424242424242|098|lpt_secret|spt_secret/u
    );
    if (!(retrieve.inputSchema instanceof z.ZodType))
      throw new Error("Expected Zod schema");
    expect(
      retrieve.inputSchema.safeParse({ id: "spr_1", include: ["card"] }).success
    ).toBe(false);
  });

  it("returns null for a missing request", async () => {
    execute.mockResolvedValue(null);
    await expect(
      retrieve.execute({ id: "missing" }, toolContextFor())
    ).resolves.toBeNull();
  });
});
