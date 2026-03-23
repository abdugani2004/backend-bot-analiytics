import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { requireApiKey, validateBotIdentityFromQuery } from "../utils/validation";
import { AuthService } from "../services/authService";
import { BotService } from "../services/botService";
import { StatsService } from "../services/statsService";

const authService = new AuthService();
const botService = new BotService();
const statsService = new StatsService();

export const handler = createHandler(async (event) => {
  const owner = await authService.requireOwnerByApiKey(requireApiKey(event));
  const identity = validateBotIdentityFromQuery(event);
  const bot = await botService.findExistingBot(identity, owner.id);
  const data = await statsService.getDashboard(bot.id);

  return successResponse(data, "Dashboard statistics retrieved");
});
