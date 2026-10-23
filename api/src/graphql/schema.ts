import { gql } from "graphql-tag";
import { GraphQLError } from "graphql";
import { manifest } from "../config.ts";
import type { Context } from "../connectionResolvers.ts";
import {
  AiNotConfiguredError,
  MAX_PROMPT_LENGTH,
  askGemma,
  getAiStatus,
} from "../modules/ai/gemma.ts";
import { SAMPLE_READ } from "../permissions.ts";

// Every type and operation is prefixed with the plugin name: the gateway
// composes all plugins into one supergraph, so names must be unique across it.
export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.9", import: ["@key"])

  type DandarStatus {
    plugin: String!
    version: String!
    subdomain: String!
    userId: String
    userEmail: String
  }

  type DandarSample {
    _id: String!
    label: String!
    createdAt: String
  }

  type DandarAiStatus {
    provider: String!
    model: String!
    configured: Boolean!
  }

  type DandarAnswer {
    text: String!
    model: String!
    provider: String!
  }

  type Query {
    dandarStatus: DandarStatus!
    dandarSamples(limit: Int = 20, offset: Int = 0): [DandarSample!]!
    dandarAiStatus: DandarAiStatus!
  }

  type Mutation {
    dandarAsk(prompt: String!): DandarAnswer!
  }
`;

export const resolvers = {
  Query: {
    dandarStatus: (_parent: unknown, _args: unknown, { subdomain, user }: Context) => ({
      plugin: manifest.name,
      version: manifest.version,
      subdomain,
      userId: user?._id ?? null,
      userEmail: user?.email ?? null,
    }),
    dandarSamples: async (
      _parent: unknown,
      { limit = 20, offset = 0 }: { limit?: number; offset?: number },
      { models, user, subdomain, checkPermission }: Context,
    ) => {
      if (!user?._id) {
        throw new GraphQLError("Login required", { extensions: { code: "UNAUTHENTICATED" } });
      }
      if (!subdomain) {
        throw new GraphQLError("Tenant required", { extensions: { code: "FORBIDDEN" } });
      }
      await checkPermission(SAMPLE_READ);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 10_000
      ) {
        throw new GraphQLError("Use limit 1–100 and offset 0–10000", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return (await models.Samples.list({ limit, offset })).map((sample) => ({
        ...sample,
        createdAt: sample.createdAt?.toISOString?.() ?? null,
      }));
    },
    dandarAiStatus: () => getAiStatus(),
  },
  Mutation: {
    dandarAsk: async (_parent: unknown, { prompt }: { prompt: string }, { user }: Context) => {
      if (!user?._id) {
        throw new GraphQLError("Login required", { extensions: { code: "UNAUTHENTICATED" } });
      }
      const question = prompt.trim();
      if (!question || question.length > MAX_PROMPT_LENGTH) {
        throw new GraphQLError(`Write a question of 1–${MAX_PROMPT_LENGTH} characters`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      try {
        return await askGemma(question);
      } catch (error) {
        if (error instanceof AiNotConfiguredError) {
          throw new GraphQLError(error.message, { extensions: { code: "AI_NOT_CONFIGURED" } });
        }
        throw new GraphQLError(
          `Gemma request failed: ${error instanceof Error ? error.message : String(error)}`,
          { extensions: { code: "AI_PROVIDER_ERROR" } },
        );
      }
    },
  },
};
