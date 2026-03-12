import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { AppError } from "./errors";

let pool: Pool | null = null;

const getDatabaseUrl = (): string => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new AppError("DATABASE_URL is required", 500, "MISSING_DATABASE_URL");
  }

  return databaseUrl;
};

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 10,
      ssl:
        process.env.NODE_ENV === "production"
          ? {
              rejectUnauthorized: false,
            }
          : false,
    });
  }

  return pool;
};

export const query = async <T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> => getPool().query<T>(text, params);

export const withTransaction = async <T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
