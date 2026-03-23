import { AuthService } from "../services/authService";
import { PlanService } from "../services/planService";
import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { requireApiKey } from "../utils/validation";

const authService = new AuthService();
const planService = new PlanService();

export const handler = createHandler(async (event) => {
  const owner = await authService.requireOwnerByApiKey(requireApiKey(event));
  const data = await planService.listOwnerBots(owner.id);

  return successResponse(data, "Owner bots retrieved");
});
