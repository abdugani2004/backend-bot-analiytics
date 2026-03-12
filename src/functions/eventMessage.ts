import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { validateMessageEvent } from "../utils/validation";
import { EventService } from "../services/eventService";

const eventService = new EventService();

export const handler = createHandler(async (event) => {
  const input = validateMessageEvent(event);
  await eventService.ingestMessage(input);

  return successResponse(null, "Message event ingested", 201);
});
