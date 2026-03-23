import { BillingService } from "../services/billingService";
import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { validateBillingWebhookInput } from "../utils/validation";

const billingService = new BillingService();

export const handler = createHandler(async (event) => {
  const input = validateBillingWebhookInput(event);
  const secret =
    event.headers["x-billing-webhook-secret"] ?? event.headers["X-Billing-Webhook-Secret"];
  const data = await billingService.processWebhook(input, secret);

  return successResponse(data, "Billing webhook processed");
});
