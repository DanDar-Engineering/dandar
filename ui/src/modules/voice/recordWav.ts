// Chimege transcribes 16 kHz mono WAV. Browsers record WebM/Opus, so the
// recording is decoded, resampled and re-encoded as 16-bit PCM WAV here.
const SAMPLE_RATE = 16_000;
export const MAX_SECONDS = 30;
// Mirrors MAX_AUDIO_CHARS in api/src/graphql/voice.ts.
export const MAX_AUDIO_CHARS = 1_400_000;

const encodeWav = (samples: Float32Array) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });

  return buffer;
};

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }

  return btoa(binary);
};

const toWavBase64 = async (blob: Blob) => {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const length = Math.ceil(decoded.duration * SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, length, SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();

    return toBase64(encodeWav(rendered.getChannelData(0)));
  } finally {
    await context.close();
  }
};

export type Recording = {
  // Stops the microphone and resolves with base64 WAV.
  stop: () => Promise<string>;
};

export const startRecording = async (): Promise<Recording> => {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new Error("Энэ browser микрофоноор бичлэг хийж чадахгүй байна.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => chunks.push(event.data);

  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType }));
    };
  });
  const limit = setTimeout(() => recorder.state === "recording" && recorder.stop(), MAX_SECONDS * 1000);
  recorder.start();

  return {
    stop: async () => {
      clearTimeout(limit);
      if (recorder.state === "recording") {
        recorder.stop();
      }
      const wav = await toWavBase64(await stopped);
      if (wav.length > MAX_AUDIO_CHARS) {
        throw new Error(`Бичлэг ${MAX_SECONDS} секундээс урт байна.`);
      }

      return wav;
    },
  };
};
