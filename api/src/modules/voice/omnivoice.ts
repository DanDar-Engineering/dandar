import { env } from "../../config.ts";

// k2-fsa/OmniVoice served by its Gradio app (`omnivoice-demo`, or the public
// Space at OMNIVOICE_URL). `/_design_fn` needs no reference audio: it takes
// the text, a language and voice attributes, and returns a 24 kHz WAV.
const TIMEOUT_MS = 60_000;
const ENDPOINT = "_design_fn";

// Labels the Gradio dropdowns expect (`/gradio_api/info`).
const GENDER_LABELS = { Auto: "Auto", Male: "Male / 男", Female: "Female / 女" } as const;

type GradioFile = { url?: string | null };

const baseUrl = () => env.OMNIVOICE_URL.replace(/\/+$/, "");

const authHeaders = (): Record<string, string> =>
  env.OMNIVOICE_HF_TOKEN ? { Authorization: `Bearer ${env.OMNIVOICE_HF_TOKEN}` } : {};

// Gradio answers a call with an event id, then streams the result as
// server-sent events: `event: complete` + `data: [file, status]`, or
// `event: error`.
const readResult = (stream: string) => {
  const events = stream.split(/\n\n+/);
  for (const block of events) {
    const event = block.match(/^event: (\w+)/m)?.[1];
    const data = block.match(/^data: (.*)$/m)?.[1];
    if (event === "error") {
      throw new Error(`OmniVoice failed${data && data !== "null" ? `: ${data.slice(0, 200)}` : ""}`);
    }
    if (event === "complete" && data) {
      const [file] = JSON.parse(data) as [GradioFile, string];
      if (!file?.url) {
        throw new Error("OmniVoice returned no audio");
      }

      return file.url;
    }
  }
  throw new Error("OmniVoice ended without a result");
};

export const synthesizeOmniVoice = async (text: string) => {
  const call = await fetch(`${baseUrl()}/gradio_api/call/${ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      data: [
        text,
        "Mongolian",
        32, // diffusion steps
        2.0, // guidance scale
        true, // denoise
        1.0, // speed
        null, // duration: let the model decide
        true, // preprocess prompt
        true, // postprocess output
        GENDER_LABELS[env.OMNIVOICE_GENDER],
        "Auto", // age
        "Auto", // pitch
        "Auto", // style
        "Auto", // English accent
        "Auto", // Chinese dialect
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!call.ok) {
    throw new Error(`OmniVoice returned ${call.status}: ${(await call.text()).slice(0, 200)}`);
  }
  const { event_id: eventId } = (await call.json()) as { event_id?: string };
  if (!eventId) {
    throw new Error("OmniVoice did not start the job");
  }

  const result = await fetch(`${baseUrl()}/gradio_api/call/${ENDPOINT}/${eventId}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const fileUrl = readResult(await result.text());

  // Only download from the configured app, never from a URL elsewhere.
  if (!fileUrl.startsWith(`${baseUrl()}/`)) {
    throw new Error("OmniVoice returned audio from an unexpected host");
  }
  const audio = await fetch(fileUrl, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!audio.ok) {
    throw new Error(`OmniVoice audio download returned ${audio.status}`);
  }

  return {
    mimeType: "audio/wav",
    data: Buffer.from(await audio.arrayBuffer()).toString("base64"),
  };
};
