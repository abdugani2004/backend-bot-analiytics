export type BotType = "token" | "username";

export interface BotIdentityInput {
  botType: BotType;
  botValue: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  message: string;
  error: {
    code: string;
    details: Record<string, unknown>;
  };
}

export interface OverviewStats {
  totalUsers: number;
  activeUsersToday: number;
  newUsersToday: number;
  messagesToday: number;
  totalMessages: number;
  weeklyGrowthPct: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  botStatus: "online" | "offline";
  apiHealth: "healthy" | "degraded";
  uptimePct: number;
  requestsToday: number;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface GrowthStats {
  weeklyGrowthPct: number;
  monthlyGrowthPct: number;
  weeklySeries: SeriesPoint[];
  monthlySeries: SeriesPoint[];
}

export interface UserStats {
  totalUsers: number;
  activeUsersToday: number;
  newUsersToday: number;
  growthSeries: SeriesPoint[];
}

export interface RevenueStats {
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  revenueSeries: SeriesPoint[];
}

export interface MessageStats {
  totalMessages: number;
  messagesToday: number;
  dailyMessagesSeries: SeriesPoint[];
}

export interface RecentActivityItem {
  id: string;
  eventType: string;
  description: string;
  eventCode: string;
  params: Record<string, string | number>;
  createdAt: string;
}

export interface DashboardStats {
  overview: OverviewStats;
  growth: GrowthStats;
  users: UserStats;
  revenue: RevenueStats;
  messages: MessageStats;
  recentActivity: RecentActivityItem[];
}

export interface BotRecord {
  id: string;
  botIdentifier: string;
  botType: BotType;
  displayName: string | null;
  telegramBotId: string | null;
  encryptedToken: string | null;
  verificationStatus: "pending" | "verified" | "failed";
  trackingStatus: "disabled" | "enabled";
  webhookStatus: "pending" | "enabled" | "failed";
  connectedAt: Date;
  verifiedAt: Date | null;
  trackingEnabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotOnboardingResponse {
  botId: string;
  displayName: string;
  status: "connected" | "verified" | "tracking_enabled";
}

export interface HealthPayload {
  status: "ok";
  apiHealth: "healthy" | "degraded";
  database: "up" | "down";
  timestamp: string;
  uptimeSeconds: number;
}
