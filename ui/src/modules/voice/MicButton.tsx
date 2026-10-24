import { useMutation } from "@apollo/client";
import { useRef, useState } from "react";
import { IconLoader2, IconMicrophone, IconPlayerStopFilled } from "@tabler/icons-react";
import { type BrowserDictation, startBrowserDictation } from "./browserDictation";
import { TRANSCRIBE_MUTATION } from "./graphql";
import { MAX_SECONDS, type Recording, startRecording } from "./recordWav";

type Props = {
  onText: (text: string) => void;
  onError: (message: string) => void;
  // true: record WAV and transcribe with Chimege; false: the browser's
  // speech recognition (no Chimege token).
  useChimege: boolean;
  className?: string;
  label?: string;
};

// Click to start, click again to stop; the Mongolian speech comes back as text.
export const MicButton = ({ onText, onError, useChimege, className, label }: Props) => {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const recording = useRef<Recording | null>(null);
  const dictation = useRef<BrowserDictation | null>(null);
  const [transcribe] = useMutation(TRANSCRIBE_MUTATION);

  const start = async () => {
    try {
      if (useChimege) {
        recording.current = await startRecording();
      } else {
        dictation.current = startBrowserDictation(onError);
      }
      setState("recording");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Микрофоныг нээж чадсангүй");
    }
  };

  const stop = async () => {
    setState("transcribing");
    try {
      let text = "";
      if (dictation.current) {
        text = await dictation.current.stop();
      } else {
        const audioData = await recording.current?.stop();
        if (audioData) {
          const result = await transcribe({ variables: { audioData } });
          text = result.data?.dandarTranscribe.trim() ?? "";
        }
      }
      if (text) {
        onText(text);
      } else {
        onError("Яриа танигдсангүй. Дахин ойроос, тодорхой ярина уу.");
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Яриаг текст болгож чадсангүй");
    } finally {
      recording.current = null;
      dictation.current = null;
      setState("idle");
    }
  };

  const onClick = () => {
    if (state === "idle") void start();
    else if (state === "recording") void stop();
  };

  const title =
    state === "recording"
      ? "Бичлэгийг зогсоох"
      : state === "transcribing"
        ? "Текст болгож байна"
        : `Дуугаар бичих${useChimege ? ` (${MAX_SECONDS} сек хүртэл)` : ""}`;

  return (
    <button
      type="button"
      className={className}
      aria-label={title}
      title={title}
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
      {label ? <span>{state === "recording" ? "Зогсоох" : label}</span> : null}
    </button>
  );
};
