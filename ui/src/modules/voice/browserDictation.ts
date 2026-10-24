// Fallback speech-to-text when Chimege has no token: the browser's Web
// Speech API (Chrome and Edge send the audio to their own service). Typed
// locally because the API is not in TypeScript's DOM library.
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionConstructor = new () => Recognition;

const getConstructor = () => {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };

  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
};

export const browserDictationSupported = () =>
  typeof window !== "undefined" && Boolean(getConstructor());

const ERRORS: Record<string, string> = {
  "not-allowed": "Микрофоны зөвшөөрөл өгөөгүй байна.",
  "no-speech": "Яриа сонсогдсонгүй. Дахин оролдоно уу.",
  "language-not-supported": "Энэ browser монгол яриа танихгүй байна.",
  network: "Яриа таних үйлчилгээнд холбогдож чадсангүй.",
};

export type BrowserDictation = { stop: () => Promise<string> };

export const startBrowserDictation = (onError: (message: string) => void): BrowserDictation => {
  const Constructor = getConstructor();
  if (!Constructor) {
    throw new Error("Энэ browser яриа таних боломжгүй. Chrome эсвэл Edge ашиглана уу.");
  }
  const recognition = new Constructor();
  recognition.lang = "mn-MN";
  recognition.continuous = true;
  recognition.interimResults = false;

  let text = "";
  let finish: (value: string) => void = () => undefined;
  const ended = new Promise<string>((resolve) => {
    finish = resolve;
  });
  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result?.isFinal) text += `${result[0].transcript} `;
    }
  };
  recognition.onerror = (event) => onError(ERRORS[event.error] ?? `Яриа таних алдаа: ${event.error}`);
  recognition.onend = () => finish(text.trim());
  recognition.start();

  return {
    stop: () => {
      recognition.stop();
      return ended;
    },
  };
};
