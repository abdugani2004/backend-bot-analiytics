import type { QueryResultRow } from "pg";
import type {
  GrowthStats,
  MessageStats,
  OverviewStats,
  RecentActivityItem,
  RevenueStats,
  SeriesPoint,
  UserStats,
} from "../types/api";
import { query } from "../utils/db";

interface NumericRow extends QueryResultRow {
  value: string | number | null;
}

interface RevenueWindowRow extends QueryResultRow {
  revenue_today: string | null;
  revenue_this_week: string | null;
  revenue_this_month: string | null;
}

interface MessageWindowRow extends QueryResultRow {
  total_messages: string | null;
  messages_today: string | null;
}

interface UserWindowRow extends QueryResultRow {
  total_users: string | null;
  active_users_today: string | null;
  new_users_today: string | null;
}

interface GrowthWindowRow extends QueryResultRow {
  current_period: string | null;
  previous_period: string | null;
}

interface HealthRow extends QueryResultRow {
  bot_status: "online" | "offline" | null;
  uptime_pct: string | null;
  requests_today: string | null;
}

interface ActivityRow extends QueryResultRow {
  id: string;
  event_type: string;
  description: string;
  event_code: string | null;
  params: Record<string, string | number> | null;
  created_at: Date;
}

interface SeriesRow extends QueryResultRow {
  bucket_date: Date;
  value: string | null;
}

const parseNumber = (value: string | number | null | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

const percentageChange = (current: number, previous: number): number => {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return Number((((current - previous) / previous) * 100).toFixed(2));
};

const formatSeries = (rows: SeriesRow[]): SeriesPoint[] =>
  rows.map((row) => ({
    date: row.bucket_date.toISOString().slice(0, 10),
    value: parseNumber(row.value),
  }));

const fallbackActivityMetadata = (
  row: Pick<ActivityRow, "event_type" | "description">,
): Pick<RecentActivityItem, "eventCode" | "params"> => {
  switch (row.event_type) {
    case "message": {
      const match = row.description.match(/^Message received from (.+)$/);
      return {
        eventCode: "message.received",
        params: match ? { user: match[1] } : {},
      };
    }
    case "payment": {
      const match = row.description.match(/^Payment of ([\d.]+) ([A-Z]+)$/);
      return {
        eventCode: "payment.received",
        params: match
          ? {
              amount: Number(match[1]),
              currency: match[2],
            }
          : {},
      };
    }
    case "user_joined": {
      const match = row.description.match(/^User (.+) joined$/);
      return {
        eventCode: "user.joined",
        params: match ? { user: match[1] } : {},
      };
    }
    default:
      return {
        eventCode: row.event_type,
        params: {},
      };
  }
};

export class StatsRepository {
  async getOverview(botId: string): Promise<OverviewStats> {
    const [userWindow, messageWindow, revenueWindow, weeklyGrowth, health] =
      await Promise.all([
        query<UserWindowRow>(
          `SELECT
             COUNT(*)::int AS total_users,
             COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE)::int AS active_users_today,
             COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS new_users_today
           FROM users
           WHERE bot_id = $1`,
          [botId],
        ),
        query<MessageWindowRow>(
          `SELECT
             COUNT(*)::int AS total_messages,
             COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS messages_today
           FROM messages
           WHERE bot_id = $1`,
          [botId],
        ),
        query<RevenueWindowRow>(
          `SELECT
             COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE), 0) AS revenue_today,
             COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('week', NOW())), 0) AS revenue_this_week,
             COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0) AS revenue_this_month
           FROM payments
           WHERE bot_id = $1`,
          [botId],
        ),
        query<GrowthWindowRow>(
          `SELECT
             COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END), 0) AS current_period,
             COALESCE(SUM(CASE
               WHEN created_at >= CURRENT_DATE - INTERVAL '14 days'
                AND created_at < CURRENT_DATE - INTERVAL '7 days'
               THEN 1 ELSE 0 END), 0) AS previous_period
           FROM users
           WHERE bot_id = $1`,
          [botId],
        ),
        query<HealthRow>(
          `SELECT
             COALESCE(
               (ARRAY_AGG(status ORDER BY created_at DESC))[1],
               'offline'
             ) AS bot_status,
             COALESCE(AVG(uptime), 0) AS uptime_pct,
             COALESCE(SUM(request_count) FILTER (WHERE created_at >= CURRENT_DATE), 0) AS requests_today
           FROM bot_health_logs
           WHERE bot_id = $1`,
          [botId],
        ),
      ]);

    const healthConfigThreshold = Number(process.env.HEALTH_DEGRADED_UPTIME_PCT ?? "99");
    const userRow = userWindow.rows[0];
    const messageRow = messageWindow.rows[0];
    const revenueRow = revenueWindow.rows[0];
    const growthRow = weeklyGrowth.rows[0];
    const healthRow = health.rows[0];
    const uptimePct = Number(parseNumber(healthRow?.uptime_pct).toFixed(2));

    return {
      totalUsers: parseNumber(userRow?.total_users),
      activeUsersToday: parseNumber(userRow?.active_users_today),
      newUsersToday: parseNumber(userRow?.new_users_today),
      messagesToday: parseNumber(messageRow?.messages_today),
      totalMessages: parseNumber(messageRow?.total_messages),
      weeklyGrowthPct: percentageChange(
        parseNumber(growthRow?.current_period),
        parseNumber(growthRow?.previous_period),
      ),
      revenueToday: Number(parseNumber(revenueRow?.revenue_today).toFixed(2)),
      revenueThisWeek: Number(parseNumber(revenueRow?.revenue_this_week).toFixed(2)),
      revenueThisMonth: Number(parseNumber(revenueRow?.revenue_this_month).toFixed(2)),
      botStatus: healthRow?.bot_status ?? "offline",
      apiHealth: uptimePct >= healthConfigThreshold ? "healthy" : "degraded",
      uptimePct,
      requestsToday: parseNumber(healthRow?.requests_today),
    };
  }

  async getGrowth(botId: string): Promise<GrowthStats> {
    const [weeklySeries, monthlySeries, weeklyCounts, monthlyCounts] = await Promise.all([
      query<SeriesRow>(
        `SELECT bucket_date, value
         FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS series(bucket_date)
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS value
           FROM users
           WHERE bot_id = $1
             AND created_at >= bucket_date
             AND created_at < bucket_date + INTERVAL '1 day'
         ) data ON TRUE
         ORDER BY bucket_date`,
        [botId],
      ),
      query<SeriesRow>(
        `SELECT bucket_date, value
         FROM generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '5 months', date_trunc('month', CURRENT_DATE), INTERVAL '1 month') AS series(bucket_date)
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS value
           FROM users
           WHERE bot_id = $1
             AND created_at >= bucket_date
             AND created_at < bucket_date + INTERVAL '1 month'
         ) data ON TRUE
         ORDER BY bucket_date`,
        [botId],
      ),
      query<GrowthWindowRow>(
        `SELECT
           COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END), 0) AS current_period,
           COALESCE(SUM(CASE
             WHEN created_at >= CURRENT_DATE - INTERVAL '14 days'
              AND created_at < CURRENT_DATE - INTERVAL '7 days'
             THEN 1 ELSE 0 END), 0) AS previous_period
         FROM users
         WHERE bot_id = $1`,
        [botId],
      ),
      query<GrowthWindowRow>(
        `SELECT
           COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) THEN 1 ELSE 0 END), 0) AS current_period,
           COALESCE(SUM(CASE
             WHEN created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
              AND created_at < date_trunc('month', CURRENT_DATE)
             THEN 1 ELSE 0 END), 0) AS previous_period
         FROM users
         WHERE bot_id = $1`,
        [botId],
      ),
    ]);

    const weeklyCountsRow = weeklyCounts.rows[0];
    const monthlyCountsRow = monthlyCounts.rows[0];

    return {
      weeklyGrowthPct: percentageChange(
        parseNumber(weeklyCountsRow?.current_period),
        parseNumber(weeklyCountsRow?.previous_period),
      ),
      monthlyGrowthPct: percentageChange(
        parseNumber(monthlyCountsRow?.current_period),
        parseNumber(monthlyCountsRow?.previous_period),
      ),
      weeklySeries: formatSeries(weeklySeries.rows),
      monthlySeries: formatSeries(monthlySeries.rows),
    };
  }

  async getUsers(botId: string): Promise<UserStats> {
    const [userWindow, growthSeries] = await Promise.all([
      query<UserWindowRow>(
        `SELECT
           COUNT(*)::int AS total_users,
           COUNT(*) FILTER (WHERE last_active_at >= CURRENT_DATE)::int AS active_users_today,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS new_users_today
         FROM users
         WHERE bot_id = $1`,
        [botId],
      ),
      query<SeriesRow>(
        `SELECT bucket_date, value
         FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS series(bucket_date)
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS value
           FROM users
           WHERE bot_id = $1
             AND created_at >= bucket_date
             AND created_at < bucket_date + INTERVAL '1 day'
         ) data ON TRUE
         ORDER BY bucket_date`,
        [botId],
      ),
    ]);

    const row = userWindow.rows[0];

    return {
      totalUsers: parseNumber(row?.total_users),
      activeUsersToday: parseNumber(row?.active_users_today),
      newUsersToday: parseNumber(row?.new_users_today),
      growthSeries: formatSeries(growthSeries.rows),
    };
  }

  async getRevenue(botId: string): Promise<RevenueStats> {
    const [revenueWindow, revenueSeries] = await Promise.all([
      query<RevenueWindowRow>(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE), 0) AS revenue_today,
           COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('week', NOW())), 0) AS revenue_this_week,
           COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0) AS revenue_this_month
         FROM payments
         WHERE bot_id = $1`,
        [botId],
      ),
      query<SeriesRow>(
        `SELECT bucket_date, value
         FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS series(bucket_date)
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(amount), 0) AS value
           FROM payments
           WHERE bot_id = $1
             AND created_at >= bucket_date
             AND created_at < bucket_date + INTERVAL '1 day'
         ) data ON TRUE
         ORDER BY bucket_date`,
        [botId],
      ),
    ]);

    const row = revenueWindow.rows[0];

    return {
      revenueToday: Number(parseNumber(row?.revenue_today).toFixed(2)),
      revenueThisWeek: Number(parseNumber(row?.revenue_this_week).toFixed(2)),
      revenueThisMonth: Number(parseNumber(row?.revenue_this_month).toFixed(2)),
      revenueSeries: formatSeries(revenueSeries.rows).map((point) => ({
        ...point,
        value: Number(point.value.toFixed(2)),
      })),
    };
  }

  async getMessages(botId: string): Promise<MessageStats> {
    const [messageWindow, dailySeries] = await Promise.all([
      query<MessageWindowRow>(
        `SELECT
           COUNT(*)::int AS total_messages,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS messages_today
         FROM messages
         WHERE bot_id = $1`,
        [botId],
      ),
      query<SeriesRow>(
        `SELECT bucket_date, value
         FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS series(bucket_date)
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS value
           FROM messages
           WHERE bot_id = $1
             AND created_at >= bucket_date
             AND created_at < bucket_date + INTERVAL '1 day'
         ) data ON TRUE
         ORDER BY bucket_date`,
        [botId],
      ),
    ]);

    const row = messageWindow.rows[0];

    return {
      totalMessages: parseNumber(row?.total_messages),
      messagesToday: parseNumber(row?.messages_today),
      dailyMessagesSeries: formatSeries(dailySeries.rows),
    };
  }

  async getRecentActivity(botId: string, limit = 10): Promise<RecentActivityItem[]> {
    const result = await query<ActivityRow>(
      `SELECT id, event_type, description, event_code, params, created_at
       FROM activity_logs
       WHERE bot_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [botId, limit],
    );

    return result.rows.map((row) => {
      const metadata = row.event_code
        ? {
            eventCode: row.event_code,
            params: row.params ?? {},
          }
        : fallbackActivityMetadata(row);

      return {
      id: row.id,
      eventType: row.event_type,
      description: row.description,
      eventCode: metadata.eventCode,
      params: metadata.params,
      createdAt: row.created_at.toISOString(),
      };
    });
  }

  async ping(): Promise<boolean> {
    const result = await query<NumericRow>("SELECT 1 AS value");
    return parseNumber(result.rows[0]?.value) === 1;
  }
}
