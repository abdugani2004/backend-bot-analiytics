import { AuthService } from "../services/authService";
import { BillingService } from "../services/billingService";
import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { requireApiKey } from "../utils/validation";

const authService = new AuthService();
const billingService = new BillingService();

export const handler = createHandler(async (event) => {
  const owner = await authService.requireOwnerByApiKey(requireApiKey(event));
  const data = await billingService.getSubscription(owner.id);

  return successResponse(data, "Subscription retrieved");
});
