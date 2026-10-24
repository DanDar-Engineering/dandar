import { gql } from "graphql-tag";
import { GraphQLError } from "graphql";
import { manifest } from "../config.ts";
import type { Context } from "../connectionResolvers.ts";
import { MAX_PROMPT_LENGTH, askGemma, getAiStatus } from "../modules/ai/gemma.ts";
import { SAMPLE_READ, SAMPLE_WRITE } from "../permissions.ts";
import { RECORD_ID, assertPage, requireTenantUser, toAiError } from "./guards.ts";
import { scanResolvers, scanTypeDefs } from "./scan.ts";

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
    "erxes contact (core Customer) _id; the UI resolves it with ui-modules"
    customerId: String
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
    dandarSampleAdd(label: String!, customerId: String): DandarSample!
    dandarAsk(prompt: String!): DandarAnswer!
  }

  ${scanTypeDefs}
`;

const LABEL_MAX_LENGTH = 200;

const toSampleOutput = (sample: { createdAt?: Date }) => ({
  ...sample,
  createdAt: sample.createdAt?.toISOString?.() ?? null,
});

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
      context: Context,
    ) => {
      requireTenantUser(context);
      await context.checkPermission(SAMPLE_READ);
      assertPage(limit, offset);
      return (await context.models.Samples.list({ limit, offset })).map(toSampleOutput);
    },
    dandarAiStatus: () => getAiStatus(),
    ...scanResolvers.Query,
  },
  Mutation: {
    ...scanResolvers.Mutation,
    dandarSampleAdd: async (
      _parent: unknown,
      { label, customerId }: { label: string; customerId?: string | null },
      context: Context,
    ) => {
      requireTenantUser(context);
      await context.checkPermission(SAMPLE_WRITE);
      const name = label.trim();
      if (!name || name.length > LABEL_MAX_LENGTH) {
        throw new GraphQLError(`Label must be 1–${LABEL_MAX_LENGTH} characters`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (customerId && !RECORD_ID.test(customerId)) {
        throw new GraphQLError("Invalid customerId", { extensions: { code: "BAD_USER_INPUT" } });
      }
      return toSampleOutput(
        await context.models.Samples.createSample({
          label: name,
          customerId: customerId || undefined,
        }),
      );
    },
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
        throw toAiError(error);
      }
    },
  },
};
