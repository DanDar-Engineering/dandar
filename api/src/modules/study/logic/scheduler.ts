import { DAY_MS, intervalForRetention, retrievability } from "./forgettingCurve.ts";

/** Сурагчийн өөрийн үнэлгээ: "мэднэ" / "эргэлзэж байна" / "мартсан" */
export type Grade = "easy" | "know" | "unsure" | "forgot";

export interface CardState {
  id: string;
  topicId: string;
  stability: number; // өдөр
  lapses: number; // мартсан тоо
  reviews: number;
  lastReviewedAt: number | null; // ms
  dueAt: number; // ms
}

export interface SchedulerOptions {
  targetRetention: number; // давтах босго, анхдагч 0.9
  initialStability: number; // шинэ картын stability (өдөр)
  minStability: number;
  maxIntervalDays: number;
}

export const DEFAULT_OPTIONS: SchedulerOptions = {
  targetRetention: 0.9,
  initialStability: 1,
  minStability: 0.5,
  maxIntervalDays: 180,
};

export function newCard(
  id: string,
  topicId: string,
  now: number,
  opts = DEFAULT_OPTIONS,
): CardState {
  return {
    id,
    topicId,
    stability: opts.initialStability,
    lapses: 0,
    reviews: 0,
    lastReviewedAt: null,
    dueAt: now,
  };
}

const GROWTH: Record<Grade, number> = { easy: 3.5, know: 2.5, unsure: 1.3, forgot: 0.3 };

/**
 * Давталтын дараа stability шинэчилж, дараагийн огноог товлоно.
 * Хугацаанаасаа өмнө давтсан бол өсөлт багасна, хоцорч мэдсэн бол илүү өснө.
 */
export function review(
  card: CardState,
  grade: Grade,
  now: number,
  opts = DEFAULT_OPTIONS,
): CardState {
  const elapsed = card.lastReviewedAt === null ? 0 : (now - card.lastReviewedAt) / DAY_MS;
  const r = card.lastReviewedAt === null ? 1 : retrievability(elapsed, card.stability);

  let stability: number;
  if (grade === "forgot") {
    stability = Math.max(opts.minStability, card.stability * GROWTH.forgot);
  } else {
    // r бага үед (хэтэрхий хоцорсон ч мэдсэн) өсөлт их; r өндөр үед (эрт давтсан) бага.
    const spacingBonus = 1 + (1 - r);
    const growth = 1 + (GROWTH[grade] - 1) * spacingBonus;
    stability = card.stability * growth;
  }

  const days = Math.min(
    opts.maxIntervalDays,
    intervalForRetention(stability, opts.targetRetention),
  );
  // "forgot" бол тухайн өдөртөө дахин нэг удаа харуулна.
  const dueAt = grade === "forgot" ? now + 10 * 60_000 : now + days * DAY_MS;

  return {
    ...card,
    stability,
    lapses: card.lapses + (grade === "forgot" ? 1 : 0),
    reviews: card.reviews + 1,
    lastReviewedAt: now,
    dueAt,
  };
}

/**
 * Шалгалтын огноотой уялдуулах:
 *  - шалгалтаас хойш товлогдохоос сэргийлж, өмнөх өдөр хүртэл богиносгоно;
 *  - шалгалтын өмнөх өдөр шинэ карт биш, хөнгөн сэргээн сануулалт хийхээр тэмдэглэнэ.
 */
export function capToExam(card: CardState, examAt: number): CardState {
  const lastBeforeExam = examAt - DAY_MS;
  return card.dueAt > lastBeforeExam
    ? { ...card, dueAt: Math.max(lastBeforeExam, card.lastReviewedAt ?? 0) }
    : card;
}

export function dueCards(cards: CardState[], now: number): CardState[] {
  return cards
    .filter((c) => c.dueAt <= now)
    .sort((a, b) => retrievabilityOf(a, now) - retrievabilityOf(b, now));
}

export function retrievabilityOf(card: CardState, now: number): number {
  if (card.lastReviewedAt === null) return 0;
  return retrievability((now - card.lastReviewedAt) / DAY_MS, card.stability);
}
