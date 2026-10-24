import { useMutation } from "@apollo/client";
import { useRef, useState } from "react";
import { IconLoader2, IconMicrophone, IconPlayerStopFilled } from "@tabler/icons-react";
import { TRANSCRIBE_MUTATION } from "./graphql";
import { MAX_SECONDS, type Recording, startRecording } from "./recordWav";

type Props = {
  onText: (text: string) => void;
  onError: (message: string) => void;
  className?: string;
};

// Click to record (up to MAX_SECONDS), click again to stop; Chimege turns the
// Mongolian speech into text for onText.
export const MicButton = ({ onText, onError, className }: Props) => {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const recording = useRef<Recording | null>(null);
  const [transcribe] = useMutation(TRANSCRIBE_MUTATION);

  const onClick = async () => {
    if (state === "transcribing") {
      return;
    }
    if (state === "idle") {
      try {
        recording.current = await startRecording();
        setState("recording");
      } catch (error) {
        onError(error instanceof Error ? error.message : "Микрофоныг нээж чадсангүй");
      }
      return;
    }

    setState("transcribing");
    try {
      const audioData = await recording.current?.stop();
      if (audioData) {
        const result = await transcribe({ variables: { audioData } });
        const text = result.data?.dandarTranscribe.trim();
        if (text) {
          onText(text);
        } else {
          onError("Яриа танигдсангүй. Дахин ойроос, тодорхой ярина уу.");
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Яриаг текст болгож чадсангүй");
    } finally {
      recording.current = null;
      setState("idle");
    }
  };

  const label =
    state === "recording"
      ? "Бичлэгийг зогсоох"
      : state === "transcribing"
        ? "Текст болгож байна"
        : `Дуугаар бичих (${MAX_SECONDS} сек хүртэл)`;

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      aria-pressed={state === "recording"}
      disabled={state === "transcribing"}
      onClick={onClick}
    >
      {state === "recording" ? (
        <IconPlayerStopFilled size={18} />
      ) : state === "transcribing" ? (
        <IconLoader2 size={18} className="dandar:animate-spin" />
      ) : (
        <IconMicrophone size={18} />
      )}
    </button>
  );
};
