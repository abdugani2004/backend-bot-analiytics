import { AuthService } from "../services/authService";
import { createHandler } from "../utils/handler";
import { successResponse } from "../utils/response";
import { validateAuthRegisterInput } from "../utils/validation";

const authService = new AuthService();

export const handler = createHandler(async (event) => {
  const input = validateAuthRegisterInput(event);
  const data = await authService.registerOwner(input);

  return successResponse(data, "Owner account created successfully");
});
