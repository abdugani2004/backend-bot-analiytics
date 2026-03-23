import type { BotIdentityInput, BotOnboardingResponse, BotRecord } from "../types/api";
import { BotRepository } from "../repositories/botRepository";
import { withTransaction } from "../utils/db";
import { decryptSecret, encryptSecret } from "../utils/crypto";
import { AppError } from "../utils/errors";
import { hashBotToken } from "../utils/hash";
import { TelegramService } from "./telegramService";

const normalizeUsername = (value: string): string =>
  value.replace(/^@/, "").trim().toLowerCase();

const buildDisplayName = (input: BotIdentityInput): string =>
  input.botType === "username" ? `@${normalizeUsername(input.botValue)}` : "Telegram Bot";

const isLikelyTelegramToken = (value: string): boolean =>
  /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(value);

export class BotService {
  constructor(
    private readonly botRepository = new BotRepository(),
    private readonly telegramService = new TelegramService(),
  ) {}

  private getBotIdentifier(input: BotIdentityInput): string {
    return input.botType === "token"
      ? hashBotToken(input.botValue)
      : normalizeUsername(input.botValue);
  }

  private toOnboardingResponse(
    bot: BotRecord,
    status: BotOnboardingResponse["status"],
  ): BotOnboardingResponse {
    return {
      botId: bot.id,
      displayName:
        bot.displayName ?? (bot.botType === "username" ? `@${bot.botIdentifier}` : "Telegram Bot"),
      status,
    };
  }

  async resolveBot(input: BotIdentityInput, ownerAccountId: string): Promise<BotRecord> {
    const botIdentifier = this.getBotIdentifier(input);

    return withTransaction(async (client) => {
      const existing = await this.botRepository.findByIdentifier(
        ownerAccountId,
        input.botType,
        botIdentifier,
        client,
      );

      if (existing) {
        await this.botRepository.touch(existing.id, client);
        return existing;
      }

      return this.botRepository.create(
        ownerAccountId,
        input.botType,
        botIdentifier,
        buildDisplayName(input),
        client,
      );
    });
  }

  async findExistingBot(input: BotIdentityInput, ownerAccountId: string): Promise<BotRecord> {
    const bot = await this.botRepository.findByIdentifier(
      ownerAccountId,
      input.botType,
      this.getBotIdentifier(input),
    );

    if (!bot) {
      throw new AppError("Bot not found", 404, "BOT_NOT_FOUND", {
        botType: input.botType,
      });
    }

    return bot;
  }

  async connectBot(
    input: BotIdentityInput,
    ownerAccountId: string,
  ): Promise<BotOnboardingResponse> {
    const bot = await this.resolveBot(input, ownerAccountId);
    return this.toOnboardingResponse(bot, "connected");
  }

  async verifyBot(
    input: BotIdentityInput,
    ownerAccountId: string,
  ): Promise<BotOnboardingResponse> {
    if (input.botType === "token" && !isLikelyTelegramToken(input.botValue)) {
      throw new AppError("Invalid bot token", 400, "INVALID_TOKEN", {
        botType: input.botType,
      });
    }

    const bot = await this.findExistingBot(input, ownerAccountId);

    if (input.botType === "token") {
      const telegramBot = await this.telegramService.getMe(input.botValue);
      const displayName = telegramBot.username
        ? `@${telegramBot.username}`
        : telegramBot.first_name;

      const verifiedBot = await this.botRepository.updateTelegramCredentials(bot.id, {
        displayName,
        telegramBotId: String(telegramBot.id),
        encryptedToken: encryptSecret(input.botValue),
        verificationStatus: "verified",
      });

      return this.toOnboardingResponse(verifiedBot, "verified");
    }

    if (input.botType === "username" && !bot.displayName) {
      throw new AppError("Verification failed", 400, "VERIFICATION_FAILED", {
        botId: bot.id,
      });
    }

    const verifiedBot = await this.botRepository.updateVerificationStatus(bot.id, "verified");
    return this.toOnboardingResponse(verifiedBot, "verified");
  }

  async enableTracking(
    input: BotIdentityInput,
    ownerAccountId: string,
  ): Promise<BotOnboardingResponse> {
    const bot = await this.findExistingBot(input, ownerAccountId);

    if (bot.verificationStatus !== "verified") {
      throw new AppError("Verification failed", 400, "VERIFICATION_FAILED", {
        botId: bot.id,
        verificationStatus: bot.verificationStatus,
      });
    }

    let webhookStatus: BotRecord["webhookStatus"] = "pending";

    if (bot.encryptedToken) {
      const token = decryptSecret(bot.encryptedToken);
      await this.telegramService.setWebhook(token, bot.id);
      webhookStatus = "enabled";
    }

    const trackingBot = await this.botRepository.updateTrackingStatus(
      bot.id,
      "enabled",
      webhookStatus,
    );
    return this.toOnboardingResponse(trackingBot, "tracking_enabled");
  }

  async findBotById(botId: string): Promise<BotRecord> {
    const bot = await this.botRepository.findById(botId);

    if (!bot) {
      throw new AppError("Bot not found", 404, "BOT_NOT_FOUND", {
        botId,
      });
    }

    return bot;
  }

  async findExistingBotForOwner(botId: string, ownerAccountId: string): Promise<BotRecord> {
    const bot = await this.botRepository.findByIdAndOwner(botId, ownerAccountId);

    if (!bot) {
      throw new AppError("Bot not found", 404, "BOT_NOT_FOUND", {
        botId,
      });
    }

    return bot;
  }
}
