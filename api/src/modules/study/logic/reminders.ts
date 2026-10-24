import { DAY_MS } from "./forgettingCurve.ts";

export interface ReminderSettings {
  reviewReminder: boolean;
  // Local hour (0–23) the daily review and exam reminders go out.
  reminderHour: number;
  examAlerts: boolean;
  // No notifications from quietStart until quietEnd (local hours).
  quietStart: number;
  quietEnd: number;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  reviewReminder: true,
  reminderHour: 16,
  examAlerts: true,
  quietStart: 21,
  quietEnd: 7,
};

/** Days before an exam that get one reminder each. */
export const EXAM_ALERT_DAYS = [7, 3, 1];

export interface ExamInput {
  deck: string;
  examAt: number;
  readiness: number;
}

export interface PlannedReminder {
  /** Stable for one reminder: the sender stores it so it goes out once. */
  key: string;
  kind: "review" | "exam";
  title: string;
  message: string;
}

export function isQuietHour(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

export function localTime(now: number, tzOffsetMinutes: number) {
  const local = new Date(now + tzOffsetMinutes * 60_000);
  return { hour: local.getUTCHours(), day: local.toISOString().slice(0, 10) };
}

/** True when a reminder could go out this hour; lets the sender skip queries. */
export function isReminderHour(now: number, tzOffsetMinutes: number, settings: ReminderSettings) {
  const { hour } = localTime(now, tzOffsetMinutes);
  return (
    (settings.reviewReminder || settings.examAlerts) &&
    hour === settings.reminderHour &&
    !isQuietHour(hour, settings.quietStart, settings.quietEnd)
  );
}

export const daysUntil = (examAt: number, now: number) => Math.ceil((examAt - now) / DAY_MS);

/**
 * Which reminders a student gets now. Wording only encourages: no streaks,
 * no comparison, and the day before an exam asks for a light review instead
 * of new topics.
 */
export function planReminders({
  now,
  tzOffsetMinutes,
  settings,
  dueCount,
  exams,
}: {
  now: number;
  tzOffsetMinutes: number;
  settings: ReminderSettings;
  dueCount: number;
  exams: ExamInput[];
}): PlannedReminder[] {
  if (!isReminderHour(now, tzOffsetMinutes, settings)) return [];
  const { day } = localTime(now, tzOffsetMinutes);
  const planned: PlannedReminder[] = [];

  if (settings.reviewReminder && dueCount > 0) {
    planned.push({
      key: `review:${day}`,
      kind: "review",
      title: "Давтлагын цаг боллоо",
      message: `${dueCount} карт давтах ээлжтэй (~${Math.max(1, Math.round(dueCount * 0.5))} мин).`,
    });
  }

  if (settings.examAlerts) {
    for (const exam of exams) {
      const days = daysUntil(exam.examAt, now);
      if (!EXAM_ALERT_DAYS.includes(days)) continue;
      planned.push({
        key: `exam:${exam.deck}:${exam.examAt}:${days}`,
        kind: "exam",
        title:
          days === 1
            ? `Маргааш ${exam.deck} шалгалт`
            : `${exam.deck} шалгалтад ${days} хоног үлдлээ`,
        message:
          days === 1
            ? `${exam.readiness}% тогтсон. Шинэ сэдэв нэмэхийн оронд хөнгөн давтаад эрт амраарай.`
            : `${exam.readiness}% тогтсон. Өнөөдрийн давтлага бэлэн байдлыг тань өсгөнө.`,
      });
    }
  }

  return planned;
}
