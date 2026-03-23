import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import type {
  BillingEventRecord,
  BillingProvider,
  PlanType,
  SubscriptionRecord,
  SubscriptionStatus,
} from "../types/api";
import { query } from "../utils/db";

type QueryExecutor = {
  query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

interface SubscriptionRow extends QueryResultRow {
  id: string;
  account_id: string;
  provider: BillingProvider;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  plan: PlanType;
  status: SubscriptionStatus;
  amount_monthly: string | number;
  currency: string;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  created_at: Date;
  updated_at: Date;
}

interface BillingEventRow extends QueryResultRow {
  id: string;
  account_id: string | null;
  provider: BillingProvider;
  provider_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed_at: Date;
  created_at: Date;
}

const parseNumber = (value: string | number | null | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

const mapSubscriptionRow = (row: SubscriptionRow): SubscriptionRecord => ({
  id: row.id,
  accountId: row.account_id,
  provider: row.provider,
  providerCustomerId: row.provider_customer_id,
  providerSubscriptionId: row.provider_subscription_id,
  plan: row.plan,
  status: row.status,
  amountMonthly: Number(parseNumber(row.amount_monthly).toFixed(2)),
  currency: row.currency,
  currentPeriodStart: row.current_period_start,
  currentPeriodEnd: row.current_period_end,
  cancelAtPeriodEnd: row.cancel_at_period_end,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapBillingEventRow = (row: BillingEventRow): BillingEventRecord => ({
  id: row.id,
  accountId: row.account_id,
  provider: row.provider,
  providerEventId: row.provider_event_id,
  eventType: row.event_type,
  payload: row.payload,
  processedAt: row.processed_at,
  createdAt: row.created_at,
});

export class BillingRepository {
  async getActiveSubscription(accountId: string, client?: PoolClient): Promise<SubscriptionRecord | null> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<SubscriptionRow>(
      `SELECT id, account_id, provider, provider_customer_id, provider_subscription_id, plan, status,
              amount_monthly, currency, current_period_start, current_period_end, cancel_at_period_end,
              created_at, updated_at
       FROM subscriptions
       WHERE account_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [accountId],
    );

    return result.rows[0] ? mapSubscriptionRow(result.rows[0]) : null;
  }

  async upsertSubscription(
    values: {
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
    },
    client?: PoolClient,
  ): Promise<SubscriptionRecord> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<SubscriptionRow>(
      `INSERT INTO subscriptions (
         account_id,
         provider,
         provider_customer_id,
         provider_subscription_id,
         plan,
         status,
         amount_monthly,
         currency,
         current_period_start,
         current_period_end,
         cancel_at_period_end
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (account_id)
       DO UPDATE SET
         provider = EXCLUDED.provider,
         provider_customer_id = EXCLUDED.provider_customer_id,
         provider_subscription_id = EXCLUDED.provider_subscription_id,
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         amount_monthly = EXCLUDED.amount_monthly,
         currency = EXCLUDED.currency,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         cancel_at_period_end = EXCLUDED.cancel_at_period_end,
         updated_at = NOW()
       RETURNING id, account_id, provider, provider_customer_id, provider_subscription_id, plan, status,
                 amount_monthly, currency, current_period_start, current_period_end, cancel_at_period_end,
                 created_at, updated_at`,
      [
        values.accountId,
        values.provider,
        values.providerCustomerId,
        values.providerSubscriptionId,
        values.plan,
        values.status,
        values.amountMonthly,
        values.currency,
        values.currentPeriodStart,
        values.currentPeriodEnd,
        values.cancelAtPeriodEnd,
      ],
    );

    return mapSubscriptionRow(result.rows[0]);
  }

  async storeBillingEvent(
    values: {
      accountId: string | null;
      provider: BillingProvider;
      providerEventId: string;
      eventType: string;
      payload: Record<string, unknown>;
    },
    client?: PoolClient,
  ): Promise<BillingEventRecord> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<BillingEventRow>(
      `INSERT INTO billing_events (account_id, provider, provider_event_id, event_type, payload, processed_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (provider, provider_event_id)
       DO UPDATE SET processed_at = NOW(), payload = EXCLUDED.payload, event_type = EXCLUDED.event_type
       RETURNING id, account_id, provider, provider_event_id, event_type, payload, processed_at, created_at`,
      [values.accountId, values.provider, values.providerEventId, values.eventType, JSON.stringify(values.payload)],
    );

    return mapBillingEventRow(result.rows[0]);
  }
}
