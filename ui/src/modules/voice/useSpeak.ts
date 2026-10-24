import { useMutation, useQuery } from "@apollo/client";
import { useCallback, useRef, useState } from "react";
import { SPEAK_MUTATION, VOICE_STATUS_QUERY } from "./graphql";

// Mirrors MAX_SPEAK_LENGTH in api/src/modules/voice/chimege.ts.
export const MAX_SPEAK_LENGTH = 300;

const clip = (text: string) =>
  text.length > MAX_SPEAK_LENGTH ? `${text.slice(0, MAX_SPEAK_LENGTH - 1)}…` : text;

// Reads Mongolian text aloud through Chimege. Resolves false when voice is
// not configured or the browser refused to play (autoplay without a click).
export const useSpeak = () => {
  const { data } = useQuery(VOICE_STATUS_QUERY);
  const [speakMutation] = useMutation(SPEAK_MUTATION);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const configured = data?.dandarVoiceStatus.configured ?? false;
  const sttConfigured = data?.dandarVoiceStatus.sttConfigured ?? false;

  const speak = useCallback(
    async (text: string) => {
      const speech = clip(text.trim());
      if (!configured || !speech) {
        return false;
      }
      setError("");
      setSpeaking(true);
      try {
        const result = await speakMutation({ variables: { text: speech } });
        const url = result.data?.dandarSpeak.audioUrl;
        if (!url) {
          throw new Error("Chimege хоосон хариу өглөө");
        }
        audio.current?.pause();
        audio.current = new Audio(url);
        await new Promise<void>((resolve, reject) => {
          const player = audio.current;
          if (!player) {
            resolve();
            return;
          }
          player.onended = () => resolve();
          player.onerror = () => reject(new Error("Аудиог тоглуулж чадсангүй"));
          player.play().catch(reject);
        });
        return true;
      } catch (speakError) {
        setError(speakError instanceof Error ? speakError.message : String(speakError));
        return false;
      } finally {
        setSpeaking(false);
      }
    },
    [configured, speakMutation],
  );

  return { configured, sttConfigured, speak, speaking, error };
};
