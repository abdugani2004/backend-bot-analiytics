import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { validateBotIdentityFromQuery } from "../utils/validation";
import { BotService } from "../services/botService";
import { StatsService } from "../services/statsService";

const botService = new BotService();
const statsService = new StatsService();

export const handler = createHandler(async (event) => {
  const identity = validateBotIdentityFromQuery(event);
  const bot = await botService.resolveBot(identity);
  const data = await statsService.getUsers(bot.id);

  return successResponse(data, "User statistics retrieved");
});
