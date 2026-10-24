import { DAY_MS } from "./forgettingCurve.ts";
import { type CardState, capToExam } from "./scheduler.ts";

/** Сорилоос өмнө картад хийлгэх давталтын зорилтот тоо. */
export const TARGET_ROUNDS = 4;

/**
 * Сорил ойртох тусам интервалыг богиносгож, сорилоос өмнө дор хаяж
 * TARGET_ROUNDS давталт хийлгэнэ. Давталтыг сорилын өмнөх өдрөөс хэтрүүлэхгүй.
 */
export function applyExam(card: CardState, examAt: number | null, now: number): CardState {
  // On the day before the exam the last review is done; nothing to tighten.
  if (!examAt || now >= examAt - DAY_MS) return card;
  const daysLeft = (examAt - now) / DAY_MS;
  const remaining = Math.max(1, TARGET_ROUNDS - card.reviews);
  const capDays = Math.max(0.1, (daysLeft - 1) / remaining);
  const capped =
    card.reviews < TARGET_ROUNDS
      ? { ...card, dueAt: Math.min(card.dueAt, now + capDays * DAY_MS) }
      : card;
  return capToExam(capped, examAt);
}

export interface ExamProgress {
  daysLeft: number;
  /** Сорилын өдөр санаж байх төсөөлөлт магадлалын дундаж, 0..100. */
  readiness: number;
  /** Зорилтот давталтын биелэлт, 0..100. */
  rounds: number;
}

export function examProgress(cards: CardState[], examAt: number, now: number): ExamProgress {
  const n = cards.length;
  const readiness = n
    ? cards.reduce(
        (s, c) =>
          s +
          (c.lastReviewedAt === null
            ? 0
            : Math.exp(-Math.max(0, examAt - c.lastReviewedAt) / DAY_MS / c.stability)),
        0,
      ) / n
    : 0;
  const rounds = n
    ? cards.reduce((s, c) => s + Math.min(TARGET_ROUNDS, c.reviews), 0) / (n * TARGET_ROUNDS)
    : 0;
  return {
    daysLeft: Math.max(0, Math.ceil((examAt - now) / DAY_MS)),
    readiness: Math.round(readiness * 100),
    rounds: Math.round(rounds * 100),
  };
}
