import { randomUUID, timingSafeEqual } from "crypto";
import type {
  BillingCheckoutInput,
  BillingCheckoutResponse,
  BillingWebhookInput,
  OwnerRecord,
  PricingPlan,
  SubscriptionRecord,
} from "../types/api";
import { BillingRepository } from "../repositories/billingRepository";
import { OwnerRepository } from "../repositories/ownerRepository";
import { withTransaction } from "../utils/db";
import { AppError } from "../utils/errors";
import { buildCheckoutPreview, getPricingPlan, listPricingPlans } from "../utils/pricing";

const parseOptionalDate = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("Invalid billing date", 400, "VALIDATION_ERROR", { value });
  }

  return parsed;
};

const isActiveStatus = (status: SubscriptionRecord["status"]): boolean =>
  status === "active" || status === "trialing";

export class BillingService {
  constructor(
    private readonly billingRepository = new BillingRepository(),
    private readonly ownerRepository = new OwnerRepository(),
  ) {}

  listPricing(): PricingPlan[] {
    return listPricingPlans();
  }

  async createCheckoutSession(
    owner: OwnerRecord,
    input: BillingCheckoutInput,
  ): Promise<BillingCheckoutResponse> {
    return buildCheckoutPreview(owner.id, input);
  }

  async getSubscription(ownerId: string): Promise<SubscriptionRecord | null> {
    return this.billingRepository.getActiveSubscription(ownerId);
  }

  async processWebhook(
    input: BillingWebhookInput,
    receivedSecret: string | undefined,
  ): Promise<SubscriptionRecord> {
    this.validateWebhookSecret(receivedSecret);

    const owner = await this.ownerRepository.findById(input.accountId);
    if (!owner) {
      throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND", {
        accountId: input.accountId,
      });
    }

    return withTransaction(async (client) => {
      await this.billingRepository.storeBillingEvent(
        {
          accountId: input.accountId,
          provider: input.provider,
          providerEventId: input.providerEventId,
          eventType: input.type,
          payload: input as unknown as Record<string, unknown>,
        },
        client,
      );

      const pricing = getPricingPlan(input.plan);
      const providerCustomerId =
        input.providerCustomerId ?? owner.billingProviderCustomerId ?? `cust_${randomUUID()}`;

      const subscription = await this.billingRepository.upsertSubscription(
        {
          accountId: owner.id,
          provider: input.provider,
          providerCustomerId,
          providerSubscriptionId: input.providerSubscriptionId ?? null,
          plan: input.plan,
          status: input.status,
          amountMonthly: input.amount ?? pricing.priceMonthly,
          currency: (input.currency ?? pricing.currency).toUpperCase(),
          currentPeriodStart: parseOptionalDate(input.currentPeriodStart),
          currentPeriodEnd: parseOptionalDate(input.currentPeriodEnd),
          cancelAtPeriodEnd: input.type === "subscription.canceled",
        },
        client,
      );

      await this.ownerRepository.updateBillingCustomerId(owner.id, providerCustomerId, client);
      await this.ownerRepository.updatePlan(
        owner.id,
        isActiveStatus(input.status) ? input.plan : "starter",
        client,
      );

      return subscription;
    });
  }

  private validateWebhookSecret(receivedSecret: string | undefined): void {
    const expected = process.env.BILLING_WEBHOOK_SECRET;

    if (!expected) {
      throw new AppError(
        "BILLING_WEBHOOK_SECRET is required",
        500,
        "MISSING_BILLING_WEBHOOK_SECRET",
      );
    }

    const received = receivedSecret?.trim();
    if (!received) {
      throw new AppError("Unauthorized billing webhook", 401, "INVALID_BILLING_WEBHOOK_SECRET");
    }

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new AppError("Unauthorized billing webhook", 401, "INVALID_BILLING_WEBHOOK_SECRET");
    }
  }
}
