import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import type { BotRecord, BotType } from "../types/api";
import { query } from "../utils/db";

interface BotRow extends QueryResultRow {
  id: string;
  bot_identifier: string;
  bot_type: BotType;
  display_name: string | null;
  telegram_bot_id: string | null;
  encrypted_token: string | null;
  verification_status: "pending" | "verified" | "failed";
  tracking_status: "disabled" | "enabled";
  webhook_status: "pending" | "enabled" | "failed";
  connected_at: Date;
  verified_at: Date | null;
  tracking_enabled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const mapBotRow = (row: BotRow): BotRecord => ({
  id: row.id,
  botIdentifier: row.bot_identifier,
  botType: row.bot_type,
  displayName: row.display_name,
  telegramBotId: row.telegram_bot_id,
  encryptedToken: row.encrypted_token,
  verificationStatus: row.verification_status,
  trackingStatus: row.tracking_status,
  webhookStatus: row.webhook_status,
  connectedAt: row.connected_at,
  verifiedAt: row.verified_at,
  trackingEnabledAt: row.tracking_enabled_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

type QueryExecutor = {
  query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

export class BotRepository {
  async findByIdentifier(
    botType: BotType,
    botIdentifier: string,
    client?: PoolClient,
  ): Promise<BotRecord | null> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<BotRow>(
      `SELECT
         id,
         bot_identifier,
         bot_type,
         display_name,
         telegram_bot_id,
         encrypted_token,
         verification_status,
         tracking_status,
         webhook_status,
         connected_at,
         verified_at,
         tracking_enabled_at,
         created_at,
         updated_at
       FROM bots
       WHERE bot_type = $1 AND bot_identifier = $2
       LIMIT 1`,
      [botType, botIdentifier],
    );

    return result.rows[0] ? mapBotRow(result.rows[0]) : null;
  }

  async create(
    botType: BotType,
    botIdentifier: string,
    displayName: string | null,
    client?: PoolClient,
  ): Promise<BotRecord> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<BotRow>(
      `INSERT INTO bots (bot_identifier, bot_type, display_name)
       VALUES ($1, $2, $3)
       RETURNING
         id,
         bot_identifier,
         bot_type,
         display_name,
         telegram_bot_id,
         encrypted_token,
         verification_status,
         tracking_status,
         webhook_status,
         connected_at,
         verified_at,
         tracking_enabled_at,
         created_at,
         updated_at`,
      [botIdentifier, botType, displayName],
    );

    return mapBotRow(result.rows[0]);
  }

  async touch(botId: string, client?: PoolClient): Promise<void> {
    const executor: QueryExecutor = client ?? { query };
    await executor.query(`UPDATE bots SET connected_at = NOW(), updated_at = NOW() WHERE id = $1`, [botId]);
  }

  async updateVerificationStatus(
    botId: string,
    status: "pending" | "verified" | "failed",
    client?: PoolClient,
  ): Promise<BotRecord> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<BotRow>(
      `UPDATE bots
       SET
         verification_status = $2,
         verified_at = CASE WHEN $2 = 'verified' THEN NOW() ELSE NULL END,
         updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         bot_identifier,
         bot_type,
         display_name,
         telegram_bot_id,
         encrypted_token,
         verification_status,
         tracking_status,
         webhook_status,
         connected_at,
         verified_at,
         tracking_enabled_at,
         created_at,
         updated_at`,
      [botId, status],
    );

    return mapBotRow(result.rows[0]);
  }

  async updateTrackingStatus(
    botId: string,
    status: "disabled" | "enabled",
    webhookStatus: "pending" | "enabled" | "failed",
    client?: PoolClient,
  ): Promise<BotRecord> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<BotRow>(
      `UPDATE bots
       SET
         tracking_status = $2,
         webhook_status = $3,
         tracking_enabled_at = CASE WHEN $2 = 'enabled' THEN NOW() ELSE NULL END,
         updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         bot_identifier,
         bot_type,
         display_name,
         telegram_bot_id,
         encrypted_token,
         verification_status,
         tracking_status,
         webhook_status,
         connected_at,
         verified_at,
         tracking_enabled_at,
         created_at,
         updated_at`,
      [botId, status, webhookStatus],
    );

    return mapBotRow(result.rows[0]);
  }

  async findById(botId: string, client?: PoolClient): Promise<BotRecord | null> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<BotRow>(
      `SELECT
         id,
         bot_identifier,
         bot_type,
         display_name,
         telegram_bot_id,
         encrypted_token,
         verification_status,
         tracking_status,
         webhook_status,
         connected_at,
         verified_at,
         tracking_enabled_at,
         created_at,
         updated_at
       FROM bots
       WHERE id = $1
       LIMIT 1`,
      [botId],
    );

    return result.rows[0] ? mapBotRow(result.rows[0]) : null;
  }

  async updateTelegramCredentials(
    botId: string,
    values: {
      displayName: string;
      telegramBotId: string;
      encryptedToken: string;
      verificationStatus: "pending" | "verified" | "failed";
    },
    client?: PoolClient,
  ): Promise<BotRecord> {
    const executor: QueryExecutor = client ?? { query };
    const result = await executor.query<BotRow>(
      `UPDATE bots
       SET
         display_name = $2,
         telegram_bot_id = $3,
         encrypted_token = $4,
         verification_status = $5,
         verified_at = CASE WHEN $5 = 'verified' THEN NOW() ELSE NULL END,
         updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         bot_identifier,
         bot_type,
         display_name,
         telegram_bot_id,
         encrypted_token,
         verification_status,
         tracking_status,
         webhook_status,
         connected_at,
         verified_at,
         tracking_enabled_at,
         created_at,
         updated_at`,
      [
        botId,
        values.displayName,
        values.telegramBotId,
        values.encryptedToken,
        values.verificationStatus,
      ],
    );

    return mapBotRow(result.rows[0]);
  }
}
