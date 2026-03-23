import type { AccountSummaryResponse, AccountUsageSummary, OwnerBotSummary, OwnerRecord } from "../types/api";
import { OwnerRepository } from "../repositories/ownerRepository";
import { AppError } from "../utils/errors";
import { getPlanLimits } from "../utils/plans";

export class PlanService {
  constructor(private readonly ownerRepository = new OwnerRepository()) {}

  async getAccountSummary(owner: OwnerRecord): Promise<AccountSummaryResponse> {
    const usage = await this.ownerRepository.getUsage(owner.id);

    return {
      ownerId: owner.id,
      email: owner.email,
      name: owner.name,
      usage: this.toUsageSummary(owner, usage),
    };
  }

  async listOwnerBots(ownerId: string): Promise<OwnerBotSummary[]> {
    return this.ownerRepository.listOwnerBots(ownerId);
  }

  async enforceCanCreateBot(owner: OwnerRecord): Promise<void> {
    const usage = await this.ownerRepository.getUsage(owner.id);
    const limits = getPlanLimits(owner.plan);

    if (usage.totalBots >= limits.maxBots) {
      throw new AppError("Plan bot limit reached", 403, "PLAN_LIMIT_REACHED", {
        metric: "maxBots",
        current: usage.totalBots,
        limit: limits.maxBots,
        plan: owner.plan,
      });
    }
  }

  async enforceCanIngestEvent(owner: OwnerRecord): Promise<void> {
    const usage = await this.ownerRepository.getUsage(owner.id);
    const limits = getPlanLimits(owner.plan);

    if (usage.monthlyEvents >= limits.monthlyEvents) {
      throw new AppError("Monthly event limit reached", 403, "PLAN_LIMIT_REACHED", {
        metric: "monthlyEvents",
        current: usage.monthlyEvents,
        limit: limits.monthlyEvents,
        plan: owner.plan,
      });
    }
  }

  private toUsageSummary(
    owner: OwnerRecord,
    usage: { totalBots: number; monthlyEvents: number },
  ): AccountUsageSummary {
    return {
      plan: owner.plan,
      limits: getPlanLimits(owner.plan),
      usage,
    };
  }
}
