import type { PoolClient } from "pg";
import type { EventUserPayload } from "../types/events";

export class EventRepository {
  async upsertUser(
    client: PoolClient,
    botId: string,
    user: EventUserPayload,
    lastActiveAt: Date,
  ): Promise<string> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO users (bot_id, telegram_id, username, first_name, last_name, created_at, last_active_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (bot_id, telegram_id)
       DO UPDATE SET
         username = EXCLUDED.username,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         last_active_at = GREATEST(users.last_active_at, EXCLUDED.last_active_at)
       RETURNING id`,
      [
        botId,
        user.telegramId,
        user.username ?? null,
        user.firstName ?? null,
        user.lastName ?? null,
        lastActiveAt,
      ],
    );

    return result.rows[0].id;
  }

  async insertMessage(
    client: PoolClient,
    botId: string,
    userId: string,
    text: string | null,
    createdAt: Date,
  ): Promise<void> {
    await client.query(
      `INSERT INTO messages (bot_id, user_id, text, created_at)
       VALUES ($1, $2, $3, $4)`,
      [botId, userId, text, createdAt],
    );
  }

  async insertPayment(
    client: PoolClient,
    botId: string,
    userId: string,
    amount: number,
    currency: string,
    createdAt: Date,
  ): Promise<void> {
    await client.query(
      `INSERT INTO payments (bot_id, user_id, amount, currency, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [botId, userId, amount, currency, createdAt],
    );
  }

  async insertHealthLog(
    client: PoolClient,
    botId: string,
    status: "online" | "offline",
    uptime: number,
    requestCount: number,
    createdAt: Date,
  ): Promise<void> {
    await client.query(
      `INSERT INTO bot_health_logs (bot_id, status, uptime, request_count, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [botId, status, uptime, requestCount, createdAt],
    );
  }

  async insertActivityLog(
    client: PoolClient,
    botId: string,
    eventType: string,
    description: string,
    eventCode: string,
    params: Record<string, string | number>,
    createdAt: Date,
  ): Promise<void> {
    await client.query(
      `INSERT INTO activity_logs (bot_id, event_type, description, event_code, params, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [botId, eventType, description, eventCode, JSON.stringify(params), createdAt],
    );
  }
}
