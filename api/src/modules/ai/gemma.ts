import { env } from "../../config.ts";

// Default instructions for every dandarAsk call. Change this to match the
// team's idea; the UI never sends a system prompt of its own.
export const TUTOR_SYSTEM_PROMPT = [
  "You are DanDar, a patient tutor for students and teachers.",
  "Answer in the language the question is written in (Mongolian or English).",
  "Explain step by step, keep answers short, and say so when you are unsure.",
].join(" ");

export const MAX_PROMPT_LENGTH = 4000;

const TIMEOUT_MS = 60_000;

export type AiAnswer = {
  text: string;
  model: string;
  provider: typeof env.AI_PROVIDER;
};

// Missing configuration is the caller's problem to fix in .env, not a
// provider outage, so resolvers report it with its own error code.
export class AiNotConfiguredError extends Error {}

export const getAiStatus = () => ({
  provider: env.AI_PROVIDER,
  model: env.AI_MODEL,
  configured: env.AI_PROVIDER === "gemini" ? Boolean(env.GEMINI_API_KEY) : Boolean(env.AI_BASE_URL),
});

const readJson = async <T>(response: Response): Promise<T> => {
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`AI endpoint returned ${response.status}: ${body.slice(0, 200)}`);
  }
};

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

const askGemini = async (system: string, prompt: string): Promise<string> => {
  if (!env.GEMINI_API_KEY) {
    throw new AiNotConfiguredError("GEMINI_API_KEY is not set in the plugin .env");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.AI_MODEL)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  const data = await readJson<GeminiResponse>(response);

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Gemini API returned ${response.status}`);
  }
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Prompt blocked: ${data.promptFeedback.blockReason}`);
  }

  // Gemma 4 can return thinking parts before the answer; show only the answer.
  return (data.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("")
    .trim();
};

type ChatCompletionResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string } | string;
};

const askOpenAiCompatible = async (system: string, prompt: string): Promise<string> => {
  if (!env.AI_BASE_URL) {
    throw new AiNotConfiguredError("AI_BASE_URL is not set in the plugin .env");
  }

  const response = await fetch(`${env.AI_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.AI_API_KEY ? { Authorization: `Bearer ${env.AI_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await readJson<ChatCompletionResponse>(response);

  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : data.error?.message;
    throw new Error(message ?? `AI endpoint returned ${response.status}`);
  }

  return data.choices?.[0]?.message?.content?.trim() ?? "";
};

export const askGemma = async (
  prompt: string,
  system: string = TUTOR_SYSTEM_PROMPT,
): Promise<AiAnswer> => {
  const text =
    env.AI_PROVIDER === "gemini"
      ? await askGemini(system, prompt)
      : await askOpenAiCompatible(system, prompt);

  if (!text) {
    throw new Error("The model returned an empty answer");
  }

  return { text, model: env.AI_MODEL, provider: env.AI_PROVIDER };
};
