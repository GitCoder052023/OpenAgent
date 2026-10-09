import { create_spend_request } from "@stripe/link-integrations-eve/tools";
import { linkToolSchemas } from "@stripe/link-sdk/tools";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import create from "@agent/tools/link__create_spend_request";
import { toolContextFor } from "@tests/helpers/tool-context";

const execute = vi.spyOn(create_spend_request, "execute");
const schema = create.inputSchema;
if (!(schema instanceof z.ZodType))
  throw new Error("Expected a Zod input schema.");
const input = {
  amount: 1000,
  context:
    "The user requested a one-time purchase from Shop with a maximum total of $10, including tax and shipping, delivered to their saved address.",
  idempotency_key: "purchase-1",
  merchant_name: "Shop",
  merchant_url: "https://shop.example/checkout",
};

beforeEach(() => vi.clearAllMocks());

describe("Link spend request approval boundary", () => {
  it("does not require an Eve tool approval", async () => {
    const approval = create.approval;
    if (!approval) throw new Error("Expected a tool approval policy.");
    const policy = "request" in approval ? approval.request : approval;
    expect(
      await policy({
        ...toolContextFor(),
        approvedTools: new Set(),
        toolInput: {
          ...linkToolSchemas.createSpendRequest.parse(input),
          request_approval: true,
        },
      })
    ).toBe("not-applicable");
  });

  it("always requests actual purchase approval from Link", async () => {
    const request = {
      id: "spr_1",
      status: "pending_approval",
      created_at: "2026-10-02",
      updated_at: "2026-10-02",
      approval_url: "https://app.link.com/approve/spr_1",
    };
    execute.mockResolvedValue(request);
    expect(schema.safeParse(input).success).toBe(true);
    const parsed = linkToolSchemas.createSpendRequest.parse(input);
    const context = toolContextFor();
    await expect(
      create.execute({ ...parsed, request_approval: true }, context)
    ).resolves.toEqual(request);
    expect(execute).toHaveBeenCalledExactlyOnceWith(
      { ...parsed, request_approval: true },
      context
    );
    expect(
      schema.safeParse({ ...input, request_approval: false }).success
    ).toBe(false);
    expect(
      schema.safeParse({ ...input, merchant_name: undefined }).success
    ).toBe(false);
  });
});
