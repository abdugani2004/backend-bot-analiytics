import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type {
  AccountPlanUpdateInput,
  AuthRegisterInput,
  BillingCheckoutInput,
  BillingWebhookInput,
  BotIdentityInput,
} from "../types/api";
import type {
  MessageEventInput,
  PaymentEventInput,
  UserJoinedEventInput,
} from "../types/events";
import { AppError } from "./errors";

const BOT_TYPES = new Set(["token", "username"]);
const BILLING_PROVIDERS = new Set(["manual", "stripe", "click"]);
const SUBSCRIPTION_STATUSES = new Set([
  "inactive",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
]);

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

export const validateAuthRegisterInput = (
  event: APIGatewayProxyEventV2,
): AuthRegisterInput => {
  const body = parseJsonBody(event);

  return {
    email: requireString(body.email, "email", { maxLength: 255 }).toLowerCase(),
    name:
      body.name === undefined || body.name === null
        ? null
        : requireString(body.name, "name", { maxLength: 255 }),
  };
};

export const requireApiKey = (event: APIGatewayProxyEventV2): string => {
  const apiKey =
    event.headers["x-api-key"] ??
    event.headers["X-API-Key"] ??
    event.headers.authorization?.replace(/^Bearer\s+/i, "").trim();

  return requireString(apiKey, "x-api-key", { maxLength: 512 });
};

export const validatePlanUpdateInput = (
  event: APIGatewayProxyEventV2,
): AccountPlanUpdateInput => {
  const body = parseJsonBody(event);
  const plan = requireString(body.plan, "plan", { maxLength: 20 }).toLowerCase();

  if (plan !== "starter" && plan !== "growth") {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      plan: 'must be "starter" or "growth"',
    });
  }

  return {
    plan,
  };
};

export const validateBillingCheckoutInput = (
  event: APIGatewayProxyEventV2,
): BillingCheckoutInput => {
  const body = parseJsonBody(event);
  const plan = requireString(body.plan, "plan", { maxLength: 20 }).toLowerCase();
  const provider = requireString(body.provider, "provider", { maxLength: 20 }).toLowerCase();

  if (plan !== "starter" && plan !== "growth") {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      plan: 'must be "starter" or "growth"',
    });
  }

  if (!BILLING_PROVIDERS.has(provider)) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      provider: 'must be "manual", "stripe", or "click"',
    });
  }

  return {
    plan,
    provider: provider as BillingCheckoutInput["provider"],
    successUrl: requireString(body.successUrl, "successUrl", { maxLength: 2048 }),
    cancelUrl: requireString(body.cancelUrl, "cancelUrl", { maxLength: 2048 }),
  };
};

export const validateBillingWebhookInput = (
  event: APIGatewayProxyEventV2,
): BillingWebhookInput => {
  const body = parseJsonBody(event);
  const provider = requireString(body.provider, "provider", { maxLength: 20 }).toLowerCase();
  const type = requireString(body.type, "type", { maxLength: 64 });
  const plan = requireString(body.plan, "plan", { maxLength: 20 }).toLowerCase();
  const status = requireString(body.status, "status", { maxLength: 20 }).toLowerCase();

  if (!BILLING_PROVIDERS.has(provider)) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      provider: 'must be "manual", "stripe", or "click"',
    });
  }

  if (plan !== "starter" && plan !== "growth") {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      plan: 'must be "starter" or "growth"',
    });
  }

  if (!SUBSCRIPTION_STATUSES.has(status)) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      status: "must be a valid subscription status",
    });
  }

  return {
    provider: provider as BillingWebhookInput["provider"],
    type: type as BillingWebhookInput["type"],
    providerEventId: requireString(body.providerEventId, "providerEventId", { maxLength: 255 }),
    accountId: requireString(body.accountId, "accountId", { maxLength: 64 }),
    plan,
    status: status as BillingWebhookInput["status"],
    providerCustomerId:
      body.providerCustomerId === undefined || body.providerCustomerId === null
        ? null
        : requireString(body.providerCustomerId, "providerCustomerId", { maxLength: 255 }),
    providerSubscriptionId:
      body.providerSubscriptionId === undefined || body.providerSubscriptionId === null
        ? null
        : requireString(body.providerSubscriptionId, "providerSubscriptionId", { maxLength: 255 }),
    amount:
      body.amount === undefined || body.amount === null
        ? undefined
        : requireNumber(body.amount, "amount"),
    currency:
      body.currency === undefined || body.currency === null
        ? null
        : requireString(body.currency, "currency", { maxLength: 8 }).toUpperCase(),
    currentPeriodStart:
      body.currentPeriodStart === undefined || body.currentPeriodStart === null
        ? null
        : requireString(body.currentPeriodStart, "currentPeriodStart", { maxLength: 64 }),
    currentPeriodEnd:
      body.currentPeriodEnd === undefined || body.currentPeriodEnd === null
        ? null
        : requireString(body.currentPeriodEnd, "currentPeriodEnd", { maxLength: 64 }),
  };
};

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
