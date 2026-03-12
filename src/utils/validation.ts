import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { BotIdentityInput } from "../types/api";
import type {
  MessageEventInput,
  PaymentEventInput,
  UserJoinedEventInput,
} from "../types/events";
import { AppError } from "./errors";

const BOT_TYPES = new Set(["token", "username"]);

const requireString = (
  value: unknown,
  field: string,
  { maxLength = 255, allowEmpty = false }: { maxLength?: number; allowEmpty?: boolean } = {},
): string => {
  if (typeof value !== "string") {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      [field]: "must be a string",
    });
  }

  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      [field]: "must not be empty",
    });
  }

  if (trimmed.length > maxLength) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      [field]: `must be at most ${maxLength} characters`,
    });
  }

  return trimmed;
};

const requireNumber = (value: unknown, field: string): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      [field]: "must be a valid number",
    });
  }

  return value;
};

export const validateBotIdentity = (input: Record<string, unknown>): BotIdentityInput => {
  const botType = requireString(input.botType, "botType", { maxLength: 20 });
  const botValue = requireString(input.botValue, "botValue", { maxLength: 512 });

  if (!BOT_TYPES.has(botType)) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      botType: 'must be "token" or "username"',
    });
  }

  return {
    botType: botType as BotIdentityInput["botType"],
    botValue,
  };
};

export const validateBotIdentityFromQuery = (
  event: APIGatewayProxyEventV2,
): BotIdentityInput =>
  validateBotIdentity({
    botType: event.queryStringParameters?.botType,
    botValue: event.queryStringParameters?.botValue,
  });

const parseJsonBody = (event: APIGatewayProxyEventV2): Record<string, unknown> => {
  if (!event.body) {
    throw new AppError("Request body is required", 400, "VALIDATION_ERROR");
  }

  try {
    return JSON.parse(event.body) as Record<string, unknown>;
  } catch {
    throw new AppError("Invalid JSON body", 400, "INVALID_JSON");
  }
};

export const validateBotIdentityFromBody = (
  event: APIGatewayProxyEventV2,
): BotIdentityInput => validateBotIdentity(parseJsonBody(event));

const validateUser = (input: unknown): MessageEventInput["user"] => {
  if (!input || typeof input !== "object") {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      user: "is required",
    });
  }

  const user = input as Record<string, unknown>;

  return {
    telegramId: requireString(user.telegramId, "user.telegramId", { maxLength: 64 }),
    username:
      user.username === undefined || user.username === null
        ? null
        : requireString(user.username, "user.username", { maxLength: 255 }),
    firstName:
      user.firstName === undefined || user.firstName === null
        ? null
        : requireString(user.firstName, "user.firstName", { maxLength: 255 }),
    lastName:
      user.lastName === undefined || user.lastName === null
        ? null
        : requireString(user.lastName, "user.lastName", { maxLength: 255 }),
  };
};

export const validateMessageEvent = (
  event: APIGatewayProxyEventV2,
): MessageEventInput => {
  const body = parseJsonBody(event);
  const identity = validateBotIdentity(body);

  return {
    ...identity,
    user: validateUser(body.user),
    text:
      body.text === undefined || body.text === null
        ? null
        : requireString(body.text, "text", { maxLength: 4000, allowEmpty: true }),
    createdAt:
      body.createdAt === undefined
        ? undefined
        : requireString(body.createdAt, "createdAt", { maxLength: 64 }),
  };
};

export const validateUserJoinedEvent = (
  event: APIGatewayProxyEventV2,
): UserJoinedEventInput => {
  const body = parseJsonBody(event);
  const identity = validateBotIdentity(body);

  return {
    ...identity,
    user: validateUser(body.user),
    createdAt:
      body.createdAt === undefined
        ? undefined
        : requireString(body.createdAt, "createdAt", { maxLength: 64 }),
  };
};

export const validatePaymentEvent = (
  event: APIGatewayProxyEventV2,
): PaymentEventInput => {
  const body = parseJsonBody(event);
  const identity = validateBotIdentity(body);

  return {
    ...identity,
    user: validateUser(body.user),
    amount: (() => {
      const amount = requireNumber(body.amount, "amount");
      if (amount < 0) {
        throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
          amount: "must be greater than or equal to 0",
        });
      }

      return amount;
    })(),
    currency: requireString(body.currency, "currency", { maxLength: 8 }).toUpperCase(),
    createdAt:
      body.createdAt === undefined
        ? undefined
        : requireString(body.createdAt, "createdAt", { maxLength: 64 }),
  };
};
