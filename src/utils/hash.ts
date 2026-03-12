import { createHmac } from "crypto";
import { AppError } from "./errors";

export const hashBotToken = (token: string): string => {
  const secret = process.env.TOKEN_HASH_SECRET;

  if (!secret) {
    throw new AppError(
      "TOKEN_HASH_SECRET is required",
      500,
      "MISSING_TOKEN_HASH_SECRET",
    );
  }

  return createHmac("sha256", secret).update(token).digest("hex");
};
