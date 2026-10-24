import { GraphQLError } from "graphql";
import type { Context } from "../connectionResolvers.ts";
import { AiNotConfiguredError } from "../modules/ai/gemma.ts";

// erxes record ids are short url-safe strings
export const RECORD_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const badInput = (message: string) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });

export const requireTenantUser = ({ user, subdomain }: Context) => {
  if (!user?._id) {
    throw new GraphQLError("Login required", { extensions: { code: "UNAUTHENTICATED" } });
  }
  if (!subdomain) {
    throw new GraphQLError("Tenant required", { extensions: { code: "FORBIDDEN" } });
  }

  return user._id;
};

export const assertPage = (limit: number, offset: number) => {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 10_000
  ) {
    throw badInput("Use limit 1–100 and offset 0–10000");
  }
};

// Missing configuration is fixed in .env; anything else is a provider failure.
export const toAiError = (error: unknown) => {
  if (error instanceof GraphQLError) {
    return error;
  }
  if (error instanceof AiNotConfiguredError) {
    return new GraphQLError(error.message, { extensions: { code: "AI_NOT_CONFIGURED" } });
  }

  return new GraphQLError(
    `Gemma request failed: ${error instanceof Error ? error.message : String(error)}`,
    { extensions: { code: "AI_PROVIDER_ERROR" } },
  );
};
