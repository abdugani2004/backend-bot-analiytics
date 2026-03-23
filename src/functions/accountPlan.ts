import { AuthService } from "../services/authService";
import { PlanService } from "../services/planService";
import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { requireApiKey, validatePlanUpdateInput } from "../utils/validation";

const authService = new AuthService();
const planService = new PlanService();

export const handler = createHandler(async (event) => {
  const owner = await authService.requireOwnerByApiKey(requireApiKey(event));
  const input = validatePlanUpdateInput(event);
  const updatedOwner = await authService.updateOwnerPlan(owner.id, input);
  const data = await planService.getAccountSummary(updatedOwner);

  return successResponse(data, "Account plan updated");
});
