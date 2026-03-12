import type {
  TelegramGetMeResponse,
  TelegramSetWebhookResponse,
  TelegramUpdate,
} from "../types/telegram";
import { AppError } from "../utils/errors";

export class TelegramService {
  private buildApiUrl(token: string, method: string): string {
    return `https://api.telegram.org/bot${token}/${method}`;
  }

  async getMe(token: string): Promise<NonNullable<TelegramGetMeResponse["result"]>> {
    const response = await fetch(this.buildApiUrl(token, "getMe"), {
      method: "GET",
    });

    const payload = (await response.json()) as TelegramGetMeResponse;

    if (!response.ok || !payload.ok || !payload.result) {
      throw new AppError("Invalid bot token", 400, "INVALID_TOKEN", {
        telegram: payload.description ?? "getMe failed",
      });
    }

    return payload.result;
  }

  async setWebhook(token: string, botId: string): Promise<void> {
    const baseUrl = process.env.TELEGRAM_WEBHOOK_BASE_URL;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!baseUrl) {
      throw new AppError(
        "TELEGRAM_WEBHOOK_BASE_URL is required",
        500,
        "MISSING_TELEGRAM_WEBHOOK_BASE_URL",
      );
    }

    if (!secret) {
      throw new AppError(
        "TELEGRAM_WEBHOOK_SECRET is required",
        500,
        "MISSING_TELEGRAM_WEBHOOK_SECRET",
      );
    }

    const response = await fetch(this.buildApiUrl(token, "setWebhook"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        url: `${baseUrl.replace(/\/$/, "")}/webhooks/telegram/${botId}`,
        secret_token: secret,
        allowed_updates: ["message"],
      }),
    });

    const payload = (await response.json()) as TelegramSetWebhookResponse;

    if (!response.ok || !payload.ok) {
      throw new AppError("Tracking enable failed", 400, "TRACKING_ENABLE_FAILED", {
        telegram: payload.description ?? "setWebhook failed",
      });
    }
  }

  validateWebhookSecret(receivedSecret: string | undefined): void {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!expected) {
      throw new AppError(
        "TELEGRAM_WEBHOOK_SECRET is required",
        500,
        "MISSING_TELEGRAM_WEBHOOK_SECRET",
      );
    }

    if (receivedSecret !== expected) {
      throw new AppError("Unauthorized webhook request", 401, "INVALID_WEBHOOK_SECRET");
    }
  }

  parseUpdate(body: string | null | undefined): TelegramUpdate {
    if (!body) {
      throw new AppError("Request body is required", 400, "VALIDATION_ERROR");
    }

    try {
      return JSON.parse(body) as TelegramUpdate;
    } catch {
      throw new AppError("Invalid JSON body", 400, "INVALID_JSON");
    }
  }
}
