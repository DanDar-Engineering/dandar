import { env } from "../../config.ts";
import { synthesize as synthesizeChimege, sttToken } from "./chimege.ts";
import { synthesizeOmniVoice } from "./omnivoice.ts";

// OmniVoice needs no key (public Space by default); Chimege needs its token.
export const getVoiceStatus = () => ({
  configured: env.TTS_PROVIDER === "omnivoice" || Boolean(env.CHIMEGE_TOKEN),
  sttConfigured: Boolean(sttToken()),
  provider: env.TTS_PROVIDER,
});

export const synthesizeSpeech = (text: string) =>
  env.TTS_PROVIDER === "omnivoice" ? synthesizeOmniVoice(text) : synthesizeChimege(text);
