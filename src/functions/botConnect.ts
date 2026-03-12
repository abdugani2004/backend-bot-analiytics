import { BotService } from "../services/botService";
import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { validateBotIdentityFromBody } from "../utils/validation";

const botService = new BotService();

export const handler = createHandler(async (event) => {
  const input = validateBotIdentityFromBody(event);
  const data = await botService.connectBot(input);

  return successResponse(data, "Bot connected successfully");
});
