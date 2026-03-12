import { BotService } from "../services/botService";
import { EventService } from "../services/eventService";
import { TelegramService } from "../services/telegramService";
import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";

const botService = new BotService();
const telegramService = new TelegramService();
const eventService = new EventService();

export const handler = createHandler(async (event) => {
  const botId = event.pathParameters?.botId;

  if (!botId) {
    throw new Error("Missing botId path parameter");
  }

  telegramService.validateWebhookSecret(
    event.headers["x-telegram-bot-api-secret-token"] ??
      event.headers["X-Telegram-Bot-Api-Secret-Token"],
  );

  const bot = await botService.findBotById(botId);
  const update = telegramService.parseUpdate(event.body);

  await eventService.ingestTelegramUpdate(bot, update);

  return successResponse({ ok: true }, "Telegram update processed");
});
