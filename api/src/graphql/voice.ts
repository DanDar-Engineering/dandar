import { gql } from "graphql-tag";
import { GraphQLError } from "graphql";
import type { Context } from "../connectionResolvers.ts";
import { MAX_SPEAK_LENGTH, VoiceNotConfiguredError, transcribe } from "../modules/voice/chimege.ts";
import { getVoiceStatus, synthesizeSpeech } from "../modules/voice/tts.ts";
import { badInput, requireTenantUser } from "./guards.ts";

export const voiceTypeDefs = gql`
  type DandarVoiceStatus {
    "true when text-to-speech works: OmniVoice, or Chimege with CHIMEGE_TOKEN"
    configured: Boolean!
    "true when a speech-to-text token is set (CHIMEGE_STT_TOKEN or CHIMEGE_TOKEN)"
    sttConfigured: Boolean!
    "Text-to-speech engine: omnivoice or chimege"
    provider: String!
  }

  type DandarSpeech {
    "data: URL of the spoken audio"
    audioUrl: String!
  }

  extend type Query {
    dandarVoiceStatus: DandarVoiceStatus!
  }

  extend type Mutation {
    "Reads Mongolian text aloud (OmniVoice or Chimege, see TTS_PROVIDER)"
    dandarSpeak(text: String!): DandarSpeech!
    "Turns a 16 kHz mono WAV recording (base64) into Mongolian text with Chimege"
    dandarTranscribe(audioData: String!): String!
  }
`;

// Mirrors MAX_AUDIO_CHARS in ui/src/modules/voice/recordWav.ts: 30 s of
// 16 kHz 16-bit mono WAV is ~960 KB, ~1.3 MB in base64.
const MAX_AUDIO_CHARS = 1_400_000;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const toVoiceError = (error: unknown) => {
  if (error instanceof GraphQLError) {
    return error;
  }
  if (error instanceof VoiceNotConfiguredError) {
    return new GraphQLError(error.message, { extensions: { code: "VOICE_NOT_CONFIGURED" } });
  }

  return new GraphQLError(
    `Дуу хоолойн үйлчилгээ хариу өгсөнгүй: ${error instanceof Error ? error.message : String(error)}`,
    { extensions: { code: "VOICE_PROVIDER_ERROR" } },
  );
};

// Both mutations spend provider quota, so they need a signed-in tenant user.
export const voiceResolvers = {
  Query: {
    dandarVoiceStatus: () => getVoiceStatus(),
  },
  Mutation: {
    dandarSpeak: async (_parent: unknown, { text }: { text: string }, context: Context) => {
      requireTenantUser(context);
      const speech = text.trim();
      if (!speech || speech.length > MAX_SPEAK_LENGTH) {
        throw badInput(`Унших текст 1–${MAX_SPEAK_LENGTH} тэмдэгт байна`);
      }

      try {
        const { mimeType, data } = await synthesizeSpeech(speech);
        return { audioUrl: `data:${mimeType};base64,${data}` };
      } catch (error) {
        throw toVoiceError(error);
      }
    },
    dandarTranscribe: async (
      _parent: unknown,
      { audioData }: { audioData: string },
      context: Context,
    ) => {
      requireTenantUser(context);
      if (!audioData || audioData.length > MAX_AUDIO_CHARS || !BASE64.test(audioData)) {
        throw badInput("Бичлэг хоосон, 30 секундээс урт эсвэл гэмтсэн байна");
      }
      const wav = Buffer.from(audioData, "base64");
      if (wav.subarray(0, 4).toString("ascii") !== "RIFF") {
        throw badInput("Бичлэг WAV форматтай байх ёстой");
      }

      try {
        return await transcribe(wav);
      } catch (error) {
        throw toVoiceError(error);
      }
    },
  },
};
