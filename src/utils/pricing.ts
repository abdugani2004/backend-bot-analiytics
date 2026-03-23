import type { BillingCheckoutInput, BillingCheckoutResponse, PricingPlan, PlanType } from "../types/api";
import { AppError } from "./errors";

const PRICING: Record<PlanType, PricingPlan> = {
  starter: {
    plan: "starter",
    priceMonthly: 29,
    currency: "USD",
    features: ["2 bots", "5,000 monthly events", "core dashboard"],
  },
  growth: {
    plan: "growth",
    priceMonthly: 99,
    currency: "USD",
    features: ["25 bots", "250,000 monthly events", "priority insights"],
  },
};

export const listPricingPlans = (): PricingPlan[] => Object.values(PRICING);

export const getPricingPlan = (plan: PlanType): PricingPlan => {
  const pricing = PRICING[plan];

  if (!pricing) {
    throw new AppError("Unknown pricing plan", 400, "INVALID_PLAN", { plan });
  }

  return pricing;
};

export const buildCheckoutPreview = (
  accountId: string,
  input: BillingCheckoutInput,
): BillingCheckoutResponse => {
  const pricing = getPricingPlan(input.plan);
  const checkoutId = `${input.provider}_${accountId}_${Date.now()}`;
  const url = new URL(input.successUrl);
  url.searchParams.set("checkout_id", checkoutId);
  url.searchParams.set("plan", input.plan);
  url.searchParams.set("provider", input.provider);

  return {
    checkoutId,
    provider: input.provider,
    approvalUrl: url.toString(),
    plan: input.plan,
    amount: pricing.priceMonthly,
    currency: pricing.currency,
  };
};
