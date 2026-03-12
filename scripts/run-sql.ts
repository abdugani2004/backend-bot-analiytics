import "dotenv/config";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { Pool } from "pg";

const [, , ...files] = process.argv;

if (files.length === 0) {
  throw new Error("Usage: tsx scripts/run-sql.ts <file.sql> [file.sql...]");
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

const main = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    for (const file of files) {
      const sql = await readFile(file, "utf8");
      await client.query(sql);
      console.log(`Executed ${file}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
