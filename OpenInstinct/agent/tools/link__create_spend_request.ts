import { create_spend_request } from "@stripe/link-integrations-eve/tools";
import { linkToolSchemas } from "@stripe/link-sdk/tools";
import { defineTool } from "eve/tools";
import { never } from "eve/tools/approval";
import { z } from "zod";

export default defineTool({
  approval: never(),
  description:
    "Create a Link spend request for the user's requested purchase, with the exact merchant, items, final total, and a stable idempotency key. Link purchase approval is always requested. Send the returned approval_url as a native link and check the same request's status before continuing checkout. Creating this request does not approve a purchase.",
  inputSchema: linkToolSchemas.createSpendRequest.safeExtend({
    request_approval: z.literal(true).default(true),
  }),
  execute(input, context) {
    return create_spend_request.execute(
      { ...input, request_approval: true },
      context
    );
  },
});
