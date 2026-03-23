import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { requireApiKey, validateMessageEvent } from "../utils/validation";
import { EventService } from "../services/eventService";
import { AuthService } from "../services/authService";
import { PlanService } from "../services/planService";

const authService = new AuthService();
const eventService = new EventService();
const planService = new PlanService();

export const handler = createHandler(async (event) => {
  const owner = await authService.requireOwnerByApiKey(requireApiKey(event));
  await planService.enforceCanIngestEvent(owner);
  const input = validateMessageEvent(event);
  await eventService.ingestMessage(input, owner.id);

  return successResponse(null, "Message event ingested", 201);
});
