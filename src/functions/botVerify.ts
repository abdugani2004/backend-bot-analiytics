import { BotService } from "../services/botService";
import { AuthService } from "../services/authService";
import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { requireApiKey, validateBotIdentityFromBody } from "../utils/validation";

const authService = new AuthService();
const botService = new BotService();

export const handler = createHandler(async (event) => {
  const owner = await authService.requireOwnerByApiKey(requireApiKey(event));
  const input = validateBotIdentityFromBody(event);
  const data = await botService.verifyBot(input, owner.id);

  return successResponse(data, "Bot verified successfully");
});
