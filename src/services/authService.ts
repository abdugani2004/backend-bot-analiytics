import { randomBytes } from "crypto";
import type {
  AccountPlanUpdateInput,
  AuthRegisterInput,
  AuthRegisterResponse,
  OwnerRecord,
} from "../types/api";
import { OwnerRepository } from "../repositories/ownerRepository";
import { hashApiKey } from "../utils/hash";
import { AppError } from "../utils/errors";

const generateApiKey = (): string => `tba_${randomBytes(24).toString("hex")}`;

export class AuthService {
  constructor(private readonly ownerRepository = new OwnerRepository()) {}

  async registerOwner(input: AuthRegisterInput): Promise<AuthRegisterResponse> {
    const apiKey = generateApiKey();
    const owner = await this.ownerRepository.create({
      email: input.email.toLowerCase(),
      name: input.name,
      apiKeyHash: hashApiKey(apiKey),
    });

    return {
      ownerId: owner.id,
      email: owner.email,
      name: owner.name,
      apiKey,
      plan: owner.plan,
    };
  }

  async requireOwnerByApiKey(apiKey: string): Promise<OwnerRecord> {
    const owner = await this.ownerRepository.findByApiKeyHash(hashApiKey(apiKey));

    if (!owner) {
      throw new AppError("Unauthorized", 401, "INVALID_API_KEY");
    }

    return owner;
  }

  async updateOwnerPlan(
    ownerId: string,
    input: AccountPlanUpdateInput,
  ): Promise<OwnerRecord> {
    return this.ownerRepository.updatePlan(ownerId, input.plan);
  }
}
