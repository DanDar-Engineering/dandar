import { z } from "zod";
import { type AiImage, askGemma } from "../ai/gemma.ts";
import { SCAN_KINDS, type ScanKind } from "./constants.ts";

// Step 1 only transcribes: asking for classification in the same call makes
// the model paraphrase instead of copying the handwriting.
const OCR_SYSTEM_PROMPT = [
  "You are an OCR engine for Mongolian school documents.",
  "The text is Mongolian Cyrillic (including Ө and Ү), sometimes with Latin words, handwritten or printed.",
  "Copy the text exactly as written, line by line, keeping the original line breaks.",
  "Never translate, correct or complete the text, and never switch Cyrillic letters to Latin.",
  "Write [?] for a word you cannot read. Ignore notebook grid lines and page decorations.",
  "Output only the transcription. If there is no text, output nothing.",
].join(" ");

const OCR_PROMPT = "Энэ зураг дээрх бүх текстийг мөр мөрөөр нь яг бичигдсэнээр нь хуулж бич.";

// Step 2 sees the photo again, so it can tell handwriting from print and
// fix obvious misreadings when it summarizes.
const CLASSIFY_SYSTEM_PROMPT = [
  "You sort study materials that Mongolian school students photograph.",
  'kind "note": the student\'s own notes, class notes, a lecture or reading summary.',
  'kind "exam": exam or test questions, quizzes, answer sheets, exam schedules or exam instructions from a teacher.',
  'kind "other": anything else.',
  "Reply with one JSON object and nothing else:",
  '{"kind": "note" | "exam" | "other", "title": string, "subject": string, "summary": string, "confidence": "high" | "low"}.',
  'confidence: "low" when the photo is hard to read or the kind is a guess.',
  "title: at most 80 characters in Mongolian. subject: the school subject in Mongolian, or an empty string.",
  'summary: for "note", 3–5 short Mongolian bullet points ("- ...") of the key ideas; otherwise an empty string.',
  "Use the photo to correct obvious transcription mistakes in the summary, but never invent content.",
].join(" ");

const classificationSchema = z.object({
  kind: z.enum(SCAN_KINDS).catch("other"),
  title: z.string().catch(""),
  subject: z.string().catch(""),
  summary: z.string().catch(""),
  confidence: z.enum(["high", "low"]).catch("low"),
});

export type ScanReading = {
  text: string;
  kind: ScanKind;
  title: string;
  subject?: string;
  summary?: string;
  // false when Gemma was unsure of the kind or marked unreadable words [?];
  // the UI asks the student to check those fields before saving.
  confident: boolean;
};

export class EmptyScanError extends Error {}

const TITLE_MAX_LENGTH = 80;

// Models sometimes wrap JSON in ```json fences or add a sentence around it.
const parseClassification = (answer: string) => {
  const json = answer.match(/\{[\s\S]*\}/)?.[0];
  if (!json) {
    return classificationSchema.parse({});
  }
  try {
    return classificationSchema.parse(JSON.parse(json));
  } catch {
    return classificationSchema.parse({});
  }
};

export const readScan = async (image: AiImage): Promise<ScanReading> => {
  const { text: rawText } = await askGemma(OCR_PROMPT, OCR_SYSTEM_PROMPT, {
    image,
    temperature: 0,
  });
  const text = rawText.replace(/^```\w*\n?|\n?```$/g, "").trim();

  if (!text) {
    throw new EmptyScanError("Зурган дээр текст олдсонгүй");
  }

  const { text: answer } = await askGemma(
    `Зурагнаас уншсан текст:\n"""\n${text}\n"""`,
    CLASSIFY_SYSTEM_PROMPT,
    { image, temperature: 0 },
  );
  const { kind, title, subject, summary, confidence } = parseClassification(answer);
  const fallbackTitle = text.split("\n")[0] ?? "";

  return {
    text,
    kind,
    title: (title.trim() || fallbackTitle).slice(0, TITLE_MAX_LENGTH),
    subject: subject.trim() || undefined,
    summary: kind === "note" ? summary.trim() || undefined : undefined,
    confident: confidence === "high" && !text.includes("[?]"),
  };
};
