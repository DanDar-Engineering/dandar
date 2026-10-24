import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// CommonJS stacks (erxes-api-shared's ESM bundle does not run under Node,
// NestJS builds CJS) override api/shared's config.ts, which uses ESM-only
// import.meta.url. erxes.json sits at the repository root, two levels above
// both src/ and dist/.
const manifestSchema = z.object({
  name: z.string(),
  title: z.string(),
  version: z.string(),
  api: z.object({
    port: z.number().int(),
    graphql: z.string(),
    health: z.string(),
  }),
});

export const manifest = manifestSchema.parse(
  JSON.parse(readFileSync(join(__dirname, "../../erxes.json"), "utf8")),
);

const optional = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().default(manifest.api.port),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: optional,
  MONGO_URL: optional,
  UI_ENTRY_URL: optional,
  LOAD_BALANCER_ADDRESS: optional,
  RELEASE_VERSION: optional,
  // Gemma 4. "gemini" calls Google AI Studio's Gemini API with GEMINI_API_KEY;
  // "openai" calls any OpenAI-compatible /chat/completions endpoint at
  // AI_BASE_URL (Ollama, DigitalOcean serverless inference, vLLM).
  AI_PROVIDER: z.enum(["gemini", "openai"]).default("gemini"),
  AI_MODEL: z.string().default("gemma-4-26b-a4b-it"),
  GEMINI_API_KEY: optional,
  AI_BASE_URL: optional,
  AI_API_KEY: optional,
  // Chimege (chimege.com) Mongolian text-to-speech and speech-to-text. The
  // console issues one token per API: CHIMEGE_TOKEN is the TTS token and
  // CHIMEGE_STT_TOKEN the speech-to-text one (falls back to CHIMEGE_TOKEN).
  // The base URL is overridable because the API version is part of the path.
  CHIMEGE_TOKEN: optional,
  CHIMEGE_STT_TOKEN: optional,
  // Text-to-speech engine. "omnivoice" (k2-fsa/OmniVoice, 600+ languages
  // including Mongolian) calls a Gradio app: the public Hugging Face Space by
  // default, or a self-hosted `omnivoice-demo` (GPU, Colab). "chimege" uses
  // CHIMEGE_TOKEN. Speech-to-text always uses Chimege.
  TTS_PROVIDER: z.enum(["omnivoice", "chimege"]).default("omnivoice"),
  OMNIVOICE_URL: z.string().default("https://k2-fsa-omnivoice.hf.space"),
  OMNIVOICE_GENDER: z.enum(["Auto", "Male", "Female"]).default("Female"),
  // A Hugging Face token raises the public Space's GPU quota; optional.
  OMNIVOICE_HF_TOKEN: optional,
  CHIMEGE_API_URL: z.string().default("https://api.chimege.com/v1.2"),
  CHIMEGE_VOICE_ID: optional,
});

export const env = envSchema.parse(process.env);

export const redisConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
};
