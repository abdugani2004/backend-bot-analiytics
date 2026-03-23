import { AuthService } from "../services/authService";
import { BillingService } from "../services/billingService";
import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { requireApiKey, validateBillingCheckoutInput } from "../utils/validation";

const authService = new AuthService();
const billingService = new BillingService();

export const handler = createHandler(async (event) => {
  const owner = await authService.requireOwnerByApiKey(requireApiKey(event));
  const input = validateBillingCheckoutInput(event);
  const data = await billingService.createCheckoutSession(owner, input);

  return successResponse(data, "Checkout session created", 201);
});
