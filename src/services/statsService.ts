import type {
  DashboardStats,
  GrowthStats,
  MessageStats,
  OverviewStats,
  RevenueStats,
  UserStats,
} from "../types/api";
import { StatsRepository } from "../repositories/statsRepository";

export class StatsService {
  constructor(private readonly statsRepository = new StatsRepository()) {}

  getOverview(botId: string): Promise<OverviewStats> {
    return this.statsRepository.getOverview(botId);
  }

  getGrowth(botId: string): Promise<GrowthStats> {
    return this.statsRepository.getGrowth(botId);
  }

  getUsers(botId: string): Promise<UserStats> {
    return this.statsRepository.getUsers(botId);
  }

  getRevenue(botId: string): Promise<RevenueStats> {
    return this.statsRepository.getRevenue(botId);
  }

  getMessages(botId: string): Promise<MessageStats> {
    return this.statsRepository.getMessages(botId);
  }

  async getDashboard(botId: string): Promise<DashboardStats> {
    const [overview, growth, users, revenue, messages, recentActivity] =
      await Promise.all([
        this.getOverview(botId),
        this.getGrowth(botId),
        this.getUsers(botId),
        this.getRevenue(botId),
        this.getMessages(botId),
        this.statsRepository.getRecentActivity(botId),
      ]);

    return {
      overview,
      growth,
      users,
      revenue,
      messages,
      recentActivity,
    };
  }
}
