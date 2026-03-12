import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { validatePaymentEvent } from "../utils/validation";
import { EventService } from "../services/eventService";

const eventService = new EventService();

export const handler = createHandler(async (event) => {
  const input = validatePaymentEvent(event);
  await eventService.ingestPayment(input);

  return successResponse(null, "Payment event ingested", 201);
});
