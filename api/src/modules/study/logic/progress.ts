import { DAY_MS } from "./forgettingCurve.ts";

export interface ReviewEvent {
  at: number;
  grade: string;
}

export interface DayActivity {
  date: string;
  reviewed: number;
  // Reviews graded know or easy (or a right quiz answer).
  remembered: number;
}

export interface DayForecast {
  date: string;
  due: number;
}

const localDay = (at: number, tzOffsetMinutes: number) =>
  new Date(at + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);

const lastDays = (now: number, tzOffsetMinutes: number, days: number, direction: 1 | -1) =>
  Array.from({ length: days }, (_, i) =>
    localDay(now + direction * (direction === 1 ? i : days - 1 - i) * DAY_MS, tzOffsetMinutes),
  );

const REMEMBERED = new Set(["know", "easy"]);

/** Reviews per local day for the last `days` days, oldest first. */
export function dailyActivity(
  events: ReviewEvent[],
  now: number,
  tzOffsetMinutes: number,
  days = 7,
): DayActivity[] {
  const result = lastDays(now, tzOffsetMinutes, days, -1).map((date) => ({
    date,
    reviewed: 0,
    remembered: 0,
  }));
  const byDate = new Map(result.map((day) => [day.date, day]));
  for (const event of events) {
    const day = byDate.get(localDay(event.at, tzOffsetMinutes));
    if (!day) continue;
    day.reviewed += 1;
    if (REMEMBERED.has(event.grade)) day.remembered += 1;
  }
  return result;
}

/** Cards coming due per local day for the next `days` days; overdue cards count today. */
export function dueForecast(
  dueTimes: number[],
  now: number,
  tzOffsetMinutes: number,
  days = 7,
): DayForecast[] {
  const result = lastDays(now, tzOffsetMinutes, days, 1).map((date) => ({ date, due: 0 }));
  const byDate = new Map(result.map((day) => [day.date, day]));
  const today = result[0];
  for (const dueAt of dueTimes) {
    const day = dueAt <= now ? today : byDate.get(localDay(dueAt, tzOffsetMinutes));
    if (day) day.due += 1;
  }
  return result;
}
