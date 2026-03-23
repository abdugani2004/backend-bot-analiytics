export type BotType = "token" | "username";
export type PlanType = "starter" | "growth";

export interface BotIdentityInput {
  botType: BotType;
  botValue: string;
}

export interface AuthRegisterInput {
  email: string;
  name: string | null;
}

export interface AccountPlanUpdateInput {
  plan: PlanType;
}

export type BillingProvider = "manual" | "stripe" | "click";
export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export interface BillingCheckoutInput {
  plan: PlanType;
  provider: BillingProvider;
  successUrl: string;
  cancelUrl: string;
}

export interface BillingWebhookInput {
  provider: BillingProvider;
  type: "subscription.updated" | "subscription.canceled" | "invoice.paid" | "invoice.failed";
  providerEventId: string;
  accountId: string;
  plan: PlanType;
  status: SubscriptionStatus;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  amount?: number;
  currency?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
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
  ownerAccountId: string | null;
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

export interface OwnerRecord {
  id: string;
  email: string;
  name: string | null;
  apiKeyHash: string;
  plan: PlanType;
  billingProviderCustomerId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRegisterResponse {
  ownerId: string;
  email: string;
  name: string | null;
  apiKey: string;
  plan: PlanType;
}

export interface PlanLimits {
  maxBots: number;
  monthlyEvents: number;
}

export interface AccountUsageSummary {
  plan: PlanType;
  limits: PlanLimits;
  usage: {
    totalBots: number;
    monthlyEvents: number;
  };
}

export interface OwnerBotSummary {
  botId: string;
  displayName: string;
  botType: BotType;
  verificationStatus: BotRecord["verificationStatus"];
  trackingStatus: BotRecord["trackingStatus"];
  connectedAt: string;
  totalUsers: number;
  totalMessages: number;
  revenueThisMonth: number;
}

export interface AccountSummaryResponse {
  ownerId: string;
  email: string;
  name: string | null;
  usage: AccountUsageSummary;
}

export interface PricingPlan {
  plan: PlanType;
  priceMonthly: number;
  currency: string;
  features: string[];
}

export interface BillingCheckoutResponse {
  checkoutId: string;
  provider: BillingProvider;
  approvalUrl: string;
  plan: PlanType;
  amount: number;
  currency: string;
}

export interface SubscriptionRecord {
  id: string;
  accountId: string;
  provider: BillingProvider;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  plan: PlanType;
  status: SubscriptionStatus;
  amountMonthly: number;
  currency: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingEventRecord {
  id: string;
  accountId: string | null;
  provider: BillingProvider;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  processedAt: Date;
  createdAt: Date;
}

export interface HealthPayload {
  status: "ok";
  apiHealth: "healthy" | "degraded";
  database: "up" | "down";
  timestamp: string;
  uptimeSeconds: number;
}
