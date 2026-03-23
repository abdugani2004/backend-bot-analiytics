import type { PlanLimits, PlanType } from "../types/api";

const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  starter: {
    maxBots: 2,
    monthlyEvents: 5000,
  },
  growth: {
    maxBots: 25,
    monthlyEvents: 250000,
  },
};

export const getPlanLimits = (plan: PlanType): PlanLimits => PLAN_LIMITS[plan];
