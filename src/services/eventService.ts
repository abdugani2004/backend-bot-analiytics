import type { BotRecord } from "../types/api";
import type {
  MessageEventInput,
  PaymentEventInput,
  UserJoinedEventInput,
} from "../types/events";
import type { TelegramUpdate } from "../types/telegram";
import { BotService } from "./botService";
import { EventRepository } from "../repositories/eventRepository";
import { parseEventDate } from "../utils/date";
import { withTransaction } from "../utils/db";

export class EventService {
  constructor(
    private readonly botService = new BotService(),
    private readonly eventRepository = new EventRepository(),
  ) {}

  async ingestMessage(input: MessageEventInput, ownerAccountId: string): Promise<void> {
    const bot = await this.botService.resolveBot(input, ownerAccountId);
    const createdAt = parseEventDate(input.createdAt);

    await this.writeMessage(bot.id, input.user, input.text ?? null, createdAt);
  }

  async ingestUserJoined(input: UserJoinedEventInput, ownerAccountId: string): Promise<void> {
    const bot = await this.botService.resolveBot(input, ownerAccountId);
    const createdAt = parseEventDate(input.createdAt);

    await this.writeUserJoined(bot.id, input.user, createdAt);
  }

  async ingestPayment(input: PaymentEventInput, ownerAccountId: string): Promise<void> {
    const bot = await this.botService.resolveBot(input, ownerAccountId);
    const createdAt = parseEventDate(input.createdAt);

    await this.writePayment(bot.id, input.user, input.amount, input.currency, createdAt);
  }

  private async writeMessage(
    botId: string,
    user: MessageEventInput["user"],
    text: string | null,
    createdAt: Date,
  ): Promise<void> {
    await withTransaction(async (client) => {
      const userId = await this.eventRepository.upsertUser(client, botId, user, createdAt);

      await this.eventRepository.insertMessage(
        client,
        botId,
        userId,
        text,
        createdAt,
      );

      await this.eventRepository.insertHealthLog(
        client,
        botId,
        "online",
        100,
        1,
        createdAt,
      );

      await this.eventRepository.insertActivityLog(
        client,
        botId,
        "message",
        `Message received from ${user.telegramId}`,
        "message.received",
        {
          user: user.telegramId,
        },
        createdAt,
      );
    });
  }

  private async writeUserJoined(
    botId: string,
    user: UserJoinedEventInput["user"],
    createdAt: Date,
  ): Promise<void> {
    await withTransaction(async (client) => {
      await this.eventRepository.upsertUser(client, botId, user, createdAt);
      await this.eventRepository.insertHealthLog(
        client,
        botId,
        "online",
        100,
        1,
        createdAt,
      );
      await this.eventRepository.insertActivityLog(
        client,
        botId,
        "user_joined",
        `User ${user.telegramId} joined`,
        "user.joined",
        {
          user: user.telegramId,
        },
        createdAt,
      );
    });
  }

  private async writePayment(
    botId: string,
    user: PaymentEventInput["user"],
    amount: number,
    currency: string,
    createdAt: Date,
  ): Promise<void> {
    await withTransaction(async (client) => {
      const userId = await this.eventRepository.upsertUser(client, botId, user, createdAt);

      await this.eventRepository.insertPayment(
        client,
        botId,
        userId,
        amount,
        currency,
        createdAt,
      );

      await this.eventRepository.insertHealthLog(
        client,
        botId,
        "online",
        100,
        1,
        createdAt,
      );

      await this.eventRepository.insertActivityLog(
        client,
        botId,
        "payment",
        `Payment of ${amount.toFixed(2)} ${currency}`,
        "payment.received",
        {
          amount: Number(amount.toFixed(2)),
          currency,
          user: user.telegramId,
        },
        createdAt,
      );
    });
  }

  async ingestTelegramUpdate(bot: BotRecord, update: TelegramUpdate): Promise<void> {
    const message = update.message;

    if (!message || !message.from) {
      return;
    }

    const createdAt = new Date(message.date * 1000);
    const user = {
      telegramId: String(message.from.id),
      username: message.from.username ?? null,
      firstName: message.from.first_name ?? null,
      lastName: message.from.last_name ?? null,
    };

    if (message.new_chat_members?.length) {
      for (const member of message.new_chat_members) {
        if (member.is_bot) {
          continue;
        }

        await this.writeUserJoined(
          bot.id,
          {
            telegramId: String(member.id),
            username: member.username ?? null,
            firstName: member.first_name ?? null,
            lastName: member.last_name ?? null,
          },
          createdAt,
        );
      }
    }

    if (typeof message.text === "string") {
      await this.writeMessage(bot.id, user, message.text, createdAt);
    }
  }
}
