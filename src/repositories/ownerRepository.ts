import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import type { OwnerBotSummary, OwnerRecord, PlanType } from "../types/api";
import { query } from "../utils/db";

interface OwnerRow extends QueryResultRow {
  id: string;
  email: string;
  name: string | null;
  api_key_hash: string;
  plan: "starter" | "growth";
  billing_provider_customer_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface UsageRow extends QueryResultRow {
  total_bots: string | number;
  monthly_events: string | number;
}

interface OwnerBotSummaryRow extends QueryResultRow {
  bot_id: string;
  display_name: string | null;
  bot_type: "token" | "username";
  verification_status: "pending" | "verified" | "failed";
  tracking_status: "disabled" | "enabled";
  connected_at: Date;
  bot_identifier: string;
  total_users: string | number;
  total_messages: string | number;
  revenue_this_month: string | number | null;
}

type QueryExecutor = {
  query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

const mapOwnerRow = (row: OwnerRow): OwnerRecord => ({
  id: row.id,
  email: row.email,
  name: row.name,
  apiKeyHash: row.api_key_hash,
  plan: row.plan,
  billingProviderCustomerId: row.billing_provider_customer_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseNumber = (value: string | number | null | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

export class OwnerRepository {
  async create(
    values: { email: string; name: string | null; apiKeyHash: string },
    client?: PoolClient,
  ): Promise<OwnerRecord> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<OwnerRow>(
      `INSERT INTO accounts (email, name, api_key_hash, plan)
       VALUES ($1, $2, $3, 'starter')
       RETURNING id, email, name, api_key_hash, plan, billing_provider_customer_id, created_at, updated_at`,
      [values.email, values.name, values.apiKeyHash],
    );

    return mapOwnerRow(result.rows[0]);
  }

  async findByApiKeyHash(apiKeyHash: string, client?: PoolClient): Promise<OwnerRecord | null> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<OwnerRow>(
      `SELECT id, email, name, api_key_hash, plan, billing_provider_customer_id, created_at, updated_at
       FROM accounts
       WHERE api_key_hash = $1
       LIMIT 1`,
      [apiKeyHash],
    );

    return result.rows[0] ? mapOwnerRow(result.rows[0]) : null;
  }

  async findById(ownerId: string, client?: PoolClient): Promise<OwnerRecord | null> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<OwnerRow>(
      `SELECT id, email, name, api_key_hash, plan, billing_provider_customer_id, created_at, updated_at
       FROM accounts
       WHERE id = $1
       LIMIT 1`,
      [ownerId],
    );

    return result.rows[0] ? mapOwnerRow(result.rows[0]) : null;
  }

  async getUsage(ownerId: string, client?: PoolClient): Promise<{ totalBots: number; monthlyEvents: number }> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<UsageRow>(
      `SELECT
         COALESCE((SELECT COUNT(*) FROM bots WHERE owner_account_id = $1), 0) AS total_bots,
         COALESCE((
           SELECT COUNT(*)
           FROM activity_logs al
           INNER JOIN bots b ON b.id = al.bot_id
           WHERE b.owner_account_id = $1
             AND al.created_at >= date_trunc('month', NOW())
         ), 0) AS monthly_events`,
      [ownerId],
    );

    return {
      totalBots: parseNumber(result.rows[0]?.total_bots),
      monthlyEvents: parseNumber(result.rows[0]?.monthly_events),
    };
  }

  async listOwnerBots(ownerId: string, client?: PoolClient): Promise<OwnerBotSummary[]> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<OwnerBotSummaryRow>(
      `SELECT
         b.id AS bot_id,
         b.display_name,
         b.bot_type,
         b.verification_status,
         b.tracking_status,
         b.connected_at,
         b.bot_identifier,
         COALESCE(users.total_users, 0) AS total_users,
         COALESCE(messages.total_messages, 0) AS total_messages,
         COALESCE(payments.revenue_this_month, 0) AS revenue_this_month
       FROM bots b
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total_users
         FROM users u
         WHERE u.bot_id = b.id
       ) users ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total_messages
         FROM messages m
         WHERE m.bot_id = b.id
       ) messages ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(p.amount) FILTER (WHERE p.created_at >= date_trunc('month', NOW())), 0) AS revenue_this_month
         FROM payments p
         WHERE p.bot_id = b.id
       ) payments ON TRUE
       WHERE b.owner_account_id = $1
       ORDER BY b.connected_at DESC`,
      [ownerId],
    );

    return result.rows.map((row) => ({
      botId: row.bot_id,
      displayName: row.display_name ?? (row.bot_type === "username" ? `@${row.bot_identifier}` : "Telegram Bot"),
      botType: row.bot_type,
      verificationStatus: row.verification_status,
      trackingStatus: row.tracking_status,
      connectedAt: row.connected_at.toISOString(),
      totalUsers: parseNumber(row.total_users),
      totalMessages: parseNumber(row.total_messages),
      revenueThisMonth: Number(parseNumber(row.revenue_this_month).toFixed(2)),
    }));
  }

  async updatePlan(ownerId: string, plan: PlanType, client?: PoolClient): Promise<OwnerRecord> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<OwnerRow>(
      `UPDATE accounts
       SET plan = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, api_key_hash, plan, billing_provider_customer_id, created_at, updated_at`,
      [ownerId, plan],
    );

    return mapOwnerRow(result.rows[0]);
  }

  async updateBillingCustomerId(
    ownerId: string,
    billingProviderCustomerId: string,
    client?: PoolClient,
  ): Promise<OwnerRecord> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<OwnerRow>(
      `UPDATE accounts
       SET billing_provider_customer_id = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, api_key_hash, plan, billing_provider_customer_id, created_at, updated_at`,
      [ownerId, billingProviderCustomerId],
    );

    return mapOwnerRow(result.rows[0]);
  }
}
