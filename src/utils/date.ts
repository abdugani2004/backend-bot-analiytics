import { AppError } from "./errors";

export const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

export const parseEventDate = (value?: string): Date => {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      createdAt: "must be a valid ISO date string",
    });
  }

  return parsed;
};
