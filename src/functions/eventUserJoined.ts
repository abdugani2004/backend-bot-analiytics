import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { validateUserJoinedEvent } from "../utils/validation";
import { EventService } from "../services/eventService";

const eventService = new EventService();

export const handler = createHandler(async (event) => {
  const input = validateUserJoinedEvent(event);
  await eventService.ingestUserJoined(input);

  return successResponse(null, "User joined event ingested", 201);
});
