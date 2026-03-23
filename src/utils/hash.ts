import { createHmac } from "crypto";
import { AppError } from "./errors";

const requireSecret = (value: string | undefined, errorCode: string, envName: string): string => {
  if (!value) {
    throw new AppError(`${envName} is required`, 500, errorCode);
  }

  return value;
};

const hashWithSecret = (value: string, secret: string): string =>
  createHmac("sha256", secret).update(value).digest("hex");

export const hashBotToken = (token: string): string => {
  const secret = requireSecret(
    process.env.TOKEN_HASH_SECRET,
    "MISSING_TOKEN_HASH_SECRET",
    "TOKEN_HASH_SECRET",
  );

  return hashWithSecret(token, secret);
};

export const hashApiKey = (apiKey: string): string => {
  const secret = requireSecret(
    process.env.API_KEY_HASH_SECRET,
    "MISSING_API_KEY_HASH_SECRET",
    "API_KEY_HASH_SECRET",
  );

  return hashWithSecret(apiKey, secret);
};
