import { retrieve_spend_request } from "@stripe/link-integrations-eve/tools";
import { linkToolSchemas } from "@stripe/link-sdk/tools";
import { defineTool } from "eve/tools";

// Eve's qualified-name override retains the mounted extension's authorization.
export default defineTool({
  description:
    "Check a Link spend request's approval status and purchase details without retrieving payment credentials. Pass the approved request ID to browser-agent's fill_from_link for a standard or supported hosted card checkout. Credential expansion is intentionally unavailable to the coordinator.",
  inputSchema: linkToolSchemas.retrieveSpendRequest.omit({ include: true }),
  async execute({ id }, context) {
    const request = await retrieve_spend_request.execute({ id }, context);
    if (!request) return null;
    if (Symbol.asyncIterator in request) {
      throw new Error("Unexpected streaming Link response.");
    }
    const action = request.status_details?.requires_action?.next_action;
    return {
      id: request.id,
      status: request.status,
      amount: request.amount ?? null,
      currency: request.currency ?? null,
      merchant_name: request.merchant_name ?? null,
      merchant_url: request.merchant_url ?? null,
      approval_url: request.approval_url ?? null,
      activity_url: request.activity_url ?? null,
      expires_at: request.expires_at ?? null,
      status_details: action
        ? {
            requires_action: {
              next_action: {
                type: action.type,
                resolution: action.resolution,
                display_message: action.display_message,
                action_url: action.action_url,
                expires_at: action.expires_at ?? null,
              },
            },
          }
        : null,
    };
  },
});
