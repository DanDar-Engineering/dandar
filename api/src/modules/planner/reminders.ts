import type { PlannerState } from "./contract.ts";
export type ReminderItem = {
  id: string;
  notificationId: string;
  taskId: string;
  blockId?: string;
  kind: "deadline" | "session";
  dueAt: string;
  expiresAt: string;
  snoozedUntil?: string;
};
export function reminderItems(state: PlannerState): ReminderItem[] {
  const items: ReminderItem[] = [];
  const lead = state.preferences.sessionReminderMinutes ?? 15;
  for (const task of state.tasks.filter((t) => t.status !== "completed")) {
    for (const m of new Set(task.reminders)) {
      const id = `${task.id}:${task.deadline}:${m}`;
      items.push({
        id,
        notificationId: id,
        taskId: task.id,
        kind: "deadline",
        dueAt: new Date(Date.parse(task.deadline) - m * 60000).toISOString(),
        expiresAt: new Date(Date.parse(task.deadline) + 86400000).toISOString(),
      });
    }
    for (const b of state.blocks.filter((b) => b.taskId === task.id && b.status === "planned")) {
      const id = `session:${b.id}:${b.start}:${lead}`;
      items.push({
        id,
        notificationId: id,
        taskId: task.id,
        blockId: b.id,
        kind: "session",
        dueAt: new Date(Date.parse(b.start) - lead * 60000).toISOString(),
        expiresAt: b.end,
      });
    }
  }
  return items
    .filter((r) => !(state.dismissed ?? []).includes(r.id))
    .map((r) => {
      const snooze = state.snoozed?.find((s) => s.id === r.id);
      return snooze
        ? {
            ...r,
            dueAt: snooze.until,
            snoozedUntil: snooze.until,
            notificationId: `${r.id}:snooze:${snooze.until}`,
          }
        : r;
    });
}
export const dueReminders = (state: PlannerState, now = Date.now()) =>
  reminderItems(state).filter((r) => Date.parse(r.dueAt) <= now && now < Date.parse(r.expiresAt));
export function quietHours(state: PlannerState, now = Date.now()) {
  const p = state.preferences;
  const h = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: p.timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(now)),
  );
  return p.quietStart === p.quietEnd
    ? false
    : p.quietStart < p.quietEnd
      ? h >= p.quietStart && h < p.quietEnd
      : h >= p.quietStart || h < p.quietEnd;
}
