import type { HealthPayload } from "../types/api";
import { StatsRepository } from "../repositories/statsRepository";

const startedAt = Date.now();

export class HealthService {
  constructor(private readonly statsRepository = new StatsRepository()) {}

  async getHealth(): Promise<HealthPayload> {
    const databaseUp = await this.statsRepository.ping();

    return {
      status: "ok",
      apiHealth: databaseUp ? "healthy" : "degraded",
      database: databaseUp ? "up" : "down",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    };
  }
}
