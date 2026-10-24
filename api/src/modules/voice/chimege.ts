import { env } from "../../config.ts";

// Mirrors MAX_SPEAK_LENGTH in ui/src/modules/voice/useSpeak.ts. Chimege's
// synthesizer takes short passages; reminders fit easily.
export const MAX_SPEAK_LENGTH = 300;
const TIMEOUT_MS = 30_000;

export class VoiceNotConfiguredError extends Error {}

export const sttToken = () => env.CHIMEGE_STT_TOKEN ?? env.CHIMEGE_TOKEN;

const endpoint = (path: string) => `${env.CHIMEGE_API_URL.replace(/\/+$/, "")}/${path}`;

const requireToken = (token: string | undefined, name: string) => {
  if (!token) {
    throw new VoiceNotConfiguredError(`${name} is not set in the plugin .env`);
  }

  return token;
};

const failure = async (response: Response) => {
  const body = (await response.text()).slice(0, 200);

  return new Error(`Chimege returned ${response.status}${body ? `: ${body}` : ""}`);
};

// Text in, audio out (WAV unless Chimege says otherwise in Content-Type).
export const synthesize = async (text: string) => {
  const token = requireToken(env.CHIMEGE_TOKEN, "CHIMEGE_TOKEN");
  const response = await fetch(endpoint("synthesize"), {
    method: "POST",
    headers: {
      "Content-Type": "plain/text",
      Token: token,
      ...(env.CHIMEGE_VOICE_ID ? { "voice-id": env.CHIMEGE_VOICE_ID } : {}),
    },
    body: text,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw await failure(response);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "audio/wav";
  if (!mimeType.startsWith("audio/")) {
    throw await failure(response);
  }
  const audio = Buffer.from(await response.arrayBuffer());

  return { mimeType, data: audio.toString("base64") };
};

// 16 kHz mono WAV in (the UI records and converts it), text out.
export const transcribe = async (wav: Buffer) => {
  const token = requireToken(sttToken(), "CHIMEGE_STT_TOKEN");
  const response = await fetch(endpoint("transcribe"), {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      Punctuate: "true",
      Token: token,
    },
    body: new Uint8Array(wav),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw await failure(response);
  }

  return (await response.text()).trim();
};
