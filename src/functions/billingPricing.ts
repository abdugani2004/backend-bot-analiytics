import { BillingService } from "../services/billingService";
import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";

const billingService = new BillingService();

export const handler = createHandler(async () => {
  const data = billingService.listPricing();
  return successResponse(data, "Pricing retrieved");
});
