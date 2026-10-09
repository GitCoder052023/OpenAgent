import type { WorkflowToolContext } from "eve/tools";
import { describe, expect, it, vi } from "vitest";
import runBrowser from "@agent/tools/run_browser";
import { toolContextFor } from "@tests/helpers/tool-context";

const completion = {
  status: "success",
  message: "Verified the page heading.",
  images: [],
};

describe("structured browser workflow", () => {
  it.each([undefined, "parked-worker"])(
    "supplies the completion schema when agentId is %s",
    async (agentId) => {
      const agent = vi
        .fn<WorkflowToolContext["agent"]>()
        .mockResolvedValue(completion);
      const context = {
        ...toolContextFor(),
        agent,
        agents: {},
        ask: vi.fn<WorkflowToolContext["ask"]>(),
      };
      const result = await runBrowser.execute(
        { message: "Inspect the heading", agentId },
        context
      );

      expect(result).toEqual(completion);
      expect(agent).toHaveBeenCalledOnce();
      expect(agent.mock.calls[0]).toMatchObject([
        "browser-agent",
        {
          message: "Inspect the heading",
          agentId,
          outputSchema: {
            type: "object",
            required: ["images", "status", "message"],
            properties: {
              images: { type: "array", maxItems: 4 },
              status: { enum: ["success", "failure"] },
            },
          },
        },
      ]);
    }
  );

  it("rejects malformed completion instead of reporting success", async () => {
    const agent = vi
      .fn<WorkflowToolContext["agent"]>()
      .mockResolvedValue({ status: "success", message: "Done" });
    await expect(
      runBrowser.execute(
        { message: "Inspect the heading" },
        {
          ...toolContextFor(),
          agent,
          agents: {},
          ask: vi.fn<WorkflowToolContext["ask"]>(),
        }
      )
    ).rejects.toThrow(/images/u);
  });
});
