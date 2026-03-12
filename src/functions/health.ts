import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { HealthService } from "../services/healthService";

const healthService = new HealthService();

export const handler = createHandler(async () => {
  const data = await healthService.getHealth();
  return successResponse(data, "Health check completed");
});
