import { BotService } from "../services/botService";
import { AuthService } from "../services/authService";
import { PlanService } from "../services/planService";
import { createHandler } from "../utils/handler";
import { isAppError } from "../utils/errors";
import { successResponse } from "../utils/response";
import { requireApiKey, validateBotIdentityFromBody } from "../utils/validation";

const authService = new AuthService();
const botService = new BotService();
const planService = new PlanService();

export const handler = createHandler(async (event) => {
  const owner = await authService.requireOwnerByApiKey(requireApiKey(event));
  const input = validateBotIdentityFromBody(event);

  try {
    await botService.findExistingBot(input, owner.id);
  } catch (error) {
    if (!isAppError(error) || error.code !== "BOT_NOT_FOUND") {
      throw error;
    }

    await planService.enforceCanCreateBot(owner);
  }

  const data = await botService.connectBot(input, owner.id);

  return successResponse(data, "Bot connected successfully");
});
