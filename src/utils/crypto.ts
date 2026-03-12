import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { AppError } from "./errors";

const IV_LENGTH = 12;

const getEncryptionKey = (): Buffer => {
  const secret = process.env.TOKEN_ENCRYPTION_SECRET;

  if (!secret) {
    throw new AppError(
      "TOKEN_ENCRYPTION_SECRET is required",
      500,
      "MISSING_TOKEN_ENCRYPTION_SECRET",
    );
  }

  return createHash("sha256").update(secret).digest();
};

export const encryptSecret = (value: string): string => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
};

export const decryptSecret = (value: string): string => {
  const [ivPart, authTagPart, encryptedPart] = value.split(":");

  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new AppError("Invalid encrypted secret", 500, "INVALID_ENCRYPTED_SECRET");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivPart, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagPart, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};
