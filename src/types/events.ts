import type { BotIdentityInput } from "./api";

export interface EventUserPayload {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface MessageEventInput extends BotIdentityInput {
  user: EventUserPayload;
  text?: string | null;
  createdAt?: string;
}

export interface UserJoinedEventInput extends BotIdentityInput {
  user: EventUserPayload;
  createdAt?: string;
}

export interface PaymentEventInput extends BotIdentityInput {
  user: EventUserPayload;
  amount: number;
  currency: string;
  createdAt?: string;
}
